# Image publishing policy

We maintain a lossless PNG master and an optimized JPG web derivative for each recipe.

| Role | Path | Notes |
| --- | --- | --- |
| Master | `assets/masters/latvian-stew-master.png` | Save and edit the full-resolution original; prefer PNG or TIFF for future source images. |
| Web | `public/images/latvian-stew.jpg` | Optimized JPEG, progressive, quality ~88; used by GitHub Pages. |

**Current Latvian Stew original:** 263 × 1096 pixels. PNG conversion is lossless with respect to the available source image but does not add detail; commission/re-render a higher-resolution original before final printing.

## GitHub status

Both files were committed as real binary Git blobs in commit `6c2d1a02b5e7526399b0534dbb5960abc217e4c5`. Their Git blob hashes matched those calculated from the original local files:

- Web JPG: `649d6d2110204099b71d7704e5754707f6b0524d` (113,232 bytes)
- Master PNG: `b8f814cd8a6869d42c4b9ff23c33645d65091477` (520,970 bytes)

View the JPG at `https://mrjag.github.io/Recipes/public/images/latvian-stew.jpg`. Reload the cookbook and select Latvian Stew to see the page-1 photo strip.

Avoid converting an image repeatedly between JPEG and PNG. Keep the master and generate new derivatives from it.

**Privacy:** This GitHub repository and Pages site are currently public. Do not upload private family photographs or sensitive metadata until authenticated hosting is in place.
