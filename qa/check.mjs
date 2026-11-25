import fs from "node:fs";
import assert from "node:assert/strict";
const read=p=>fs.readFileSync(p,"utf8");
const home=read("index.html");
const recipe=read("recipe.html");
const script=read("src/scripts/cookbook.js");
const taxonomy=JSON.parse(read("src/data/recipe-taxonomy.json"));
const catalog=[...recipe.matchAll(/data-recipe="([^"]+)"/g)].map(m=>m[1]).filter(p=>p.startsWith("recipes/")&&p.endsWith(".json"));
const assigned=taxonomy.groups.flatMap(g=>g.subcategories.flatMap(s=>s.slugs));
assert.equal(catalog.length,178);
assert.equal(new Set(assigned).size,catalog.length);
assert(recipe.includes('id="recipeView"') && recipe.includes('id="pages"'));
assert(!recipe.includes('class="index-link"'));
assert(home.includes('recipe.html" + location.search'));
assert(!home.includes('src/scripts/cookbook.js'));
assert(script.includes('buildSidebar().catch('));
for (const file of catalog) {
  assert(fs.existsSync(file),"Missing recipe: "+file);
  const data=JSON.parse(read(file));
  assert(data.title && Array.isArray(data.steps) && Array.isArray(data.ingredientGroups));
  if(data.photo)assert(fs.existsSync(data.photo.replace(/^\.\//,"")),"Missing photo "+data.photo);
}
console.log("PASS: 178 valid recipes, standalone viewer, unified navigation, legacy redirects.");
