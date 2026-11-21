# Recipes

Private family cookbook project.

## Goals
- Preserve the original recipes in Google Drive while migrating them into structured recipe files.
- Use a shared recipe data model for an eventual private website and printable cookbook.
- Produce US Letter (8.5 × 11 in) print layouts using editable HTML and CSS.
- Keep all ingredients in one contiguous block, optionally using two columns.
- Use a 28% right-edge photographic strip **on page 1 only**. Continuation pages use full-width text.
- Keep recipes private; do not publish via public GitHub Pages.

## Current status
- `src/styles/cookbook.css`: editable editorial right-strip print design (v0.6).
- `index.html` and `src/scripts/cookbook.js`: browser recipe selector, layout controls, and automatic pagination.\n- Five example recipes imported as JSON from Google Drive, preserving source references and review flags.\n- The layout is under test; page-fit is checked in-browser and is not yet validated across every recipe.
- Original food photography has not yet been imported. The page-1 photo strip displays a clear placeholder until an image is supplied.

## Proposed folders
- `recipes/`: structured, versioned recipe content
- `public/images/`: licensed or personally owned recipe photography
- `src/components/`: reusable HTML rendering components
- `src/styles/`: shared screen and print styling
- `docs/`: schema, import, and publishing specifications

## Privacy
The repository is currently public to support a temporary GitHub Pages preview. **All committed recipe JSON is public** until repository visibility and hosted access are changed. GitHub Pages is not family-authenticated. Do not commit sensitive family information.

## Next steps
1. Visually validate the v0.6 browser preview and print pagination against the five imported recipes.
2. Add original high-resolution recipe photographs and test commercial print bleed.
3. Finish structured parsing of ingredients, recipe references, and serving yields.
4. Replace the temporary public Pages preview with authenticated family hosting.

## Image files

Use a PNG master at `assets/masters/<recipe-slug>.png` and a web JPG at `public/images/<recipe-slug>.jpg`. Recipe JSON `photo` points to the JPG. The PNG is retained for re-exports and later print-production work. Converting an existing JPG to PNG cannot restore details already discarded by JPG encoding.

**Latvian Stew:** replacement assets have been prepared, but the GitHub connection supports UTF-8 text writes only. The two binary images must be uploaded through GitHub's file upload interface (or Git CLI) before the published JPG resolves. The browser shows a placeholder if the image is not yet uploaded. See `docs/images.md` for instructions.
