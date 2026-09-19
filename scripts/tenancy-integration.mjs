import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { startTenancyQa, documentNumber } from './tenancy-qa-harness.mjs';
const qa=await startTenancyQa(),results=[];
async function check(name,fn){try{await fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.message});console.log(`FAIL ${name}: ${e.message}`);}}
const blocked=name=>results.push({name,status:'blocked',reason:'MongoDB standalone: transactions required'});
const expect=async(call,status)=>{const r=await call;assert.equal(r.status,status,`HTTP ${r.status}, expected ${status}: ${JSON.stringify(r.body)}`);return r.body;};
try{
 const a=await qa.company(),b=await qa.company(),p=await qa.company('PENDING');
 const actors={OWNER:a.owner,OTHER_OWNER:b.owner,PENDING:p.owner,PLATFORM_ADMIN:await qa.fixture('PLATFORM_ADMIN')};
 for(const role of ['ADMIN','CASHIER','KITCHEN','ACCOUNTANT'])actors[role]=await qa.fixture(role,a.tenant);
 actors.OTHER_CASHIER=await qa.fixture('CASHIER',a.tenant);
 actors.EMPLOYEE_PENDING=await qa.fixture(null,a.tenant,'PENDING');
 const sessions={};for(const [role,user]of Object.entries(actors)){sessions[role]=await qa.session().init();await expect(sessions[role].login(user),200);}
 const anonymous=await qa.session().init();
 const owner={name:'Onboarding Owner',email:`onboard-${qa.run}@example.invalid`,password:randomBytes(24).toString('hex')};owner.passwordConfirmation=owner.password;
 const company={cnpj:documentNumber(),legalName:`Onboarding ${qa.run}`,tradeName:`Onboarding ${qa.run}`,corporateEmail:`company-${qa.run}@example.invalid`,phone:'11999999999'};
 await check('onboarding: atomic success or standalone503 with zero residues',async()=>{
  const r=await anonymous.api('post','/auth/onboarding',{company,owner});assert.equal(r.status,qa.transactions?201:503);
  assert.equal(await qa.db.collection('tenants_v2').countDocuments({cnpj:company.cnpj}),qa.transactions?1:0);
  assert.equal(await qa.db.collection('users_v2').countDocuments({email:owner.email}),qa.transactions?1:0);
  if(!qa.transactions)assert.equal(r.body.code,'TRANSACTIONS_REQUIRED');
 });
 const req={cnpj:a.tenant.cnpj,name:'Requested Employee',email:`request-${qa.run}@example.invalid`,cpf:documentNumber(true),phone:'11999999999',jobDescription:'Caixa',password:randomBytes(24).toString('hex')};req.passwordConfirmation=req.password;
 await check('company lookup active only, opaque unknown and pending',async()=>{await expect(anonymous.api('post','/auth/company-lookup',{cnpj:a.tenant.cnpj}),201);for(const cnpj of [p.tenant.cnpj,documentNumber()])await expect(anonymous.api('post','/auth/company-lookup',{cnpj}),404);});
 await check('employee request: role null, CPF protected or standalone zero residues',async()=>{
  await expect(anonymous.api('post','/auth/access-requests',req),qa.transactions?201:503);
  const user=await qa.db.collection('users_v2').findOne({email:req.email});if(!qa.transactions){assert.equal(user,null);return;}assert.equal(user.role,null);assert.equal(user.status,'PENDING');assert.ok(user.cpfHash);assert.ok(user.cpfEncrypted);assert.ok(!JSON.stringify(user).includes(req.cpf));
 });
 const require=createRequire(new URL('../apps/api/package.json',import.meta.url));const {METHOD_METADATA,PATH_METADATA}=require('@nestjs/common/constants');
 const controllers=[['auth/auth.controller.js','AuthController'],['users/users.controller.js','UsersController'],['tenants/platform.controller.js','PlatformController'],['products/products.controller.js','ProductsController'],['orders/orders.controller.js','OrdersController'],['productions/productions.controller.js','ProductionsController'],['reports/reports.controller.js','ReportsController'],['finance/finance.controller.js','FinanceController'],['audit/audit.module.js','AuditController']];
 const rows=[];for(const [file,name]of controllers){const C=(await import(`../apps/api/dist/${file}`))[name];for(const name of Object.getOwnPropertyNames(C.prototype)){
  const h=C.prototype[name];if(typeof h!=='function'||Reflect.getMetadata(METHOD_METADATA,h)===undefined)continue;
  rows.push({path:`/${Reflect.getMetadata(PATH_METADATA,C)}/${Reflect.getMetadata(PATH_METADATA,h)}`.replace(/\/$/,''),method:['get','post','put','delete','patch'][Reflect.getMetadata(METHOD_METADATA,h)],roles:Reflect.getMetadata('roles',h)??Reflect.getMetadata('roles',C),public:Reflect.getMetadata('isPublic',h),session:Reflect.getMetadata('sessionOnly',h)??Reflect.getMetadata('sessionOnly',C)});
 }}
 await writeFile(`${qa.out}/endpoints.json`,JSON.stringify(rows,null,2));
 for(const row of rows.filter(r=>!r.public)){
  const path=row.path.replace(':id','000000000000000000000001');
  await check(`401 ${row.method} ${row.path}`,()=>expect(anonymous.api(row.method,path,row.method==='get'?undefined:{}),401));
  for(const role of ['PLATFORM_ADMIN','OWNER','ADMIN','CASHIER','KITCHEN','ACCOUNTANT','PENDING','EMPLOYEE_PENDING']){
   const denied=!row.session&&(['PENDING','EMPLOYEE_PENDING'].includes(role)||!row.roles?.includes(role));
   if(denied)await check(`403 ${role} ${row.method} ${row.path}`,()=>expect(sessions[role].api(row.method,path,row.method==='get'?undefined:{}),403));
  }
 }
 for(const role of ['PLATFORM_ADMIN','OWNER','ADMIN','CASHIER','KITCHEN','ACCOUNTANT','PENDING','EMPLOYEE_PENDING']){
  await check(`own profile readable and immutable ${role}`,async()=>{
   const profile=await expect(sessions[role].api('get','/users/me/profile'),200);
   assert.equal(profile._id,actors[role].id);assert.equal(profile.email,actors[role].email);
   assert.equal(profile.tenantId,actors[role].tenantId);
   if(role==='PLATFORM_ADMIN')assert.equal(profile.company,null);
   for(const secret of ['passwordHash','cpfEncrypted','cpfHash','sessionVersion'])assert.ok(!Object.hasOwn(profile,secret));
   await expect(sessions[role].api('patch','/users/me/profile',{name:'Forbidden change'}),403);
   assert.deepEqual(await expect(sessions[role].api('get','/users/me/profile'),200),profile);
  });
 }
 let product,order,category,entry,recurrence;
 await check('products OWNER/ADMIN, tenant reference IDOR and kitchen projection',async()=>{
  product=await expect(sessions.OWNER.api('post','/products',{name:`Product ${qa.run}`,category:'QA',origin:'PRODUCED',salesGroup:'SNACKS',priceCents:100,availabilityMode:'PRODUCTION_CONTROLLED'}),201);
  await expect(sessions.ADMIN.api('patch',`/products/${product._id}`,{minimumStock:1}),200);
  await expect(sessions.OTHER_OWNER.api('patch',`/products/${product._id}`,{name:'Forbidden'}),404);
  assert.equal((await expect(sessions.OTHER_OWNER.api('get','/products'),200)).length,0);
  const list=await expect(sessions.KITCHEN.api('get','/products'),200);assert.equal(list[0].priceCents,undefined);assert.equal(list[0].tenantId,undefined);
 });
 await check('production and stock stay in tenant',async()=>{
  await expect(sessions.OTHER_OWNER.api('post','/productions',{productId:product._id,quantity:5}),404);
  await expect(sessions.KITCHEN.api('post','/productions',{productId:product._id,quantity:50}),201);
  assert.equal((await expect(sessions.OTHER_OWNER.api('get','/productions/today'),200)).length,0);
 });
 await check('orders tenant IDOR and same-tenant cashier ownership',async()=>{
  order=await expect(sessions.CASHIER.api('post','/orders',{type:'TAKEAWAY',items:[{productId:product._id,quantity:2}]}),201);
  for(const [method,suffix,body]of [['get','',undefined],['patch','',{type:'TAKEAWAY',items:[{productId:product._id,quantity:1}]}],['post','/finalize',{payments:[{method:'PIX',amountCents:200}]}],['post','/cancel',{reason:'QA denied'}]]){
   await expect(sessions.OTHER_OWNER.api(method,`/orders/${order._id}${suffix}`,body),404);await expect(sessions.OTHER_CASHIER.api(method,`/orders/${order._id}${suffix}`,body),403);
  }
  await expect(sessions.OTHER_OWNER.api('post','/orders',{type:'TAKEAWAY',items:[{productId:product._id,quantity:1}]}),400);
  assert.equal((await expect(sessions.OTHER_OWNER.api('get','/orders'),200)).length,0);
 });
 await check('sale edit/finalize, cancellation release, daily reports',async()=>{
  await expect(sessions.CASHIER.api('patch',`/orders/${order._id}`,{type:'TAKEAWAY',items:[{productId:product._id,quantity:3}]}),200);
  await expect(sessions.CASHIER.api('post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:300}]}),201);
  await expect(sessions.CASHIER.api('post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:300}]}),409);
  const other=await expect(sessions.OWNER.api('post','/orders',{type:'TAKEAWAY',items:[{productId:product._id,quantity:2}]}),201);
  await expect(sessions.OWNER.api('post',`/orders/${other._id}/cancel`,{reason:'QA cancellation'}),201);
  const stock=await expect(sessions.OWNER.api('get','/products'),200);assert.equal(stock.find(p=>p._id===product._id).availableStock,47);
  assert.equal((await expect(sessions.OWNER.api('get','/reports/daily'),200)).revenueCents,300);
  assert.equal((await expect(sessions.OTHER_OWNER.api('get','/reports/daily'),200)).revenueCents,0);
 });
 await check('independent tenant order counters start at1',async()=>{
  const p2=await expect(sessions.OTHER_OWNER.api('post','/products',{name:'Tenant B',category:'QA',origin:'PRODUCED',salesGroup:'SNACKS',priceCents:100,availabilityMode:'MADE_TO_ORDER'}),201);
  const o2=await expect(sessions.OTHER_OWNER.api('post','/orders',{type:'TAKEAWAY',items:[{productId:p2._id,quantity:1}]}),201);assert.equal(o2.number,1);assert.equal(order.number,1);
 });
 await check('financial CRUD, references, payments, histories and accountant projection',async()=>{
  category=await expect(sessions.ACCOUNTANT.api('post','/finance/categories',{name:`Category ${qa.run}`,type:'DESPESA_OPERACIONAL'}),201);
  const body={description:`Entry ${qa.run}`,categoryId:category._id,type:'DESPESA_OPERACIONAL',nature:'FIXA',expectedAmountCents:1000,dueDate:'2026-09-15',competence:'2026-09'};
  entry=await expect(sessions.ACCOUNTANT.api('post','/finance/entries',body),201);
  await expect(sessions.OTHER_OWNER.api('post','/finance/entries',body),404);
  for(const [method,suffix,body]of [['get','',undefined],['patch','',{description:'forbidden'}],['post','/payment',{paidOn:'2020-01-01',paidAmountCents:1000,origin:'PJ',method:'PIX'}],['post','/cancel',{reason:'forbidden'}],['get','/history',undefined]])await expect(sessions.OTHER_OWNER.api(method,`/finance/entries/${entry._id}${suffix}`,body),404);
  await expect(sessions.ACCOUNTANT.api('patch',`/finance/entries/${entry._id}`,{description:'Updated',version:0}),200);
  await expect(sessions.ACCOUNTANT.api('post',`/finance/entries/${entry._id}/payment`,{paidOn:'2020-01-01',paidAmountCents:1000,origin:'PJ',method:'PIX'}),201);
  await expect(sessions.ACCOUNTANT.api('patch',`/finance/entries/${entry._id}/payment`,{paidOn:'2020-01-01',paidAmountCents:1100,origin:'PJ',method:'PIX',confirmed:true,reason:'Correction'}),200);
  assert.equal((await expect(sessions.ACCOUNTANT.api('get',`/finance/entries/${entry._id}/history`),200)).total,4);
  const catalog=await expect(sessions.ACCOUNTANT.api('get','/finance/products'),200);assert.deepEqual(Object.keys(catalog.items[0]).sort(),['_id','active','name']);
  assert.equal((await expect(sessions.OTHER_OWNER.api('get','/finance/entries'),200)).total,0);
  assert.equal((await expect(sessions.OTHER_OWNER.api('get','/finance/summary?year=2026&month=9'),200)).count,0);
 });
 await check('financial recurrence, cancellation, category isolation and report',async()=>{
  recurrence=await expect(sessions.ACCOUNTANT.api('post','/finance/recurrences',{description:'Monthly QA',categoryId:category._id,type:'DESPESA_OPERACIONAL',nature:'FIXA',expectedAmountCents:100,frequency:'MENSAL',startDate:'2026-09-15',billingDay:15}),201);
  await expect(sessions.OTHER_OWNER.api('get',`/finance/recurrences/${recurrence._id}`),404);
  await expect(sessions.OTHER_OWNER.api('patch',`/finance/categories/${category._id}`,{name:'Forbidden'}),404);
  const gen=await expect(sessions.ACCOUNTANT.api('post',`/finance/recurrences/${recurrence._id}/generate`,{competence:'2026-10'}),201);assert.equal(gen.created,1);
  assert.equal((await expect(sessions.ACCOUNTANT.api('post',`/finance/recurrences/${recurrence._id}/generate`,{competence:'2026-10'}),201)).existing,1);
  await expect(sessions.ACCOUNTANT.api('post',`/finance/entries/${gen.entries[0]._id}/cancel`,{reason:'QA cancel'}),201);
  await expect(sessions.ACCOUNTANT.api('post',`/finance/recurrences/${recurrence._id}/deactivate`,{}),201);
  await expect(sessions.ACCOUNTANT.api('post',`/finance/categories/${category._id}/deactivate`,{}),201);
  await expect(sessions.ACCOUNTANT.api('get','/finance/reports/monthly?year=2026&month=9'),200);
 });
 await check('pending count, user details and audit isolated',async()=>{
  assert.equal((await expect(sessions.OWNER.api('get','/users/pending-count'),200)).count,qa.transactions?2:1);
  assert.equal((await expect(sessions.OTHER_OWNER.api('get','/users/pending-count'),200)).count,0);
  await expect(sessions.OTHER_OWNER.api('get',`/users/${actors.CASHIER.id}`),404);
  const audit=await expect(sessions.OWNER.api('get','/audit?limit=100'),200);assert.ok(audit.items.length);assert.ok(audit.items.every(x=>String(x.tenantId)===String(a.tenant._id)));
  for(const bad of ['passwordHash','cpfEncrypted','cpfHash','sessionVersion'])assert.ok(!JSON.stringify(await expect(sessions.OWNER.api('get','/users'),200)).includes(bad));
 });
 await check('cookies, CSRF, CORS, headers and validation',async()=>{
  const s=await qa.session().init(),response=await s.login(actors.OWNER);const cookie=response.headers.getSetCookie().join(';');for(const attr of ['HttpOnly','SameSite=Lax','Path=/api','Max-Age=900'])assert.ok(cookie.includes(attr));assert.ok(!cookie.includes('Domain='));
  assert.equal(response.body.token,undefined);assert.equal(response.body.user.sessionVersion,undefined);
  await expect(s.api('post','/auth/login',{cnpj:a.tenant.cnpj,email:actors.OWNER.email,password:actors.OWNER.password},{'X-CSRF-Token':''}),403);
  await expect(s.api('get','/auth/csrf',undefined,{Origin:'https://evil.example'}),403);
  const headers=(await s.api('get','/auth/csrf')).headers;assert.equal(headers.get('x-content-type-options'),'nosniff');assert.ok(headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.equal(headers.get('cache-control'),'no-store');
  for(const path of ['/orders/nope','/products?limit=101','/orders?status[$ne]=OPEN','/reports/daily?date=2026-02-30'])await expect(sessions.OWNER.api('get',path),400);
  await expect(anonymous.api('post','/auth/onboarding',{company,owner,role:'PLATFORM_ADMIN'}),400);
  await expect(sessions.OWNER.api('post',`/users/${actors.EMPLOYEE_PENDING.id}/approve`,{}),400);
  await expect(sessions.OWNER.api('post',`/users/${actors.EMPLOYEE_PENDING.id}/approve`,{role:'OWNER'}),400);
 });
 await check('logout immediately revokes saved cookies and tenant claims',async()=>{
  const user=await qa.fixture('CASHIER',a.tenant),s=await qa.session().init();await expect(s.login(user),200);const saved=s.cookies.get('salgados_session');await expect(s.api('post','/auth/logout',{}),200);s.cookies.set('salgados_session',saved);await expect(s.api('get','/auth/me'),401);
 });
 await check('rate limit public and platform login',async()=>{
  for(const [group,path,body]of [['ONBOARDING','/auth/onboarding',{}],['PLATFORM_LOGIN','/auth/platform-login',{email:actors.PLATFORM_ADMIN.email,password:'invalid'}]]){process.env[`RATE_LIMIT_${group}`]='1';await anonymous.api('post',path,body);await expect(anonymous.api('post',path,body),429);process.env[`RATE_LIMIT_${group}`]='10000';}
 });
 const transactional=['company approval/rejection','company suspension/reactivation and old sessions','employee approval/rejection/role/inactivation','last OWNER concurrent protection','onboarding rollback injection'];
 if(!qa.transactions){for(const name of transactional)blocked(name);await check('all membership/global decisions503 without any change',async()=>{
  const pendingBefore=await qa.db.collection('tenants_v2').findOne({_id:p.tenant._id});
  const activeBefore=await qa.db.collection('tenants_v2').findOne({_id:a.tenant._id});
  const memberBefore=await qa.db.collection('users_v2').findOne({email:actors.EMPLOYEE_PENDING.email});
  const cashierBefore=await qa.db.collection('users_v2').findOne({email:actors.CASHIER.email});
  for(const [s,method,path,body]of [
   [sessions.PLATFORM_ADMIN,'post',`/platform/tenants/${p.tenant._id}/approve`,{}],
   [sessions.PLATFORM_ADMIN,'post',`/platform/tenants/${p.tenant._id}/reject`,{reason:'QA rejection'}],
   [sessions.PLATFORM_ADMIN,'post',`/platform/tenants/${a.tenant._id}/suspend`,{reason:'QA suspension'}],
   [sessions.OWNER,'post',`/users/${actors.EMPLOYEE_PENDING.id}/approve`,{role:'CASHIER'}],
   [sessions.OWNER,'post',`/users/${actors.EMPLOYEE_PENDING.id}/reject`,{reason:'QA rejection'}],
   [sessions.OWNER,'patch',`/users/${actors.CASHIER.id}/role`,{role:'ACCOUNTANT'}],
   [sessions.OWNER,'patch',`/users/${actors.CASHIER.id}/status`,{status:'INACTIVE'}],
  ])await expect(s.api(method,path,body),503);
  assert.deepEqual(await qa.db.collection('tenants_v2').findOne({_id:p.tenant._id}),pendingBefore);
  assert.deepEqual(await qa.db.collection('tenants_v2').findOne({_id:a.tenant._id}),activeBefore);
  assert.deepEqual(await qa.db.collection('users_v2').findOne({email:actors.EMPLOYEE_PENDING.email}),memberBefore);
  assert.deepEqual(await qa.db.collection('users_v2').findOne({email:actors.CASHIER.email}),cashierBefore);
  assert.equal((await qa.db.collection('tenants_v2').findOne({_id:p.tenant._id})).status,'PENDING');assert.equal((await qa.db.collection('users_v2').findOne({email:actors.EMPLOYEE_PENDING.email})).status,'PENDING');
 });}
 else {
  await check(transactional[0],async()=>{await expect(sessions.PLATFORM_ADMIN.api('post',`/platform/tenants/${p.tenant._id}/approve`,{}),201);await expect(sessions.PENDING.api('get','/auth/me'),401);await expect(sessions.PENDING.login(p.owner),200);const rejected=await qa.company('PENDING');await expect(sessions.PLATFORM_ADMIN.api('post',`/platform/tenants/${rejected.tenant._id}/reject`,{reason:'QA rejected'}),201);await expect(anonymous.login(rejected.owner),401);});
  await check(transactional[1],async()=>{await expect(sessions.PLATFORM_ADMIN.api('post',`/platform/tenants/${a.tenant._id}/suspend`,{reason:'QA suspended'}),201);await expect(sessions.OWNER.api('get','/auth/me'),401);await expect(sessions.PLATFORM_ADMIN.api('post',`/platform/tenants/${a.tenant._id}/reactivate`,{reason:'QA restored'}),201);await expect(sessions.OWNER.api('get','/auth/me'),401);await expect(sessions.OWNER.login(a.owner),200);});
  await check(transactional[2],async()=>{await expect(sessions.OWNER.api('post',`/users/${actors.EMPLOYEE_PENDING.id}/approve`,{role:'CASHIER'}),201);await expect(sessions.EMPLOYEE_PENDING.api('get','/auth/me'),401);await expect(sessions.EMPLOYEE_PENDING.login(actors.EMPLOYEE_PENDING),200);await expect(sessions.OWNER.api('patch',`/users/${actors.EMPLOYEE_PENDING.id}/role`,{role:'ACCOUNTANT'}),200);await expect(sessions.EMPLOYEE_PENDING.api('get','/auth/me'),401);await expect(sessions.OWNER.api('patch',`/users/${actors.EMPLOYEE_PENDING.id}/status`,{status:'INACTIVE'}),200);await expect(sessions.OWNER.api('patch',`/users/${actors.EMPLOYEE_PENDING.id}/status`,{status:'ACTIVE'}),200);});
  await check('sole OWNER self-status denied before mutation',async()=>{const before=await qa.db.collection('users_v2').findOne({_id:b.tenant.ownerId});await expect(sessions.OTHER_OWNER.api('patch',`/users/${b.owner.id}/status`,{status:'INACTIVE'}),403);assert.deepEqual(await qa.db.collection('users_v2').findOne({_id:b.tenant.ownerId}),before);});
 }
 if(process.env.TENANCY_BROWSER==='true'){const {runBrowser}=await import('./tenancy-browser.mjs');await runBrowser(qa,{actors,sessions,a,b},check,blocked);}
}catch(e){results.push({name:'integration setup/sequence',status:'failed',error:e.message});console.log(e.stack);}
finally{
 await check('all documents from earlier runs preserved',async()=>{const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);console.log(`PRESERVED ${p.unchanged}/${p.previous}`);});
 await qa.app.close();await writeFile(`${qa.out}/results.json`,JSON.stringify(results,null,2));
 const summary={run:qa.run,passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length,blocked:results.filter(x=>x.status==='blocked').length};console.log(JSON.stringify(summary));if(summary.failed)process.exitCode=1;
}
