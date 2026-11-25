import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
const report={date:new Date().toISOString(),checks:[],errors:[]};
let browser;
const check=(ok,label)=>{report.checks.push({label,pass:Boolean(ok)});if(!ok)report.errors.push(label)};
try {
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 page.on('pageerror',error=>report.errors.push('PAGE ERROR: '+error.message));
 // The original La Duni PDF, updated CraftyBaking, and lemon rendition share one entry.
 await page.goto('http://localhost:8123/recipe.html?recipe=cuatro-leches-cake',{waitUntil:'load'});
 await page.waitForTimeout(600);
 check(await page.locator('.recipe-versions button').count()===3,'Cuatro Leches has three linked versions');
 check((await page.locator('.recipe-versions button').allTextContents()).every(t=>t.includes('Draft')),'All three Cuatro Leches versions are Draft');
 check((await page.locator('#pages h1').allTextContents()).some(t=>t.includes('La Duni Original')),'Original La Duni recipe loads first');
 check((await page.locator('#pages .photo-strip img').first().getAttribute('src')).includes('cuatro-leches-original.jpg'),'Original cake uses the new image');
 await page.locator('.recipe-versions button').nth(1).click();
 await page.waitForTimeout(350);
 check((await page.locator('#pages h1').allTextContents()).some(t=>t.includes('CraftyBaking Updated')),'CraftyBaking version loads');
 check((await page.locator('#pages .photo-strip img').first().getAttribute('src')).includes('cuatro-leches-updated.jpg'),'Updated cake uses its generated photo');
 await page.locator('.recipe-versions button').nth(2).click();
 await page.waitForTimeout(350);
 check((await page.locator('#pages h1').allTextContents()).some(t=>t.includes('Panque de Limón')),'Panque de Limón version loads');
 check((await page.locator('#pages .photo-strip img').first().getAttribute('src')).includes('panque-de-limon.jpg'),'Lemon cake uses its generated photo');
 check((await page.locator('#pages .headnote').allTextContents()).join(' ').includes('supplement'),'Panque de Limón visibly distinguishes supplementary elements');
 await page.goto('http://localhost:8123/recipe.html?recipe=whiskey-date-cake',{waitUntil:'load'});
 await page.waitForTimeout(900);
 check(await page.locator('.recipe-versions button').count()===2,'Whiskey Cake has original and home adaptation version buttons');
 check((await page.locator('.recipe-versions button').allTextContents()).every(t=>t.includes('Draft')),'Both Whiskey Cake versions show Draft badges');
 check((await page.locator('#pages h1').allTextContents()).some(t=>t.includes('Chef John Franke')),'Chef John Franke version loads as the original');
 await page.locator('.recipe-versions button').nth(1).click();
 await page.waitForTimeout(550);
 check((await page.locator('#pages h1').allTextContents()).some(t=>t.includes('Home Adaptation')),'Home adaptation displays when selected');
 await page.locator('.recipe-versions button').nth(0).click();
 await page.waitForTimeout(550);
 check((await page.locator('#pages h1').allTextContents()).some(t=>t.includes('Chef John Franke')),'Original version can be restored');
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
 check((await page.locator('#categoryStatus').textContent()).includes('of 178'), 'Directory filtering loads');
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
 check(await page.locator('.group-details[open]').count()===1,
   'Explicit category bookmark expands only the requested category');
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
 check((await page.locator('#categoryStatus').textContent()).includes('178 of 178'),'Search clears category selection');
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
 check(await page.locator('.group-details[open]').count()===0,
   'Unfiltered directory starts with every top-level category collapsed');
 check(await page.locator('.subcategory-details[open]').count()===0,
   'Unfiltered directory starts with all subcategories collapsed');
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
 await page.locator('#editRecipeButton').click();
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
 // Compact mobile viewport: actions stay high and Print options fit onscreen.
 await page.setViewportSize({width:390,height:700});
 await page.waitForTimeout(100);
 check(await page.locator('.recipe-action-rail').evaluate(el => {
   const rect=el.getBoundingClientRect();
   return rect.top >= 80 && rect.top < window.innerHeight * .45;
 }), 'Mobile action toolbar is near the upper portion of the screen');
 await page.locator('#printMenuToggle').click();
 check(await page.locator('.print-menu .toolbar').evaluate(el => {
   const rect=el.getBoundingClientRect();
   return rect.top >= 0 && rect.bottom <= window.innerHeight - 8;
 }), 'Mobile print menu stays within visible viewport height');
 check(await page.locator('.print-menu .toolbar').evaluate(el =>
   ['auto','scroll'].includes(getComputedStyle(el).overflowY)),
   'Mobile print menu scrolls when available height is limited');
 check(await page.locator('#printButton').isVisible(),
   'Print action remains available on mobile');
 await page.locator('#printMenuToggle').click();
 await page.setViewportSize({width:1400,height:900});
 await page.waitForTimeout(100);
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
 await page.locator('#ratingStars button[data-rating="4"]').hover();
 check(await page.locator('#ratingStars button.selected').count()===4,
   'Hovering over fourth star illuminates first four stars');
 check(await page.locator('#ratingStars button[data-rating="5"]').evaluate(el =>
   !el.classList.contains('selected')),'Stars after hovered rating remain unfilled');
 await page.locator('#ratingStars button[data-rating="2"]').hover();
 check(await page.locator('#ratingStars button.selected').count()===2,
   'Hovering over second star illuminates first two stars');
 await page.locator('#ratingRecipeButton').hover();
 check(await page.locator('#ratingStars button.selected').count()===0,
   'Moving pointer away restores unrated selection');
 await page.locator('#ratingStars button[data-rating="4"]').click();
 check((await page.locator('.recipe-header .rating-glyphs').textContent())==='★★★★☆',
   'Click immediately previews four stars on normal recipe page');
 check(await page.locator('#saveRecipeRating').count()===0,
   'Rating requires no separate Save button');
 check(await page.locator('#recipeSaveDialog').isVisible(),
   'Without cached GitHub access, clicking a star opens authentication');
 const ratingPayload=JSON.parse(await page.locator('#recipeSaveDialog').getAttribute('data-payload'));
 check(ratingPayload.rating===4,'Star click immediately prepares the rating JSON');
 check(await page.locator('.edit-sheet').count()===0,'Rating does not enter recipe editing mode');
 await page.locator('#dismissSaveDialog').click();
 check((await page.locator('.recipe-header .rating-glyphs').textContent())==='☆☆☆☆☆',
   'Dismissing unauthenticated save restores committed rating');

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
 check(await page.locator('#cancelEditButton').count()===0,'Cancel button is removed');
 check(await page.locator('#editRecipeButton').getAttribute('aria-label')==='Cancel editing',
   'Pencil button indicates it will exit editing');
 check(await page.locator('.edit-sheet .edit-headnote[contenteditable="true"]').count()===1,'Description is inline editable and italicized');
 check(await page.locator('.edit-sheet .edit-headnote').evaluate(el => getComputedStyle(el).fontStyle === 'italic'),'Description actually renders italic');
 check(await page.locator('.edit-sheet .ingredients ul').evaluate(el => getComputedStyle(el).columnCount === '1'),'Short ingredient lists stay single column');
 check(await page.locator('.edit-sheet .edit-directions ol').evaluate(el => getComputedStyle(el).listStyleType === 'none'),'Directions use custom circular numbering as in read mode');
 check(await page.locator('.edit-sheet .edit-directions li.edit-list-item').first().evaluate(el =>
   getComputedStyle(el).display === 'block' && getComputedStyle(el,'::before').content !== 'none' &&
   getComputedStyle(el,'::before').position === 'absolute'),
   'Edit mode places circular numbers outside the editable text area');
 check(await page.locator('.edit-sheet .edit-directions li.edit-list-item').first().evaluate(el => {
   const read=document.querySelector('#pages .recipe-step');
   return !read || (getComputedStyle(el).fontFamily === getComputedStyle(read).fontFamily &&
     getComputedStyle(el).fontSize === getComputedStyle(read).fontSize);
 }), 'Directions use the same body font in reading and editing modes');
 check(await page.locator('.edit-sheet .ingredients ul li[contenteditable="true"]').count()>=6,'Ingredients remain editable bullet points');
 check(await page.locator('.edit-sheet .edit-directions ol li[contenteditable="true"]').count()>=3,'Directions remain editable numbered steps');
 // Insertion lines appear between items on hover and create editable headings.
 const initialIngredientCount=await page.locator('[data-groups="main"] .edit-list-item').count();
 const ingredientInsert=page.locator('[data-groups="main"] .edit-insert-slot').nth(1);
 await ingredientInsert.hover();
 check(await ingredientInsert.locator('button').evaluate(el =>
   getComputedStyle(el).opacity==='1' || Number(getComputedStyle(el).opacity)>0),
   'Ingredient insertion button reveals on hover between items');
 await ingredientInsert.locator('button').click();
 check(await page.locator('[data-groups="main"] .edit-ingredient-group').count()===2,
   'Hover insertion creates a new ingredient group at exact boundary');
 await page.locator('[data-groups="main"] .edit-group-name').nth(1).fill('Finishing ingredients');
 check(await page.locator('[data-groups="main"] .edit-list-item').count()===initialIngredientCount,
   'Splitting ingredients preserves every ingredient');
 // Backspace on an emptied group heading removes it and rejoins the ingredients.
 const secondHeading=page.locator('[data-groups="main"] .edit-group-name').nth(1);
 await secondHeading.fill('');
 await secondHeading.press('Backspace');
 check(await page.locator('[data-groups="main"] .edit-ingredient-group').count()===1,
   'Backspace removes an empty ingredient group heading');
 check(await page.locator('[data-groups="main"] .edit-list-item').count()===initialIngredientCount,
   'Removing a group heading restores all ingredient items');
 const reinsertion=page.locator('[data-groups="main"] .edit-insert-slot').nth(1);
 await reinsertion.hover();
 await reinsertion.locator('button').click();
 await page.locator('[data-groups="main"] .edit-group-name').nth(1).fill('Finishing ingredients');

 const firstDirectionSlot=page.locator('[data-directions="main"] .edit-insert-slot').first();
 check(await firstDirectionSlot.evaluate(el => el===el.parentElement.firstElementChild),
   'Directions expose an insertion slot before step one');
 await firstDirectionSlot.locator('button').click({force:true});
 await page.locator('[data-directions="main"] .edit-stage-heading').first().fill('Preparation');
 check(await page.locator('[data-directions="main"] ol > li.edit-stage-heading').first().evaluate(el =>
   !el.previousElementSibling?.classList.contains('edit-list-item')),
   'Heading inserted before first numbered direction');
 await page.locator('[data-directions="main"] .edit-stage-heading').first().fill('');
 await page.locator('[data-directions="main"] .edit-stage-heading').first().press('Backspace');
 const initialDirectionCount=await page.locator('[data-directions="main"] .edit-list-item').count();
 const lastDirection=page.locator('[data-directions="main"] .edit-list-item').last();
 await lastDirection.focus();
 await lastDirection.press('End');
 await lastDirection.press('Enter');
 check(await page.locator('[data-directions="main"] .edit-list-item').count()===initialDirectionCount+1,
   'Enter creates a new numbered direction');
 check(await page.evaluate(() => {
   const sel=window.getSelection();
   const li=sel?.anchorNode?.parentElement?.closest('li.edit-list-item') ||
     (sel?.anchorNode?.nodeType===1 ? sel.anchorNode.closest('li.edit-list-item') : null);
   if(!li) return false;
   const marker=li.getBoundingClientRect();
   const styles=getComputedStyle(li);
   const entries=[...document.querySelectorAll('[data-directions="main"] .edit-list-item')];
   return li===entries[entries.length-1] &&
     parseFloat(styles.paddingLeft)>=30 && marker.width>100;
 }), 'New direction focuses editable content after its circular number');
 await page.locator('[data-directions="main"] .edit-list-item').last().press('Backspace');
 const directionInsert=page.locator('[data-directions="main"] .edit-insert-slot').nth(1);
 await directionInsert.hover();
 await directionInsert.locator('button').click();
 await page.locator('[data-directions="main"] .edit-stage-heading').fill('Finishing steps');
 check(await page.locator('[data-directions="main"] .edit-stage-heading').count()===1,
   'Direction insertion line creates a heading between steps');
 await page.locator('[data-directions="main"] .edit-stage-heading').fill('');
 await page.locator('[data-directions="main"] .edit-stage-heading').press('Backspace');
 check(await page.locator('[data-directions="main"] .edit-stage-heading').count()===0,
   'Backspace removes an empty direction heading');
 check(await page.locator('[data-directions="main"] .edit-list-item').count()===initialDirectionCount,
   'Removing direction heading does not lose steps');
 const directionReinsert=page.locator('[data-directions="main"] .edit-insert-slot').nth(1);
 await directionReinsert.hover();
 await directionReinsert.locator('button').click();
 await page.locator('[data-directions="main"] .edit-stage-heading').fill('Finishing steps');
 check(await page.locator('[data-directions="main"] .edit-list-item').evaluateAll(items =>
   items.every((li,index) => li.value===index+1)),
   'Direction numbering stays sequential after insertion and removal');

 await page.locator('.edit-sheet .edit-main-title').fill('Sweetango Orchard Sour — Test Edit');
 await page.locator('.edit-sheet .edit-headnote').fill('First paragraph of description.\n\nSecond paragraph of description.');
 check(await page.locator('.edit-sheet .edit-headnote').evaluate(el =>
   getComputedStyle(el).whiteSpace === 'pre-wrap'),
   'Description editor preserves multiline whitespace');

 await page.locator('#saveRecipeButton').click();
 check(await page.locator('#recipeSaveDialog').isVisible(),'Save opens real persistence options');
 const multilinePayload = JSON.parse(await page.locator('#recipeSaveDialog').getAttribute('data-payload'));
 check(multilinePayload.headnote.includes('First paragraph of description.\n\nSecond paragraph of description.'),
   'Saving a recipe preserves blank lines between description paragraphs');
 check(multilinePayload.ingredientGroups.length===2 &&
   multilinePayload.ingredientGroups[1].title==='Finishing ingredients',
   'Ingredient group insertion is saved in recipe JSON');
 check(multilinePayload.steps.some(step => step?.heading==='Finishing steps'),
   'Direction stage heading is saved in recipe JSON');
 check(multilinePayload.steps.filter(step => !step?.heading).length>=3,
   'Direction headings do not remove or overwrite steps');
 check(await page.locator('#downloadRecipeJson').isVisible(),'JSON download fallback is available');
 check(await page.locator('#publishRecipeGithub').isVisible(),'GitHub publishing option is available');
 check((await page.locator('#saveFeedback').textContent()).length===0,'Save does not claim success prematurely');
 await page.locator('#dismissSaveDialog').click();
 page.once('dialog', dialog => dialog.accept());
 await page.locator('#editRecipeButton').click();
 await page.locator('.sheet:not(.edit-sheet)').first().waitFor({state:'visible',timeout:3000});
 check(await page.locator('.edit-sheet').count()===0,'Pencil toggle restores normal pagination');
 check(await page.locator('#saveRecipeButton').isHidden(),'Save action hides outside edit mode');
 // Simulate a saved recipe containing an inserted direction heading.
 await page.evaluate(() => {
   const bridge=window.CookbookEditorBridge;
   const updated=JSON.parse(JSON.stringify(bridge.getRecipe()));
   updated.steps.splice(2,0,{heading:'Test direction group'});
   bridge.setSavedRecipe(updated);
 });
 check(await page.locator('#pages .stage-heading').filter({hasText:'Test direction group'}).count()===1,
   'Recipe viewer displays saved direction headings');
 check(await page.locator('#pages .recipe-step').evaluateAll(items =>
   items.every((item,index) =>
     item.querySelector('.step-num')?.textContent===String(index+1))),
   'Recipe viewer numbers directions sequentially across headings');
 await page.reload({waitUntil:'load'});
 await page.waitForTimeout(300);
 await page.locator('#editRecipeButton').click();
 await page.locator('#saveRecipeButton').click();
 await page.locator('#publishRecipeGithub').click();
 check((await page.locator('#saveFeedback').textContent()).includes('token'),'Publishing without credentials is refused');
 await page.locator('#dismissSaveDialog').click();
 await page.locator('#editRecipeButton').click();

 // Ingredient Notes appear between Ingredients and Directions and remain editable.
 await page.goto('http://localhost:8123/recipe.html?recipe=tandoori-chicken',{waitUntil:'load'});
 await page.waitForTimeout(350);
 check(await page.locator('.ingredient-notes').count()===1,
   'Tandoori chicken displays Ingredient Notes');
 check((await page.locator('.ingredient-notes').textContent()).includes('Garlic and Ginger Paste'),
   'Tandoori paste guidance moved from attribution into Ingredient Notes');
 check(await page.locator('.ingredient-notes').evaluate(el => {
   const ingredients = document.querySelector('.ingredients');
   const steps = document.querySelector('.steps');
   return ingredients && steps && ingredients.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING &&
     el.compareDocumentPosition(steps)&Node.DOCUMENT_POSITION_FOLLOWING;
 }), 'Ingredient Notes appear between Ingredients and Directions');
 check(!(await page.locator('.source').textContent()).includes('Garlic and Ginger Paste'),
   'Tandoori source attribution no longer duplicates ingredient instructions');
 await page.locator('#editRecipeButton').click();
 check(await page.locator('.edit-ingredient-notes li[contenteditable="true"]').count()===1,
   'Ingredient notes are editable in place');
 await page.locator('.edit-ingredient-notes li').first().fill('Combine fresh ginger and garlic in equal portions.');
 await page.locator('#saveRecipeButton').click();
 const notePayload=JSON.parse(await page.locator('#recipeSaveDialog').getAttribute('data-payload'));
 check(notePayload.ingredientNotes?.[0]==='Combine fresh ginger and garlic in equal portions.',
   'Ingredient Notes are preserved in recipe JSON');
 check(notePayload.sourceNote?.includes('Food Fusion'),'Recipe attribution stays intact');
 await page.locator('#dismissSaveDialog').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#editRecipeButton').click();
 await page.goto('http://localhost:8123/recipe.html?recipe=butter-masala-chicken',{waitUntil:'load'});
 await page.waitForTimeout(350);
 check((await page.locator('.ingredient-notes').textContent()).includes('peel the tomatoes'),
   'Butter Masala tomato tip appears in Ingredient Notes');
 check(!(await page.locator('.component-note').allTextContents()).some(text=>text.includes('peel the tomatoes')),
   'Butter Masala tomato tip is not repeated after Directions');

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
 await page.locator('#editRecipeButton').click();

 // Mock GitHub API to test the save flow without changing repository data.
 let githubPut = null;
 let githubPuts = 0;
 let savedMockContent = null;
 const originalSource = readFileSync('recipes/drinks/sweetango-orchard-sour.json','utf8');
 await page.route('https://api.github.com/repos/MrJag/Recipes/contents/**',async route => {
   const method = route.request().method();
   const cors = {'access-control-allow-origin':'*','access-control-allow-headers':'authorization,accept,x-github-api-version,content-type',
     'access-control-allow-methods':'GET,PUT,OPTIONS'};
   if (method === 'OPTIONS') return route.fulfill({status:204,headers:cors,body:''});
   if (method === 'GET') return route.fulfill({
     status:200,contentType:'application/json',headers:cors,
     body:JSON.stringify({sha:'mock-current-sha',content:Buffer.from(savedMockContent || originalSource).toString('base64')})
   });
   if (method === 'PUT') {
     githubPut = route.request().postDataJSON();
     githubPuts++;
     savedMockContent = Buffer.from(githubPut.content,'base64').toString('utf8');
     // Hold rating writes long enough to test in-flight user feedback.
     if (githubPuts===3 || githubPuts===4) await new Promise(resolve=>setTimeout(resolve,350));
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
 check(await page.locator('#editRecipeButton').getAttribute('title')==='Edit recipe',
   'Pencil tooltip returns to Edit recipe after successful save');
 check(await page.locator('#editRecipeButton').getAttribute('aria-label')==='Edit recipe',
   'Pencil accessibility label resets after successful save');
 await page.locator('#dismissSaveDialog').click();
 const storedAccess = await page.evaluate(() =>
   JSON.parse(sessionStorage.getItem('familyCookbook.githubToken.v1') || 'null'));
 check(storedAccess?.token==='test-only-token','Confirmed GitHub save caches tab-only access');
 check(storedAccess?.expiresAt>Date.now(),'Cached access has a future expiry');
 await page.locator('#editRecipeButton').click();
 await page.locator('.edit-sheet .edit-main-title').fill('Sweetango Orchard Sour — Followup');
 await page.locator('#saveRecipeButton').click();
 check(await page.locator('#recipeSaveDialog').isHidden(),
   'Cached GitHub token saves without opening the publish dialog');
 check(await page.locator('#saveRecipeButton').evaluate(el =>
   el.disabled && el.classList.contains('is-saving') && el.textContent.includes('Saving')),
   'Save button shows disabled Saving state during GitHub request');
 check(await page.locator('#ratingSaveProgress').isHidden(),
   'Editing recipe does not show rating save progress');
 check(await page.locator('#ratingRecipeButton').evaluate(el =>
   !el.classList.contains('is-saving')),
   'Editing recipe does not animate the star icon');
 await page.waitForTimeout(600);
 check(githubPuts===2,'Valid tab access publishes follow-up edit automatically');
 check(await page.locator('#recipeSaveDialog').isHidden(),
   'Successful automatic save never displays the dialog');
 check(await page.locator('#saveRecipeButton').isHidden(),
   'Successful automatic save leaves edit mode');
 check(await page.locator('#saveRecipeButton').evaluate(el =>
   !el.disabled && !el.classList.contains('is-saving') && el.textContent==='Save'),
   'Save spinner resets after successful publication');
 check(await page.locator('#editRecipeButton').getAttribute('aria-pressed')==='false',
   'Quiet save returns to normal read-only view');
 await page.locator('#ratingRecipeButton').click();
 await page.locator('#ratingStars button[data-rating="4"]').click();
 await page.locator('#ratingSaveProgress').waitFor({state:'visible'});
 check(await page.locator('#ratingSaveProgress').textContent() === 'Saving rating…',
   'Rating save displays prominent Saving rating feedback');
 check(await page.locator('#ratingRecipeButton').evaluate(el =>
   el.disabled && !el.classList.contains('is-saving') &&
   getComputedStyle(el,'::before').animationName === 'none' &&
   getComputedStyle(el,'::after').animationName === 'none'),
   'Rating button stays disabled without a duplicate spinner');
 check(await page.locator('#ratingSaveProgress .rating-save-spinner').evaluate(el =>
   getComputedStyle(el).animationName === 'recipe-save-spin'),
   'Rating save progress spinner is animated');
 check(await page.locator('#ratingOptions').isVisible(),
   'Rating menu remains visible until save finishes');
 check(await page.locator('#ratingStars button[data-rating="4"]').isDisabled(),
   'Rating stars are disabled during a save');
 await page.waitForTimeout(700);
 check(githubPuts===3,'Clicking a rating immediately commits to GitHub with cached token');
 check(JSON.parse(savedMockContent).rating===4,'Rating of four stars persisted');
 check(await page.locator('#recipeSaveDialog').isHidden(),'Auto-saving rating is silent');
 check(await page.locator('.edit-sheet').count()===0,'Rating auto-save keeps normal recipe view');
 await page.locator('#ratingRecipeButton').click();
 await page.locator('#ratingStars button[data-rating="4"]').click();
 await page.locator('#ratingSaveProgress').waitFor({state:'visible'});
 check(await page.locator('#ratingOptions').isVisible(),
   'Clearing a rating also displays saving feedback');
 await page.waitForTimeout(700);
 check(githubPuts===4,'Clicking the selected star again auto-saves clearing the rating');
 check(!('rating' in JSON.parse(savedMockContent)),'Cleared star selection deletes rating JSON property');
 // An expired cached token must never trigger an automatic publish.
 await page.evaluate(() => {
   const key='familyCookbook.githubToken.v1';
   const data=JSON.parse(sessionStorage.getItem(key));
   data.expiresAt=Date.now()-1;
   sessionStorage.setItem(key, JSON.stringify(data));
 });
 await page.locator('#editRecipeButton').click();
 await page.locator('.edit-sheet .edit-main-title').fill('Unsaved after expiry');
 await page.locator('#saveRecipeButton').click();
 check(await page.locator('#recipeSaveDialog').isVisible(),
   'Expired cached access opens the publish dialog');
 check(await page.locator('#githubTokenPrompt').isVisible(),'Expired access requires token again');
 check(githubPuts===4,'Expired access prevents automatic publish');
 await page.locator('#dismissSaveDialog').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#editRecipeButton').click();
 await page.unrouteAll();
 // A cached token rejected by GitHub must bring up a visible error dialog.
 await page.evaluate(() => sessionStorage.setItem('familyCookbook.githubToken.v1',
   JSON.stringify({token:'expired-token',expiresAt:Date.now()+600000})));
 await page.route('https://api.github.com/repos/MrJag/Recipes/contents/**',async route => {
   const cors={'access-control-allow-origin':'*',
     'access-control-allow-headers':'authorization,accept,x-github-api-version,content-type',
     'access-control-allow-methods':'GET,PUT,OPTIONS'};
   if(route.request().method()==='OPTIONS')
     return route.fulfill({status:204,headers:cors,body:''});
   return route.fulfill({status:401,contentType:'application/json',headers:cors,
     body:JSON.stringify({message:'Bad credentials'})});
 });
 await page.goto('http://localhost:8123/recipe.html?recipe=sweetango-orchard-sour',{waitUntil:'load'});
 await page.waitForTimeout(350);
 await page.locator('#editRecipeButton').click();
 await page.locator('.edit-sheet .edit-main-title').fill('Rejected token test');
 await page.locator('#saveRecipeButton').click();
 await page.locator('#recipeSaveDialog').waitFor({state:'visible'});
 check((await page.locator('#saveFeedback').textContent()).includes('HTTP 401'),
   'Rejected cached token opens a visible error dialog');
 check(await page.locator('#githubTokenPrompt').isVisible(),
   'Rejected credentials reveal the token prompt');
 check(await page.locator('.edit-sheet').isVisible(),
   'Rejected silent save preserves inline edits');
 check(await page.locator('#saveRecipeButton').evaluate(el =>
   !el.disabled && !el.classList.contains('is-saving') && el.textContent==='Save'),
   'Save spinner resets after GitHub error');
 check(await page.evaluate(() =>
   sessionStorage.getItem('familyCookbook.githubToken.v1'))===null,
   'Rejected cached credentials are forgotten');
 await page.locator('#dismissSaveDialog').click();
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('#editRecipeButton').click();
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
 await page.evaluate(() => sessionStorage.removeItem('familyCookbook.githubToken.v1'));
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
 await page.evaluate(() => sessionStorage.removeItem('familyCookbook.githubToken.v1'));
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
 await page.evaluate(() => sessionStorage.removeItem('familyCookbook.githubToken.v1'));
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
 // Salad image must load at full portrait resolution in the actual viewer.
 await page.goto('http://localhost:8123/recipe.html?recipe=fennel-apple-salad',{waitUntil:'load'});
 await page.waitForFunction(() => {
   const img=document.querySelector('#pages .sheet.has-photo .strip-image');
   return img?.complete && img.naturalWidth > 0;
 });
 check(await page.locator('#pages .sheet.has-photo .strip-image').evaluate(el =>
   el.naturalWidth>=1000 && el.naturalHeight>=1400 && el.currentSrc.includes('fennel-apple-salad.jpg')),
   'Fennel Apple Salad uses the full-resolution photo rather than a placeholder');
 await page.locator('#editRecipeButton').click();
 check(await page.locator('.edit-sheet .edit-directions li.edit-list-item').first().evaluate(el =>
   getComputedStyle(el).fontFamily.includes('Georgia') && getComputedStyle(el,'::before').content !== 'none'),
   'Fennel Apple Salad edit mode keeps cookbook font and circular direction numbers');
 await page.locator('#editRecipeButton').click();
 // High-resolution Florentine photo is loaded from its versioned image asset.
 await page.goto('http://localhost:8123/recipe.html?recipe=creamy-chicken-florentine',{waitUntil:'load'});
 await page.waitForFunction(() => {
   const img=document.querySelector('#pages .sheet.has-photo .strip-image');
   return img && img.complete && img.naturalWidth>0;
 });
 check(await page.locator('#pages .sheet.has-photo .strip-image').evaluate(img =>
   img.naturalWidth>=700 && img.naturalHeight>=1800),
   'Florentine recipe renders high-resolution portrait image');
 check(await page.locator('#pages .sheet.has-photo .strip-image').evaluate(img =>
   img.currentSrc.includes('creamy-chicken-florentine-v2.jpg')),
   'Florentine uses versioned image instead of stale cached preview');
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
