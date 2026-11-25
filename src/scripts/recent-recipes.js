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
    const selected = payload.recipes.slice(0, 3);
    // The recent index supplies order, not authoritative display metadata.
    const page = await fetch(new URL("./recipe.html", location.href), {cache:"no-cache"});
    if (!page.ok) throw new Error("Recipe paths unavailable");
    const catalog = new DOMParser().parseFromString(await page.text(), "text/html");
    const paths = new Map([...catalog.querySelectorAll(".recipe-outline a[data-recipe]")].map(link => [
      new URL(link.getAttribute("href"), new URL("./recipe.html", location.href)).searchParams.get("recipe"),
      link.dataset.recipe
    ]));
    const metadata = await RecipeMetadata.mapLimit(selected, entry => RecipeMetadata.load(paths.get(entry.slug) || ""));
    const cards = document.createDocumentFragment();
    for (const [i, entry] of selected.entries()) {
      const data = metadata[i].value;
      if (metadata[i].error) console.warn("Using saved recent recipe details:", entry.slug, metadata[i].error);
      const recipe = data ? {
        ...entry, title:data.title, draft:data.status === "draft", photo:data.photo,
        description:RecipeMetadata.description(data) || "Recently added to the cookbook."
      } : entry;
      const link = document.createElement("a");
      link.className = "recent-recipe";
      link.href = "./recipe.html?recipe=" + encodeURIComponent(recipe.slug);
      if (recipe.photo) {
        const img = document.createElement("img");
        img.src = new URL((recipe.photo.startsWith("./") ? recipe.photo.slice(2) : recipe.photo), location.href).href;
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
