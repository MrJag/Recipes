(() => {
"use strict";

const bridge = window.CookbookEditorBridge;
const pages = document.getElementById("pages");
const editButton = document.getElementById("editRecipeButton");
const saveButton = document.getElementById("saveRecipeButton");
const printButton = document.getElementById("printButton");
const saveDialog = document.getElementById("recipeSaveDialog");
const feedback = document.getElementById("saveFeedback");
const tokenField = document.getElementById("githubWriteToken");
const status = document.getElementById("status");
const tokenPrompt = document.getElementById("githubTokenPrompt");
const cachedTokenNotice = document.getElementById("cachedTokenNotice");
const TOKEN_SESSION_KEY = "familyCookbook.githubToken.v1";
const TOKEN_TTL_MS = 30 * 60 * 1000;

function forgetSessionToken() {
  try { sessionStorage.removeItem(TOKEN_SESSION_KEY); } catch {}
}
function readSessionToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved.token !== "string" ||
        !Number.isFinite(saved.expiresAt) || Date.now() >= saved.expiresAt) {
      forgetSessionToken();
      return null;
    }
    return saved.token;
  } catch {
    forgetSessionToken();
    return null;
  }
}
function rememberSessionToken(token) {
  // Only after GitHub confirms the write. This is tab-scoped sessionStorage,
  // NOT an HttpOnly cookie: JavaScript running on this origin can read it.
  try {
    sessionStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify({
      token, expiresAt: Date.now() + TOKEN_TTL_MS
    }));
  } catch {
    // Private browsing or disabled storage: save still succeeds, no reuse.
  }
}
function setTokenPromptVisible(visible) {
  tokenPrompt.hidden = !visible;
  cachedTokenNotice.hidden = visible;
}
function openSaveDialog() {
  if (saveInProgress) return;
  const reused = Boolean(readSessionToken());
  setTokenPromptVisible(!reused);
  if (reused) {
    // No modal on a cached-token save. A failed request opens it with details.
    void publish({silent:true});
  } else {
    saveDialog.showModal();
  }
}

let editing = false;
let dirty = false;
let draft = null;
let saveInProgress = false;
let restoreScroll = 0;

const publishButton = document.getElementById("publishRecipeGithub");

function setSavingState(busy, ratingSave=false) {
  for (const button of [saveButton, publishButton]) {
    if (!button) continue;
    button.disabled = busy;
    button.classList.toggle("is-saving", busy);
    button.setAttribute("aria-busy", String(busy));
    if (button === saveButton) button.textContent = busy ? "Saving…" : "Save";
    if (button === publishButton) button.textContent = busy ? "Publishing…" : "Publish to GitHub";
  }
  // Only the visible button is announced, and repeated clicks are blocked.
  if (busy) status.textContent = "Saving recipe to GitHub…";
  // Only rating-only saves animate the star control. Recipe edits keep
  // progress feedback on the regular Save button.
  window.CookbookRating?.setSavingState(busy && ratingSave);
}

