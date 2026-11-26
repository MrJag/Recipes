(() => {
"use strict";

// Dish-type classification is presentation metadata; recipe files and URLs remain unchanged.
const indexUrl = new URL("./recipe.html", location.href);
const taxonomyUrl = new URL("./src/data/recipe-taxonomy.json", location.href);
const cuisineOverrides = {
  "frozen-margarita":"Mexican","persian-rice-with-tahdig":"Persian",
  "turkish-kofta-kebab":"Turkish","belgian-waffles":"Belgian",
  "latvian-stew":"Latvian","mariano-margarita":"Mexican",
  "taiwanese-popcorn-chicken":"Taiwanese"
};
const nonCuisineGroups = new Set(["Breakfast","Dessert","Drinks"]);
const proteinOverrides = {
  Beef:"hutchins-style-brisket beef-stroganoff skirt-steak-fajitas beef-short-rib-biryani uzbek-plov-beef paella-de-carne clay-pot-rice-short-ribs polpette-alla-napoletana texas-chili-serrano texas-chili-ancho midwestern-chili cookoff-smoked-beef-chili mariannas-chili chuys-carne-guisada steak-guide velveting-beef classic-bolognese-ragu bolognese-ragu",
  Chicken:"roasted-chicken-bombay-potatoes spatchcocked-hawaiian-chicken hawaiian-huli-huli-chicken hawaiian-teriyaki-chicken butter-masala-chicken ultimate-butter-chicken tandoori-chicken smoked-garam-masala-tandoori-chicken sour-cream-chicken-enchiladas chicken-mole-poblano pollo-asado pollo-a-la-brasa thai-basil-chicken lemongrass-chicken chicken-satay taiwanese-popcorn-chicken mariannas-chicken-kotleti joojeh-kebab chicken-pintxo-avocado-toast enchiladas-suizas chuys-chicka-boom-enchiladas japanese-curry creamy-chicken-florentine chicken-congee chicken-plov chicken-paella velveting-chicken",
  Pork:"pistachio-stuffed-pork-tenderloin hutchins-style-ribs pan-fried-pork-chops tamarind-glazed-pork-chops texas-twinkies 3-2-1-ribs smoked-pulled-pork szechuan-green-beans-and-pork goan-pork-vindaloo pork-carnitas shashlik-pork-kebab salsiccia-napolitana hatch-green-chili 15-bean-soup-sausage latvian-stew polpette-alla-napoletana classic-bolognese-ragu bolognese-ragu",
  Lamb:"lamb-biryani uzbek-plov-lamb turkish-kofta-kebab",
  Seafood:"gambas-al-ajillo",
  Vegetarian:"ancient-grains-bowl dal-tadka paneer-butter-masala shakshuka baba-ganoush"
};
const proteinBySlug = new Map();
for (const [protein, list] of Object.entries(proteinOverrides)) {
  for (const slug of list.split(" ")) {
    if (!proteinBySlug.has(slug)) proteinBySlug.set(slug, []);
    proteinBySlug.get(slug).push(protein);
  }
}
const photoCategoryGroups = {
  Mains:["Soups, Stews & Chili","Main Dishes","Pizza, Pasta & Noodles","Breakfast & Brunch"],
  Sides:["Sides, Breads & Grains"],
  Condiments:["Sauces, Condiments & Seasonings","Techniques & Guides"],
  Drinks:["Drinks & Cocktails"],
  Desserts:["Desserts & Baking"]
};
const $ = id => document.getElementById(id);
const results = $("categoryResults");
const status = $("categoryStatus");
const searchInput = $("recipeSearch");
const cuisineFilter = $("cuisineFilter");
const proteinFilter = $("proteinFilter");
const clearButton = $("clearFilters");
const groupNav = $("groupNav");
let taxonomy;
let recipes = [];
let metadataFailures = 0;
let metadataRefreshing = false;
let selectedGroups = [];
let expandedGroup = null;

let featuredPhotoIndex = {};
let recentHighlights = [];
const highlights = $("directoryHighlightsCards");
const highlightsTitle = $("directoryHighlightsTitle");

function renderHighlights(matching) {
  if (!highlights) return;
  const currentGroup = selectedGroups.length === 1 ? selectedGroups[0] : null;
  const activeFilters = Boolean(currentGroup || searchInput.value.trim() || cuisineFilter.value || proteinFilter.value);
  const photographed = matching.filter(recipe => featuredPhotoIndex[recipe.slug]);
  const chosen = [];
  const seen = new Set();
  // When browsing a category, show variety across its subcategories first.
  if (currentGroup) {
    for (const recipe of photographed) {
      const subgroup = recipe.assignments.find(a => a.group === currentGroup)?.subgroup;
      if (!seen.has(subgroup) && chosen.length < 3) {
        chosen.push(recipe);
        seen.add(subgroup);
      }
    }
  }
  for (const recipe of photographed) {
    if (chosen.length === 3) break;
    if (!chosen.some(item => item.slug === recipe.slug)) chosen.push(recipe);
  }
  const bySlug = new Map(recipes.map(recipe => [recipe.slug,recipe]));
  const byRecent = new Map(recentHighlights.map(recipe => [recipe.slug,recipe]));
  let show = activeFilters ? chosen : recentHighlights.map(entry => bySlug.get(entry.slug)).filter(recipe => recipe && featuredPhotoIndex[recipe.slug]).slice(0,3);
  if (!show.length) show = recentHighlights.map(entry => bySlug.get(entry.slug)).filter(recipe => recipe && featuredPhotoIndex[recipe.slug]).slice(0,3);
  highlightsTitle.textContent = currentGroup ? "From " + currentGroup : activeFilters ? "Recipes to Discover" : "Fresh from the Kitchen";
  highlights.replaceChildren();
  for (const recipe of show) {
    const card = document.createElement("a");
    card.className = "highlight-recipe";
    card.href = recipe.url;
    const frame = document.createElement("span");
    frame.className = "highlight-photo";
    frame.style.display = "block";
    const img = document.createElement("img");
    img.src = featuredPhotoIndex[recipe.slug];
    img.alt = recipe.title;
    img.loading = "lazy";
    img.decoding = "async";
    frame.appendChild(img);
    const title = document.createElement("span");
    title.className = "highlight-title";
    title.textContent = recipe.title;
    if (recipe.draft) {
      const badge = document.createElement("span");
      badge.className = "draft-badge";
      badge.textContent = "Draft";
      title.append(" ",badge);
    }
    const description = document.createElement("span");
    description.className = "highlight-description";
    const note = recipe.description || byRecent.get(recipe.slug)?.description;
    description.textContent = note || [recipe.assignments.find(a => a.group === currentGroup)?.subgroup || recipe.assignments[0].subgroup,recipe.cuisine].filter(Boolean).join(" · ");
    card.append(frame,title,description);
    highlights.appendChild(card);
  }
  if (!show.length) {
    const empty = document.createElement("p");
    empty.className = "directory-highlights-empty";
    empty.textContent = "More recipe photos are coming soon.";
    highlights.appendChild(empty);
  }
}

function itemNode(recipe) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = recipe.url;
  link.textContent = recipe.title;
  if (recipe.draft) {
    const badge = document.createElement("span");
    badge.className = "draft-badge";
    badge.textContent = "Draft";
    link.append(" ", badge);
  }
  const detail = document.createElement("span");
  detail.className = "recipe-cuisine";
  detail.textContent = [recipe.cuisine, ...recipe.proteins].filter(Boolean).join(" · ");
  item.append(link, detail);
  return item;
}

function updateGroupButtons() {
  for (const button of groupNav.querySelectorAll("button")) {
    const active = selectedGroups.length === 1 && selectedGroups[0] === button.dataset.group;
    button.setAttribute("aria-pressed", String(active));
  }
}

function render() {
  const term = searchInput.value.trim().toLocaleLowerCase();
  const matching = recipes.filter(recipe =>
    (!selectedGroups.length || recipe.assignments.some(a => selectedGroups.includes(a.group))) &&
    (!cuisineFilter.value || recipe.cuisine === cuisineFilter.value) &&
    (!proteinFilter.value || recipe.proteins.includes(proteinFilter.value)) &&
    (!term || [recipe.title, recipe.subtitle || "", recipe.cuisine, ...recipe.assignments.flatMap(a => [a.group,a.subgroup]), ...recipe.proteins]
      .some(value => value.toLocaleLowerCase().includes(term)))
  );
  const bySlug = new Map(matching.map(recipe => [recipe.slug, recipe]));
  const forceOpen = Boolean(term || cuisineFilter.value || proteinFilter.value);
  results.replaceChildren();
  for (const group of taxonomy.groups) {
    if (selectedGroups.length && !selectedGroups.includes(group.name)) continue;
    const subgroups = group.subcategories.map(sub => ({
      label:sub.label,
      entries:sub.slugs.map(slug => bySlug.get(slug)).filter(Boolean)
    })).filter(sub => sub.entries.length);
    if (!subgroups.length) continue;
    const section = document.createElement("section");
    section.className = "taxonomy-section";
    section.dataset.group = group.name;
    section.id = "recipes-" + group.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const details = document.createElement("details");
    details.className = "group-details";
    const categorySelected = selectedGroups.includes(group.name);
    details.open = forceOpen || group.name === expandedGroup || categorySelected;
    details.addEventListener("toggle", () => {
      if (details.open && !forceOpen) expandedGroup = group.name;
    });
    const title = document.createElement("summary");
    title.className = "group-heading";
    title.addEventListener("click", () => {
      // Opening a category reveals every recipe list beneath it.
      if (!details.open) {
        for (const child of details.querySelectorAll(".subcategory-details")) child.open = true;
      }
    });
    const name = document.createElement("span");
    name.textContent = group.name;
    const count = document.createElement("small");
    count.textContent = String(new Set(subgroups.flatMap(sub => sub.entries.map(recipe => recipe.slug))).size);
    title.append(name, count);
    details.appendChild(title);
    const wrap = document.createElement("div");
    wrap.className = "subcategory-list";
    for (const sub of subgroups) {
      const subdetails = document.createElement("details");
      subdetails.className = "subcategory-details";
      subdetails.open = forceOpen || categorySelected || group.name === expandedGroup;
      const summary = document.createElement("summary");
      const label = document.createElement("span");
      label.className = "subcategory-label";
      label.textContent = sub.label;
      const number = document.createElement("small");
      number.textContent = String(sub.entries.length);
      summary.append(label, number);
      const list = document.createElement("ul");
      for (const recipe of sub.entries) list.appendChild(itemNode(recipe));
      subdetails.append(summary, list);
      wrap.appendChild(subdetails);
    }
    details.appendChild(wrap);
    section.appendChild(details);
    results.appendChild(section);
  }
  status.textContent = matching.length
    ? `Showing ${matching.length} of ${recipes.length} recipes`
    : "No recipes match your filters. Try clearing the search or filters.";
  if (metadataRefreshing) status.textContent += " · Refreshing recipe details…";
  if (metadataFailures) status.textContent += ` · ${metadataFailures} recipe(s) using saved listing details; reload to retry.`;
  updateGroupButtons();
  renderHighlights(matching);
}

function saveFilterUrl() {
  const url = new URL(location.href);
  if (selectedGroups.length === 1) url.searchParams.set("category", selectedGroups[0]);
  else url.searchParams.delete("category");
  for (const [name,value] of [["search",searchInput.value.trim()],["cuisine",cuisineFilter.value],["ingredient",proteinFilter.value]]) {
    if (value) url.searchParams.set(name,value); else url.searchParams.delete(name);
  }
  history.replaceState(null,"",url);
}
function selectGroups(names) {
  selectedGroups = names;
  expandedGroup = names[0] || null;
  saveFilterUrl();
  render();
}

// Render the index immediately; hydrate live titles in the background.
// Keep expanded groups/subcategories intact when metadata refreshes.
function refreshRenderedMetadata() {
  const expansionState = new Map([...results.querySelectorAll("details")].map(d => {
    const section = d.closest(".taxonomy-section");
    const name = section?.dataset.group || "";
    const key = d.classList.contains("group-details") ? name : name + "::" + d.querySelector("summary .subcategory-label")?.textContent;
    return [key, d.open];
  }));
  render();
  for (const d of results.querySelectorAll("details")) {
    const name = d.closest(".taxonomy-section")?.dataset.group || "";
    const key = d.classList.contains("group-details") ? name : name + "::" + d.querySelector("summary .subcategory-label")?.textContent;
    if (expansionState.has(key)) d.open = expansionState.get(key);
  }
}

async function hydrateCatalogMetadata() {
  metadataRefreshing = true;
  let timer = null;
  const scheduleRender = () => {
    if (timer !== null) return;
    timer = setTimeout(() => { timer = null; refreshRenderedMetadata(); }, 250);
  };
  const entries = [...recipes];
  const outcomes = await RecipeMetadata.mapLimit(entries, async entry => {
    const data = await RecipeMetadata.load(entry.path);
    Object.assign(entry, {
      title:data.title, subtitle:data.subtitle || "", draft:data.status === "draft",
      description:RecipeMetadata.description(data), rating:data.rating, yield:data.yield
    });
    if (data.photo) featuredPhotoIndex[entry.slug] = data.photo;
    else delete featuredPhotoIndex[entry.slug];
    scheduleRender();
  });
  metadataFailures = outcomes.filter(result => result.error).length;
  if (timer !== null) clearTimeout(timer);
  metadataRefreshing = false;
  refreshRenderedMetadata();
}

async function loadCatalog() {
  const [page, tags, pictures, recent] = await Promise.all([
    fetch(indexUrl,{cache:"no-cache"}),
    fetch(taxonomyUrl,{cache:"no-cache"}),
    fetch("./src/data/recipe-photo-index.json",{cache:"no-cache"}),
    fetch("./src/data/recent-recipes.json",{cache:"no-cache"})
  ]);
  if (pictures.ok) featuredPhotoIndex = await pictures.json();
  if (recent.ok) {
    const data = await recent.json();
    recentHighlights = Array.isArray(data.recipes) ? data.recipes : [];
  }
  if (!page.ok || !tags.ok) throw new Error("Could not fetch recipe catalog or taxonomy");
  const catalog = new DOMParser().parseFromString(await page.text(),"text/html");
  taxonomy = await tags.json();
  const mapped = new Map();
  for (const group of taxonomy.groups) for (const sub of group.subcategories) {
    for (const slug of sub.slugs) {
      if (!mapped.has(slug)) mapped.set(slug,[]);
      const assignments = mapped.get(slug);
      if (assignments.some(a => a.group === group.name && a.subgroup === sub.label)) throw new Error("Duplicate recipe within category: " + slug);
      assignments.push({group:group.name,subgroup:sub.label});
    }
  }
  recipes = [...catalog.querySelectorAll(".recipe-outline a[data-recipe]")].map(link => {
    const section = link.closest("section");
    const sourceGroup = section.querySelector("h2").textContent.trim();
    const url = new URL(link.getAttribute("href"),indexUrl);
    const slug = url.searchParams.get("recipe");
    const assignment = mapped.get(slug);
    if (!assignment) throw new Error("Unclassified recipe: " + slug);
    return {
      slug,path:link.dataset.recipe,title:link.textContent.trim(),url:url.href,
      cuisine:cuisineOverrides[slug] ?? (nonCuisineGroups.has(sourceGroup) ? "Unspecified" : sourceGroup),
      assignments:assignment,
      proteins:proteinBySlug.get(slug) || [],
      draft:link.dataset.status === "draft"
    };
  });
  if (!recipes.length || mapped.size !== recipes.length || new Set(recipes.map(recipe => recipe.slug)).size !== recipes.length) throw new Error("Recipe taxonomy does not match catalog");
  recipes.sort((a,b)=>a.title.localeCompare(b.title));
  for (const cuisine of [...new Set(recipes.map(recipe=>recipe.cuisine))].sort()) {
    cuisineFilter.add(new Option(cuisine,cuisine));
  }
  for (const protein of Object.keys(proteinOverrides)) {
    proteinFilter.add(new Option(protein,protein));
  }
  cuisineFilter.disabled = proteinFilter.disabled = false;
  for (const group of taxonomy.groups) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.group = group.name;
    button.textContent = group.name;
    button.addEventListener("click",() => {
      selectGroups(selectedGroups.length === 1 && selectedGroups[0] === group.name ? [] : [group.name]);
    });
    groupNav.appendChild(button);
  }
  const changeFilter = () => { saveFilterUrl(); render(); };
  cuisineFilter.addEventListener("change",changeFilter);
  proteinFilter.addEventListener("change",changeFilter);
  searchInput.addEventListener("input",changeFilter);
  clearButton.addEventListener("click",() => {
    selectedGroups = [];
    searchInput.value = cuisineFilter.value = proteinFilter.value = "";
    expandedGroup = null;
    saveFilterUrl();
    render();
  });
  for (const card of document.querySelectorAll("[data-category]")) {
    card.addEventListener("click",(event) => {
      event.preventDefault();
      searchInput.value = cuisineFilter.value = proteinFilter.value = "";
      const groups = photoCategoryGroups[card.dataset.category] || [];
      selectGroups(groups);
      // Jump to the actual recipe group rather than the directory search controls.
      // Main Dishes takes precedence over Soups for the Mains photo card.
      const targetName = card.dataset.category === "Mains" ? "Main Dishes" : groups[0];
      const target = [...results.querySelectorAll(".taxonomy-section")]
        .find(section => section.dataset.group === targetName);
      if (target) {
        target.querySelector(".group-details").open = true;
        target.scrollIntoView({behavior:"auto",block:"start"});
      }
    });
  }
  $("searchShortcut")?.addEventListener("click", event => {
    // Search is a clean, collapsed directory view rather than a category view.
    event.preventDefault();
    selectedGroups = [];
    expandedGroup = null;
    searchInput.value = cuisineFilter.value = proteinFilter.value = "";
    const url = new URL(location.href);
    url.search = "";
    url.hash = "recipeSearch";
    history.replaceState(null, "", url);
    render();
    searchInput.scrollIntoView({block:"start"});
    searchInput.focus({preventScroll:true});
  });
  const urlFilters = new URLSearchParams(location.search);
  const requestedGroup = location.hash === "#recipeSearch" ? null : urlFilters.get("category");
  searchInput.value = urlFilters.get("search") || "";
  if (urlFilters.has("cuisine")) cuisineFilter.value = urlFilters.get("cuisine");
  if (urlFilters.has("ingredient")) proteinFilter.value = urlFilters.get("ingredient");
  if (requestedGroup && taxonomy.groups.some(group => group.name === requestedGroup)) {
    selectedGroups = [requestedGroup];
    expandedGroup = requestedGroup;
  }
  metadataRefreshing = true;
  render();
  void hydrateCatalogMetadata().catch(error => {
    metadataRefreshing = false;
    console.warn("Recipe metadata refresh failed:", error);
    refreshRenderedMetadata();
  });
  if (location.hash === "#recipeSearch") {
    // Focus after the asynchronous catalog is ready; don't auto-expand a group.
    searchInput.focus({preventScroll:true});
  }
}

loadCatalog().catch(error => {
  console.error("Cookbook catalog:",error);
  const link = document.createElement("a");
  link.href = "./directory.html";
  link.textContent = "Reload the recipe directory.";
  status.replaceChildren(document.createTextNode("Couldn’t load the recipe directory. "),link);
});
})();
