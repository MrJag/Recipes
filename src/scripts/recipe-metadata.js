"use strict";

// The HTML catalog supplies stable paths and taxonomy keys only.
// Every displayed recipe title and status is read from its own recipe JSON.
// Revalidate on navigation so changes published by any editor become visible.
window.RecipeMetadata = (() => {
  const limit = 12;
  async function load(path) {
    if (!/^recipes\/[a-z0-9-]+\/[a-z0-9-]+\.json$/.test(path)) {
      throw new Error("Invalid recipe path: " + path);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(new URL(path, location.href), {cache:"no-cache", signal:controller.signal});
      if (!response.ok) throw new Error("Recipe metadata unavailable: " + path + " (" + response.status + ")");
      const recipe = await response.json();
      if (typeof recipe.title !== "string" || !recipe.title.trim()) {
        throw new Error("Missing recipe title: " + path);
      }
      return recipe;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function mapLimit(items, action) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        try { results[i] = {value:await action(items[i], i)}; }
        catch (error) { results[i] = {error}; }
      }
    }
    await Promise.all(Array.from({length:Math.min(limit, items.length)}, worker));
    return results;
  }

  function description(recipe) {
    const value = [recipe.description, recipe.headnote, recipe.subtitle]
      .find(text => typeof text === "string" && text.trim());
    if (!value) return "";
    const paragraph = value.trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
    if (paragraph.length <= 180) return paragraph;
    const cut = paragraph.slice(0, 177);
    return cut.slice(0, cut.lastIndexOf(" ") > 100 ? cut.lastIndexOf(" ") : cut.length) + "…";
  }

  return {load, mapLimit, description};
})();
