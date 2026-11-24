# Family Cookbook release checkpoints

## v0.9.0 — November 23, 2026
Recipe viewer editing milestone. The Print options trigger is now a printer icon
outside the paper preview, and a pencil toggles inline editing. Styled editable
fields preserve the recipe title, italic description, bulleted ingredients
(with automatic two-column layout for longer lists), and numbered directions.

The floating Save button offers two real persistence routes: a JSON download
or a GitHub commit using a fine-grained, repository-restricted token.
The token is entered per save and is not stored by the application.

Previous main HEAD before v0.9.0 checkpoint: `cd847b0d1bdd00c3657e9d02982291b28ca156fd`.
The v0.8.0 baseline checkpoint is commit `01049fb78082d7ae6ecd5c44f520b60c0ccaaf31`.

## v0.8.0 — November 23, 2026
Baseline before adding a dynamic, category-aware recipe photography sidebar.
The version is displayed in the shared site header across homepage, directory, and recipe pages.

Pre-version snapshot (previous main HEAD): `802afb51b6a82593da43f6ebf190b0703488770e`.

To restore a checkpoint, use the GitHub history for the version checkpoint commit
(not a force push). The version checkpoint itself is the commit that adds this file
and the header version. Subsequent features can be compared against it.

Note: the version string identifies this baseline; it is not automatically updated with every change.
