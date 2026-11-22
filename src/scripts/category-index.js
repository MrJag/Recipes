"use strict";

const categoryRecipes = {
  Drinks: ["frozen-margarita", "iced-lemon-green-tea-with-basil-seeds", "mariano-margarita"],
  Condiments: ["chili-powder", "spanish-picada", "neapolitan-pizza-sauce", "lawrys-seasoning-clone", 
    "raspberry-vinaigrette", "caribbean-green-seasoning", "chinese-white-stir-fry-sauce",
    "greek-marinade", "hawaiian-chili-pepper-water", "pomodoro-sauce", "bolognese-ragu",
    "codys-salsa", "salsa-roja", "catalan-sofrito", "peanut-sauce", "russells-yellow-curry-spice-blend"
  ],
  Sides: ["burger-buns", "mashed-potatoes", "creamed-corn", "cranberry-relish", "pita-bread", "persian-rice-with-tahdig", "baba-ganoush", 
    "cornbread", "dinner-rolls", "roasted-acorn-squash", "southwestern-roasted-cauliflower",
    "jasmine-coconut-rice", "indian-basmati-rice-pilau", "long-grain-rice-with-mustard-seeds",
    "rosemary-focaccia", "coconut-lime-rice"
  ],
  Mains: ["pistachio-stuffed-pork-tenderloin", "beef-short-rib-biryani", "hutchins-style-ribs", "hutchins-style-brisket", "tamarind-glazed-pork-chops", "pan-fried-pork-chops", "roasted-chicken-bombay-potatoes", "joojeh-kebab", "texas-twinkies", "detroit-style-pizza", "dal-tadka", "mariannas-chili", "spatchcocked-hawaiian-chicken", "chicken-plov", "uzbek-plov-lamb", "clay-pot-rice-short-ribs", "chicken-congee", "hatch-green-chili", "hawaiian-teriyaki-chicken", "hawaiian-stir-fry-noodles", "shakshuka", "neapolitan-pizza", "lamb-biryani", "turkish-kofta-kebab", "smoked-pulled-pork", "3-2-1-ribs", "mariannas-chicken-kotleti", 
    "beef-stroganoff", "red-beans-and-rice", "tomato-basil-soup", "belgian-waffles",
    "philips-waffles", "szechuan-green-beans-and-pork", "taiwanese-popcorn-chicken",
    "hawaiian-huli-huli-chicken", "butter-masala-chicken", "goan-pork-vindaloo",
    "paneer-butter-masala", "tandoori-chicken", "fresh-pasta-from-scratch", "japanese-curry",
    "enchiladas-suizas", "pollo-asado", "pork-carnitas", "skirt-steak-fajitas", "latvian-stew",
    "chicken-paella", "chicken-satay", "thai-basil-chicken", "lemongrass-chicken",
    "pollo-a-la-brasa", "shashlik-pork-kebab"
  ],
  Desserts: ["coconut-stracciatella-gelato", "buttery-apple-tart", "cranberry-orange-muffins", "espresso-oreo-gelato", "hectors-tres-leches", "mini-pavlovas"]
};

const cuisineOverrides = {
  "frozen-margarita": "Mexican",
  "persian-rice-with-tahdig": "Persian",
  "turkish-kofta-kebab": "Turkish",
  "belgian-waffles": "Belgian",
  "latvian-stew": "Latvian",
  "mariano-margarita": "Mexican",
  "taiwanese-popcorn-chicken": "Taiwanese"
};
const recipeCategories = new Map(Object.entries(categoryRecipes).flatMap(
  ([category, slugs]) => slugs.map(slug => [slug, category])
));
const nonCuisineGroups = new Set(["Breakfast", "Dessert", "Drinks"]);
const cuisineFilter = document.getElementById("cuisineFilter");
const results = document.getElementById("categoryResults");
const status = document.getElementById("categoryStatus");
const indexUrl = new URL("./index.html", location.href);

function renderCategories(recipes) {
  const matching = recipes.filter(recipe => !cuisineFilter.value || recipe.cuisine === cuisineFilter.value);
  results.replaceChildren();
  for (const category of [...Object.keys(categoryRecipes), "Uncategorized"]) {
    const entries = matching.filter(recipe => recipe.category === category);
    if (!entries.length) continue;

    const section = document.createElement("section");
    const heading = document.createElement("h2");
    heading.textContent = category;
    const list = document.createElement("ul");
    for (const recipe of entries) {
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
      const cuisine = document.createElement("span");
      cuisine.className = "recipe-cuisine";
      cuisine.textContent = recipe.cuisine;
      item.append(link, cuisine);
      list.appendChild(item);
    }
    section.append(heading, list);
    results.appendChild(section);
  }
  status.textContent = matching.length
    ? `${matching.length} ${matching.length === 1 ? "recipe" : "recipes"}`
    : "No recipes match this cuisine.";
}

async function loadCatalog() {
  const response = await fetch(indexUrl, {cache: "no-cache"});
  if (!response.ok) throw new Error("Catalog request failed");
  const catalog = new DOMParser().parseFromString(await response.text(), "text/html");
  const recipes = [...catalog.querySelectorAll(".recipe-outline a[data-recipe]")].map(link => {
    const group = link.closest("section").querySelector("h2").textContent.trim();
    const url = new URL(link.getAttribute("href"), indexUrl);
    const slug = url.searchParams.get("recipe");
    return {
      title: link.textContent.trim(),
      url: url.href,
      cuisine: cuisineOverrides[slug] ?? (nonCuisineGroups.has(group) ? "Unspecified" : group),
      category: recipeCategories.get(slug) ?? "Uncategorized",
      draft: link.dataset.status === "draft"
    };
  });
  if (!recipes.length) throw new Error("Catalog is empty");
  recipes.sort((a, b) => a.cuisine.localeCompare(b.cuisine) || a.title.localeCompare(b.title));
  const cuisines = [...new Set(recipes.map(recipe => recipe.cuisine))].sort((a, b) => a.localeCompare(b));
  for (const cuisine of cuisines) cuisineFilter.add(new Option(cuisine, cuisine));
  cuisineFilter.disabled = false;
  cuisineFilter.addEventListener("change", () => renderCategories(recipes));
  renderCategories(recipes);
}

loadCatalog().catch(() => {
  status.textContent = "Couldn’t load the recipe catalog. Open the original cuisine index to browse recipes.";
});
