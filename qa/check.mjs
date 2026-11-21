import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

let checks = 0;
const warnings = [];
const good = (condition, description) => { assert.ok(condition, description); checks++; };
const read = file => fs.readFileSync(file, 'utf8');
const html = read('index.html');
const css = read('src/styles/cookbook.css');
const script = read('src/scripts/cookbook.js');
good(/<main id="pages"/.test(html), 'Page preview container must exist');
good(/<script defer src="\.\/src\/scripts\/cookbook\.js"/.test(html), 'Browser renderer must be referenced');
good(/\.sheet:not\(\.has-photo\) \.content/.test(css), 'Continuation pages must be full-width');
good(/index === 0 \? " has-photo"/.test(script), 'Photo strip must only appear on page 1');
good(/candidate.pages < balanced.pages/.test(script), 'Compact mode must save at least one page');
good(/@media print/.test(css) && /size: letter/.test(css), 'US Letter print styles must exist');

const recipePaths = [...html.matchAll(/value="(recipes\/[^"]+\.json)"/g)].map(m => m[1]);
good(recipePaths.length === 5, 'All five imported recipes must be selectable');
for (const file of recipePaths) {
  good(fs.existsSync(file), 'Recipe missing: ' + file);
  const recipe = JSON.parse(read(file));
  good(Boolean(recipe.title), file + ': title missing');
  good(Array.isArray(recipe.ingredientGroups) && recipe.ingredientGroups.length > 0, file + ': ingredients missing');
  good(Array.isArray(recipe.steps) && recipe.steps.length > 0, file + ': steps missing');
  good(Boolean(recipe.sourceDriveUrl), file + ': original source link missing');
  for (const group of [...recipe.ingredientGroups, ...(recipe.components || []).flatMap(c => c.ingredientGroups || [])]) {
    good(Array.isArray(group.items) && group.items.every(item => typeof item === 'string'), file + ': invalid ingredient items');
  }
  if (recipe.photo) {
    const imagePath = recipe.photo.replace(/^\.\//, '');
    const exists = fs.existsSync(imagePath);
    if (!exists && recipe.photoStatus === 'awaiting-binary-upload') {
      warnings.push(file + ': prepared JPEG not yet uploaded to ' + imagePath);
    } else {
      good(exists, file + ': photo file missing: ' + imagePath);
    }
    if (exists && imagePath.endsWith('.svg')) {
      const source = read(imagePath);
      const jpegBase64 = source.match(/data:image\/jpeg;base64,([^"]+)/)?.[1];
      good(Boolean(jpegBase64), file + ': SVG lacks embedded JPEG');
      const bytes = Buffer.from(jpegBase64, 'base64');
      good(bytes[0] === 0xff && bytes[1] === 0xd8, file + ': embedded JPEG has bad header');
      if (bytes.length < 25000) warnings.push(file + ': photo is very compressed (' + bytes.length + ' bytes). Review print quality.');
    }
  }
  if (recipe.reviewFlags?.length) warnings.push(file + ': ' + recipe.reviewFlags.length + ' original-source items need editorial review.');
}
good(!/eval\(/.test(script), 'Do not evaluate recipe data as executable JavaScript');
console.log('PASS: ' + checks + ' structural and source-integrity checks.');
for (const warning of warnings) console.warn('WARN: ' + warning);
console.log('Note: browser visual and print/PDF pagination QA requires a rendered browser run.');
