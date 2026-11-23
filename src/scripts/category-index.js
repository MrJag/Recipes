"use strict";

// Dish-type classification is presentation metadata; recipe files and URLs remain unchanged.
const indexUrl = new URL("./index2.html", location.href);
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
  Chicken:"roasted-chicken-bombay-potatoes spatchcocked-hawaiian-chicken hawaiian-huli-huli-chicken hawaiian-teriyaki-chicken butter-masala-chicken tandoori-chicken smoked-garam-masala-tandoori-chicken sour-cream-chicken-enchiladas chicken-mole-poblano pollo-asado pollo-a-la-brasa thai-basil-chicken lemongrass-chicken chicken-satay taiwanese-popcorn-chicken mariannas-chicken-kotleti joojeh-kebab chicken-pintxo-avocado-toast enchiladas-suizas chuys-chicka-boom-enchiladas japanese-curry creamy-chicken-florentine chicken-congee chicken-plov chicken-paella velveting-chicken",
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
let selectedGroups = [];
let expandedGroup = "Soups, Stews & Chili";

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
    (!selectedGroups.length || selectedGroups.includes(recipe.group)) &&
    (!cuisineFilter.value || recipe.cuisine === cuisineFilter.value) &&
    (!proteinFilter.value || recipe.proteins.includes(proteinFilter.value)) &&
    (!term || [recipe.title, recipe.cuisine, recipe.group, recipe.subgroup, ...recipe.proteins]
      .some(value => value.toLocaleLowerCase().includes(term)))
  );
  const bySlug = new Map(matching.map(recipe => [recipe.slug, recipe]));
  const forceOpen = Boolean(term || cuisineFilter.value || proteinFilter.value);
  results.replaceChildren();
  for (const group of taxonomy.groups) {
    const subgroups = group.subcategories.map(sub => ({
      label:sub.label,
      entries:sub.slugs.map(slug => bySlug.get(slug)).filter(Boolean)
    })).filter(sub => sub.entries.length);
    if (!subgroups.length) continue;
    const section = document.createElement("section");
    section.className = "taxonomy-section";
    const details = document.createElement("details");
    details.className = "group-details";
    details.open = forceOpen || group.name === expandedGroup ||
      (selectedGroups.length === 1 && group.name === selectedGroups[0]);
    details.addEventListener("toggle", () => {
      if (details.open && !forceOpen) expandedGroup = group.name;
    });
    const title = document.createElement("summary");
    title.className = "group-heading";
    const name = document.createElement("span");
    name.textContent = group.name;
    const count = document.createElement("small");
    count.textContent = String(subgroups.reduce((sum, sub) => sum + sub.entries.length, 0));
    title.append(name, count);
    details.appendChild(title);
    const wrap = document.createElement("div");
    wrap.className = "subcategory-list";
    for (const sub of subgroups) {
      const subdetails = document.createElement("details");
      subdetails.className = "subcategory-details";
      subdetails.open = forceOpen || subgroups.length === 1 || (group.name === "Soups, Stews & Chili" && sub.label === "Chili");
      const summary = document.createElement("summary");
      const label = document.createElement("span");
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
  updateGroupButtons();
}

function selectGroups(names) {
  selectedGroups = names;
  expandedGroup = names[0] || "Soups, Stews & Chili";
  render();
}

async function loadCatalog() {
  const [page, tags] = await Promise.all([
    fetch(indexUrl,{cache:"no-cache"}),
    fetch(taxonomyUrl,{cache:"no-cache"})
  ]);
  if (!page.ok || !tags.ok) throw new Error("Could not fetch recipe catalog or taxonomy");
  const catalog = new DOMParser().parseFromString(await page.text(),"text/html");
  taxonomy = await tags.json();
  const mapped = new Map();
  for (const group of taxonomy.groups) for (const sub of group.subcategories) {
    for (const slug of sub.slugs) {
      if (mapped.has(slug)) throw new Error("Duplicate recipe taxonomy entry: " + slug);
      mapped.set(slug,{group:group.name,subgroup:sub.label});
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
      slug,title:link.textContent.trim(),url:url.href,
      cuisine:cuisineOverrides[slug] ?? (nonCuisineGroups.has(sourceGroup) ? "Unspecified" : sourceGroup),
      group:assignment.group,subgroup:assignment.subgroup,
      proteins:proteinBySlug.get(slug) || [],
      draft:link.dataset.status === "draft"
    };
  });
  if (!recipes.length || mapped.size !== recipes.length) throw new Error("Recipe taxonomy does not match catalog");
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
  cuisineFilter.addEventListener("change",render);
  proteinFilter.addEventListener("change",render);
  searchInput.addEventListener("input",render);
  clearButton.addEventListener("click",() => {
    selectedGroups = [];
    searchInput.value = cuisineFilter.value = proteinFilter.value = "";
    expandedGroup = "Soups, Stews & Chili";
    render();
  });
  for (const card of document.querySelectorAll("[data-category]")) {
    card.addEventListener("click",() => {
      searchInput.value = cuisineFilter.value = proteinFilter.value = "";
      selectGroups(photoCategoryGroups[card.dataset.category] || []);
    });
  }
  $("searchShortcut")?.addEventListener("click",() => {
    window.setTimeout(() => searchInput.focus({preventScroll:true}),0);
  });
  render();
}

loadCatalog().catch(error => {
  console.error("Cookbook catalog:",error);
  const link = document.createElement("a");
  link.href = "./index2.html";
  link.textContent = "Browse the classic cuisine index.";
  status.replaceChildren(document.createTextNode("Couldn’t load the recipe directory. "),link);
});
