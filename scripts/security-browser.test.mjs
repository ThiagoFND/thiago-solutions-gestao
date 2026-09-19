import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startQa } from './start-finance-qa.mjs';
const run=process.env.SECURITY_QA_RUN;
if(!/^[a-zA-Z0-9_-]+$/.test(run??''))throw new Error('Unique SECURITY_QA_RUN required');
const output=fileURLToPath(new URL(`../docs/security-qa/${run}/browser/`,import.meta.url));
await mkdir(output,{recursive:true});
const {app,users,baseURL}=await startQa();
const results=[];let browser;
async function check(name,fn){try{await fn();results.push({name,status:'passed'});console.log(`PASS ${name}`);}catch(e){results.push({name,status:'failed',error:e.message});console.log(`FAIL ${name}: ${e.message}`);}}
try {
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'})});
  for(const [role,home,allowed,forbidden] of [
    ['ADMIN','/dashboard',['/dashboard','/vendas','/cozinha','/financeiro','/produtos','/usuarios'],[]],
    ['CASHIER','/vendas',['/vendas'],['/cozinha','/financeiro','/usuarios','/produtos','/dashboard']],
    ['KITCHEN','/cozinha',['/cozinha'],['/vendas','/financeiro','/usuarios','/produtos','/dashboard']],
  ]) {
    const context=await browser.newContext({baseURL});const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await check(`${role} login, cookie, reload, menus`,async()=>{
      await page.goto('/login');await page.locator('input[name=email]').fill(users[role].email);await page.locator('input[name=password]').fill(users[role].password);
      await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(`**${home}`);
      await page.reload();await page.locator('aside nav').waitFor();
      assert.equal(new URL(page.url()).pathname,home);
      const links=await page.locator('aside nav a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));assert.deepEqual(links.sort(),allowed.slice().sort());
      const cookies=await context.cookies(`${baseURL}/api`);const session=cookies.find(x=>x.name==='salgados_session');assert.ok(session?.httpOnly);assert.equal(session.sameSite,'Lax');
      assert.equal(await page.evaluate(()=>localStorage.getItem('access_token')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('auth_user')),null);
    });
    for(const path of forbidden)await check(`${role} manual URL ${path}`,async()=>{await page.goto(path);await page.waitForURL(`**${home}`);assert.equal(new URL(page.url()).pathname,home);});
    for(const path of allowed)await check(`${role} permitted screen ${path}`,async()=>{await page.goto(path);await page.locator('aside nav').waitFor();assert.equal(new URL(page.url()).pathname,path);assert.deepEqual(errors,[]);});
    await check(`${role} backend forbidden responses and401 session expiry`,async()=>{
      const paths=role==='CASHIER'?['/finance/entries','/users','/productions/today']:role==='KITCHEN'?['/orders','/finance/entries','/users']:[];
      for(const path of paths)assert.equal((await context.request.get(`/api${path}`)).status(),403);
      await context.clearCookies();await page.reload();await page.waitForURL('**/login');assert.equal(new URL(page.url()).pathname,'/login');
    });
    await check(`${role} logout invalidates cookie session`,async()=>{
      await page.goto('/login');await page.locator('input[name=email]').fill(users[role].email);await page.locator('input[name=password]').fill(users[role].password);
      await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(`**${home}`);
      await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL('**/login');
      assert.equal((await context.request.get('/api/auth/me')).status(),401);
    });
    await page.screenshot({path:`${output}/${role}.png`,fullPage:true});await context.close();
  }
} catch(e){results.push({name:'browser infrastructure',status:'failed',error:e.message});}
finally {if(browser)await browser.close();await app.close();await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify({passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length}));
if(results.some(x=>x.status==='failed'))process.exitCode=1;
