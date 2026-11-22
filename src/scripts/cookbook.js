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
  const page = el("article", "sheet" + (index === 0 ? " has-photo" : ""));
  page.setAttribute("aria-label", "Recipe page " + (index + 1));
  const content = el("div", "content");
  if (index === 0) {
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
      photo.onload = () => { photo.hidden = false; };
      photo.onerror = () => { photo.hidden = true; };
      photo.hidden = true;
      photo.src = recipe.photo;
      strip.appendChild(photo);
    }
    page.appendChild(strip);
  } else {
    content.appendChild(el("div", "running-head", recipe.title + " · continued"));
  }
  page.appendChild(content);
  page.appendChild(el("div", "page-num", String(index + 1)));
  pagesEl.appendChild(page);
  return { page, content, index, steps: null };
}
function buildHeader(recipe) {
  const wrap = el("header", "recipe-header");
  wrap.appendChild(el("div", "category", (recipe.category || "Recipes").toUpperCase()));
  wrap.appendChild(el("h1", null, recipe.title));
  if (recipe.subtitle) wrap.appendChild(el("div", "subtitle", "(" + recipe.subtitle + ")"));
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
}
function paginate(recipe, density) {
  setLayout(density);
  pagesEl.replaceChildren();
  let page = pageShell(0, recipe);
  const header = buildHeader(recipe);
  const ingredients = buildIngredients(allIngredientGroups(recipe));
  page.content.append(header, ingredients);
  let overflow = !fits(page);
  const stages = [
    ...(recipe.components || []).map(c => ({title:c.title, steps:c.steps || [], note:c.notes})),
    ...(recipe.steps?.length ? [{title:recipe.components?.length ? "Main method" : null, steps:recipe.steps}] : [])
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
  if (!currentRecipe || renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    render(currentRecipe);
  });
}
async function loadRecipe(button) {
  const requestId = ++loadSequence;
  const file = button.dataset.recipe;
  sidebar.querySelector("[aria-current]")?.removeAttribute("aria-current");
  sidebar.querySelector(".recipe-versions")?.remove();
  button.setAttribute("aria-current", "true");
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

  const versions = el("div", "recipe-versions");
  versions.setAttribute("role", "group");
  versions.setAttribute("aria-label", recipeButton.textContent + " versions");
  const titles = ["Original draft", ...recipe.variants.map(variant => variant.title)];
  titles.forEach((title, position) => {
    const index = position - 1;
    const button = el("button", null, title);
    button.type = "button";
    button.setAttribute("aria-pressed", String(index === 0));
    button.addEventListener("click", () => {
      versions.querySelector('[aria-pressed="true"]').setAttribute("aria-pressed", "false");
      button.setAttribute("aria-pressed", "true");
      selectRecipeVersion(index);
    });
    versions.appendChild(button);
  });
  recipeButton.after(versions);
  selectRecipeVersion(0);
}
function selectRecipeVersion(index) {
  const variant = sourceRecipe?.variants?.[index];
  currentRecipe = variant ? {
    ...sourceRecipe,
    ...variant,
    title: variant.title,
    category: sourceRecipe.category,
    sourceDriveUrl: sourceRecipe.sourceDriveUrl,
    sourceNote: variant.sourceNote || sourceRecipe.sourceNote || "Original source document"
  } : sourceRecipe;
  requestRender();
}
const sidebar = document.querySelector(".recipe-sidebar");
for (const button of sidebar.querySelectorAll("[data-recipe]")) {
  button.addEventListener("click", () => loadRecipe(button));
}
for (const id of ["photoWidth","fontSize","stepGap"]) {
  byId(id).addEventListener("input", () => {
    byId(id+"Value").textContent = byId(id).value + (id === "photoWidth" ? "%" : id === "fontSize" ? " pt" : "px");
    requestRender();
  });
}
byId("printMode").addEventListener("change", requestRender);
byId("printButton").addEventListener("click", () => window.print());
window.addEventListener("resize", requestRender);
loadRecipe(sidebar.querySelector("details[open] [data-recipe]"));
