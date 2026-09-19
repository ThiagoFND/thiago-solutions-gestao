import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
import { startTenancyQa } from './tenancy-qa-harness.mjs';
const qa=await startTenancyQa();let browser;const results=[];
try{
 const a=await qa.company();await qa.fixture(null,a.tenant,'PENDING');
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'})});
 const context=await browser.newContext({baseURL:qa.baseURL}),page=await context.newPage();
 await page.goto('/login');await page.locator('[name=cnpj]').fill(a.owner.cnpj);await page.locator('[name=email]').fill(a.owner.email);await page.locator('[name=password]').fill(a.owner.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/dashboard');
 await page.goto('/usuarios');await page.locator('.pending-badge').waitFor();const count=Number(await page.locator('.pending-badge').textContent());
 await qa.fixture(null,a.tenant,'PENDING');
 await page.waitForFunction(expected=>document.querySelector('.pending-badge')?.textContent?.trim()===String(expected),count+1,{timeout:22000});
 const approve=page.getByRole('button',{name:'Aprovar',exact:true}).first();assert.equal(await approve.isDisabled(),true);
 await page.locator('article select').first().selectOption('CASHIER');assert.equal(await approve.isEnabled(),true);
 await page.screenshot({path:`${qa.out}/users.png`,fullPage:true});
 results.push({name:'pending badge polling and explicit approval selection',status:'passed'});
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL('**/login');assert.equal((await context.request.get('/api/auth/me')).status(),401);
 results.push({name:'logout stops protected access after polling',status:'passed'});
 await context.close();
}catch(e){results.push({name:'badge browser',status:'failed',error:e.message});console.log(e.message);process.exitCode=1;}
finally{if(browser)await browser.close();const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);await qa.app.close();await writeFile(`${qa.out}/badge-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({run:qa.run,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,preserved:p.unchanged}));}
