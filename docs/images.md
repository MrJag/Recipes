# Image publishing policy

We maintain a lossless PNG master and an optimized JPG web derivative for each recipe.

| Role | Path | Notes |
| --- | --- | --- |
| Master | `assets/masters/latvian-stew-master.png` | Save and edit the full-resolution original; prefer PNG or TIFF for future source images. |
| Web | `public/images/latvian-stew.jpg` | Optimized JPEG, progressive, quality ~88; used by GitHub Pages. |

**Current Latvian Stew original:** 263 × 1096 pixels. PNG conversion is lossless with respect to the available source image but does not add detail; commission/re-render a higher-resolution original before final printing.

## Upload to GitHub

The connected GitHub API only accepts UTF-8 text for file creates/updates, so binary files are intentionally not passed through the SVG/base64 workaround.

1. From the GitHub repository, choose **Add file → Upload files**.
2. Upload the PNG to `assets/masters/` and the JPG to `public/images/`. The GitHub web interface allows you to first navigate to or create those folders.
3. Commit both binary files to `main`.
4. Verify the JPG directly at `https://mrjag.github.io/Recipes/public/images/latvian-stew.jpg`.
5. Reload `https://mrjag.github.io/Recipes/` and select Latvian Stew. The photo strip is shown on page 1 only.

Avoid converting an image repeatedly between JPEG and PNG. Keep the master and generate new derivatives from it.

**Privacy:** This GitHub repository and Pages site are currently public. Do not upload private family photographs or sensitive metadata until authenticated hosting is in place.
