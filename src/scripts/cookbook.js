"use strict";
// Browser-only print layout. No external services, tracking, or publishing.
const ROOT = document.documentElement;
const pagesEl = document.getElementById("pages");
const statusEl = document.getElementById("status");
const byId = id => document.getElementById(id);
let currentRecipe = null;
let lastPageCount = 0;
let renderPending = false;

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
    if (recipe.photo) {
      // Relative paths must point to images committed to this private project.
      strip.style.backgroundImage = "url(" + JSON.stringify(recipe.photo).slice(1,-1) + ")";
    } else {
      const placeholder = el("div", "photo-placeholder");
      placeholder.appendChild(el("span", null, "PHOTO PLACEHOLDER · ORIGINAL IMAGE NEEDED"));
      strip.appendChild(placeholder);
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
function buildIngredients(groups) {
  const wrap = el("section", "ingredients");
  wrap.appendChild(makeHeading("Ingredients"));
  if (!Array.isArray(groups)) return wrap;
  const single = groups.length === 1 && !groups[0].title;
  if (single) {
    const ul = el("ul");
    for (const item of groups[0].items || []) ul.appendChild(el("li", null, item));
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
  const li = el("li");
  li.appendChild(el("span", "step-num", number));
  const text = typeof step === "string" ? step : step.text;
  if (typeof step === "object" && step.lead) {
    const strong = el("strong", null, step.lead + " ");
    li.appendChild(strong);
  }
  li.appendChild(document.createTextNode(text || ""));
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
function render(recipe, compact = false) {
  pagesEl.replaceChildren();
  ROOT.style.setProperty("--step-gap", (compact ? Math.max(3, Number(byId("stepGap").value)-3) : Number(byId("stepGap").value)) + "px");
  ROOT.style.setProperty("--body-size", (Number(byId("fontSize").value) - (compact ? .2 : 0)) + "pt");
  ROOT.style.setProperty("--strip-fraction", (Number(byId("photoWidth").value)/100).toFixed(2));
  document.body.classList.toggle("commercial", byId("printMode").value === "commercial");
  let page = pageShell(0, recipe);
  page.content.appendChild(buildHeader(recipe));
  page.content.appendChild(buildIngredients(recipe.ingredientGroups));
  let overflow = !fits(page);
  const steps = recipe.steps || [];
  for (let i = 0; i < steps.length; i++) {
    ensureSteps(page);
    const node = stepNode(steps[i], i+1);
    if (!attachWithFit(page, node)) {
      page = pageShell(pagesEl.children.length, recipe);
      ensureSteps(page);
      page.steps.appendChild(node);
      overflow ||= !fits(page);
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
    const node = el("p", "source", recipe.sourceNote);
    if (!attachWithFit(page, node)) {
      page = pageShell(pagesEl.children.length, recipe);
      page.content.appendChild(node);
      overflow ||= !fits(page);
    }
  }
  // Automatic density adjustment for a tiny page-2 spill, not for substantial content.
  if (!compact && pagesEl.children.length === 2) {
    const last = pagesEl.lastElementChild;
    const extras = last.querySelectorAll(".steps > li, .related-section, .source");
    if (extras.length <= 1 && last.querySelector(".related-section") === null) {
      const normalPages = pagesEl.children.length;
      const compactResult = render(recipe, true);
      if (compactResult.pages < normalPages) return compactResult;
      return render(recipe, true); // Favor slightly tighter version, if still readable.
    }
  }
  if (overflow) {
    const warning = el("div", "overflow-warning", "A section exceeds the page area; review this recipe manually.");
    statusEl.replaceChildren(warning);
  } else {
    statusEl.textContent = recipe.title + " · " + pagesEl.children.length + " page(s) · first-page photo only · " + (compact ? "minor overflow adjustment" : "balanced layout");
  }
  lastPageCount = pagesEl.children.length;
  return {pages: lastPageCount, overflow};
}
function requestRender() {
  if (!currentRecipe || renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    render(currentRecipe);
  });
}
async function loadRecipe() {
  const file = byId("recipe").value;
  statusEl.textContent = "Loading " + file + " …";
  try {
    const response = await fetch("./" + file, {cache:"no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const recipe = await response.json();
    if (!recipe.title || !Array.isArray(recipe.ingredientGroups) || !Array.isArray(recipe.steps)) throw new Error("Invalid recipe structure");
    currentRecipe = recipe;
    requestRender();
  } catch (error) {
    statusEl.textContent = "Unable to load recipe: " + error.message + ". Run a local HTTP server; opening index.html directly may block JSON fetches.";
  }
}
byId("recipe").addEventListener("change", loadRecipe);
for (const id of ["photoWidth","fontSize","stepGap"]) {
  byId(id).addEventListener("input", () => {
    byId(id+"Value").textContent = byId(id).value + (id === "photoWidth" ? "%" : id === "fontSize" ? " pt" : "px");
    requestRender();
  });
}
byId("printMode").addEventListener("change", requestRender);
byId("printButton").addEventListener("click", () => window.print());
window.addEventListener("resize", requestRender);
loadRecipe();
