import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
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
 await page.locator('.site-header a.brand').click();
 check(page.url().endsWith('/'),'Header brand returns home');
 check(await page.locator('.hero').isVisible(),'Landing page visible');
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
