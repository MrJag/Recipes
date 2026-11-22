# Recipes

Family cookbook project (temporarily public for GitHub Pages preview).

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
- Ten recipes imported as JSON from Google Drive, preserving source references and review flags.\n- The layout is under test; page-fit is checked in-browser and is not yet validated across every recipe.
- Latvian Stew has its verified trim-free 614 × 2559 JPEG web image and lossless PNG master committed. The other nine recipes use generated editorial photography.

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

- Check category filtering and recipe selection in the sidebar. On narrow screens, verify navigation appears above the preview. Confirm the sidebar stays out of print.
- Check the live preview and browser print preview. Confirm every page fits and only page 1 has a side photo.
- Check the ingredient divider in Greek Marinade (plain two-column ingredients) and Japanese Curry (grouped ingredients). Confirm it is centered between the columns, with clear space around bullets and wrapped text. Repeat at the default and widest photo settings. Verify a single-column list has no divider.
- Verify alternative methods restart at step 1 in each section (Greek Marinade Chicken and Lamb). Verify sequential methods continue numbering across sections and page breaks (Japanese Curry and Latvian Stew).
- Check that single- and double-digit step numerals are visually centered horizontally and vertically in their circles in the live preview and browser print preview.

## Image files

Include a portrait photo with every new recipe, including recipes added for review. Commit the web JPG and set the recipe JSON’s `photo` path in the same change. Verify that the photo loads in the right-edge strip on page 1 and that continuation pages use the full text width.

Use a PNG master at `assets/masters/<recipe-slug>.png` and a web JPG at `public/images/<recipe-slug>.jpg`. Recipe JSON `photo` points to the JPG. The PNG is retained for re-exports and later print-production work. Converting an existing JPG to PNG cannot restore details already discarded by JPG encoding.

**Latvian Stew:** The current JPEG and original PNG are committed as binary Git blobs and their Git SHAs have been verified against local image files. See `docs/images.md` for paths and asset policy.
