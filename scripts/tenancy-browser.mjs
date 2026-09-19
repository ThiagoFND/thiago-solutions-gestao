import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export async function runBrowser(qa,state,check,blocked){
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'})});
  const {actors}=state;
  const matrix=[['OWNER','/dashboard',['/dashboard','/vendas','/cozinha','/financeiro','/produtos','/usuarios']],['ADMIN','/dashboard',['/dashboard','/vendas','/cozinha','/financeiro','/produtos','/usuarios']],['CASHIER','/vendas',['/vendas']],['KITCHEN','/cozinha',['/cozinha']],['ACCOUNTANT','/financeiro',['/financeiro']],['PLATFORM_ADMIN','/plataforma/empresas',['/plataforma/empresas']],['PENDING','/aguardando-aprovacao',['/aguardando-aprovacao']]];
  async function login(page,role){const user=actors[role];await page.goto(role==='PLATFORM_ADMIN'?'/plataforma/login':'/login');if(role!=='PLATFORM_ADMIN')await page.locator('input[name=cnpj]').fill(user.cnpj);await page.locator('input[name=email]').fill(user.email);await page.locator('input[name=password]').fill(user.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();}
  for(const [role,home,allowed]of matrix){
   if(qa.transactions&&role==='PENDING')continue;
   const context=await browser.newContext({baseURL:qa.baseURL}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await check(`browser ${role} login/reload/menu/cookie`,async()=>{
    await login(page,role);await page.waitForURL(`**${home}`);await page.reload();await page.getByRole('button',{name:'Sair',exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,home);
    if(!['PLATFORM_ADMIN','PENDING'].includes(role))assert.deepEqual((await page.locator('aside nav a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')))).sort(),[...allowed,'/meu-perfil'].sort());
    else assert.equal(await page.locator('aside').count(),0);
    assert.ok((await context.cookies(`${qa.baseURL}/api`)).find(c=>c.name==='salgados_session')?.httpOnly);
    assert.equal(await page.evaluate(()=>localStorage.getItem('access_token')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('auth_user')),null);assert.deepEqual(errors,[]);
   });
   for(const path of ['/dashboard','/vendas','/cozinha','/financeiro','/produtos','/usuarios','/plataforma/empresas'])await check(`browser ${role} manual URL ${path}`,async()=>{await page.goto(path);await page.waitForURL(`**${allowed.includes(path)?path:home}`);await page.getByRole('button',{name:'Sair',exact:true}).waitFor();assert.deepEqual(errors,[]);});
   if(role==='OWNER'){
    await check('browser pending badge updates automatically without reload',async()=>{
     await page.goto('/usuarios');await page.locator('.pending-badge').waitFor();const old=Number(await page.locator('.pending-badge').textContent());
     await qa.fixture(null,state.a.tenant,'PENDING');
     await page.waitForFunction(count=>document.querySelector('.pending-badge')?.textContent?.trim()===String(count),old+1,{timeout:22000});
     const approve=page.getByRole('button',{name:'Aprovar',exact:true}).first();assert.equal(await approve.isDisabled(),true);
     await page.locator('article select').first().selectOption('CASHIER');assert.equal(await approve.isEnabled(),true);
     await page.screenshot({path:`${qa.out}/users.png`,fullPage:true});
    });
   }
   if(role==='PLATFORM_ADMIN')await check('browser company details/history and required decision reason',async()=>{
    await page.goto('/plataforma/empresas');await page.getByRole('button',{name:'Detalhes',exact:true}).first().click();await page.getByRole('button',{name:'Recusar empresa',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Recusar empresa',exact:true}).isDisabled(),true);await page.screenshot({path:`${qa.out}/platform.png`,fullPage:true});
   });
   await check(`browser ${role} logout and manual URL401`,async()=>{await page.getByRole('button',{name:'Sair',exact:true}).click();await page.waitForURL(role==='PLATFORM_ADMIN'?'**/plataforma/login':'**/login');assert.equal((await context.request.get('/api/auth/me')).status(),401);});
   await context.close();
  }
  const context=await browser.newContext({baseURL:qa.baseURL}),page=await context.newPage();
  await check('browser public onboarding form, validation and transaction result',async()=>{
   await page.goto('/cadastrar-empresa');assert.equal(await page.getByRole('button',{name:'Cadastrar empresa',exact:true}).isDisabled(),true);
   const password=`${qa.run}-Public-Password`;
   for(const [name,value]of Object.entries({cnpj:qa.documentNumber(),legalName:`Public ${qa.run}`,tradeName:`Public ${qa.run}`,corporateEmail:`public-${qa.run}@example.invalid`,companyPhone:'11999999999',name:'Public Owner',email:`public-owner-${qa.run}@example.invalid`,password,passwordConfirmation:password}))await page.locator(`[name=${name}]`).fill(value);
   const response=page.waitForResponse(r=>r.url().endsWith('/auth/onboarding'));await page.getByRole('button',{name:'Cadastrar empresa',exact:true}).click();assert.equal((await response).status(),qa.transactions?201:503);
   if(!qa.transactions)await page.getByRole('alert').waitFor();await page.screenshot({path:`${qa.out}/onboarding.png`,fullPage:true});
  });
  await check('browser public employee request, no implicit role field',async()=>{
   await page.goto('/solicitar-acesso');for(const [name,value]of Object.entries({cnpj:state.a.tenant.cnpj,name:'Public Employee',email:`public-employee-${qa.run}@example.invalid`,cpf:qa.documentNumber(true),phone:'11999999999',jobDescription:'Caixa',password:`${qa.run}-Password`,passwordConfirmation:`${qa.run}-Password`}))await page.locator(`[name=${name}]`).fill(value);
   assert.equal(await page.locator('[name=role]').count(),0);const response=page.waitForResponse(r=>r.url().endsWith('/auth/access-requests'));await page.getByRole('button',{name:'Enviar solicitação',exact:true}).click();assert.equal((await response).status(),qa.transactions?201:503);
  });
  await context.close();
  if(!qa.transactions)blocked('browser positive onboarding/approval/rejection/suspension/member changes require transactional Mongo');
  await check('Angular bundles contain no generated credentials, Mongo URI, CPF keys or JWT persistence',async()=>{
   const root=fileURLToPath(new URL('../apps/web/dist/web/browser/',import.meta.url));let scanned=0;
   for(const name of await readdir(root)){if(!/\.(js|html)$/.test(name))continue;const text=await readFile(root+name,'utf8');scanned++;for(const secret of [process.env.JWT_SECRET,process.env.CPF_ENCRYPTION_KEY,process.env.CPF_HASH_KEY,...Object.values(actors).map(u=>u.password)])assert.ok(!text.includes(secret));assert.ok(!/mongodb(?:\+srv)?:\/\//.test(text));assert.ok(!/localStorage\.setItem\([^)]*(?:token|auth_user)/.test(text));}assert.ok(scanned>5);
  });
 }finally{if(browser)await browser.close();}
}
