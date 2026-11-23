(() => {
  "use strict";
  const menu = document.getElementById("headerCategories");
  if (!menu) return;
  // Preserve server-rendered category options when the taxonomy is unavailable.
  fetch("./src/data/recipe-taxonomy.json", {cache:"no-cache"})
    .then(response => { if (!response.ok) throw new Error("Category index unavailable"); return response.json(); })
    .then(data => {
      if (!Array.isArray(data.groups) || !data.groups.length) return;
      const container = menu.querySelector(".header-categories-menu");
      const links = document.createDocumentFragment();
      for (const group of data.groups) {
        if (!group.name) continue;
        const link = document.createElement("a");
        link.href = "./directory.html?category=" + encodeURIComponent(group.name);
        link.textContent = group.name;
        links.appendChild(link);
      }
      container.replaceChildren(links);
    })
    .catch(error => console.warn("Showing built-in category links:", error));
  document.addEventListener("click", event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      menu.querySelector("summary").focus();
    }
  });
})();
