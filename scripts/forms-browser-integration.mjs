import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startTenancyQa } from './tenancy-qa-harness.mjs';

const qa=await startTenancyQa(),results=[];
let browser;
async function check(name,fn){try{await fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.message});console.log(`FAIL ${name}: ${e.message}`);}}
const digits=v=>v.replace(/\D/g,'');
async function paste(input,value){await input.focus();await input.evaluate((el,text)=>{const data=new DataTransfer();data.setData('text/plain',text);if(el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))){el.setRangeText(text,el.selectionStart,el.selectionEnd,'end');el.dispatchEvent(new InputEvent('input',{inputType:'insertFromPaste',data:text,bubbles:true}));}},value);}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'})});
 const company=await qa.company(),pending=await qa.company('PENDING'),platform=await qa.fixture('PLATFORM_ADMIN'),cashier=await qa.fixture('CASHIER',company.tenant);
 await qa.fixture(null,company.tenant,'PENDING');
 const context=await browser.newContext({baseURL:qa.baseURL}),page=await context.newPage();page.setDefaultTimeout(10000);
 for(const path of ['/login','/cadastrar-empresa','/solicitar-acesso'])await check(`CNPJ mask typing paste and limit ${path}`,async()=>{
  await page.goto(path);const input=page.locator('[name=cnpj]');await input.pressSequentially(company.owner.cnpj);assert.match(await input.inputValue(),/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);assert.equal(digits(await input.inputValue()),company.owner.cnpj);
  await input.pressSequentially('ab12345');assert.equal(digits(await input.inputValue()).length,14);assert.ok(!/[a-z]/i.test(await input.inputValue()));await input.fill('');await paste(input,company.owner.cnpj);assert.equal(digits(await input.inputValue()),company.owner.cnpj);
 });
 await check('employee CPF phone masks limits and real submitted digits',async()=>{
  await page.goto('/solicitar-acesso');const cpf=qa.documentNumber(true),password=`${qa.run}-Password!`;
  const values={cnpj:company.owner.cnpj,name:'Forms employee QA',email:`forms-${qa.run}@example.invalid`,cpf,phone:'11987654321',jobDescription:'Caixa',password,passwordConfirmation:password};
  for(const [name,value]of Object.entries(values))await page.locator(`[name=${name}]`).fill(value);
  assert.match(await page.locator('[name=cpf]').inputValue(),/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);await page.locator('[name=cpf]').pressSequentially('abc1234');assert.equal(digits(await page.locator('[name=cpf]').inputValue()),cpf);
  assert.equal(await page.locator('[name=phone]').inputValue(),'(11) 98765-4321');await page.locator('[name=phone]').pressSequentially('xyz123');assert.equal(digits(await page.locator('[name=phone]').inputValue()),'11987654321');
  for(const [name,max]of [['name',120],['email',254],['password',72],['jobDescription',500]])assert.equal(await page.locator(`[name=${name}]`).getAttribute('maxlength'),String(max));
  const response=page.waitForResponse(r=>r.url().endsWith('/auth/access-requests'));await page.getByRole('button',{name:'Enviar solicitação',exact:true}).click();const r=await response;assert.equal(r.status(),201);const body=r.request().postDataJSON();assert.equal(body.cnpj,company.owner.cnpj);assert.equal(body.cpf,cpf);assert.equal(body.phone,'11987654321');
 });
 await check('company onboarding masks and real submitted model',async()=>{
  await page.goto('/cadastrar-empresa');const cnpj=qa.documentNumber(),password=`${qa.run}-OwnerPassword!`;
  for(const [name,value]of Object.entries({cnpj,legalName:`Forms ${qa.run}`,tradeName:'Forms company',corporateEmail:`corp-${qa.run}@example.invalid`,companyPhone:'1133334444',name:'Forms Owner',email:`owner-forms-${qa.run}@example.invalid`,password,passwordConfirmation:password}))await page.locator(`[name=${name}]`).fill(value);
  assert.equal(await page.locator('[name=companyPhone]').inputValue(),'(11) 3333-4444');for(const [name,max]of [['legalName',200],['tradeName',160],['corporateEmail',254],['passwordConfirmation',72]])assert.equal(await page.locator(`[name=${name}]`).getAttribute('maxlength'),String(max));
  const response=page.waitForResponse(r=>r.url().endsWith('/auth/onboarding'));await page.getByRole('button',{name:'Cadastrar empresa',exact:true}).click();const r=await response;assert.equal(r.status(),201);assert.equal(r.request().postDataJSON().company.cnpj,cnpj);assert.equal(r.request().postDataJSON().company.phone,'1133334444');
 });
 async function login(p,user,home){await p.goto(user.role==='PLATFORM_ADMIN'?'/plataforma/login':'/login');if(user.role!=='PLATFORM_ADMIN')await p.locator('[name=cnpj]').fill(user.cnpj);await p.locator('[name=email]').fill(user.email);await p.locator('[name=password]').fill(user.password);await p.getByRole('button',{name:'Entrar',exact:true}).click();await p.waitForURL(`**${home}`);}
 for(const [name,user,home,shell]of [['owner',company.owner,'/dashboard',true],['cashier',cashier,'/vendas',true],['pending',pending.owner,'/aguardando-aprovacao',false],['platform',platform,'/plataforma/empresas',false]])await check(`profile navigation and session isolation ${name}`,async()=>{
  const ctx=await browser.newContext({baseURL:qa.baseURL}),p=await ctx.newPage();try{await login(p,user,home);await p.goto('/meu-perfil');await p.getByRole('heading',{name:'Meu perfil',exact:true}).waitFor();await p.getByText(user.email,{exact:true}).waitFor();assert.equal(await p.locator('aside nav').count(),1);if(!shell){assert.deepEqual((await p.locator('aside nav a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')))).sort(),['/meu-perfil',home].sort());await p.waitForTimeout(16000);assert.equal(new URL(p.url()).pathname,'/meu-perfil');}if(shell){await p.locator(`aside nav a[href="${home}"]`).click();await p.waitForURL(`**${home}`);}else{await p.goto('/dashboard');await p.waitForURL(`**${home}`);}await p.goto('/meu-perfil');await p.reload();await p.getByText(user.email,{exact:true}).waitFor();}finally{await ctx.close();}
 });
 await login(page,company.owner,'/dashboard');
 await check('users Portuguese status labels retain API enum filter',async()=>{
  await page.goto('/usuarios');await page.locator('[name=status]').waitFor({state:'visible'});const options=page.locator('[name=status] option');assert.deepEqual(await options.allTextContents(),['Pendente','Ativo','Inativo','Recusado']);
  for(const status of ['ACTIVE','INACTIVE','REJECTED','PENDING']){const response=page.waitForResponse(r=>new URL(r.url()).pathname===(status==='PENDING'?'/api/users/requests':'/api/users')&&new URL(r.url()).searchParams.get('status')===status);await page.locator('[name=status]').selectOption(status);assert.equal((await response).status(),200);}
  await page.locator('article').first().waitFor({state:'visible'});assert.ok(!/\bPENDING\b/.test(await page.locator('article').first().innerText()));
 });
 await check('sales groups DOM order',async()=>{await page.goto('/vendas');await page.getByRole('heading',{name:'Bebidas',exact:true}).waitFor();assert.deepEqual(await page.locator('.catalog > h2').allTextContents(),['Salgados','Outros','Bebidas']);});
 await check('finance money rejects letters invalid paste and preserves decimal payload with inline category',async()=>{
  await page.goto('/financeiro');await page.getByRole('button',{name:'Nova conta',exact:true}).click();await page.locator('[name=description]').fill('Forms personal draft');await page.locator('[name=type]').selectOption('DESPESA_PESSOAL');const amount=page.locator('[name=amount]');await amount.fill('12,34');await amount.press('a');assert.equal(await amount.inputValue(),'12,34');await paste(amount,'abc');assert.equal(await amount.inputValue(),'12,34');await paste(amount,'1.234,56');assert.equal(await amount.inputValue(),'12,34');await amount.fill('12,345');assert.equal(await amount.inputValue(),'12,34');await amount.fill('10000000000,01');assert.equal(await amount.inputValue(),'12,34');
  await page.getByRole('button',{name:'Cadastrar categoria',exact:true}).click();await page.locator('[name=entryCategoryName]').fill('Forms personal category');const catResponse=page.waitForResponse(r=>r.url().endsWith('/finance/categories')&&r.request().method()==='POST');await page.getByRole('button',{name:'Salvar categoria',exact:true}).click();const cat=await (await catResponse).json();await page.waitForFunction(id=>document.querySelector('[name=categoryId]')?.value===id,cat._id);assert.equal(await amount.inputValue(),'12,34');assert.equal(await page.locator('[name=description]').inputValue(),'Forms personal draft');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife'}).format(new Date());await page.locator('[name=dueDate]').fill(today);const response=page.waitForResponse(r=>r.url().endsWith('/finance/entries')&&r.request().method()==='POST');await page.getByRole('button',{name:'Salvar',exact:true}).click();const r=await response;assert.equal(r.status(),201);assert.equal(r.request().postDataJSON().expectedAmountCents,1234);
 });
 await check('finance quantities and recurrence integers reject malformed input',async()=>{
  await page.getByRole('button',{name:'Nova conta',exact:true}).click();await page.locator('[name=type]').selectOption('CUSTO_PRODUCAO');
  for(const name of ['quantity','purchasedQuantity']){const input=page.locator(`[name=${name}]`);await input.fill('1,123456');await input.press('e');await paste(input,'invalid');assert.equal(await input.inputValue(),'1,123456');await input.fill('1,1234567');assert.equal(await input.inputValue(),'1,123456');}
  for(const name of ['unitAmount','totalAmount']){const input=page.locator(`[name=${name}]`);await input.fill('2.50');await input.press('x');assert.equal(await input.inputValue(),'2.50');}
  await page.locator('[name=recurring]').check();for(const [name,valid,invalid]of [['billingDay','31','32'],['installments','600','601']]){const input=page.locator(`[name=${name}]`);await input.fill(valid);await input.fill(invalid);assert.equal(await input.inputValue(),valid);await input.press('e');assert.equal(await input.inputValue(),valid);}
 });
 await page.screenshot({path:`${qa.out}/forms.png`,fullPage:true});await context.close();
}catch(e){results.push({name:'setup/sequence',status:'failed',error:e.stack});console.log(e.stack);}finally{
 if(browser)await browser.close();await check('previous documents preserved',async()=>{const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);console.log(`PRESERVED ${p.unchanged}/${p.previous}`);});await qa.app.close();await writeFile(`${qa.out}/forms-results.json`,JSON.stringify(results,null,2));const summary={run:qa.run,passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length};console.log(JSON.stringify(summary));if(summary.failed)process.exitCode=1;
}
