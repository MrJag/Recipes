# Recipes

Family cookbook project (temporarily public for GitHub Pages preview).

## Recipe viewer editing (v0.9.0)

Open a recipe at `recipe.html?recipe=<slug>`. The printer icon opens
print settings in a compact toolbar outside the document preview; use the
pencil icon to edit the recipe directly. The edit view preserves the formatted
title, italic subtitle/description, bulleted ingredients (automatically
two columns for longer lists), and numbered directions. Enter adds a
new ingredient or direction; Backspace on an empty item removes it.

The floating **Save** action opens a dialog:
- **Download JSON** saves a copy of the edited recipe to your device,
  but does not update the website.
- **Publish to GitHub** commits the edited JSON back to `main`. This
  requires a fine-grained GitHub personal access token scoped only to
  `MrJag/Recipes` with **Contents: Read and write** permission. The token
  is requested on the first save in a tab. After GitHub confirms the
  save, the token is temporarily cached in that tab's `sessionStorage`
  for up to 30 minutes and can be cleared using **Forget saved GitHub access**.
  Follow-up saves with an unexpired token run silently, without opening
  the publish dialog. The dialog opens only when the token is missing,
  expired, rejected, or another save error occurs. Rejected credentials
  are cleared automatically. **This is not a secure HttpOnly
  session cookie**: any JavaScript running on the cookbook origin can read
  sessionStorage. Truly secure server-side sessions require an authentication
  backend (for example, a GitHub OAuth service).
  The app checks the file SHA and rejects a save if the upstream recipe
  changed since the editor loaded it.

The original formatting and automatic paginated print preview return
after successful publication or when cancelling the edit. GitHub Pages
deployment may take a short time after a successful commit.

## Goals
- Preserve the original recipes in Google Drive while migrating them into structured recipe files.
- Use a shared recipe data model for an eventual private website and printable cookbook.
- Produce US Letter (8.5 × 11 in) print layouts using editable HTML and CSS.
- Keep all ingredients in one contiguous block, optionally using two columns.
- Use a 28% right-edge photographic strip **on page 1 only**. Continuation pages use full-width text.
- Return to private, authenticated family hosting after the temporary public preview.

## Current status
- `src/styles/cookbook.css`: editable editorial right-strip print design (v0.7).
- `index.html` and `src/scripts/cookbook.js`: category and recipe sidebar, layout controls, and automatic pagination.
- Seventy recipes imported as JSON from Google Drive, preserving source references and review flags.\n- The layout is under test; page-fit is checked in-browser and is not yet validated across every recipe.
- Latvian Stew has its verified trim-free 614 × 2559 JPEG web image and lossless PNG master committed. The other sixty-nine recipes use generated editorial photography.

## Proposed folders
- `recipes/`: structured, versioned recipe content
- `public/images/`: licensed or personally owned recipe photography
- `src/components/`: reusable HTML rendering components
- `src/styles/`: shared screen and print styling
- `docs/`: schema, import, and publishing specifications

## Privacy
The repository is currently public to support a temporary GitHub Pages preview. **All committed recipe JSON is public** until repository visibility and hosted access are changed. GitHub Pages is not family-authenticated. Do not commit sensitive family information.

## Next steps
1. Visually validate the v0.7 browser preview and print pagination against the imported recipes.
2. Add original high-resolution recipe photographs and test commercial print bleed.
3. Finish structured parsing of ingredients, recipe references, and serving yields.
4. Replace the temporary public Pages preview with authenticated family hosting.

## Recipe layout QA checklist

- Check that sidebar categories expand and collapse, recipe buttons open the correct recipe, and named versions can be selected under their recipe. On narrow screens, verify navigation appears above the preview. Confirm the sidebar stays out of print.
- Check the live preview and browser print preview. Confirm every page fits and only page 1 has a side photo.
- Check the ingredient divider in Greek Marinade (plain two-column ingredients) and Japanese Curry (grouped ingredients). Confirm it is centered between the columns, with clear space around bullets and wrapped text. Repeat at the default and widest photo settings. Verify a single-column list has no divider.
- Verify alternative methods restart at step 1 in each section (Greek Marinade Chicken and Lamb). Verify sequential methods continue numbering across sections and page breaks (Japanese Curry and Latvian Stew).
- Check that single- and double-digit step numerals are visually centered horizontally and vertically in their circles in the live preview and browser print preview.

## Image files

Include a portrait photo with every new recipe, including recipes added for review. Commit the web JPG and set the recipe JSON’s `photo` path in the same change. Verify that the photo loads in the right-edge strip on page 1 and that continuation pages use the full text width.

Use a PNG master at `assets/masters/<recipe-slug>.png` and a web JPG at `public/images/<recipe-slug>.jpg`. Recipe JSON `photo` points to the JPG. The PNG is retained for re-exports and later print-production work. Converting an existing JPG to PNG cannot restore details already discarded by JPG encoding.

**Latvian Stew:** The current JPEG and original PNG are committed as binary Git blobs and their Git SHAs have been verified against local image files. See `docs/images.md` for paths and asset policy.
