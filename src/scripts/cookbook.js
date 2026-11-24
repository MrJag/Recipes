"use strict";
// Browser-only print layout. No external services, tracking, or publishing.
const ROOT = document.documentElement;
const pagesEl = document.getElementById("pages");
const statusEl = document.getElementById("status");
const byId = id => document.getElementById(id);
let currentRecipe = null;
let sourceRecipe = null;
let lastPageCount = 0;
let renderPending = false;
let loadSequence = 0;
let photoWarning = "";
// Decode each recipe photo once. Pagination can rebuild sheets repeatedly,
// but the browser must never hide an image that has already loaded.
const photoCache = new Map();
function photoState(url) {
  let cached = photoCache.get(url);
  if (cached) return cached;
  cached = {loaded:false,failed:false,listeners:new Set()};
  photoCache.set(url,cached);
  const preload = new Image();
  preload.onload = () => {
    cached.loaded = true;
    for (const listener of cached.listeners) listener(true);
    cached.listeners.clear();
  };
  preload.onerror = () => {
    cached.failed = true;
    for (const listener of cached.listeners) listener(false);
    cached.listeners.clear();
  };
  preload.src = url;
  if (preload.complete && preload.naturalWidth) preload.onload();
  return cached;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}
function makeHeading(title) {
  return el("h2", "section-heading", title);
}
function pageShell(index, recipe) {
  const displayPhoto = index === 0 && byId("printMode").value !== "none";
  const page = el("article", "sheet" + (displayPhoto ? " has-photo" : ""));
  page.setAttribute("aria-label", "Recipe page " + (index + 1));
  const content = el("div", "content");
  if (displayPhoto) {
    const strip = el("aside", "photo-strip");
    strip.setAttribute("aria-label", recipe.photo ? "Recipe photograph" : "Photograph placeholder");
    const placeholder = el("div", "photo-placeholder");
    placeholder.appendChild(el("span", null, recipe.photo ? "IMAGE LOADING · PHOTO PREVIEW" : "PHOTO PLACEHOLDER · ORIGINAL IMAGE NEEDED"));
    strip.appendChild(placeholder);
    if (recipe.photo) {
      // Show a readable fallback if an asset is missing or still awaiting upload.
      const photo = el("img", "strip-image");
      photo.alt = "";
      photo.decoding = "async";
      const state = photoState(recipe.photo);
      // A loaded image is shown immediately, even after a layout rebuild.
      photo.hidden = !state.loaded;
      photo.src = recipe.photo;
      if (!state.loaded && !state.failed) {
        const reveal = ok => {
          if (photo.isConnected) photo.hidden = !ok;
        };
        state.listeners.add(reveal);
      }
      strip.appendChild(photo);
    }
    page.appendChild(strip);
  } else if (index > 0) {
    content.appendChild(el("div", "running-head", recipe.title + " · continued"));
  }
  page.appendChild(content);
  page.appendChild(el("div", "page-num", String(index + 1)));
  pagesEl.appendChild(page);
  return { page, content, index, steps: null };
}
function addDraftBadge(element, status) {
  if (status === "draft") element.append(" ", el("span", "draft-badge", "Draft"));
}