const clone = object => JSON.parse(JSON.stringify(object));
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = String(text);
  return element;
}
function editable(tag, className, value, label, placeholder) {
  const element = node(tag, className, value || "");
  element.contentEditable = "true";
  element.spellcheck = true;
  element.setAttribute("role", "textbox");
  element.setAttribute("aria-label", label);
  element.setAttribute("data-placeholder", placeholder || label);
  element.addEventListener("input", () => { dirty = true; });
  element.addEventListener("paste", event => {
    // Never paste external rich HTML into a cookbook field.
    event.preventDefault();
    const plain = event.clipboardData?.getData("text/plain") || "";
    document.execCommand("insertText", false, plain);
  });
  return element;
}
function editableList(values, type, label) {
  const list = node(type === "directions" ? "ol" : "ul", "edit-list");
  list.dataset.listType = type;
  const refreshList = () => {
    if (type === "ingredients") {
      list.classList.toggle("two-column",
        [...list.children].filter(li => li.classList.contains("edit-list-item")).length >= 9);
    }
    if (type === "directions") {
      let number = 1;
      for (const li of list.children) {
        if (li.dataset.stageHeading) li.removeAttribute("value");
        else li.value = number++;
      }
    }
  };
  const addItem = (value, after) => {
    const heading = type === "directions" && value && typeof value === "object" &&
      Object.hasOwn(value,"heading");
    const display = heading ? value.heading :
      typeof value === "string" ? value :
      [value?.lead,value?.text].filter(Boolean).join(" ");
    const li = editable("li", heading ? "edit-stage-heading" : "edit-list-item",
      display || "", heading ? "Direction group heading" : label + " item",
      heading ? "Group heading" : "Type here");
    if (heading) li.dataset.stageHeading = "true";
    li.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const sibling = addItem("", li);
        sibling.focus();
      } else if (event.key === "Backspace" && !li.textContent.trim() &&
                 list.children.length > 1) {
        event.preventDefault();
        const next = li.previousElementSibling || li.nextElementSibling;
        li.remove();
        refreshList();
        next?.focus();
        dirty = true;
      }
    });
    if (after) after.after(li); else list.appendChild(li);
    if (type === "directions" && !heading && value && typeof value === "object") {
      li.dataset.originalStep = JSON.stringify(value);
      li.dataset.originalText = display;
    }
    refreshList();
    dirty = true;
    return li;
  };
  list.addEventListener("focusin", event => {
    const item = event.target.closest("li");
    if (item && item.parentElement === list) list._selectedItem = item;
  });
  list.insertHeading = () => {
    const heading = addItem({heading:""}, list._selectedItem || list.lastElementChild);
    heading.focus();
    return heading;
  };
  for (const value of values?.length ? values : [""]) addItem(value, null);
  return list;
}
function sectionHeading(text) {
  return node("h2", "section-heading", text);
}
function ingredientGroups(groups, identifier) {
  const holder = node("div", "edit-groups");
  holder.dataset.groups = identifier;
  const makeGroup = (group) => {
    const section = node("div","edit-ingredient-group");
    const heading = editable("h3","edit-group-name",group.title || "",
      "Ingredient group heading","Group heading (optional)");
    const list = editableList(group.items || [],"ingredients","Ingredient");
    const control = node("button","edit-insert-group",
      "+ Group heading after selected ingredient");
    control.type = "button";
    control.setAttribute("aria-label","Insert ingredient group heading after selected ingredient");
    control.addEventListener("click", () => {
      const entries = [...list.querySelectorAll(":scope > li.edit-list-item")];
      const selected = list._selectedItem && entries.includes(list._selectedItem)
        ? list._selectedItem : entries[entries.length-1];
      const split = Math.max(0, entries.indexOf(selected)+1);
      const moved = entries.slice(split).map(item => item.textContent.trim()).filter(Boolean);
      const next = makeGroup({title:null,items:moved});
      section.after(next);
      holder.classList.toggle("grouped", holder.children.length > 1);
      for (const li of entries.slice(split)) li.remove();
      list.classList.toggle("two-column",list.children.length >= 9);
      dirty = true;
      next.querySelector(".edit-group-name").focus();
    });
    section.append(heading,list,control);
    return section;
  };
  (groups?.length ? groups : [{title:null,items:[]}]).forEach(group =>
    holder.appendChild(makeGroup(group)));
  holder.classList.toggle("grouped", holder.children.length > 1);
  return holder;
}
function directions(steps, identifier) {
  const section = node("section", "edit-directions");
  section.dataset.directions = identifier;
  section.appendChild(sectionHeading("Directions"));
  const list = editableList(steps || [],"directions","Direction");
  const control = node("button","edit-insert-stage","+ Heading after selected step");
  control.type = "button";
  control.setAttribute("aria-label","Insert direction heading after selected step");
  control.addEventListener("click", () => {
    list.insertHeading();
    dirty = true;
  });
  section.append(control,list);
  return section;
}
function valueOf(selector) {
  const element = pages.querySelector(selector);
  if (!element) return "";
  // Editable descriptions can contain DOM paragraphs/divs produced by Enter.
  // innerText preserves their visible line breaks; textContent concatenates them.
  if (element.classList.contains("edit-headnote")) {
    return element.innerText.replace(/\r\n?/g, "\n").trim();
  }
  return element.textContent.trim();
}
function readGroups(holder) {
  return [...holder.querySelectorAll(":scope > .edit-ingredient-group")].map(section => ({
    title: section.querySelector(".edit-group-name").textContent.trim() || null,
    items: [...section.querySelectorAll("ul > li")].map(li => li.textContent.trim()).filter(Boolean)
  })).filter(group => group.title || group.items.length);
}
function readSteps(section) {
  return [...section.querySelectorAll("ol > li")].map(li => {
    const text = li.textContent.trim();
    if (!text) return null;
    if (li.dataset.stageHeading) return {heading:text};
    // Preserve structured {lead,text} steps unless the user actually edits them.
    if (li.dataset.originalStep && text === li.dataset.originalText) {
      return JSON.parse(li.dataset.originalStep);
    }
    return text;
  }).filter(Boolean);
}
function buildEditPage(recipe) {
  pages.replaceChildren();
  const sheet = node("article","sheet edit-sheet" + (recipe.photo ? " has-photo" : ""));
  if (recipe.photo) {
    const photo = node("aside","photo-strip");
    const image = node("img","strip-image");
    image.src = recipe.photo;
    image.alt = "";
    photo.appendChild(image);
    sheet.appendChild(photo);
  }
  const content = node("div","content edit-content");
  content.appendChild(node("div","category",(recipe.category || "Recipes").toUpperCase()));
  content.appendChild(editable("h1","edit-main-title",recipe.title,"Recipe title","Recipe title"));
  const subtitle = editable("div","edit-subtitle",recipe.subtitle || "","Subtitle","Subtitle (optional)");
  subtitle.dataset.editField = "subtitle";
  content.appendChild(subtitle);
  content.appendChild(window.CookbookRating?.display(draft?.rating) ||
    node("div","edit-recipe-rating","Unrated"));
  const meta = node("div","edit-meta");
  for (const [key,label] of [["servings","Serves"],["yield","Yield"],["prepTime","Prep"],["cookTime","Cook"]]) {
    const wrapper = node("label",null,label);
    const control = editable("span",null,recipe[key] || "",label,label + " (optional)");
    control.dataset.meta = key;
    wrapper.appendChild(control);
    meta.appendChild(wrapper);
  }
  content.appendChild(meta);
  content.appendChild(editable("p","edit-headnote",recipe.headnote || "","Description","Description (italic)"));
  content.appendChild(node("p","edit-help","Edit directly in the recipe. Press Enter to add an ingredient or a direction; delete an empty line with Backspace."));
  const ingredients = node("section","ingredients");
  ingredients.appendChild(sectionHeading("Ingredients"));
  ingredients.appendChild(ingredientGroups(recipe.ingredientGroups,"main"));
  content.appendChild(ingredients);
  const notesSection = node("section", "ingredient-notes edit-ingredient-notes");
  notesSection.dataset.editField = "ingredientNotes";
  notesSection.appendChild(sectionHeading("Ingredient Notes"));
  notesSection.appendChild(editableList(recipe.ingredientNotes || [],
    "ingredient-notes", "Ingredient note"));
  content.appendChild(notesSection);
  if (Array.isArray(recipe.components)) {
    const components = node("div","edit-components");
    recipe.components.forEach((component,index) => {
      const section = node("section","edit-component");
      section.dataset.componentIndex = index;
      section.appendChild(editable("h2","section-heading edit-component-title",component.title || "","Component title","Component title"));
      section.appendChild(ingredientGroups(component.ingredientGroups || [],"component"));
      section.appendChild(directions(component.steps || [],"component"));
      content.appendChild(section);
    });
  }
  content.appendChild(directions(recipe.steps || [],"main"));
  const source = editable("p","source edit-source-note",recipe.sourceNote || "",
    "Source, inspiration or attribution","Source or attribution (optional)");
  source.dataset.editField = "sourceNote";
  content.appendChild(source);
  sheet.appendChild(content);
  pages.appendChild(sheet);
  dirty = false;
}
function collectDraft() {
  if (!editing) throw new Error("Not editing a recipe.");
  const result = clone(draft);
  const title = valueOf(".edit-main-title");
  if (!title) throw new Error("Recipe title cannot be empty.");
  result.title = title;
  result.subtitle = valueOf(".edit-subtitle");
  result.headnote = valueOf(".edit-headnote");
  const attribution = valueOf(".edit-source-note");
  if (attribution) result.sourceNote = attribution;
  else delete result.sourceNote;
  const selectedRating = window.CookbookRating?.getRating();
  if (selectedRating) result.rating = selectedRating;
  else delete result.rating;
  for (const field of pages.querySelectorAll("[data-meta]")) {
    const value = field.textContent.trim();
    if (value) result[field.dataset.meta] = value;
    else delete result[field.dataset.meta];
  }
  result.ingredientGroups = readGroups(pages.querySelector('[data-groups="main"]'));
  const notes = [...pages.querySelectorAll('.edit-ingredient-notes ul > li')]
    .map(item => item.textContent.trim()).filter(Boolean);
  if (notes.length) result.ingredientNotes = notes;
  else delete result.ingredientNotes;
  if (!result.ingredientGroups.some(group => group.items.length)) throw new Error("Add at least one ingredient.");
  result.steps = readSteps(pages.querySelector('[data-directions="main"]'));
  if (!result.steps.length && !(result.components || []).some(component => component.steps?.length)) {
    throw new Error("Add at least one direction.");
  }
  for (const section of pages.querySelectorAll("[data-component-index]")) {
    const index = Number(section.dataset.componentIndex);
    if (!result.components?.[index]) continue;
    const component = result.components[index];
    component.title = section.querySelector(".edit-component-title").textContent.trim();
    component.ingredientGroups = readGroups(section.querySelector('[data-groups="component"]'));
    component.steps = readSteps(section.querySelector('[data-directions="component"]'));
  }
  return result;
}
function fullRecipeFile(edited) {
  const file = clone(bridge.getSource());
  const index = bridge.getVariantIndex();
  const fields = ["title","subtitle","headnote","servings","yield","prepTime","cookTime","ingredientGroups","ingredientNotes","steps","components","rating","sourceNote"];
  const target = index < 0 ? file : file.variants[index];
  if (!target) throw new Error("The selected recipe version is unavailable.");
  for (const field of fields) {
    if (Object.hasOwn(edited,field)) target[field] = edited[field];
    else delete target[field];
  }
  return file;
}
function start() {
  if (editing || !bridge.getRecipe()) return;
  if (document.getElementById("recipeView").hidden) return;
  draft = clone(bridge.getRecipe());
  window.CookbookRating?.sync(draft.rating);
  restoreScroll = window.scrollY;
  editing = true;
  printButton.disabled = true;
  editButton.setAttribute("aria-pressed","true");
  editButton.setAttribute("aria-label","Cancel editing");
  editButton.title = "Cancel editing";
  saveButton.hidden = false;
  document.getElementById("printMenu").open = false;
  buildEditPage(draft);
  status.textContent = "Editing · changes are not published until you save";
}
function close({discard=false}={}) {
  if (!editing || saveInProgress) return false;
  if (!discard && dirty && !confirm("Discard your unsaved recipe edits?")) return false;
  editing = false;
  dirty = false;
  draft = null;
  window.CookbookRating?.close();
  if (saveDialog.open) saveDialog.close();
  tokenField.value = "";
  editButton.setAttribute("aria-pressed","false");
  editButton.setAttribute("aria-label","Edit recipe");
  editButton.title = "Edit recipe";
  saveButton.hidden = true;
  printButton.disabled = false;
  pages.replaceChildren();
  window.CookbookRating?.sync(bridge.getRecipe()?.rating);
  bridge.requestRender();
  return true;
}
let ratingOnlySave = false;
function saveRating(value) {
  if (editing) return showSave();
  const source = bridge.getSource();
  const current = bridge.getRecipe();
  if (!source || !current) return;
  const cloneRecipe = clone(current);
  if (value) cloneRecipe.rating = value;
  else delete cloneRecipe.rating;
  const file = fullRecipeFile(cloneRecipe);
  ratingOnlySave = true;
  feedback.textContent = "";
  tokenField.value = "";
  saveDialog.dataset.filePath = bridge.getPath() || "";
  saveDialog.dataset.payload = JSON.stringify(file,null,2) + "\n";
  openSaveDialog();
}
function showSave() {
  ratingOnlySave = false;
  try {
    const updated = collectDraft();
    const file = fullRecipeFile(updated);
    feedback.textContent = "";
    tokenField.value = "";
    saveDialog.dataset.filePath = bridge.getPath() || "";
    saveDialog.dataset.payload = JSON.stringify(file,null,2) + "\n";
    openSaveDialog();
  } catch(error) {
    alert("Unable to save: " + error.message);
  }
}
function download() {
  const path = saveDialog.dataset.filePath;
  const payload = saveDialog.dataset.payload;
  const url = URL.createObjectURL(new Blob([payload],{type:"application/json"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = path.split("/").pop() || "recipe.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  feedback.textContent = "JSON downloaded. This does not change the published site.";
}
function toBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i,i+8192));
  }
  return btoa(binary);
}
async function parseGithubResponse(response, operation) {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(operation + " returned an empty response (HTTP " + response.status + "). Check GitHub before retrying.");
  try { return JSON.parse(raw); }
  catch { throw new Error(operation + " returned invalid JSON (HTTP " + response.status + "). Check GitHub before retrying."); }
}
// Confirm ambiguous saves against GitHub rather than treating a malformed PUT
// confirmation as proof of failure. Use the original token only in this request.
async function verifyPublishedContent(url, headers, expected) {
  const check = new URL(url);
  check.searchParams.set("ref", "main");
  check.searchParams.set("_verify", String(Date.now()));
  const response = await fetch(check.href, {headers, cache:"no-store"});
  if (!response.ok) throw new Error("Verification read failed (HTTP " + response.status + ")");
  const file = await parseGithubResponse(response, "GitHub verification");
  if (typeof file.content !== "string" || !file.content.trim()) {
    throw new Error("Verification returned no recipe contents");
  }
  let committed;
  try {
    const bytes = Uint8Array.from(atob(file.content.replace(/\\s/g,"")), c=>c.charCodeAt(0));
    committed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Verification returned unreadable recipe JSON");
  }
  return JSON.stringify(committed) === JSON.stringify(expected);
}
async function publish({silent=false}={}) {
  if (saveInProgress) return;
  const typedToken = tokenField.value.trim();
  const token = typedToken || readSessionToken();
  const usingCachedToken = !typedToken && Boolean(token);
  if (!token) {
    setTokenPromptVisible(true);
    if (!saveDialog.open) saveDialog.showModal();
    feedback.textContent = "Enter a fine-grained GitHub token to publish, or download the JSON instead.";
    tokenField.focus();
    return;
  }
  const path = saveDialog.dataset.filePath;
  if (!/^recipes\/[a-z0-9-]+\/[a-z0-9-]+\.json$/.test(path)) {
    if (!saveDialog.open) saveDialog.showModal();
    feedback.textContent = "Recipe path could not be verified; nothing was published.";
    return;
  }
  const content = saveDialog.dataset.payload;
  const url = "https://api.github.com/repos/MrJag/Recipes/contents/" + path;
  const headers = {"Authorization":"Bearer " + token,"Accept":"application/vnd.github+json",
                   "X-GitHub-Api-Version":"2022-11-28"};
  const savingRating = ratingOnlySave;
  saveInProgress = true;
  setSavingState(true, savingRating);
  feedback.textContent = "Checking latest GitHub revision…";
  try {
    const get = await fetch(url + "?ref=main",{headers,cache:"no-store"});
    if (!get.ok) {
      const error = new Error("Could not load latest GitHub file (HTTP " + get.status + "). Check token permissions.");
      error.githubStatus = get.status;
      throw error;
    }
    const latest = await parseGithubResponse(get, "GitHub read");
    if (!latest.sha) throw new Error("Missing revision SHA; refusing to overwrite.");
    if (typeof latest.content !== "string" || !latest.content.trim()) {
      throw new Error("GitHub returned no recipe file content. Nothing was published.");
    }
    const latestBytes = Uint8Array.from(atob(latest.content.replace(/\s/g,"")),c=>c.charCodeAt(0));
    const latestJson = new TextDecoder().decode(latestBytes);
    let latestData;
    try { latestData = JSON.parse(latestJson); }
    catch { throw new Error("GitHub returned incomplete recipe JSON. Nothing was published."); }
    const newJson = JSON.parse(content);
    const baseJson = bridge.getSource();
    if (JSON.stringify(latestData) !== JSON.stringify(baseJson)) {
      throw new Error("Someone else changed this recipe since you opened it. Refresh and reconcile before publishing.");
    }
    feedback.textContent = "Publishing the updated recipe to GitHub…";
    const put = await fetch(url,{
      method:"PUT",headers:{...headers,"Content-Type":"application/json"},
      body:JSON.stringify({
        message:"Edit recipe: " + (newJson.title || "Untitled"),
        content:toBase64(content),sha:latest.sha,branch:"main"
      })
    });
    if (!put.ok) {
      const raw = await put.text();
      let error = {message:"No details returned"};
      if (raw.trim()) { try {error = JSON.parse(raw);} catch {error = {message:"Unexpected non-JSON response"};} }
      const failure = new Error("GitHub rejected the save (HTTP " + put.status + "): " + error.message);
      failure.githubStatus = put.status;
      throw failure;
    }
    let result;
    let confirmationIssue = null;
    try {
      result = await parseGithubResponse(put, "GitHub publish");
      if (!result.commit?.sha) throw new Error("GitHub returned no commit ID");
    } catch (error) {
      confirmationIssue = error;
    }
    if (confirmationIssue) {
      feedback.textContent = "GitHub accepted the request; verifying saved recipe content…";
      let verified = false;
      try {
        verified = await verifyPublishedContent(url, headers, newJson);
      } catch (error) {
        throw new Error("GitHub accepted the save request, but confirmation could not be verified (" +
          error.message + "). Check the repository before retrying; your edits are still available.");
      }
      if (!verified) {
        throw new Error("GitHub accepted the save request, but the repository content does not match your edits. " +
          "Do not retry blindly; check the recipe history first.");
      }
      feedback.textContent = "Published successfully — verified against GitHub. Pages may take time to update.";
    } else {
      feedback.textContent = "Published! GitHub commit: " + result.commit.sha.slice(0,10) + ". Pages may take time to update.";
    }
    rememberSessionToken(token);
    tokenField.value = "";
    const update = JSON.parse(content);
    saveInProgress = false;
    editing = false;
    dirty = false;
    saveButton.hidden = true;
      editButton.setAttribute("aria-pressed","false");
    editButton.setAttribute("aria-label","Edit recipe");
    editButton.title = "Edit recipe";
    printButton.disabled = false;
    bridge.setSavedRecipe(update);
    saveDialog.dataset.payload = "";
    ratingOnlySave = false;
    window.CookbookRating?.close({discard:false});
    // Manual saves keep the confirmation dialog; cached-token saves never
    // show it. Updating the recipe preview is the success indication.
    if (silent) {
      status.textContent = "Recipe saved to GitHub.";
      if (saveDialog.open) saveDialog.close();
    }
  } catch(error) {
    const denied = error?.githubStatus === 401 || error?.githubStatus === 403;
    if (denied) {
      forgetSessionToken();
      setTokenPromptVisible(true);
    }
    feedback.textContent = (error instanceof TypeError
      ? "GitHub could not be reached. Check your connection or browser extensions."
      : error.message) + " Your edits remain in the editor." +
      (denied && usingCachedToken ? " Enter a new GitHub token to retry." : "");
    tokenField.value = "";
    // Surface errors only, including auth expiry, stale revisions, network
    // errors, and ambiguous commit confirmations. Keep the edit draft intact.
    if (!saveDialog.open) saveDialog.showModal();
  } finally {
    saveInProgress = false;
    setSavingState(false, savingRating);
  }
}
editButton.addEventListener("click",()=> editing ? close() : start());
saveButton.addEventListener("click",showSave);
document.getElementById("forgetGithubSession").addEventListener("click", () => {
  forgetSessionToken();
  setTokenPromptVisible(true);
  feedback.textContent = "Saved GitHub access cleared for this tab.";
});
document.getElementById("downloadRecipeJson").addEventListener("click",download);
document.getElementById("publishRecipeGithub").addEventListener("click",()=>void publish());
document.getElementById("dismissSaveDialog").addEventListener("click",()=>saveDialog.close());
saveDialog.addEventListener("close",()=>{
  tokenField.value = "";
  setTokenPromptVisible(true);
  saveDialog.dataset.payload = "";
  if (ratingOnlySave && !saveInProgress) {
    ratingOnlySave = false;
    window.CookbookRating?.discard();
  }
});
window.addEventListener("beforeunload",event=>{
  if (editing && dirty) {event.preventDefault();event.returnValue="";}
});
document.addEventListener("click",event=>{
  if (!editing) return;
  const link = event.target.closest('a[data-recipe], .recipe-versions button');
  if (!link) return;
  if (!close()) {event.preventDefault();event.stopImmediatePropagation();}
},true);
window.CookbookEditor = {
  get active(){return editing;},
  start,
  close,
  saveRating,
  setRating(rating) {
    if (!editing) return;
    if (rating) draft.rating = rating;
    else delete draft.rating;
    const display = pages.querySelector(".edit-recipe-rating");
    display?.replaceWith(window.CookbookRating.display(rating));
    dirty = true;
  },
  get dirty(){return dirty;}
};
})();
