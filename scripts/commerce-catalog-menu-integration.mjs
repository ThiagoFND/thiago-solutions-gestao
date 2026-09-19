import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startTenancyQa,guard } from './tenancy-qa-harness.mjs';
guard();process.env.LEAD_EMAIL_ENABLED='false';
const qa=await startTenancyQa({port:4346}),results=[],owned=new Set();let browser,platform;
const run=async(name,fn)=>{try{await fn();results.push({name,status:'passed'});console.log('PASS',name);}catch(e){results.push({name,status:'failed',error:String(e.message).slice(0,700)});console.log('FAIL',name,String(e.message).slice(0,700));}};
const ok=async(session,method,path,body,status=method==='post'?201:200)=>{const response=await session.api(method,path,body);assert.equal(response.status,status,`${path}: ${JSON.stringify(response.body)}`);return response.body;};
try{
 const admin=await qa.fixture('PLATFORM_ADMIN'),company=await qa.company(),owner=await qa.session().init();platform=await qa.session().init();assert.equal((await platform.login(admin)).status,200);assert.equal((await owner.login(company.owner)).status,200);
 const catalog=await ok(platform,'get','/platform/commerce/catalog'),base=catalog.find(o=>o.code==='BASIC');assert(base);
 const code=`REAL_${qa.run.replaceAll('-','_').toUpperCase()}`,testCode=`FIXTURE_${qa.run.replaceAll('-','_').toUpperCase()}`;owned.add(code);owned.add(testCode);
 let commercial,fixture;
 await run('explicit test-only plans stay in admin catalog and cannot be quoted by owner or admin',async()=>{
  fixture=await ok(platform,'post','/platform/commerce/catalog/versions',{...base,code:testCode,name:'Fixture isolada '+qa.run,version:0,testOnly:true,reason:'QA '+qa.run});
  const adminCatalog=await ok(platform,'get','/platform/commerce/catalog'),customerCatalog=await ok(owner,'get','/subscription/catalog');assert(adminCatalog.some(o=>o.code===testCode&&o.testOnly));assert(!customerCatalog.some(o=>o.code===testCode));assert(!customerCatalog.some(o=>/^QA_\d{13}_|^WEB_\d{13}_/.test(o.code)));
  await ok(owner,'post','/subscription/quote',{planCode:testCode,modules:[],cycle:'MONTHLY'},400);await ok(platform,'post',`/platform/commerce/tenants/${company.tenant._id}/quote`,{planCode:testCode,modules:[],cycle:'MONTHLY'},400);
 });
 await run('legitimate custom plan stays available and existing contract survives later test classification',async()=>{
  commercial=await ok(platform,'post','/platform/commerce/catalog/versions',{...base,code,name:'Plano comercial de validação '+qa.run,version:0,testOnly:false,reason:'QA '+qa.run});assert((await ok(owner,'get','/subscription/catalog')).some(o=>o.code===code));
  const assignment={planCode:code,modules:[],cycle:'MONTHLY',version:0,status:'ACTIVE',startsAt:'2026-01-01',endsAt:'2099-01-01',nextDueAt:'2026-10-01',reason:'QA '+qa.run};const subscription=await ok(platform,'post',`/platform/commerce/tenants/${company.tenant._id}/subscription`,assignment);const snapshot=structuredClone(subscription.snapshot);
  commercial=await ok(platform,'post','/platform/commerce/catalog/versions',{...commercial,testOnly:true,reason:'QA fixture de classificação '+qa.run});assert.deepEqual((await ok(owner,'get','/subscription')).subscription.snapshot,snapshot);await ok(owner,'post','/subscription/quote',{planCode:code,modules:[],cycle:'MONTHLY'},400);
 });
 await run('omitted testOnly inherits previous classification and explicit false reclassifies auditable version',async()=>{
  const {testOnly,...withoutFlag}=fixture;fixture=await ok(platform,'post','/platform/commerce/catalog/versions',{...withoutFlag,reason:'QA herança '+qa.run});assert.equal(fixture.testOnly,true);
  fixture=await ok(platform,'post','/platform/commerce/catalog/versions',{...fixture,testOnly:false,reason:'QA reclassificação explícita '+qa.run});assert.equal(fixture.testOnly,false);assert((await ok(owner,'get','/subscription/catalog')).some(o=>o.code===testCode));assert(await qa.connection.models.CommercialEvent.exists({'after.code':testCode,'before.testOnly':true,'after.testOnly':false,reason:'QA reclassificação explícita '+qa.run}));
 });
 const assign=async(modules,planCode='CUSTOM')=>{const detail=await ok(owner,'get','/subscription');return ok(platform,'post',`/platform/commerce/tenants/${company.tenant._id}/subscription`,{planCode,modules,cycle:'MONTHLY',version:detail.subscription.version,status:'ACTIVE',startsAt:'2026-01-01',endsAt:'2099-01-01',nextDueAt:'2026-10-01',reason:'QA menu '+qa.run});};
 await assign([],'COMPLETE');browser=await chromium.launch({headless:true,channel:'chrome'});
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`${qa.baseURL}/login`);await page.locator('[name=cnpj]').fill(company.owner.cnpj);await page.locator('[name=email]').fill(company.owner.email);await page.locator('[name=password]').fill(company.owner.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(url=>url.pathname!=='/login');
  const menu=page.getByRole('navigation',{name:'Menu principal'});
  await run('OWNER COMPLETE 12 modules sees audit and hides uncontracted journey/quality',async()=>{
   const detail=await ok(owner,'get','/subscription');assert.equal(detail.modules.length,12);assert.equal(await menu.locator('a[href="/jornada"]').count(),0);assert.equal(await menu.locator('a[href="/qualidade"]').count(),0);const auditRequest=page.waitForResponse(response=>response.url().includes('/api/audit?')&&response.request().method()==='GET');await menu.locator('a[href="/auditoria"]').click();const auditResponse=await auditRequest;assert.equal(auditResponse.status(),200);const auditData=await auditResponse.json();assert(auditData.items.length>0);await page.locator('app-audit tbody tr').first().waitFor();assert.equal(await page.locator('app-audit tbody tr').count(),auditData.items.length);assert(await page.getByRole('navigation',{name:'Paginação da auditoria'}).getByRole('button',{name:'Anterior',exact:true}).isDisabled());await page.waitForURL('**/auditoria');await page.getByRole('heading',{name:'Auditoria',exact:true}).waitFor();await page.screenshot({path:`${qa.out}/owner-complete-12.png`,fullPage:true});
  });
  await run('owner plan comparison excludes fixtures while preserving the contracted snapshot',async()=>{
   await menu.locator('a[href="/assinatura"]').click();await page.getByRole('heading',{name:'Contrato atual',exact:true}).waitFor();const options=await page.getByLabel('Plano',{exact:true}).locator('option').allTextContents();assert(!options.some(value=>/Plano navegador QA|QA isolated commercial plan/.test(value)));await page.screenshot({path:`${qa.out}/owner-plans.png`,fullPage:true});
  });
  await run('OWNER custom 13 modules sees quality and audit with working routes',async()=>{
   const {MODULE_CODES}=await import('../apps/api/dist/commerce/commerce.domain.js');await assign([...MODULE_CODES]);await page.reload();await menu.locator('a[href="/qualidade"]').waitFor();assert(await menu.locator('a[href="/auditoria"]').isVisible());
   await menu.locator('a[href="/qualidade"]').click();await page.waitForURL('**/qualidade');await page.locator('app-quality').waitFor();await page.screenshot({path:`${qa.out}/owner-custom-13.png`,fullPage:true});assert.deepEqual(errors,[]);
  });
  await run('OWNER without advanced audit cannot see audit menu or call audit endpoint',async()=>{
   await assign(['SALES']);await page.goto(`${qa.baseURL}/assinatura`);await page.getByRole('heading',{name:'Contrato atual',exact:true}).waitFor();assert.equal(await menu.locator('a[href="/auditoria"]').count(),0);await ok(owner,'get','/audit',undefined,403);
  });
 }finally{await context.close();}
 await run('platform contract selector excludes test plans and retains COMPLETE selection',async()=>{
  await assign([],'COMPLETE');const adminContext=await browser.newContext();try{const web=await adminContext.newPage();await web.goto(`${qa.baseURL}/plataforma/login`);await web.locator('[name=email]').fill(admin.email);await web.locator('[name=password]').fill(admin.password);await web.getByRole('button',{name:'Entrar',exact:true}).click();await web.waitForURL(url=>!url.pathname.endsWith('/login'));await web.goto(`${qa.baseURL}/plataforma/empresas?tenant=${company.tenant._id}`);await web.getByRole('heading',{name:'Empresa selecionada',exact:true}).waitFor();const plan=web.getByLabel('Plano',{exact:true}).filter({visible:true});await plan.locator('option[value="COMPLETE"]').waitFor({state:'attached'});assert.equal(await plan.inputValue(),'COMPLETE');const options=await plan.locator('option').allTextContents();assert(!options.some(value=>/Plano navegador QA|QA isolated commercial plan|Plano comercial de validação/.test(value)));await web.screenshot({path:`${qa.out}/platform-plan-selector.png`,fullPage:true});}finally{await adminContext.close();}
 });
}catch(error){results.push({name:'setup',status:'failed',error:String(error.message).slice(0,700)});console.log('SETUP FAIL',error.message);}
finally{
 if(browser)await browser.close();
 await run('fixtures created by this execution become unavailable without deleting historical data',async()=>{if(!platform)return;const catalog=await ok(platform,'get','/platform/commerce/catalog');for(const offer of catalog.filter(row=>owned.has(row.code))){const doc=await qa.connection.models.CommercialOffer.findOne({code:offer.code,version:offer.version}).lean();assert(doc&&!qa.existedBefore('commercial_offer_versions_v2',doc._id));await ok(platform,'post','/platform/commerce/catalog/versions',{...offer,available:false,reason:'QA fixture finalizada '+qa.run});}});
 await run('previous database documents preserved',async()=>{const preserved=await qa.preserve();assert.equal(preserved.missing,0);assert.equal(preserved.changed,0);});
 await writeFile(`${qa.out}/catalog-menu-results.json`,JSON.stringify({run:qa.run,results},null,2));console.log(JSON.stringify({run:qa.run,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,out:qa.out}));await qa.app.close();
}
if(results.some(result=>result.status==='failed'))process.exitCode=1;
