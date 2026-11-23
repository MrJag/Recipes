"use strict";

/* The newest recipe cards are generated from repository recipe-addition history.
   A static three-card fallback remains available if loading fails. */
(async function loadRecentRecipes() {
  const container = document.getElementById("recentRecipes");
  if (!container) return;
  try {
    const response = await fetch(new URL("./src/data/recent-recipes.json", location.href), {cache:"no-cache"});
    if (!response.ok) throw new Error("Recent recipes unavailable");
    const payload = await response.json();
    if (!Array.isArray(payload.recipes) || !payload.recipes.length) return;
    const cards = document.createDocumentFragment();
    for (const recipe of payload.recipes.slice(0, 3)) {
      const link = document.createElement("a");
      link.className = "recent-recipe";
      link.href = "./index2.html?recipe=" + encodeURIComponent(recipe.slug);
      if (recipe.photo) {
        const img = document.createElement("img");
        img.src = new URL(recipe.photo.replace(/^\\.\\//,""), location.href).href;
        img.alt = recipe.title;
        img.loading = "lazy";
        img.onerror = function () {
          const placeholder = makePlaceholder();
          img.replaceWith(placeholder);
        };
        link.appendChild(img);
      } else {
        link.appendChild(makePlaceholder());
      }
      const h3 = document.createElement("h3");
      h3.textContent = recipe.title;
      if (recipe.draft) {
        const badge = document.createElement("span");
        badge.className = "draft-badge";
        badge.textContent = "Draft";
        h3.append(" ", badge);
      }
      const description = document.createElement("p");
      description.textContent = recipe.description || "Recently added to the cookbook.";
      link.append(h3, description);
      cards.appendChild(link);
    }
    container.replaceChildren(cards);
  } catch (error) {
    console.warn("Showing saved recent recipe cards:", error);
  }

  function makePlaceholder() {
    const wrap = document.createElement("div");
    wrap.className = "featured-photo-placeholder";
    wrap.setAttribute("aria-label", "Photo coming soon");
    const label = document.createElement("span");
    label.textContent = "Photo coming soon";
    wrap.appendChild(label);
    return wrap;
  }
})();
