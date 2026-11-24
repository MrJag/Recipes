(() => {
  "use strict";
  const toggle = document.getElementById("ratingRecipeButton");
  const panel = document.getElementById("ratingOptions");
  const stars = document.getElementById("ratingStars");
  if (!toggle || !panel || !stars) return;

  const normalize = number => {
    const n = Number(number);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  };
  let saved = null;
  let value = null;
  let pending = false;
  let saving = false;
  let hovered = null;

  function paint() {
    const illuminated = hovered ?? value;
    for (const button of stars.querySelectorAll("button")) {
      const current = Number(button.dataset.rating);
      button.classList.toggle("selected", illuminated !== null && current <= illuminated);
      button.setAttribute("aria-pressed", String(current === value));
      button.setAttribute("aria-label", current + " star" + (current === 1 ? "" : "s") +
        (current === value ? " (selected, click to clear)" : ""));
    }
    for (const button of stars.querySelectorAll("button")) button.disabled = saving;
  }
  function preview() {
    window.CookbookEditor?.setRating(value);
    // In normal reading mode update only the rating node, not the entire
    // paginated preview (which would recreate the photograph).
    if (!window.CookbookEditor?.active) {
      const bridge = window.CookbookEditorBridge;
      document.querySelectorAll("#pages .recipe-header .recipe-rating").forEach(el => {
        el.replaceWith(bridge.displayRating(value));
      });
    }
  }
  function choose(next) {
    if (saving) return;
    const selected = normalize(next);
    value = value === selected ? null : selected;
    pending = value !== saved;
    hovered = null;
    paint();
    preview();
    if (pending) {
      // A click is the save action; cached credentials publish silently.
      if (window.CookbookEditor?.active) {
        document.getElementById("saveRecipeButton").click();
      } else {
        window.CookbookEditor?.saveRating(value);
      }
    }
  }
  for (let n = 1; n <= 5; n++) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rating = String(n);
    button.textContent = "★";
    button.addEventListener("mouseenter", () => {hovered = n; paint();});
    button.addEventListener("focus", () => {hovered = n; paint();});
    button.addEventListener("click", () => choose(n));
    stars.appendChild(button);
  }
  stars.addEventListener("mouseleave", () => {hovered = null; paint();});
  stars.addEventListener("focusout", event => {
    if (!stars.contains(event.relatedTarget)) {hovered = null; paint();}
  });
  function close({discard=true}={}) {
    hovered = null;
    paint();
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (discard && pending && !window.CookbookEditor?.active) {
      value = saved;
      pending = false;
      paint();
      preview();
    }
  }
  toggle.addEventListener("click", () => {
    if (!panel.hidden) return close();
    if (!window.CookbookEditorBridge?.getRecipe()) return;
    document.getElementById("printMenu").open = false;
    hovered = null;
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    paint();
  });
  document.addEventListener("click", event => {
    if (!panel.hidden && !event.target.closest(".rating-action-group")) {
      // Save dialog was opened from the rating panel; retain the preview
      // until the dialog's outcome is known.
      if (!document.getElementById("recipeSaveDialog").open) close();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      close();
      toggle.focus();
    }
  });
  window.CookbookRating = {
    sync(rating) {saved = normalize(rating); value = saved; pending = false; hovered = null; paint(); close({discard:false});},
    reset() {saved = null; value = null; pending = false; hovered = null; paint(); close({discard:false});},
    getRating() {return value;},
    display(rating) {return window.CookbookEditorBridge.displayRating(rating, "edit-recipe-rating");},
    close,
    setSavingState(busy) {
      saving = Boolean(busy);
      toggle.disabled = saving;
      toggle.classList.toggle("is-saving", saving);
      toggle.setAttribute("aria-busy", String(saving));
      stars.setAttribute("aria-busy", String(saving));
      paint();
    },
    discard() { value = saved; pending = false; paint(); close({discard:false}); preview(); }
  };
  paint();
})();