function normalizedRating(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}
function ratingDisplay(value, className="recipe-rating") {
  const rating = normalizedRating(value);
  const container = el("div", className + (!rating ? " unrated" : ""));
  const stars = el("span", "rating-glyphs", rating ? "★".repeat(rating) + "☆".repeat(5-rating) : "☆☆☆☆☆");
  stars.setAttribute("aria-hidden","true");
  container.appendChild(stars);
  container.appendChild(el("span", "rating-label", rating ? rating + " of 5" : "Unrated"));
  container.setAttribute("aria-label", rating ? "Recipe rating: " + rating + " of 5 stars" : "Recipe not yet rated");
  return container;
}
function buildHeader(recipe) {
  const wrap = el("header", "recipe-header");
  const category = el("div", "category", (recipe.category || "Recipes").toUpperCase());
  addDraftBadge(category, recipe.status);
  wrap.appendChild(category);
  wrap.appendChild(el("h1", null, recipe.title));
  if (recipe.subtitle) wrap.appendChild(el("div", "subtitle", "(" + recipe.subtitle + ")"));
  wrap.appendChild(ratingDisplay(recipe.rating));
  const bits = [];
  if (recipe.servings) bits.push("SERVES " + recipe.servings);
  if (recipe.prepTime) bits.push("PREP " + recipe.prepTime);
  if (recipe.cookTime) bits.push("COOK " + recipe.cookTime);
  if (bits.length) wrap.appendChild(el("div", "metadata", bits.join("   |   ")));
  if (recipe.headnote) wrap.appendChild(el("p", "headnote", recipe.headnote));
  return wrap;
}
function allIngredientGroups(recipe) {
  const groups = [...(recipe.ingredientGroups || [])];
  for (const component of recipe.components || []) {
    for (const group of component.ingredientGroups || []) {
      groups.push({title: group.title ? component.title + " — " + group.title : component.title, items: group.items || []});
    }
  }
  return groups;
}
function buildIngredients(groups) {
  const wrap = el("section", "ingredients");
  wrap.appendChild(makeHeading("Ingredients"));
  if (!Array.isArray(groups)) return wrap;
  const single = groups.length === 1 && !groups[0].title;
  if (single) {
    const ul = el("ul");
    for (const item of groups[0].items || []) ul.appendChild(el("li", null, item));
    wrap.classList.add(groups[0].items?.length >= 9 ? "two-column" : "one-column");
    wrap.appendChild(ul);
  } else {
    wrap.classList.add("grouped");
    const columns = el("div", "ingredient-groups");
    for (const group of groups) {
      const section = el("div", "ingredient-group");
      if (group.title) section.appendChild(el("h3", null, group.title));
      const ul = el("ul");
      for (const item of group.items || []) ul.appendChild(el("li", null, item));
      section.appendChild(ul);
      columns.appendChild(section);
    }
    wrap.appendChild(columns);
  }
  return wrap;
}
function stepNode(step, number) {
  const li = el("li", "recipe-step");
  const num = el("span", "step-num", number);
  num.setAttribute("aria-hidden", "true");
  const copy = el("div", "step-copy");
  const value = typeof step === "string" ? step : (step?.text || "");
  if (typeof step === "object" && step?.lead) {
    copy.appendChild(el("strong", null, step.lead + " "));
  }
  copy.appendChild(document.createTextNode(value));
  li.append(num, copy);
  li.setAttribute("aria-label", "Step " + number + ": " + (step?.lead ? step.lead + " " : "") + value);
  return li;
}
function ensureSteps(page) {
  if (!page.steps) {
    page.content.appendChild(makeHeading("Directions"));
    page.steps = el("ol", "steps");
    page.content.appendChild(page.steps);
  }
}
function applicationNode(app) {
  const section = el("section", "related-section");
  section.appendChild(el("h3", null, app.title));
  for (const group of app.ingredientGroups || []) {
    if (group.title) section.appendChild(el("strong", null, group.title));
    const ul = el("ul");
    for (const item of group.items || []) ul.appendChild(el("li", null, item));
    section.appendChild(ul);
  }
  if (app.method) section.appendChild(el("p", null, app.method));
  return section;
}
function buildSourceNote(note) {
  const node = el("p", "source");
  node.style.overflowWrap = "anywhere";
  let offset = 0;
  for (const match of note.matchAll(/https?:\/\/[^\s<>"“”]+/gi)) {
    const url = match[0].replace(/[.,;:!?]+$/, "");
    node.append(note.slice(offset, match.index));
    const link = el("a", null, url);
    link.href = url;
    node.appendChild(link);
    offset = match.index + url.length;
  }
  node.append(note.slice(offset));
  return node;
}
function fits(page) {
  // An explicitly sized, non-shrinking content region provides actual print-page bounds.
  return page.content.scrollHeight <= page.content.clientHeight + 1;
}
function attachWithFit(page, node) {
  page.content.appendChild(node);
  if (!fits(page)) {
    node.remove();
    return false;
  }
  return true;
}
function setLayout(density) {
  const stepGap = Number(byId("stepGap").value);
  const fontSize = Number(byId("fontSize").value);
  ROOT.style.setProperty("--step-gap", Math.max(3, stepGap - density * 2) + "px");
  ROOT.style.setProperty("--body-size", Math.max(9, fontSize - density * 0.15) + "pt");
  ROOT.style.setProperty("--section-gap", (13 - density * 2) + "px");
  const photoFraction = Number(byId("photoWidth").value) / 100;
  ROOT.style.setProperty("--strip-fraction", photoFraction.toFixed(2));
  ROOT.style.setProperty("--photo-width", ((8.5 - 2 * 0.38) * photoFraction).toFixed(3) + "in");
  document.body.classList.toggle("commercial", byId("printMode").value === "commercial");
  document.body.classList.toggle("no-print-photo", byId("printMode").value === "none");
}
function paginate(recipe, density) {
  setLayout(density);
  pagesEl.replaceChildren();
  let page = pageShell(0, recipe);
  const header = buildHeader(recipe);
  const ingredients = buildIngredients(allIngredientGroups(recipe));
  page.content.append(header, ingredients);
  let overflow = !fits(page);
  // Ingredient Notes are optional and follow Ingredients, not the Directions
  // footer. Each note can flow onto another page without being dropped.
  const ingredientNotes = Array.isArray(recipe.ingredientNotes)
    ? recipe.ingredientNotes.filter(note => typeof note === "string" && note.trim())
    : [];
  if (ingredientNotes.length) {
    let list = null;
    let notesSection = null;
    let placedNotes = 0;
    const makeNotesSection = (continued=false) => {
      notesSection = el("section", "ingredient-notes");
      notesSection.appendChild(makeHeading(continued ? "Ingredient Notes · continued" : "Ingredient Notes"));
      list = el("ul");
      notesSection.appendChild(list);
      page.content.appendChild(notesSection);
    };
    makeNotesSection();
    for (const note of ingredientNotes) {
      const item = el("li", null, note);
      list.appendChild(item);
      if (!fits(page)) {
        item.remove();
        if (!list.children.length) notesSection.remove();
        page = pageShell(pagesEl.children.length, recipe);
        makeNotesSection(placedNotes > 0);
        list.appendChild(item);
        overflow ||= !fits(page);
      }
      placedNotes++;
    }
  }
  // Inline direction headings are represented as {heading:"..."} within
  // steps. Convert them into display stages without numbering headings or
  // changing any pre-existing component sections.
  const mainStages = [];
  let currentStage = {title:recipe.components?.length ? "Main method" : null,steps:[]};
  for (const step of recipe.steps || []) {
    if (step && typeof step === "object" && typeof step.heading === "string") {
      if (currentStage.steps.length || currentStage.title) mainStages.push(currentStage);
      currentStage = {title:step.heading,steps:[]};
    } else {
      currentStage.steps.push(step);
    }
  }
  if (currentStage.steps.length || currentStage.title) mainStages.push(currentStage);
  const stages = [
    ...(recipe.components || []).map(c => ({title:c.title, steps:c.steps || [], note:c.notes})),
    ...mainStages
  ];
  let stepNo = 1;
  for (const stage of stages) {
    if (recipe.restartStepNumbersPerSection) stepNo = 1;
    let pendingHeading = stage.title ? el("li", "stage-heading", stage.title) : null;
    for (const step of stage.steps) {
      ensureSteps(page);
      const stepElement = stepNode(step, stepNo++);
      if (pendingHeading) page.steps.appendChild(pendingHeading);
      page.steps.appendChild(stepElement);
      if (!fits(page)) {
        stepElement.remove();
        if (pendingHeading) pendingHeading.remove();
        // Never leave an empty Directions heading at the bottom of a page.
        if (page.steps && page.steps.children.length === 0) {
          const list = page.steps;
          const heading = list.previousElementSibling;
          list.remove();
          if (heading?.classList.contains("section-heading")) heading.remove();
          page.steps = null;
        }
        page = pageShell(pagesEl.children.length, recipe);
        ensureSteps(page);
        if (pendingHeading) page.steps.appendChild(pendingHeading);
        page.steps.appendChild(stepElement);
        overflow ||= !fits(page);
      }
      pendingHeading = null;
    }
    if (pendingHeading) {
      ensureSteps(page);
      if (!attachWithFit(page, pendingHeading)) {
        page = pageShell(pagesEl.children.length, recipe);
        ensureSteps(page);
        page.steps.appendChild(pendingHeading);
        overflow ||= !fits(page);
      }
    }
    if (stage.note) {
      const note = el("p", "component-note", stage.note);
      if (!attachWithFit(page, note)) {
        page = pageShell(pagesEl.children.length, recipe);
        page.content.appendChild(note);
        overflow ||= !fits(page);
      }
    }
  }
  for (const app of recipe.relatedApplications || []) {
    const node = applicationNode(app);
    if (!attachWithFit(page, node)) {
      page = pageShell(pagesEl.children.length, recipe);
      page.content.appendChild(node);
      overflow ||= !fits(page);
    }
  }
  if (recipe.sourceNote) {
    const node = buildSourceNote(recipe.sourceNote);
    if (!attachWithFit(page, node)) {
      page = pageShell(pagesEl.children.length, recipe);
      page.content.appendChild(node);
      overflow ||= !fits(page);
    }
  }
  return {pages:pagesEl.children.length, overflow};
}
function tinySpill() {
  if (pagesEl.children.length < 2) return false;
  const last = pagesEl.lastElementChild;
  const steps = [...last.querySelectorAll(".steps > li:not(.stage-heading)")];
  if (last.querySelector(".related-section") || last.querySelector(".component-note")) return false;
  const source = last.querySelector(".source");
  if (steps.length > 1) return false;
  const pxLine = Number(byId("fontSize").value) * 96 / 72 * 1.3;
  const remainingHeight = steps.reduce((n, element) => n + element.offsetHeight, 0) + (source ? source.offsetHeight : 0);
  return remainingHeight > 0 && remainingHeight <= pxLine * 2.5;
}
function render(recipe) {
  const balanced = paginate(recipe, 0);
  let result = balanced;
  let density = 0;
  // Preserve the balanced layout unless a small spacing change actually saves a page.
  if (!balanced.overflow && balanced.pages > 1 && tinySpill()) {
    for (const trial of [1, 2]) {
      const candidate = paginate(recipe, trial);
      if (!candidate.overflow && candidate.pages < balanced.pages) {
        result = candidate;
        density = trial;
        break;
      }
    }
    if (density === 0) result = paginate(recipe, 0);
  }
  lastPageCount = result.pages;
  if (result.overflow) {
    const warning = el("div", "overflow-warning",
      "Some recipe content exceeds a page. The source is intact; choose a smaller photo width or font, or review this layout.");
    statusEl.replaceChildren(warning);
  } else {
    statusEl.textContent = recipe.title + " · " + result.pages + " page(s) · photo on page 1 only · " +
      (density ? "auto-tightened to avoid spillover" : "balanced layout") + (photoWarning ? " · ⚠ " + photoWarning : "");
  }
  return result;
}
function requestRender() {
  if (!currentRecipe || window.CookbookEditor?.active || renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    if (currentRecipe && !window.CookbookEditor?.active) {
      pagesEl.classList.add("measuring");
      try {
        render(currentRecipe);
        byId("printButton").disabled = false;
      } finally {
        pagesEl.classList.remove("measuring");
      }
    }
  });
}
async function loadRecipe(button) {
  const requestId = ++loadSequence;
  const file = button.dataset.recipe;
  window.CookbookEditor?.close({discard:true});
  currentRecipe = null;
  window.CookbookRating?.reset();
  pagesEl.replaceChildren();
  byId("printButton").disabled = true;
  sidebar.querySelector("[aria-current]")?.removeAttribute("aria-current");
  sidebar.querySelector(".recipe-versions")?.remove();
  button.setAttribute("aria-current", "page");
  revealSelectedRecipe(button);
  statusEl.textContent = "Loading " + file + " …";
  try {
    const response = await fetch("./" + file, {cache:"no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const recipe = await response.json();
    if (requestId !== loadSequence) return; // Ignore stale responses from previous selections.
    if (!recipe.title || !Array.isArray(recipe.ingredientGroups) || !Array.isArray(recipe.steps)) throw new Error("Invalid recipe structure");
    sourceRecipe = recipe;
    photoWarning = "";
    if (recipe.photo) {
      const probe = new Image();
      probe.onload = () => {
        if (requestId !== loadSequence) return;
        photoWarning = probe.naturalWidth < 250 ? "Photo is low resolution (" + probe.naturalWidth + "px wide)" : "";
        requestRender();
      };
      probe.onerror = () => {
        if (requestId !== loadSequence) return;
        photoWarning = "Photo failed to load";
        requestRender();
      };
      probe.src = recipe.photo;
    }
    setupVariants(recipe, button);
  } catch (error) {
    if (requestId !== loadSequence) return;
    statusEl.textContent = "Unable to load recipe: " + error.message + ". Run a local HTTP server; opening index.html directly may block JSON fetches.";
  }
}
function setupVariants(recipe, recipeButton) {
  if (!recipe.variants?.length) {
    selectRecipeVersion(-1);
    return;
  }

  const initialIndex = recipe.defaultVariant === -1 ? -1 : 0;
  const versions = el("div", "recipe-versions");
  versions.setAttribute("role", "group");
  versions.setAttribute("aria-label", recipeButton.textContent + " versions");
  const versionsToShow = [{title: "Original", status: recipe.status}, ...recipe.variants];
  versionsToShow.forEach(({title, status}, position) => {
    const index = position - 1;
    const button = el("button", null, title);
    button.type = "button";
    addDraftBadge(button, status);
    button.setAttribute("aria-pressed", String(index === initialIndex));
    button.addEventListener("click", () => {
      versions.querySelector('[aria-pressed="true"]').setAttribute("aria-pressed", "false");
      button.setAttribute("aria-pressed", "true");
      selectRecipeVersion(index);
    });
    versions.appendChild(button);
  });
  recipeButton.after(versions);
  selectRecipeVersion(initialIndex);
}
let activeVariantIndex = -1;
function selectRecipeVersion(index) {
  window.CookbookEditor?.close({discard:true});
  activeVariantIndex = index;
  const variant = sourceRecipe?.variants?.[index];
  currentRecipe = variant ? {
    ...sourceRecipe,
    ...variant,
    title: variant.title,
    status: variant.status,
    category: sourceRecipe.category,
    sourceDriveUrl: sourceRecipe.sourceDriveUrl,
    sourceNote: variant.sourceNote || sourceRecipe.sourceNote || "Original source document"
  } : sourceRecipe;
  document.title = currentRecipe.title + " | Family Cookbook";
  window.CookbookRating?.sync(currentRecipe.rating);
  requestRender();
}
const sidebar = document.querySelector(".recipe-sidebar");
const recipeIndex = byId("recipeIndex");
const recipeView = byId("recipeView");
const printMenu = byId("printMenu");
const recipeLinks = new Map();
const catalogLinks = new Map();
const recipeCount = recipeIndex.querySelectorAll(".recipe-outline a[data-recipe]").length;
byId("recipeCount").textContent = `${recipeCount} ${recipeCount === 1 ? "recipe" : "recipes"}`;

// Maintain a single recipe catalog. The landing page and recipe sidebar share
// the same taxonomy so a recipe cannot appear under different category trees.
for (const link of recipeIndex.querySelectorAll(".recipe-outline a[data-recipe]")) {
  const slug = new URL(link.href).searchParams.get("recipe");
  if (!slug || catalogLinks.has(slug)) continue;
  addDraftBadge(link, link.dataset.status);
  catalogLinks.set(slug, link);
}

function addSidebarLink(link, container, slug) {
  const sidebarLink = link.cloneNode(true);
  sidebarLink.removeAttribute("aria-current");
  sidebarLink.classList.add("sidebar-recipe-link");
  // The source link already contains its draft badge.
  recipeLinks.set(slug, sidebarLink);
  container.appendChild(sidebarLink);
}

function buildSidebarFallback() {
  for (const category of recipeIndex.querySelectorAll(".recipe-outline section")) {
    const group = el("details", "sidebar-category");
    group.appendChild(el("summary", null, category.querySelector("h2").textContent));
    for (const link of category.querySelectorAll("a[data-recipe]")) {
      const slug = new URL(link.href).searchParams.get("recipe");
      addSidebarLink(link, group, slug);
    }
    sidebar.appendChild(group);
  }
}

async function buildSidebar() {
  const response = await fetch("./src/data/recipe-taxonomy.json", {cache: "no-cache"});
  if (!response.ok) throw new Error("Could not load recipe categories");
  const taxonomy = await response.json();
  const fragment = document.createDocumentFragment();
  const assigned = new Set();
  for (const category of taxonomy.groups) {
    const group = el("details", "sidebar-category");
    const heading = el("summary", "sidebar-category-title");
    heading.appendChild(el("span", null, category.name));
    const groupCount = el("span", "sidebar-count");
    heading.appendChild(groupCount);
    group.appendChild(heading);
    let count = 0;
    for (const subcategory of category.subcategories) {
      const subgroup = el("details", "sidebar-subcategory");
      const subheading = el("summary", "sidebar-subcategory-title");
      subheading.appendChild(el("span", null, subcategory.label));
      const subcount = el("span", "sidebar-subcount");
      subheading.appendChild(subcount);
      subgroup.appendChild(subheading);
      let subTotal = 0;
      for (const slug of subcategory.slugs) {
        const link = catalogLinks.get(slug);
        if (!link) throw new Error("Unknown category recipe: " + slug);
        if (assigned.has(slug)) throw new Error("Duplicate category recipe: " + slug);
        assigned.add(slug);
        addSidebarLink(link, subgroup, slug);
        subTotal++;
      }
      if (subTotal) {
        subcount.textContent = subTotal;
        count += subTotal;
        group.appendChild(subgroup);
      }
    }
    if (count) {
      groupCount.textContent = count;
      fragment.appendChild(group);
    }
  }
  if (assigned.size !== catalogLinks.size) {
    throw new Error("Category index is missing " + (catalogLinks.size - assigned.size) + " recipes");
  }
  sidebar.replaceChildren(fragment);
}

function revealSelectedRecipe(link) {
  const subcategory = link.closest(".sidebar-subcategory");
  const category = link.closest(".sidebar-category");
  // Only auto-expand the active branch. Keep manually expanded other groups.
  if (category) category.open = true;
  if (subcategory) subcategory.open = true;
}

function showRoute() {
  printMenu.open = false;
  const slug = new URLSearchParams(location.search).get("recipe");
  const link = recipeLinks.get(slug);
  recipeIndex.hidden = Boolean(link);
  recipeView.hidden = !link;
  if (link) {
    revealSelectedRecipe(link);
    loadRecipe(link);
  } else {
    ++loadSequence;
    currentRecipe = null;
    document.title = "Family Cookbook";
  }
}

document.addEventListener("click", event => {
  const link = event.target.closest("[data-recipe], .index-link");
  if (!link || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  if (location.href !== link.href) history.pushState(null, "", link.href);
  showRoute();
  window.scrollTo(0, 0);
  (recipeView.hidden ? recipeIndex : recipeView).focus();
});

window.CookbookEditorBridge = {
  getRecipe: () => currentRecipe,
  displayRating: ratingDisplay,
  getSource: () => sourceRecipe,
  getVariantIndex: () => activeVariantIndex,
  getPath: () => sidebar.querySelector('[aria-current="page"]')?.dataset.recipe,
  setSavedRecipe: data => {
    sourceRecipe = data;
    selectRecipeVersion(activeVariantIndex);
  },
  requestRender
};
window.addEventListener("popstate", showRoute);
document.addEventListener("click", event => {
  if (printMenu.open && !printMenu.contains(event.target)) printMenu.open = false;
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || event.defaultPrevented || !printMenu.open) return;
  printMenu.open = false;
  byId("printMenuToggle").focus();
});
for (const id of ["photoWidth","fontSize","stepGap"]) {
  byId(id).addEventListener("input", () => {
    byId(id+"Value").textContent = byId(id).value + (id === "photoWidth" ? "%" : id === "fontSize" ? " pt" : "px");
    requestRender();
  });
}
byId("printMode").addEventListener("change", requestRender);
byId("printButton").addEventListener("click", () => window.print());
// Sheet dimensions are fixed at US Letter, independent of viewport width.
// Re-paginating on every resize or mobile scroll viewport change would destroy
// and recreate the photo element, causing visible flashes and wasted decoding.
// CSS handles the responsive preview without resetting the page DOM.
buildSidebar().catch(error => {
  console.warn("Using cuisine-based navigation because taxonomy could not load:", error);
  sidebar.querySelectorAll(".sidebar-category").forEach(group => group.remove());
  recipeLinks.clear();
  buildSidebarFallback();
}).finally(showRoute);
