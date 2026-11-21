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
- `src/styles/cookbook.css`: initial v0.4 editorial right-strip design tokens and layout rules.
- Recipe importer, browser preview, JavaScript pagination, and structured recipe data are planned, not yet committed.
- No recipes or photos have been imported from Drive yet.

## Proposed folders
- `recipes/`: structured, versioned recipe content
- `public/images/`: licensed or personally owned recipe photography
- `src/components/`: reusable HTML rendering components
- `src/styles/`: shared screen and print styling
- `docs/`: schema, import, and publishing specifications

## Privacy
This repository is private. A private GitHub repository is not by itself an authenticated private family website. Hosting and family access will be designed separately.

## Next steps
1. Validate the recipe data schema against Latvian Stew, Caribbean Green Seasoning, Butter Masala, Rosemary Focaccia, and Mariano Margarita.
2. Port the v0.4 interactive prototype and add pagination tests.
3. Import the first recipes, keeping links to their original Drive documents.
4. Build a private preview and family-access plan.
