import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
// Inspect only the public URL supplied by the user. No application startup or DB connection.
const url='http://localhost:4200/empresa/thiagoteste';
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={url,readOnly:true,images:0,links:0};
try {
  const context=await browser.newContext();
  await context.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(20000);
  await page.goto(url);
  await page.getByRole('navigation',{name:'Navegação da vitrine'}).waitFor();
  for(const img of await page.locator('.featured-image').all()) {
    await img.scrollIntoViewIfNeeded();
    await img.evaluate(img=>img.decode());
    assert.equal(await img.evaluate(img=>img.naturalWidth>0),true);
    assert.equal(new URL(await img.getAttribute('src')).port,'3000');
    report.images++;
  }
  for(const gallery of await page.locator('app-product-gallery').all()) {
    const thumbs=gallery.locator('.thumbnails button');
    for(let i=0;i<await thumbs.count();i++){
      await thumbs.nth(i).click();const img=gallery.locator('.main-photo');await img.evaluate(img=>img.decode());
      assert.equal(await img.evaluate(img=>img.naturalWidth>0),true);assert.equal(await thumbs.nth(i).getAttribute('aria-pressed'),'true');report.images++;
    }
    if(await thumbs.count()>1){await thumbs.nth(0).focus();await thumbs.nth(0).click();await page.keyboard.press('ArrowRight');assert.equal(await thumbs.nth(1).getAttribute('aria-pressed'),'true');}
  }
  assert.ok(report.images>=5,'Expected main, featured and three additional photos');
  for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
  const nav=page.getByRole('navigation',{name:'Navegação da vitrine'});
  for(const [label,id] of [['Produtos','catalogo'],['Sobre','sobre'],['Contato','contato']]) {
    await nav.getByRole('link',{name:label,exact:true}).click();
    assert.equal(new URL(page.url()).pathname,'/empresa/thiagoteste');
    assert.equal(new URL(page.url()).hash,`#${id}`);report.links++;
  }
  await page.screenshot({path:'docs/vitrine-qa/thiagoteste-local.png',fullPage:true});
  await writeFile('docs/vitrine-qa/thiagoteste-local.json',JSON.stringify({...report,status:'passed'},null,2));
  console.log(JSON.stringify(report));
} finally {await browser.close();}
