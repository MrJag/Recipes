"use strict";
// Browser-only print layout. No external services, tracking, or publishing.
const ROOT = document.documentElement;
const pagesEl = document.getElementById("pages");
const statusEl = document.getElementById("status");
const byId = id => document.getElementById(id);
let currentRecipe = null;
let recipeScaleFactor = 1;
let recipeScaler = null;
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
  if (recipe.status === "draft") page.classList.add("is-draft");
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
  if (recipe.displayScale) bits.push("SCALED " + Number(recipe.displayScale.toPrecision(5)) + "×");
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
      if (currentStage.steps.length) mainStages.push(currentStage);
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
  // Position decorative watermarks only after pagination has settled.
  for (const sheet of pagesEl.querySelectorAll(".sheet.is-draft")) {
    const content = sheet.querySelector(".content");
    const steps = content.querySelector(".steps");
    const ingredients = content.querySelector(".ingredients");
    const heading = steps?.previousElementSibling;
    const start = heading?.classList.contains("section-heading") ? heading : steps;
    const bounds = content.getBoundingClientRect();
    const scale = bounds.height / content.clientHeight || 1;
    const top = start ? (start.getBoundingClientRect().top - bounds.top) / scale
      : ingredients ? (ingredients.getBoundingClientRect().bottom - bounds.top) / scale : 0;
    const available = Math.max(0, content.clientHeight - top);
    // Fit the rotated text into the remaining region, including short first pages.
    const watermark = el("div", "draft-watermark", "DRAFT");
    watermark.setAttribute("aria-hidden", "true");
    watermark.style.top = (top + available / 2) + "px";
    watermark.style.fontSize = Math.max(0, Math.min(144, content.clientWidth / 3.15, available / 3.15)) + "px";
    content.prepend(watermark);
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
function scaleIngredient(item, factor) {
  if (typeof item !== "string" || factor === 1 || /\bper\s+(?:serving|person|portion|pastry|piece|glass|drink|cookie|roll|pancake|waffle|pizza|batch)\b/i.test(item)) return item;
  const fractions = {"¼":.25,"½":.5,"¾":.75,"⅓":1/3,"⅔":2/3,"⅛":.125,"⅜":.375,"⅝":.625,"⅞":.875,"⅕":.2,"⅖":.4,"⅗":.6,"⅘":.8,"⅙":1/6,"⅚":5/6};
  const token = "(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|[¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]|\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?|\\.\\d+)";
  const pattern = new RegExp("^(\\s*(?:optional\\s*:\\s*)?)("+token+")(?:\\s*([-–—]|\\bto\\b)\\s*("+token+"))?(?=\\s|$|[a-zA-Z])","i");
  const parse = value => {
    const t = value.trim();
    const glyph = t.slice(-1);
    if (Object.hasOwn(fractions,glyph)) return Number(t.slice(0,-1).trim() || 0) + fractions[glyph];
    if (t.includes("/")) {
      const m = t.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
      return m && Number(m[3]) ? Number(m[1] || 0)+Number(m[2])/Number(m[3]) : NaN;
    }
    return Number(t);
  };
  const format = (value, metric) => {
    if (!metric) {
      const whole = Math.floor(value+1e-9);
      const rest = value-whole;
      if (Math.abs(rest)<1e-9) return String(whole);
      for (const [glyph,n] of Object.entries(fractions)) {
        if (Math.abs(rest-n)<1e-7) return (whole || "")+glyph;
      }
    }
    return String(Number(value.toPrecision(5)));
  };
  const m = item.match(pattern);
  if (!m) return item;
  const suffix = item.slice(m[0].length);
  if (/^\s*(?:[-–—]\s*)?(?:inch(?:es)?|cm|mm|°[FC]|%|×|x\s+\d)\b/i.test(suffix) || /^[-–—\d/.]/.test(suffix)) return item;
  const a = parse(m[2]), b = m[4] ? parse(m[4]) : null;
  if (!Number.isFinite(a) || (b !== null && !Number.isFinite(b))) return item;
  const metric = /^\s*(?:g|kg|mg|ml|mL|l|L|grams?|kilograms?|milliliters?|liters?)\b/i.test(suffix);
  return m[1]+format(a*factor,metric)+(b === null ? "" : (m[3].toLowerCase()==="to"?" to ":"–")+format(b*factor,metric))+suffix;
}

function scaleServingCount(value) {
  const m = String(value ?? "").trim().match(/^(\d+(?:\.\d+)?)$/);
  const n = m ? Number(m[1]) : 0;
  return Number.isFinite(n) && n>0 ? n : null;
}

function scaledRecipeForDisplay(recipe) {
  const factor = recipeScaleFactor;
  if (factor === 1) return recipe;
  const groups = list => (list || []).map(group => ({
    ...group,
    items: /\b(?:separate|independent)\s+batch\b/i.test(group.title || "") ? group.items :
      (group.items || []).map(item => scaleIngredient(item,factor))
  }));
  const base = scaleServingCount(recipe.servings);
  return {...recipe,
    servings: base === null ? recipe.servings : Number((base*factor).toPrecision(5)),
    displayScale: factor,
    ingredientGroups: groups(recipe.ingredientGroups),
    components: (recipe.components || []).map(c=>({...c,ingredientGroups:groups(c.ingredientGroups)})),
    headnote: [recipe.headnote, "Scaled ingredient quantities are estimates. Check package sizes, equivalent amounts, separate batches, per-serving amounts and any quantities in the directions; cooking times and temperatures are unchanged."].filter(Boolean).join("\n")
  };
}

function installRecipeScaler() {
  const rail = document.querySelector(".recipe-action-rail");
  const button = el("button","recipe-icon-button");
  button.type="button";
  button.title="Scale recipe";
  button.setAttribute("aria-label","Scale recipe");
  button.setAttribute("aria-haspopup","dialog");
  button.textContent="×";
  button.style.fontSize="25px";
  rail.appendChild(button);
  const dialog=el("dialog","recipe-save-dialog");
  dialog.setAttribute("aria-label","Scale recipe");
  const heading=el("h2",null,"Scale recipe");
  const form=el("form");
  form.method="dialog";
  const info=el("p",null,"");
  const presets=el("div","dialog-actions");
  const multiplier=el("input");
  multiplier.type="number";multiplier.min="0.01";multiplier.max="100";multiplier.step="any";
  multiplier.required=true;multiplier.id="recipeScaleMultiplier";
  const factorLabel=el("label",null,"Batch multiplier (×)");
  factorLabel.htmlFor=multiplier.id;
  const servingLabel=el("label",null,"Desired servings");
  const servings=el("input");
  servings.type="number";servings.min="0.01";servings.step="any";servings.id="recipeScaleServings";
  servingLabel.htmlFor=servings.id;
  const servingWrap=el("div");servingWrap.append(servingLabel,servings);
  const note=el("p","token-note","Only the displayed recipe and print preview change. The original recipe is never modified. Review ingredient quantities and directions before cooking.");
  const actions=el("div","dialog-actions");
  const apply=el("button",null,"Apply");apply.type="submit";
  const reset=el("button",null,"Reset to 1×");reset.type="button";
  const cancel=el("button",null,"Cancel");cancel.type="button";
  actions.append(reset,cancel,apply);
  let base=null;
  function fill(factor) {
    multiplier.value=String(Number(factor.toPrecision(8)));
    servings.value=base ? String(Number((base*factor).toPrecision(8))) : "";
  }
  for (const factor of [.5,1,1.5,2,3,4]) {
    const p=el("button",null,factor+"×");p.type="button";
    p.addEventListener("click",()=>fill(factor));presets.append(p);
  }
  multiplier.addEventListener("input",()=>{
    if(base) servings.value=multiplier.value && Number(multiplier.value)>0 ? String(Number((base*Number(multiplier.value)).toPrecision(8))) : "";
  });
  servings.addEventListener("input",()=>{
    if(base) multiplier.value=servings.value && Number(servings.value)>0 ? String(Number((Number(servings.value)/base).toPrecision(8))) : "";
  });
  function applyFactor(factor) {
    recipeScaleFactor=factor;
    button.setAttribute("aria-pressed",String(factor!==1));
    button.title="Scale recipe ("+factor+"×)";
    dialog.close();requestRender();button.focus();
  }
  form.addEventListener("submit",event=>{
    event.preventDefault();
    const factor=Number(multiplier.value);
    if(Number.isFinite(factor)&&factor>=.01&&factor<=100&&currentRecipe&&!window.CookbookEditor?.active) applyFactor(factor);
  });
  reset.addEventListener("click",()=>applyFactor(1));
  cancel.addEventListener("click",()=>dialog.close());
  button.addEventListener("click",()=>{
    if(!currentRecipe)return;
    if(window.CookbookEditor?.active){window.alert("Finish editing before scaling the recipe.");return;}
    printMenu.open=false;
    base=scaleServingCount(currentRecipe.servings);
    info.textContent=base ? "Original recipe serves "+base+"." : "No exact serving count is stored. Scale by batch instead.";
    servingWrap.hidden=base===null;
    servings.disabled=base===null;
    fill(recipeScaleFactor);
    dialog.showModal();
  });
  form.append(heading,info,presets,factorLabel,multiplier,servingWrap,note,actions);
  dialog.append(form);document.body.append(dialog);
  return {reset(){recipeScaleFactor=1;button.setAttribute("aria-pressed","false");button.title="Scale recipe";if(dialog.open)dialog.close();}};
}

function requestRender() {
  if (!currentRecipe || window.CookbookEditor?.active || renderPending) return;
  renderPending = true;
  requestAnimationFrame(() => {
    renderPending = false;
    if (currentRecipe && !window.CookbookEditor?.active) {
      pagesEl.classList.add("measuring");
      try {
        render(scaledRecipeForDisplay(currentRecipe));
        byId("printButton").disabled = false;
      } finally {
        pagesEl.classList.remove("measuring");
      }
    }
  });
}
async function loadRecipe(button) {
  const requestId = ++loadSequence;
  recipeScaler?.reset();
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
  const routeMessage = byId("recipeRouteMessage");
  routeMessage.textContent = "Loading recipe…";
  routeMessage.hidden = false;
  try {
    const response = await fetch("./" + file, {cache:"no-store"});
    if (!response.ok) throw new Error("HTTP " + response.status);
    const recipe = await response.json();
    if (requestId !== loadSequence) return; // Ignore stale responses from previous selections.
    if (!recipe.title || !Array.isArray(recipe.ingredientGroups) || !Array.isArray(recipe.steps)) throw new Error("Invalid recipe structure");
    sourceRecipe = recipe;
    syncCatalogRecipe(new URL(button.href).searchParams.get("recipe"), recipe);
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
    const selected = sidebar.querySelector('[aria-current="page"]') || button;
    setupVariants(recipe, selected);
    byId("recipeRouteMessage").hidden = true;
  } catch (error) {
    if (requestId !== loadSequence) return;
    statusEl.textContent = "Unable to load recipe: " + error.message + ". Refresh to retry; a newly published recipe may not be deployed yet.";
    showRecipeRouteError("Unable to load this recipe: " + error.message, button.href);
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
  recipeScaler?.reset();
  window.CookbookEditor?.close({discard:true});
  activeVariantIndex = index;
  const variant = sourceRecipe?.variants?.[index];
  currentRecipe = variant ? {
    ...sourceRecipe,
    ...variant,
    title: variant.title,
    status: variant.status,
    category: sourceRecipe.category,
    sourceDriveUrl: variant.sourceUrl || variant.sourceDriveUrl || sourceRecipe.sourceDriveUrl,
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
const authoritativeCatalogSlugs = new Set();
const recipeCount = recipeIndex.querySelectorAll(".recipe-outline a[data-recipe]").length;
byId("recipeCount").textContent = `${recipeCount} ${recipeCount === 1 ? "recipe" : "recipes"}`;

// Maintain a single recipe catalog. The landing page and recipe sidebar share
// the same taxonomy; several category links may refer to one recipe file.
for (const link of recipeIndex.querySelectorAll(".recipe-outline a[data-recipe]")) {
  const slug = new URL(link.href).searchParams.get("recipe");
  if (!slug || catalogLinks.has(slug)) continue;
  addDraftBadge(link, link.dataset.status);
  catalogLinks.set(slug, link);
}

function addSidebarLink(link, container, slug, links = recipeLinks) {
  const sidebarLink = link.cloneNode(true);
  sidebarLink.removeAttribute("aria-current");
  sidebarLink.classList.add("sidebar-recipe-link");
  // The source link already contains its draft badge.
  if (!links.has(slug)) links.set(slug, []);
  links.get(slug).push(sidebarLink);
  container.appendChild(sidebarLink);
}

// Update existing nodes in place: routing, expanded groups and focus stay intact.
function syncCatalogRecipe(slug, data) {
  if (!slug || !data || typeof data.title !== "string" || !data.title.trim()) return;
  authoritativeCatalogSlugs.add(slug);
  for (const link of [catalogLinks.get(slug), ...(recipeLinks.get(slug) || [])]) {
    if (!link) continue;
    link.textContent = data.title;
    if (data.status) link.dataset.status = data.status;
    else delete link.dataset.status;
    addDraftBadge(link, data.status);
  }
}

async function refreshCatalogMetadata() {
  const entries = [...catalogLinks.entries()];
  const results = await RecipeMetadata.mapLimit(entries, async ([slug, link]) => {
    if (authoritativeCatalogSlugs.has(slug)) return;
    const data = await RecipeMetadata.load(link.dataset.recipe);
    // A just-opened or just-saved recipe is more authoritative than a pending fetch.
    if (!authoritativeCatalogSlugs.has(slug)) syncCatalogRecipe(slug, data);
  });
  const failures = results.filter(result => result.error);
  if (failures.length) console.warn("Some recipe links use saved listing details:", failures);
}

function buildSidebarFallback() {
  sidebar.replaceChildren();
  recipeLinks.clear();
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  let taxonomy;
  try {
    const response = await fetch("./src/data/recipe-taxonomy.json", {cache: "no-cache", signal:controller.signal});
    if (!response.ok) throw new Error("Could not load recipe categories");
    taxonomy = await response.json();
  } finally {
    clearTimeout(timeout);
  }
  const fragment = document.createDocumentFragment();
  const newRecipeLinks = new Map();
  const assigned = new Set();
  for (const category of taxonomy.groups) {
    const group = el("details", "sidebar-category");
    const heading = el("summary", "sidebar-category-title");
    heading.addEventListener("click", () => {
      // Opening a category reveals every subcategory, without changing recipe selection.
      if (!group.open) {
        for (const child of group.querySelectorAll(".sidebar-subcategory")) child.open = true;
      }
    });
    heading.appendChild(el("span", null, category.name));
    const groupCount = el("span", "sidebar-count");
    heading.appendChild(groupCount);
    group.appendChild(heading);
    const groupSlugs = new Set();
    for (const subcategory of category.subcategories) {
      const subgroup = el("details", "sidebar-subcategory");
      const subheading = el("summary", "sidebar-subcategory-title");
      subheading.appendChild(el("span", null, subcategory.label));
      const subcount = el("span", "sidebar-subcount");
      subheading.appendChild(subcount);
      subgroup.appendChild(subheading);
      const subSlugs = new Set();
      let subTotal = 0;
      for (const slug of subcategory.slugs) {
        const link = catalogLinks.get(slug);
        if (!link) throw new Error("Unknown category recipe: " + slug);
        if (subSlugs.has(slug)) throw new Error("Duplicate recipe within category: " + slug);
        subSlugs.add(slug);
        groupSlugs.add(slug);
        assigned.add(slug);
        addSidebarLink(link, subgroup, slug, newRecipeLinks);
        subTotal++;
      }
      if (subTotal) {
        subcount.textContent = subTotal;
        group.appendChild(subgroup);
      }
    }
    if (groupSlugs.size) {
      groupCount.textContent = groupSlugs.size;
      fragment.appendChild(group);
    }
  }
  if (assigned.size !== catalogLinks.size) {
    throw new Error("Category index is missing " + (catalogLinks.size - assigned.size) + " recipes");
  }
  // A recipe can already be open while taxonomy is loading. Move its selection
  // and version controls to the new sidebar without fetching or rendering again.
  const activeSlug = getRouteSlug();
  const versions = sidebar.querySelector(".recipe-versions");
  const selected = newRecipeLinks.get(activeSlug)?.[0];
  if (selected) {
    selected.setAttribute("aria-current", "page");
    if (versions) selected.after(versions);
    revealSelectedRecipe(selected);
  }
  sidebar.replaceChildren(fragment);
  recipeLinks.clear();
  for (const [slug, link] of newRecipeLinks) recipeLinks.set(slug, link);
}

function revealSelectedRecipe(link) {
  const subcategory = link.closest(".sidebar-subcategory");
  const category = link.closest(".sidebar-category");
  // Only auto-expand the active branch. Keep manually expanded other groups.
  if (category) category.open = true;
  if (subcategory) subcategory.open = true;
}

function getRouteSlug() {
  const query = new URLSearchParams(location.search);
  return query.get("recipe") || new URLSearchParams(location.hash.slice(1)).get("recipe");
}
function showRecipeRouteError(message, retryUrl) {
  const notice = byId("recipeRouteMessage");
  notice.replaceChildren(document.createTextNode(message + ". "));
  const retry = el("a", null, "Retry");
  retry.href = retryUrl || location.href;
  const directory = el("a", null, "Browse recipes");
  directory.href = "./directory.html";
  notice.append(retry, " · ", directory);
  notice.hidden = false;
}
function showRoute(preferredLink = null) {
  printMenu.open = false;
  const slug = getRouteSlug();
  const choices = recipeLinks.get(slug) || [];
  const link = choices.includes(preferredLink) ? preferredLink : choices.find(item => item.getAttribute("aria-current") === "page") || choices[0];
  // Never silently show the catalog when a recipe URL is requested.
  recipeIndex.hidden = Boolean(slug);
  recipeView.hidden = !slug;
  if (link) {
    revealSelectedRecipe(link);
    loadRecipe(link);
  } else {
    ++loadSequence;
    currentRecipe = null;
    document.title = "Family Cookbook";
    pagesEl.replaceChildren();
    if (slug) {
      showRecipeRouteError("This recipe is not in the currently deployed catalog", location.href);
    } else {
      byId("recipeRouteMessage").hidden = true;
    }
  }
}

document.addEventListener("click", event => {
  const link = event.target.closest("[data-recipe], .index-link");
  if (!link || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  if (location.href !== link.href) history.pushState(null, "", link.href);
  showRoute(link);
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
    syncCatalogRecipe(getRouteSlug(), data);
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
// Direct recipe links work from the embedded catalog even if the taxonomy
// request is slow, fails or is temporarily out of sync during deployment.
recipeScaler = installRecipeScaler();
buildSidebarFallback();
showRoute();
buildSidebar().catch(error => {
  console.warn("Keeping cuisine-based navigation because taxonomy could not load:", error);
}).finally(() => {
  void refreshCatalogMetadata().catch(error => console.warn("Recipe metadata refresh failed:", error));
});
