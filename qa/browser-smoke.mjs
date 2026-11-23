import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const report = { date: new Date().toISOString(), checks: [], errors: [] };
const check = (ok, label) => {
  report.checks.push({label,pass:Boolean(ok)});
  if (!ok) report.errors.push(label);
};
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({viewport:{width:1400,height:900}});
  page.on('pageerror', err => report.errors.push('PAGE ERROR: '+err.message));
  await page.goto('http://localhost:8123/?recipe=midwestern-chili', {waitUntil:'load'});
  await page.waitForTimeout(1400);
  check(await page.locator('body.recipe-open').count()===1,'Direct recipe URL switches to recipe view');
  check(await page.locator('#recipeView').isVisible(),'Recipe viewer is visible');
  check(await page.locator('#homeContent').isHidden(),'Landing page hides on recipe');
  check((await page.locator('#pages h1').allTextContents()).some(x=>x.includes('Mid-Western Chili')),'Selected recipe is rendered');
  check(await page.locator('.recipe-sidebar .sidebar-recipe-link').count()>=170,'Sidebar contains recipe navigation');
  await page.locator('.site-header a.brand').click();
  await page.waitForTimeout(200);
  check(await page.locator('#homeContent').isVisible(),'Brand navigates back home');
  await page.goto('http://localhost:8123/?recipe=sweetango-orchard-sour', {waitUntil:'load'});
  await page.waitForTimeout(1000);
  check(await page.locator('#recipeView').isVisible(),'Another direct recipe opens');
} catch(error) {
  report.errors.push('TEST ERROR: '+(error.stack||String(error)));
} finally {
  if (browser) await browser.close();
  report.pass = report.errors.length === 0;
  writeFileSync('qa/browser-smoke-result.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if (!report.pass) process.exitCode=1;
}
