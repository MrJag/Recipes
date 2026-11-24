import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
const report={date:new Date().toISOString(),checks:[],errors:[]};
let browser;
const check=(ok,label)=>{report.checks.push({label,pass:Boolean(ok)});if(!ok)report.errors.push(label)};
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 page.on('pageerror',error=>report.errors.push('PAGE ERROR: '+error.message));
 await page.goto('http://localhost:8123/recipe.html?recipe=midwestern-chili',{waitUntil:'load'});
 await page.waitForTimeout(1000);
 check(await page.locator('#recipeView').isVisible(),'Direct recipe URL displays viewer');
 check(await page.locator('#recipeIndex').isHidden(),'Legacy cuisine index is hidden on recipe');
 check((await page.locator('#pages h1').allTextContents()).some(x=>x.includes('Mid-Western Chili')),'Mid-Western Chili appears in preview');
 check(await page.locator('.recipe-sidebar .sidebar-recipe-link').count()>=170,'Taxonomy sidebar populated');
 await page.locator('#headerCategories > summary').click();
 check(await page.locator('.header-categories-menu a').count()===9,'Header dropdown lists all taxonomy groups');
 await page.locator('.header-categories-menu a').filter({hasText:'Drinks & Cocktails'}).click();
 await page.waitForTimeout(550);
 check(page.url().includes('directory.html?category=Drinks'), 'Dropdown opens separate directory page with category');
 check((await page.locator('#categoryStatus').textContent()).includes('of 176'), 'Directory filtering loads');
 check((await page.locator('#categoryStatus').textContent()).includes('22 of'), 'Drinks category filtering matches taxonomy');
 check(await page.locator('#directoryHeading').isVisible(),'Directory heading is visible');
 check(await page.locator('#directoryHighlights .highlight-recipe').count()>=1,'Dynamic photo sidebar appears');
 check((await page.locator('#directoryHighlightsTitle').textContent()).includes('Drinks & Cocktails'),'Photo sidebar reflects selected category');
 check(await page.locator('#directoryHighlights img').count()>=1,'Category photos use actual image files');
 check((await page.locator('#directoryHeading').boundingBox()).y < 220,'Directory heading is near top of viewport');
 await page.goto('http://localhost:8123/directory.html?category=Main%20Dishes',{waitUntil:'load'});
 await page.waitForTimeout(550);
 check((await page.locator('#categoryStatus').textContent()).includes('53 of'),'Main Dishes bookmark filters correctly');
 check((await page.locator('#directoryHighlightsTitle').textContent()).includes('Main Dishes'),'Main Dishes photo sidebar follows category');
 check(await page.locator('#directoryHighlights .highlight-recipe').count()===3,'Three category-aware cards appear');
 check(await page.locator('#categoryResults').isVisible(),'Filtered results visible');
 await page.goto('http://localhost:8123/directory.html#recipeSearch',{waitUntil:'load'});
 await page.waitForTimeout(550);
 check(await page.locator('.group-details[open]').count()===0,'Search bookmark starts with every category collapsed');
 check(await page.locator('#recipeSearch').evaluate(input => document.activeElement === input),'Search bookmark focuses search field');
 await page.goto('http://localhost:8123/directory.html?category=Main%20Dishes',{waitUntil:'load'});
 await page.waitForTimeout(500);
 await page.locator('#searchShortcut').click();
 check(await page.locator('.group-details[open]').count()===0,'Clicking Search collapses categories');
 check((await page.locator('#categoryStatus').textContent()).includes('176 of 176'),'Search clears category selection');
 check(page.url().endsWith('#recipeSearch'),'Search shortcut updates to shareable anchor');
 await page.goto('http://localhost:8123/',{waitUntil:'load'});
 await page.locator('#searchShortcut').click();
 await page.waitForTimeout(500);
 check(page.url().includes('directory.html#recipeSearch'),'Homepage Search opens directory search view');
 check(await page.locator('.group-details[open]').count()===0,'Homepage Search keeps category groups collapsed');

 await page.goto('http://localhost:8123/?category=Main%20Dishes#directory',{waitUntil:'load'});
 await page.waitForTimeout(300);
 check(page.url().includes('directory.html?category=Main'),'Old homepage category bookmark redirects');
 await page.goto('http://localhost:8123/',{waitUntil:'load'});
 await page.locator('.category-card[data-category="Mains"]').click();
 await page.waitForTimeout(350);
 check(page.url().includes('directory.html?category=Main'),'Homepage category card opens directory');
 await page.goto('http://localhost:8123/directory.html',{waitUntil:'load'});
 await page.waitForTimeout(500);
 check((await page.locator('#directoryHighlightsTitle').textContent()).includes('Fresh from the Kitchen'),'Unfiltered directory shows recent additions');
 check(await page.locator('#directoryHighlights .highlight-recipe').count()===3,'Three recent additions appear in directory photo rail');
 await page.goto('http://localhost:8123/recipe.html?recipe=midwestern-chili',{waitUntil:'load'});
 await page.waitForTimeout(500);
 await page.locator('#headerCategories > summary').click();
 check(await page.locator('.header-categories-menu a').count()===9,'Recipe header has category dropdown');
 await page.locator('.site-header a.brand').click();
 check(page.url().endsWith('/'),'Header brand returns home');
 await page.locator('.site-header .site-nav a').filter({hasText:'Recipes'}).click();
 check(page.url().includes('/directory.html'),'Recipes nav opens dedicated directory');
 check(await page.locator('#directoryHeading').isVisible(),'Dedicated directory visible after Recipes navigation');
 await page.locator('.site-header a.brand').click();
 check(await page.locator('.hero').isVisible(),'Landing page visible after returning home');

 // Inline editing keeps the visual recipe structure while enabling changes.

 await page.goto('http://localhost:8123/recipe.html?recipe=midwestern-chili',{waitUntil:'load'});
 await page.waitForTimeout(650);
 await page.locator('#editRecipeButton').click();
 check(await page.locator('.edit-sheet .ingredients ul').evaluate(el => getComputedStyle(el).columnCount === '2'),'Long ingredient lists automatically use two columns');
 await page.locator('#cancelEditButton').click();
 await page.goto('http://localhost:8123/recipe.html?recipe=sweetango-orchard-sour',{waitUntil:'load'});
 await page.waitForTimeout(650);
 check(await page.locator('#editRecipeButton').isVisible(),'Pencil action is available');
 check(await page.locator('#printMenuToggle svg').count()===1,'Print action is an icon outside the recipe page');
 // Toolbar icons stack vertically, and print mode can omit photos entirely.
 check(await page.locator('.recipe-action-rail').evaluate(el=>getComputedStyle(el).flexDirection==='column'),
   'Recipe action icons are vertically stacked');
 check(await page.locator('.recipe-action-rail').evaluate(el => {
   const rail=el.getBoundingClientRect();
   const sheet=document.querySelector('#pages .sheet').getBoundingClientRect();
   return rail.left >= sheet.right && rail.left - sheet.right <= 22;
 }), 'Desktop toolbar sits directly beside the recipe page');
 check(await page.locator('#ratingRecipeButton').evaluate(el =>
   getComputedStyle(el).backgroundColor === 'rgb(32, 32, 36)'),
   'Inactive rating button matches neutral black toolbar icons');
 check(await page.locator('.recipe-header .recipe-rating').count()===1,
   'Recipe header includes a rating summary');
 check(await page.locator('.recipe-header > .recipe-rating').count()===1,
   'Option A displays the rating as a separate row below the subtitle');
 check(await page.locator('.recipe-header .recipe-rating').evaluate(el =>
   el.previousElementSibling?.classList.contains('subtitle') ||
   el.previousElementSibling?.tagName === 'H1'),
   'Rating follows the title or subtitle');
 check((await page.locator('.recipe-header .recipe-rating').textContent()).includes('Unrated'),
   'Recipes without a rating show Unrated');
 await page.locator('#printMenuToggle').click();
 await page.locator('#printMode').selectOption('none');
 await page.locator('#pages .sheet').first().waitFor({state:'visible'});
 await page.waitForTimeout(150);
 check(await page.locator('#pages .photo-strip').count()===0,
   'No-photo print mode removes the photo strip');
 check(await page.locator('#pages .sheet.has-photo').count()===0,
   'No-photo print layout uses full-width text');
 await page.locator('#printMode').selectOption('commercial');
 await page.locator('#printMenuToggle').click();
 await page.waitForTimeout(150);
 check(await page.locator('#pages .sheet.has-photo .strip-image').count()===1,
   'Switching back to photo print mode restores first-page photo');
 // Rating is independent of the pencil editor, and selecting the same star
 // again clears it without a separate Clear button.
 check(await page.locator('#ratingOptions').isHidden(),'Rating stars are hidden by default');
 await page.locator('#ratingRecipeButton').click();
 check(await page.locator('#ratingOptions').isVisible(),'Rating stars appear on button click');
 check(await page.locator('.edit-sheet').count()===0,'Opening stars does not activate inline edit mode');
 check(await page.locator('#editRecipeButton').getAttribute('aria-pressed')==='false','Pencil stays inactive when rating');
 check(await page.locator('#clearRecipeRating').count()===0,'Redundant Clear rating button is removed');
 check(await page.locator('#ratingStatus').count()===0,'Rating popover has no text status');
 check(await page.locator('#ratingRecipeButton').evaluate(el =>
   getComputedStyle(el).backgroundColor==='rgb(86, 99, 67)'),'Rating button uses olive accent while open');
 await page.locator('#ratingStars button[data-rating="4"]').click();
 check((await page.locator('.recipe-header .rating-glyphs').textContent())==='★★★★☆','Four stars preview on normal recipe page');
 check(await page.locator('#saveRecipeRating').isVisible(),'Rating has its own Save action');
 await page.locator('#ratingStars button[data-rating="4"]').click();
 check((await page.locator('.recipe-header .rating-glyphs').textContent())==='☆☆☆☆☆','Clicking selected four stars clears rating');
 check(await page.locator('#saveRecipeRating').isHidden(),'Saving is disabled when rating matches original');
 await page.locator('#ratingStars button[data-rating="3"]').click();
 await page.locator('#saveRecipeRating').click();
 const ratingPayload=JSON.parse(await page.locator('#recipeSaveDialog').getAttribute('data-payload'));
 check(ratingPayload.rating===3,'Standalone rating Save writes rating to recipe JSON');
 check(await page.locator('.edit-sheet').count()===0,'Rating Save does not create an editable sheet');
 await page.locator('#dismissSaveDialog').click();
 check((await page.locator('.recipe-header .rating-glyphs').textContent())==='☆☆☆☆☆','Dismissing rating Save restores committed rating');

 // Responsive changes should not rebuild the page or briefly hide its photograph.
 await page.waitForFunction(() => {
   const img = document.querySelector('#pages .sheet.has-photo .strip-image');
   return Boolean(img && img.complete && img.naturalWidth > 0 && !img.hidden);
 });
 await page.locator('#pages .sheet.has-photo .strip-image').evaluate(el => {window.__photoBeforeResize = el});
 await page.setViewportSize({width:1160,height:900});
 await page.waitForTimeout(120);
 check(await page.locator('#pages .sheet.has-photo .strip-image').evaluate(el => !el.hidden && el.naturalWidth > 0),'Photo stays visible after desktop resize');
 await page.setViewportSize({width:700,height:850});
 await page.waitForTimeout(120);
 check(await page.locator('#pages .sheet.has-photo .strip-image').evaluate(el => !el.hidden && el.naturalWidth > 0),'Photo stays visible on mobile breakpoint');
 await page.setViewportSize({width:1400,height:900});
 await page.waitForTimeout(120);
 check(await page.locator('#pages .sheet.has-photo .strip-image').evaluate(el => !el.hidden && el.naturalWidth > 0),'Photo remains visible returning to desktop');
 check(await page.locator('#pages .sheet.has-photo .strip-image').evaluate(el => el === window.__photoBeforeResize),'Resize does not replace the loaded photo element');
 check(await page.locator('#pages .sheet:not(:first-child) .photo-strip').count()===0,'Continuation pages remain free of photo strips');

 await page.locator('#editRecipeButton').click();
 check(await page.locator('.edit-sheet').isVisible(),'Pencil enters inline edit mode');
 check(await page.locator('#saveRecipeButton').isVisible(),'Save action appears during editing');
 check(await page.locator('.edit-sheet .edit-headnote[contenteditable="true"]').count()===1,'Description is inline editable and italicized');
 check(await page.locator('.edit-sheet .edit-headnote').evaluate(el => getComputedStyle(el).fontStyle === 'italic'),'Description actually renders italic');
 check(await page.locator('.edit-sheet .ingredients ul').evaluate(el => getComputedStyle(el).columnCount === '1'),'Short ingredient lists stay single column');
 check(await page.locator('.edit-sheet .edit-directions ol').evaluate(el => getComputedStyle(el).listStyleType === 'decimal'),'Directions use automatic numbering');
 check(await page.locator('.edit-sheet .ingredients ul li[contenteditable="true"]').count()>=6,'Ingredients remain editable bullet points');
 check(await page.locator('.edit-sheet .edit-directions ol li[contenteditable="true"]').count()>=3,'Directions remain editable numbered steps');
 await page.locator('.edit-sheet .edit-main-title').fill('Sweetango Orchard Sour — Test Edit');
 await page.locator('.edit-sheet .edit-headnote').fill('Bright, sweet-tart apple cider test description.');
 await page.locator('#saveRecipeButton').click();
 check(await page.locator('#recipeSaveDialog').isVisible(),'Save opens real persistence options');
 check(await page.locator('#downloadRecipeJson').isVisible(),'JSON download fallback is available');
 check(await page.locator('#publishRecipeGithub').isVisible(),'GitHub publishing option is available');
 check((await page.locator('#saveFeedback').textContent()).length===0,'Save does not claim success prematurely');
 await page.locator('#dismissSaveDialog').click();
 page.once('dialog', dialog => dialog.accept());
 await page.locator('#cancelEditButton').click();
 await page.locator('.sheet:not(.edit-sheet)').first().waitFor({state:'visible',timeout:3000});
 check(await page.locator('.edit-sheet').count()===0,'Cancel restores normal pagination');
 check(await page.locator('#saveRecipeButton').isHidden(),'Save action hides outside edit mode');
 await page.locator('#editRecipeButton').click();
 await page.locator('#saveRecipeButton').click();
 await page.locator('#publishRecipeGithub').click();
 check((await page.locator('#saveFeedback').textContent()).includes('token'),'Publishing without credentials is refused');
 await page.locator('#dismissSaveDialog').click();
 await page.locator('#cancelEditButton').click();

 // Source attribution is a real editable field and preserves the original
 // JSON property, including when other recipe fields are unchanged.
 await page.goto('http://localhost:8123/recipe.html?recipe=roasted-chicken-bombay-potatoes',{waitUntil:'load'});
 await page.waitForTimeout(400);
 check((await page.locator('#pages .source').textContent()).includes('Jamie Oliver'),
   'Published Bombay potatoes recipe includes the Jamie Oliver attribution');
 await page.locator('#editRecipeButton').click();
 check((await page.locator('.edit-sheet .edit-source-note').textContent()).includes('Jamie Oliver'),
   'Attribution is visible in inline edit mode');
 check(await page.locator('.edit-sheet .edit-source-note').getAttribute('contenteditable')==='true',
   'Attribution can be edited');
 check(await page.locator('.edit-sheet .edit-source-note').evaluate(el =>
   getComputedStyle(el).fontStyle==='italic'),'Attribution retains italic footnote styling');
 await page.locator('.edit-sheet .edit-source-note').fill('Adapted from Jamie Oliver — revised in editor.');
 await page.locator('#saveRecipeButton').click();
 const sourcePayload=JSON.parse(await page.locator('#recipeSaveDialog').getAttribute('data-payload'));
 check(sourcePayload.sourceNote==='Adapted from Jamie Oliver — revised in editor.',
   'Source note edits are persisted to the original JSON field');
 check(sourcePayload.steps.length===7,'Editing source note preserves all recipe directions');
 await page.locator('#dismissSaveDialog').click();
 page.once('dialog', dialog => dialog.accept());
 await page.locator('#cancelEditButton').click();

 // Mock GitHub API to test the save flow without changing repository data.
 let githubPut = null;
 const originalSource = readFileSync('recipes/drinks/sweetango-orchard-sour.json','utf8');
 await page.route('https://api.github.com/repos/MrJag/Recipes/contents/**',async route => {
   const method = route.request().method();
   const cors = {'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,x-github-api-version,content-type',
     'access-control-allow-methods':'GET,PUT,OPTIONS'};
   if (method === 'OPTIONS') return route.fulfill({status:204,headers:cors,body:''});
   if (method === 'GET') return route.fulfill({
     status:200,contentType:'application/json',headers:cors,
     body:JSON.stringify({sha:'mock-current-sha',content:Buffer.from(originalSource).toString('base64')})
   });
   if (method === 'PUT') {
     githubPut = route.request().postDataJSON();
     return route.fulfill({status:200,contentType:'application/json',headers:cors,
       body:JSON.stringify({commit:{sha:'abcdef1234567890'}})});
   }
   return route.abort();
 });
 await page.goto('http://localhost:8123/recipe.html?recipe=sweetango-orchard-sour',{waitUntil:'load'});
 await page.waitForTimeout(400);
 await page.locator('#editRecipeButton').click();
 await page.locator('.edit-sheet .edit-main-title').fill('Sweetango Orchard Sour — Browser Test');
 await page.locator('#saveRecipeButton').click();
 await page.locator('#githubWriteToken').fill('test-only-token');
 await page.locator('#publishRecipeGithub').click();
 await page.waitForTimeout(450);
 check(Boolean(githubPut),'Authenticated save sends a GitHub API commit');
 if (githubPut) {
   const saved = JSON.parse(Buffer.from(githubPut.content,'base64').toString('utf8'));
   check(saved.title === 'Sweetango Orchard Sour — Browser Test','Saved JSON includes edited recipe title');
   check(saved.photo === './public/images/sweetango-orchard-sour-v2.jpg','Save preserves the recipe photo');
   check(saved.status === 'draft','Save preserves Draft status');
   check(!('rating' in saved),'Ordinary recipe editing does not invent a rating');
   check(githubPut.sha === 'mock-current-sha','Save uses optimistic concurrency SHA');
 }
 check((await page.locator('#saveFeedback').textContent()).includes('Published!'),'Successful publish confirms commit');
 check(await page.locator('#saveRecipeButton').isHidden(),'Save hides after successful publish');
 await page.locator('#dismissSaveDialog').click();
 await page.unrouteAll();
 // A truncated/empty GitHub response must not silently discard edits.
 await page.route('https://api.github.com/repos/MrJag/Recipes/contents/**',async route => {
   const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,x-github-api-version,content-type',
     'access-control-allow-methods':'GET,PUT,OPTIONS'};
   if (route.request().method()==='OPTIONS') return route.fulfill({status:204,headers:cors,body:''});
   return route.fulfill({status:200,contentType:'application/json',headers:cors,body:''});
 });
 await page.goto('http://localhost:8123/recipe.html?recipe=sweetango-orchard-sour',{waitUntil:'load'});
 await page.waitForTimeout(350);
 await page.locator('#editRecipeButton').click();
 await page.locator('.edit-sheet .edit-main-title').fill('Unsaved response error test');
 await page.locator('#saveRecipeButton').click();
 await page.locator('#githubWriteToken').fill('test-only-token');
 await page.locator('#publishRecipeGithub').click();
 await page.waitForTimeout(300);
 check((await page.locator('#saveFeedback').textContent()).includes('empty response'),'Empty API response produces an actionable error');
 check(await page.locator('.edit-sheet').isVisible(),'Edits remain available after failed GitHub response');
 check(!(await page.locator('#saveFeedback').textContent()).includes('Published!'),'Failed save does not claim publication');
 await page.locator('#dismissSaveDialog').click();
 await page.unrouteAll();
 // GitHub may commit the update but return an empty body. Re-fetch and verify.
 let ambiguousPayload = null;
 let verificationReads = 0;
 await page.route('https://api.github.com/repos/MrJag/Recipes/contents/**',async route => {
   const method=route.request().method();
   const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,x-github-api-version,content-type',
     'access-control-allow-methods':'GET,PUT,OPTIONS'};
   if(method==='OPTIONS') return route.fulfill({status:204,headers:cors,body:''});
   if(method==='PUT') {
     ambiguousPayload=route.request().postDataJSON();
     return route.fulfill({status:200,contentType:'application/json',headers:cors,body:''});
   }
   if(method==='GET') {
     const verifying=route.request().url().includes('_verify=');
     if(verifying) verificationReads++;
     const json=verifying && ambiguousPayload
       ? Buffer.from(ambiguousPayload.content,'base64').toString('utf8')
       : originalSource;
     return route.fulfill({status:200,contentType:'application/json',headers:cors,
       body:JSON.stringify({sha:'mock-current-sha',content:Buffer.from(json).toString('base64')})});
   }
   return route.abort();
 });
 await page.goto('http://localhost:8123/recipe.html?recipe=sweetango-orchard-sour',{waitUntil:'load'});
 await page.waitForTimeout(350);
 await page.locator('#editRecipeButton').click();
 await page.locator('.edit-sheet .edit-main-title').fill('Verified after empty confirmation');
 await page.locator('#saveRecipeButton').click();
 await page.locator('#githubWriteToken').fill('test-only-token');
 await page.locator('#publishRecipeGithub').click();
 await page.waitForTimeout(500);
 check(Boolean(ambiguousPayload),'Ambiguous GitHub save submits the edited JSON');
 check(verificationReads>=1,'Ambiguous GitHub confirmation triggers a verification read');
 check((await page.locator('#saveFeedback').textContent()).includes('Published successfully'),
   'Matching repository content confirms ambiguous save as published');
 check(await page.locator('#saveRecipeButton').isHidden(),
   'Verified save returns to normal recipe mode');
 await page.locator('#dismissSaveDialog').click();
 await page.unrouteAll();
 // If the GitHub revision does NOT match, preserve edits and avoid false success.
 await page.route('https://api.github.com/repos/MrJag/Recipes/contents/**',async route => {
   const method=route.request().method();
   const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,x-github-api-version,content-type',
     'access-control-allow-methods':'GET,PUT,OPTIONS'};
   if(method==='OPTIONS') return route.fulfill({status:204,headers:cors,body:''});
   if(method==='PUT') return route.fulfill({status:200,contentType:'application/json',headers:cors,body:''});
   if(method==='GET') return route.fulfill({status:200,contentType:'application/json',headers:cors,
     body:JSON.stringify({sha:'mock-current-sha',content:Buffer.from(originalSource).toString('base64')})});
   return route.abort();
 });
 await page.goto('http://localhost:8123/recipe.html?recipe=sweetango-orchard-sour',{waitUntil:'load'});
 await page.waitForTimeout(350);
 await page.locator('#editRecipeButton').click();
 await page.locator('.edit-sheet .edit-main-title').fill('Not committed test');
 await page.locator('#saveRecipeButton').click();
 await page.locator('#githubWriteToken').fill('test-only-token');
 await page.locator('#publishRecipeGithub').click();
 await page.waitForTimeout(500);
 check((await page.locator('#saveFeedback').textContent()).includes('does not match'),
   'Mismatched revision is reported as unverified');
 check(await page.locator('.edit-sheet').isVisible(),'Unverified save preserves inline edits');
 check(!(await page.locator('#saveFeedback').textContent()).includes('Published successfully'),
   'Unverified save does not display success');
 await page.locator('#dismissSaveDialog').click();
 await page.unrouteAll();
 await page.unrouteAll();
 await page.goto('http://localhost:8123/index.html?recipe=midwestern-chili',{waitUntil:'load'});
 await page.waitForTimeout(300);
 check(page.url().includes('recipe.html?recipe=midwestern-chili'),'Old combined-page bookmark redirects');
 await page.goto('http://localhost:8123/index2.html?recipe=midwestern-chili',{waitUntil:'load'});
 await page.waitForTimeout(300);
 check(page.url().includes('recipe.html?recipe=midwestern-chili'),'Old index2 bookmark redirects');
} catch(error) {
 report.errors.push('TEST ERROR: '+(error.stack||String(error)));
} finally {
 if(browser)await browser.close();
 report.pass=report.errors.length===0;
 writeFileSync('qa/browser-smoke-result.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(!report.pass)process.exitCode=1;
}
