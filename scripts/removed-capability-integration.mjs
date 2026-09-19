import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startTenancyQa,guard } from './tenancy-qa-harness.mjs';
guard();process.env.LEAD_EMAIL_ENABLED='false';const qa=await startTenancyQa({port:4351}),results=[];let browser;
const retiredCode='TIME_CLOCK';
const run=async(name,fn)=>{try{await fn();results.push({name,status:'passed'});console.log('PASS',name);}catch(error){results.push({name,status:'failed',error:String(error.message).slice(0,650)});console.log('FAIL',name,String(error.message).slice(0,650));}};
const ok=async(session,method,path,body,status=method==='post'?201:200)=>{const response=await session.api(method,path,body);assert.equal(response.status,status,path);return response.body;};
try{
 const company=await qa.company(),admin=await qa.fixture('PLATFORM_ADMIN'),owner=await qa.session().init(),platform=await qa.session().init();assert.equal((await owner.login(company.owner)).status,200);assert.equal((await platform.login(admin)).status,200);
 const subscription=await ok(platform,'post',`/platform/commerce/tenants/${company.tenant._id}/subscription`,{modules:['SALES','ADVANCED_AUDIT'],cycle:'MONTHLY',version:0,status:'ACTIVE',startsAt:'2026-01-01',endsAt:'2099-01-01',nextDueAt:'2026-10-01',reason:'QA remoção '+qa.run});
 const snapshot=structuredClone(subscription.snapshot);snapshot.modules.push(retiredCode);snapshot.items.push({code:retiredCode,name:'Módulo legado',version:1,unitCents:1000,quantity:1,subtotalCents:1000,discountCents:0,totalCents:1000});for(const field of ['subtotalCents','totalCents','afterPromotionCents'])snapshot[field]+=1000;
 const doc=await qa.connection.models.CommercialSubscription.findOne({tenantId:company.tenant._id}).lean();assert(doc&&!qa.existedBefore('commercial_subscriptions_v2',doc._id));await qa.connection.models.CommercialSubscription.updateOne({_id:doc._id},{$set:{snapshot}});
 await run('historical retired module remains stored but cannot break active sales access',async()=>{
  const detail=await ok(owner,'get','/subscription');assert.deepEqual(detail.subscription.snapshot,snapshot);assert(detail.modules.includes('SALES'));assert(!detail.modules.includes(retiredCode));const me=await ok(owner,'get','/auth/me');assert(me.permissions.includes('vendas.criar'));assert(!me.permissions.some(permission=>permission.startsWith('ponto.')));await ok(owner,'get','/orders');
 });
 await run('catalogs and new quotes cannot activate the removed capability',async()=>{
  for(const session of [owner,platform]){const path=session===owner?'/subscription/catalog':'/platform/commerce/catalog',catalog=await ok(session,'get',path);assert(!catalog.some(row=>row.code===retiredCode));}
  await ok(owner,'post','/subscription/quote',{modules:[retiredCode],cycle:'MONTHLY'},400);
  await ok(platform,'post',`/platform/commerce/tenants/${company.tenant._id}/quote`,{modules:[retiredCode],cycle:'MONTHLY'},400);
 });
 await run('legacy role permissions cannot break list assignment edit or authenticated identity',async()=>{
  const role=await ok(owner,'post','/roles',{name:'QA cargo legado '+qa.run,description:'',permissions:['produtos.visualizar']});await qa.connection.models.CustomRole.collection.updateOne({_id:new qa.connection.base.Types.ObjectId(role._id)},{$set:{permissions:['produtos.visualizar','ponto.registrar','ponto.visualizar','ponto.gerenciar','ponto.exportar']}});
  const listed=(await ok(owner,'get','/roles')).items.find(item=>item._id===role._id);assert.deepEqual(listed.permissions,['produtos.visualizar']);const member=await qa.fixture('MEMBER',company.tenant);await ok(owner,'post',`/roles/${role._id}/assign/${member.id}`,{});const session=await qa.session().init();assert.equal((await session.login(member)).status,200);assert(!(await ok(session,'get','/auth/me')).permissions.some(permission=>permission.startsWith('ponto.')));
  await ok(owner,'patch','/roles/'+role._id,{name:role.name,description:'Atualizado após remoção',permissions:['produtos.visualizar'],version:0});
 });
 await run('old time-clock audit events stay persisted but are not returned by audit browsing',async()=>{
  const event=await qa.connection.models.AuditEvent.create({tenantId:company.tenant._id,action:'time.punch.created',outcome:'success',actorId:company.owner.id,actorRole:'OWNER',resourceType:'time-clock'});const events=await ok(owner,'get','/audit?limit=100');assert(!events.items.some(item=>item._id===String(event._id)));assert(await qa.connection.models.AuditEvent.exists({_id:event._id}));
 });
 await run('every former read and write endpoint is unavailable',async()=>{
  for(const suffix of ['state','clock','receipts','mine','team','people','export','corrections/mine','corrections/team'])await ok(owner,'get','/time-clock/'+suffix,undefined,404);
  await ok(owner,'post','/time-clock/punch',{},404);await ok(owner,'post','/time-clock/corrections',{},404);await ok(owner,'post','/time-clock/corrections/000000000000000000000001/review',{},404);await ok(platform,'get','/platform/time-clock?tenantId='+company.tenant._id,undefined,404);
 });
 browser=await chromium.launch({headless:true,channel:'chrome'});
 const login=async(page,user)=>{await page.goto(`${qa.baseURL}${user.role==='PLATFORM_ADMIN'?'/plataforma/login':'/login'}`);if(user.cnpj)await page.locator('[name=cnpj]').fill(user.cnpj);await page.locator('[name=email]').fill(user.email);await page.locator('[name=password]').fill(user.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL(url=>!url.pathname.endsWith('/login'));};
 await run('browser owner keeps sales and has no removed menu route or controls',async()=>{
  const context=await browser.newContext();try{const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await login(page,company.owner);const menu=page.getByRole('navigation',{name:'Menu principal'});assert(await menu.locator('a[href="/vendas"]').isVisible());assert.equal(await menu.locator('a[href^="/jornada"]').count(),0);assert.equal(await page.getByRole('button',{name:'Bater ponto',exact:true}).count(),0);await page.goto(`${qa.baseURL}/jornada`);await page.waitForURL(url=>url.pathname!=='/jornada');assert.equal(await page.locator('app-time-clock').count(),0);await page.goto(`${qa.baseURL}/assinatura`);await page.getByRole('heading',{name:'Contrato atual',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:/Registro de jornada|Bater ponto/}).count(),0);assert.deepEqual(errors,[]);await page.screenshot({path:`${qa.out}/removed-owner.png`,fullPage:true});}finally{await context.close();}
 });
 await run('browser platform has no removed section and contract editor exposes only current modules',async()=>{
  const context=await browser.newContext();try{const page=await context.newPage();await login(page,admin);assert.equal(await page.getByRole('navigation',{name:'Painel da plataforma'}).getByRole('button',{name:'Registros de jornada',exact:true}).count(),0);await page.goto(`${qa.baseURL}/plataforma/empresas?tenant=${company.tenant._id}`);await page.getByRole('heading',{name:'Empresa selecionada',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:/Registro de jornada|Bater ponto/}).count(),0);assert.equal(await page.locator('app-time-clock').count(),0);await page.screenshot({path:`${qa.out}/removed-platform.png`,fullPage:true});}finally{await context.close();}
 });
}catch(error){results.push({name:'setup',status:'failed',error:String(error.message).slice(0,650)});console.log('SETUP FAIL',error.message);}
finally{if(browser)await browser.close();await run('all prior database documents including historical records remain unchanged',async()=>{const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);});await writeFile(`${qa.out}/removed-capability-results.json`,JSON.stringify({run:qa.run,results},null,2));console.log(JSON.stringify({run:qa.run,passed:results.filter(row=>row.status==='passed').length,failed:results.filter(row=>row.status==='failed').length,out:qa.out}));await qa.app.close();}
if(results.some(row=>row.status==='failed'))process.exitCode=1;
