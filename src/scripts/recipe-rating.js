(() => {
  "use strict";
  const toggle = document.getElementById("ratingRecipeButton");
  const panel = document.getElementById("ratingOptions");
  const stars = document.getElementById("ratingStars");
  const label = document.getElementById("ratingStatus");
  const clear = document.getElementById("clearRecipeRating");
  if (!toggle || !panel || !stars) return;
  let value = null;
  const normalize = rating => {
    const n = Number(rating);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  function paint() {
    for (const button of stars.querySelectorAll("button")) {
      const selected = value !== null && Number(button.dataset.rating) <= value;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(Number(button.dataset.rating) === value));
    }
    label.textContent = value ? value + " of 5" : "Unrated";
  }
  function update(valueToApply) {
    value = normalize(valueToApply);
    paint();
    window.CookbookEditor?.setRating(value);
  }
  for (let rating = 1; rating <= 5; rating++) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rating = String(rating);
    button.textContent = "★";
    button.setAttribute("aria-label", rating + (rating === 1 ? " star" : " stars"));
    button.addEventListener("click", () => update(rating));
    stars.appendChild(button);
  }
  toggle.addEventListener("click", () => {
    if (!panel.hidden) {
      resetPanel();
      return;
    }
    if (!window.CookbookEditorBridge?.getRecipe()) return;
    const editor = window.CookbookEditor;
    if (!editor?.active) editor?.start();
    if (!editor?.active) return;
    document.getElementById("printMenu").open = false;
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    paint();
  });
  clear.addEventListener("click", () => update(null));
  function resetPanel() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }
  document.addEventListener("click", event => {
    if (!panel.hidden && !event.target.closest(".rating-action-group")) resetPanel();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      resetPanel();
      toggle.focus();
    }
  });
  window.CookbookRating = {
    sync(rating) {value = normalize(rating);paint();resetPanel();},
    reset() {value = null;paint();resetPanel();},
    getRating() {return value;},
    display(rating) {return window.CookbookEditorBridge.displayRating(rating,"edit-recipe-rating");},
    close: resetPanel
  };
  paint();
})();