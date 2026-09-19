import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startTenancyQa, guard } from './tenancy-qa-harness.mjs';
guard();
process.env.COMMERCIAL_ENTITLEMENTS_ENABLED = 'false'; // Obsolete rollout flag must not bypass authorization.
const qa = await startTenancyQa({ port: 4341 });
const results = [], tenants = [], users = [], auditIds = [];
const audit = qa.connection.models.AuditEvent;
const createAudit = audit.create.bind(audit);
audit.create = async (...args) => { const docs = await createAudit(...args); for (const d of Array.isArray(docs) ? docs : [docs]) auditIds.push(d._id); return docs; };
const run = async (name, fn) => { try { await fn(); results.push({ name, status: 'passed' }); console.log('PASS', name); } catch (e) { results.push({ name, status: 'failed', error: String(e.message).slice(0,600) }); console.log('FAIL', name, String(e.message).slice(0,600)); } };
const ok = async (s, method, path, body, status = method === 'post' ? 201 : 200) => { const r = await s.api(method, path, body); assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(r.body)}`); return r.body; };
let browser, cleanupPlatform;
const ownedPlanCodes=new Set();
try {
  assert.equal(qa.transactions, true, 'Commercial mutations require replica set transactions');
  guard(); const a = await qa.company(); tenants.push(a.tenant._id); users.push(a.owner.id);
  const b = await qa.company(); tenants.push(b.tenant._id); users.push(b.owner.id);
  const admin = await qa.fixture('PLATFORM_ADMIN'); users.push(admin.id);
  const owner = await qa.session().init(), other = await qa.session().init(), platform = await qa.session().init(), anonymous = await qa.session().init();
  cleanupPlatform=platform;
  await ok(owner, 'post', '/auth/login', { email:a.owner.email,password:a.owner.password,cnpj:a.owner.cnpj },200);
  assert.equal((await other.login(b.owner)).status,200); assert.equal((await platform.login(admin)).status,200);
  const path = `/platform/commerce/tenants/${a.tenant._id}`;
  let catalog, subscription, invoice, plan;
  await run('global commercial panel requires authentication and platform role', async () => { await ok(anonymous,'get','/platform/commerce/dashboard',undefined,401); await ok(owner,'get','/platform/commerce/dashboard',undefined,403); await ok(platform,'get','/platform/commerce/dashboard'); });
  await run('catalog initialization is explicit and idempotent', async () => { await ok(platform,'post','/platform/commerce/catalog/initialize',{reason:`QA ${qa.run}`}); const again=await ok(platform,'post','/platform/commerce/catalog/initialize',{reason:`QA ${qa.run}`}); assert.deepEqual(again.created,[]); catalog=await ok(platform,'get','/platform/commerce/catalog'); assert(catalog.filter(o=>o.kind==='MODULE').length>=12); });
  await run('tenant without contract has no business access even with legacy flag disabled', async () => { for(const endpoint of ['/products','/categories','/users','/roles','/orders']) await ok(owner,'get',endpoint,undefined,403); await ok(owner,'get','/users/me/profile'); const me=await ok(owner,'get','/auth/me'); assert.deepEqual(me.permissions,[]);assert.equal(me.subscriptionAllowed,false);assert.equal((await ok(owner,'get','/subscription')).subscription,null); });
  await run('owner cannot submit prices, discounts, tenant or payment state', async () => { for(const extra of [{totalCents:1},{discounts:['FREE']},{tenantId:String(b.tenant._id)},{status:'PAID'}]) await ok(owner,'post','/subscription/quote',{modules:['SALES'],cycle:'MONTHLY',...extra},400); await ok(owner,'post',`${path}/subscription`,{},403); });
  await run('unknown modules and malformed IDs are rejected', async () => { await ok(owner,'post','/subscription/quote',{modules:['ROOT'],cycle:'MONTHLY'},400); await ok(platform,'get','/platform/commerce/tenants/not-an-id/subscription',undefined,400); });
  await run('custom calculation deduplicates modules and does not add dependencies', async () => { const q=await ok(owner,'post','/subscription/quote',{modules:['SALES','SALES'],cycle:'MONTHLY'}); assert.equal(q.items.length,2); assert.deepEqual(q.modules,['SALES']); assert.deepEqual(q.dependenciesAdded,[]); });
  const planCode=`QA_${qa.run.replaceAll('-','_').toUpperCase()}`;
  ownedPlanCodes.add(planCode);ownedPlanCodes.add(`WEB_${qa.run.replaceAll('-','_').toUpperCase()}`);
  await run('proposal permissions compare absent contract without granting access',async()=>{
    const q=await ok(owner,'post','/subscription/quote',{modules:['SALES'],cycle:'MONTHLY'});
    assert.equal(q.accessComparison.currentCount,0);assert(q.accessComparison.addedCount>0);
    assert(q.accessComparison.permissions.some(p=>p.key==='vendas.criar'&&p.proposed&&!p.current));
    assert(!q.accessComparison.permissions.some(p=>p.key==='financeiro.visualizar'));
    await ok(owner,'get','/orders',undefined,403);
  });
  await run('plan versions use optimistic concurrency', async () => { const base=catalog.find(o=>o.code==='BASIC'); const dto={...base,code:planCode,name:'QA isolated commercial plan',testOnly:false,monthlyCents:7990,version:0,reason:`QA ${qa.run}`}; plan=await ok(platform,'post','/platform/commerce/catalog/versions',dto); assert.equal(plan.version,1); await ok(platform,'post','/platform/commerce/catalog/versions',dto,409); });
  const assignment={planCode,modules:[],cycle:'MONTHLY',version:0,status:'ACTIVE',startsAt:'2026-01-01T00:00:00Z',endsAt:'2099-01-01T00:00:00Z',nextDueAt:'2026-10-01T00:00:00Z',reason:`QA ${qa.run}`};
  await run('assignment snapshots prices and enables only contracted modules',async()=>{subscription=await ok(platform,'post',`${path}/subscription`,assignment);assert.equal(subscription.snapshot.totalCents,7990);await ok(owner,'get','/orders');await ok(owner,'get','/finance/entries',undefined,403);const me=await ok(owner,'get','/auth/me');assert(me.permissions.includes('vendas.criar'));assert(!me.permissions.includes('financeiro.visualizar'));});
  await run('proposal compares upgrades and downgrades without changing the contract',async()=>{
    const up=await ok(owner,'post','/subscription/quote',{modules:['SALES','FINANCE'],cycle:'MONTHLY'});
    assert(up.accessComparison.permissions.some(p=>p.key==='tesouraria.visualizar'&&p.change==='ADDED'));
    assert(up.accessComparison.permissions.some(p=>p.key==='vendas.criar'&&p.change==='KEPT'));
    const down=await ok(owner,'post','/subscription/quote',{modules:[],cycle:'MONTHLY'});
    assert(down.accessComparison.permissions.some(p=>p.key==='vendas.criar'&&p.change==='REMOVED'));
    assert.equal((await ok(owner,'get','/subscription')).subscription.snapshot.planCode,planCode);
    await ok(owner,'get','/finance/entries',undefined,403);
  });
  await run('price update does not silently change contracted price',async()=>{await ok(platform,'post','/platform/commerce/catalog/versions',{...plan,monthlyCents:9990,reason:`QA ${qa.run}`});const detail=await ok(owner,'get','/subscription');assert.equal(detail.subscription.snapshot.totalCents,7990);assert.equal((await ok(owner,'post','/subscription/quote',{planCode,modules:[],cycle:'MONTHLY'})).totalCents,9990);});
  await run('owner cannot grant a permission from an uncontracted module',async()=>{await ok(owner,'post','/roles',{name:'QA forbidden grant',description:'',permissions:['financeiro.visualizar']},403);});
  await run('suspension blocks all business access in an existing session',async()=>{subscription=await ok(platform,'post',`${path}/status`,{version:subscription.version,status:'SUSPENDED',reason:`QA ${qa.run}`});await ok(owner,'get','/orders',undefined,403);await ok(owner,'get','/products',undefined,403);await ok(owner,'get','/subscription');subscription=await ok(platform,'post',`${path}/status`,{version:subscription.version,status:'ACTIVE',reason:`QA ${qa.run}`});await ok(owner,'get','/orders');});
  await run('invoice snapshots old signed price and duplicate competence conflicts',async()=>{const d={competence:'2026-10',dueAt:'2026-10-10T12:00:00Z',reason:`QA ${qa.run}`};invoice=await ok(platform,'post',`${path}/invoices`,d);assert.equal(invoice.snapshot.totalCents,7990);await ok(platform,'post',`${path}/invoices`,d,409);});
  await run('tenant cannot read another tenant invoice and platform is not tenant user',async()=>{assert.equal((await ok(other,'get','/subscription/invoices')).total,0);await ok(other,'get',`${path}/invoices`,undefined,403);await ok(platform,'get','/subscription',undefined,403);});
  await run('manual payment requires opening and a method then becomes immutable',async()=>{await ok(platform,'post',`${path}/invoices/${invoice._id}/status`,{version:invoice.version,status:'PAID',method:'Transferência',reason:`QA ${qa.run}`},400);invoice=await ok(platform,'post',`${path}/invoices/${invoice._id}/status`,{version:invoice.version,status:'OPEN',reason:`QA ${qa.run}`});await ok(platform,'post',`${path}/invoices/${invoice._id}/status`,{version:invoice.version,status:'PAID',reason:`QA ${qa.run}`},400);invoice=await ok(platform,'post',`${path}/invoices/${invoice._id}/status`,{version:invoice.version,status:'PAID',method:'Transferência',reason:`QA ${qa.run}`});await ok(platform,'post',`${path}/invoices/${invoice._id}/status`,{version:invoice.version,status:'CANCELED',reason:`QA ${qa.run}`},409);});
  await run('commercial audit records changes and owner requests do not activate modules',async()=>{const history=await ok(platform,'get',`${path}/history?limit=100`);assert(history.items.some(e=>e.action==='invoice.paid'));await ok(owner,'post','/subscription/requests',{kind:'CHANGE',modules:['FINANCE'],cycle:'MONTHLY',note:`QA ${qa.run}`});assert.deepEqual((await ok(owner,'get','/subscription')).modules,['SALES']);});
  await run('dashboard separates projected recurrence from confirmed receipt',async()=>{const dashboard=await ok(platform,'get','/platform/commerce/dashboard');assert(dashboard.received.some(r=>r.cents>=7990));assert(Number.isSafeInteger(dashboard.projectedMrrCents));});
  const discountCode=`D_${qa.run.replaceAll('-','_').toUpperCase()}`,couponCode=`C_${qa.run.replaceAll('-','_').toUpperCase()}`;
  await run('discount and coupon are configurable and owner simulation never consumes them',async()=>{
    await ok(platform,'post','/platform/commerce/discounts/versions',{code:discountCode,name:'QA founder',kind:'PERCENT',value:2000,scope:'SUBTOTAL',modules:[],plans:[],startsAt:'2026-01-01',endsAt:'2099-01-01',maxCycles:12,combinable:false,active:true,version:0,reason:`QA ${qa.run}`});
    await ok(platform,'post','/platform/commerce/coupons',{code:couponCode,discountCode,startsAt:'2026-01-01',endsAt:'2099-01-01',maxUses:1,perTenant:1,active:true,version:0,reason:`QA ${qa.run}`});
    const q=await ok(owner,'post','/subscription/quote',{modules:['SALES'],cycle:'MONTHLY',coupons:[couponCode]});assert(q.discountCents>0);const coupons=await ok(platform,'get','/platform/commerce/coupons?limit=100');assert.equal(coupons.items.find(c=>c.code===couponCode).uses,0);
  });
  await run('concurrent coupon redemption never exceeds the global limit',async()=>{
    const current=(await ok(owner,'get','/subscription')).subscription;
    const replies=await Promise.all([platform.api('post',`${path}/subscription`,{...assignment,version:current.version,coupons:[couponCode]}),platform.api('post',`/platform/commerce/tenants/${b.tenant._id}/subscription`,{...assignment,version:0,coupons:[couponCode]})]);
    assert.equal(replies.filter(r=>r.status===201).length,1,JSON.stringify(replies.map(r=>r.status)));assert(replies.some(r=>[400,409].includes(r.status)));const coupons=await ok(platform,'get','/platform/commerce/coupons?limit=100');assert.equal(coupons.items.find(c=>c.code===couponCode).uses,1);
  });
  await run('exhausted coupon and duplicate discount cannot be applied',async()=>{await ok(owner,'post','/subscription/quote',{modules:['SALES'],cycle:'MONTHLY',coupons:[couponCode]},400);await ok(owner,'post','/subscription/quote',{modules:['SALES'],cycle:'MONTHLY',coupons:[couponCode,couponCode]},400);});
  let product;
  await run('SALES alone finalizes without stock movement, using the shared product',async()=>{
    const category=await ok(owner,'post','/categories',{name:'QA shared category'});
    product=await ok(owner,'post','/products',{name:'QA shared product',categoryId:category._id,origin:'PURCHASED_FOR_RESALE',supplyMode:'CONTROLADO_POR_ESTOQUE',priceCents:1000});
    const order=await ok(owner,'post','/orders',{type:'TAKEAWAY',items:[{productId:product._id,quantity:2}]});assert.equal(order.stockPolicy,'AT_FINALIZATION');await ok(owner,'post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:2000}]});
    assert.equal((await qa.connection.models.Product.findById(product._id)).availableStock,0);assert.equal(await qa.connection.models.StockMovement.countDocuments({tenantId:a.tenant._id,productId:product._id}),0);
    await ok(owner,'patch',`/categories/${category._id}`,{name:'QA renamed category',version:category.version});const newer=await ok(owner,'post','/orders',{type:'TAKEAWAY',items:[{productId:product._id,quantity:1}]});assert.equal(newer.items[0].category,'QA renamed category');assert.equal((await ok(owner,'get',`/orders/${order._id}`)).items[0].category,'QA shared category');
  });
  await run('SALES plus INVENTORY debits once at finalization and rejects concurrent duplicate',async()=>{
    const version=(await ok(owner,'get','/subscription')).subscription.version;
    await ok(platform,'post',`${path}/subscription`,{...assignment,planCode:'CUSTOM',modules:['SALES','INVENTORY'],version});
    guard();await qa.connection.models.Product.updateOne({_id:product._id,tenantId:a.tenant._id},{$set:{availableStock:5}});
    const order=await ok(owner,'post','/orders',{type:'TAKEAWAY',items:[{productId:product._id,quantity:2}]});assert.equal((await qa.connection.models.Product.findById(product._id)).availableStock,5);
    const replies=await Promise.all([owner.api('post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:2000}]}),owner.api('post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:2000}]})]);assert.deepEqual(replies.map(r=>r.status).sort(),[201,409]);assert.equal((await qa.connection.models.Product.findById(product._id)).availableStock,3);assert.equal(await qa.connection.models.StockMovement.countDocuments({tenantId:a.tenant._id,referenceId:order._id}),1);
    const current=(await ok(owner,'get','/subscription')).subscription.version;await ok(platform,'post',`${path}/subscription`,{...assignment,version:current});
  });
  await run('concurrent product creation respects quota and downgrade preserves existing records',async()=>{
    const currentOffers=await ok(platform,'get','/platform/commerce/catalog');const limited=currentOffers.find(o=>o.code===planCode);
    await ok(platform,'post','/platform/commerce/catalog/versions',{...limited,limits:{...limited.limits,products:2,categories:1,activeUsers:1},reason:`QA ${qa.run}`});
    const version=(await ok(owner,'get','/subscription')).subscription.version;await ok(platform,'post',`${path}/subscription`,{...assignment,version});
    const data={name:'QA limited product',categoryId:product.categoryId,origin:'PURCHASED_FOR_RESALE',supplyMode:'CONTROLADO_POR_ESTOQUE',priceCents:100};
    const replies=await Promise.all([owner.api('post','/products',{...data,name:'QA concurrent one'}),owner.api('post','/products',{...data,name:'QA concurrent two'})]);assert.deepEqual(replies.map(r=>r.status).sort(),[201,403]);assert.equal(await qa.connection.models.Product.countDocuments({tenantId:a.tenant._id}),2);await ok(owner,'post','/categories',{name:'QA beyond category limit'},403);
    const role=await ok(owner,'post','/roles',{name:'QA base role',description:'',permissions:['produtos.visualizar']});guard();const pending=await qa.fixture(null,a.tenant,'PENDING');users.push(pending.id);await ok(owner,'post',`/users/${pending.id}/approve`,{customRoleId:role._id},403);assert.equal((await qa.connection.models.User.findById(pending.id)).status,'PENDING');
  });
  await run('scheduled change switches effective modules on the server without a GET write',async()=>{
    const version=(await ok(owner,'get','/subscription')).subscription.version;const future=new Date(Date.now()+86400000).toISOString();
    await ok(platform,'post',`${path}/schedule`,{...assignment,planCode:'CUSTOM',modules:['PRODUCTION'],version,startsAt:future});assert.deepEqual((await ok(owner,'get','/subscription')).modules,['SALES']);
    guard();await qa.connection.models.CommercialSubscription.updateOne({tenantId:a.tenant._id},{$set:{'scheduled.effectiveAt':new Date(Date.now()-1000),'scheduled.startsAt':new Date(Date.now()-1000)}});
    const before=await qa.connection.models.CommercialSubscription.findOne({tenantId:a.tenant._id}).lean();const effective=await ok(owner,'get','/subscription');assert.deepEqual(effective.modules,['PRODUCTION']);await ok(owner,'get','/orders',undefined,403);const after=await qa.connection.models.CommercialSubscription.findOne({tenantId:a.tenant._id}).lean();assert.deepEqual(after,before);
  });
  await run('PRODUCTION alone records output without changing inventory, replay preserves identity',async()=>{
    const produced=await ok(owner,'post','/products',{name:'QA produced standalone',categoryId:product.categoryId,origin:'PRODUCED',supplyMode:'CONTROLADO_POR_ESTOQUE',priceCents:100});
    const dto={productId:produced._id,quantity:3,idempotencyKey:`qa-${qa.run}`};const first=await ok(owner,'post','/productions',dto);const replay=await ok(owner,'post','/productions',dto);assert.equal(replay._id,first._id);assert.equal((await qa.connection.models.Product.findById(produced._id)).availableStock,0);assert.equal(await qa.connection.models.StockMovement.countDocuments({tenantId:a.tenant._id,productId:produced._id}),0);
    const version=(await ok(owner,'get','/subscription')).subscription.version;await ok(platform,'post',`${path}/subscription`,{...assignment,version});assert.equal(await qa.connection.models.Product.countDocuments({tenantId:a.tenant._id}),3);
  });
  await run('requests are tenant scoped and approval cannot fake a contractual change',async()=>{
    const requests=await ok(owner,'get','/subscription/requests');assert.equal(requests.total,1);const request=requests.items[0];assert.equal((await ok(other,'get','/subscription/requests')).total,0);
    await ok(platform,'post',`${path}/requests/${request._id}/decision`,{version:0,status:'APPROVED',reason:`QA ${qa.run}`},409);
    await ok(platform,'post',`${path}/requests/${request._id}/decision`,{version:0,status:'REJECTED',reason:`QA ${qa.run}`});assert.equal((await ok(owner,'get','/subscription/requests')).items[0].status,'REJECTED');
  });
  await run('draft correction is versioned and cannot modify a paid invoice',async()=>{
    let draft=await ok(platform,'post',`${path}/invoices`,{competence:'2026-11',dueAt:'2026-11-10',reason:`QA ${qa.run}`});
    draft=await ok(platform,'post',`${path}/invoices/${draft._id}/edit`,{version:0,competence:'2026-11',dueAt:'2026-11-15',reason:`QA ${qa.run}`});assert.equal(draft.version,1);
    await ok(platform,'post',`${path}/invoices/${invoice._id}/edit`,{version:invoice.version,competence:'2026-10',dueAt:'2026-10-15',reason:`QA ${qa.run}`},409);
  });
  await run('LANDING_PAGE alone is public without inventory; stock hiding and module removal protect images too',async()=>{
    const assignModules=async modules=>{const version=(await ok(owner,'get','/subscription')).subscription.version;return ok(platform,'post',`${path}/subscription`,{...assignment,planCode:'CUSTOM',modules,version});};
    await assignModules(['LANDING_PAGE']);
    const category=await qa.connection.models.Category.findById(product.categoryId);await ok(owner,'patch',`/categories/${category.id}`,{name:category.name,published:true,version:category.version});
    const csrf=(await owner.api('get','/auth/csrf')).body.csrfToken;const form=new FormData();form.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'qa.png');
    const response=await fetch(`${qa.baseURL}/api/catalog-images`,{method:'POST',headers:{Origin:qa.baseURL,Cookie:[...owner.cookies].map(([k,v])=>`${k}=${v}`).join('; '),'X-CSRF-Token':csrf},body:form});assert.equal(response.status,201);const image=await response.json();
    const current=await qa.connection.models.Product.findById(product._id);await ok(owner,'patch',`/products/${product._id}`,{published:true,imageUrl:image.url,version:current.version});guard();await qa.connection.models.Product.updateOne({_id:product._id,tenantId:a.tenant._id},{$set:{availableStock:0}});
    const dto={slug:`saas-${qa.run}`,publicName:'QA standalone showcase',slogan:'',description:'',presentation:'',theme:'green',logoUrl:'',coverUrl:'',phone:'',whatsapp:'',publicEmail:'',address:'',hours:'',socialLinks:[],sections:['products'],additionalInfo:'',contactUrl:'',contactLabel:'Contato',operatingNotice:'',shareTitle:'',shareDescription:'',hideUnavailable:true,showDemandLabel:true,showPrices:true};
    const config=await ok(owner,'put','/landing',dto);await ok(owner,'post','/landing/publish',{version:config.version});
    let page=await ok(anonymous,'get',`/public/companies/${dto.slug}`);assert.equal(page.products.find(p=>p.key===product._id).available,true);assert.equal((await anonymous.api('get',image.url.replace('/api',''))).status,200);
    await assignModules(['LANDING_PAGE','INVENTORY']);page=await ok(anonymous,'get',`/public/companies/${dto.slug}`);assert(!page.products.some(p=>p.key===product._id));assert.equal((await anonymous.api('get',image.url.replace('/api',''))).status,404);
    const version=(await ok(owner,'get','/subscription')).subscription.version;await ok(platform,'post',`${path}/subscription`,{...assignment,version});await ok(anonymous,'get',`/public/companies/${dto.slug}`,undefined,404);assert.equal((await anonymous.api('get',image.url.replace('/api',''))).status,404);assert(await qa.connection.models.LandingConfig.exists({tenantId:a.tenant._id}));
  });

  const chooseModules=async modules=>ok(platform,'post',`${path}/subscription`,{...assignment,planCode:'CUSTOM',modules,version:(await ok(owner,'get','/subscription')).subscription.version});
  let cashAccount,cashEntry,debitAccount,creditAccount,journal;
  await run('expenses and treasury are independent commercial permissions',async()=>{
    await chooseModules(['EXPENSES']);await ok(owner,'get','/finance/entries');await ok(owner,'get','/treasury/accounts',undefined,403);
    const allowed=await ok(owner,'get','/roles/permissions');assert(!allowed.some(p=>p.key.startsWith('tesouraria.')));
    await chooseModules(['FINANCE']);await ok(owner,'get','/finance/entries',undefined,403);await ok(owner,'get','/accounting/accounts',undefined,403);
    cashAccount=await ok(owner,'post','/treasury/accounts',{name:'QA bank',kind:'BANK',openingCents:10000});
    const party=await ok(owner,'post','/parties',{name:'QA customer',roles:['CUSTOMER']});
    const d={accountId:cashAccount._id,partyId:party._id,description:'QA receivable',direction:'IN',amountCents:2500,dueDate:'2026-09-18',reference:`cash-${qa.run}`};
    cashEntry=await ok(owner,'post','/treasury/entries',d);assert.equal((await ok(owner,'post','/treasury/entries',d))._id,cashEntry._id);
    await ok(owner,'post','/treasury/entries',{...d,amountCents:3000},409);
    await ok(owner,'post',`/treasury/entries/${cashEntry._id}/settle`,{version:0,date:'2026-09-18',reason:'QA settlement'});
    await ok(owner,'post',`/treasury/entries/${cashEntry._id}/settle`,{version:0,date:'2026-09-18',reason:'QA duplicate'},409);
    assert.equal((await ok(owner,'get','/treasury/summary?month=2026-09')).accounts[0].balanceCents,12500);
  });
  await run('treasury transfers are atomic and idempotent',async()=>{
    const to=await ok(owner,'post','/treasury/accounts',{name:'QA cash',kind:'CASH',openingCents:0});const d={fromAccountId:cashAccount._id,toAccountId:to._id,amountCents:1000,date:'2026-09-18',reference:`transfer-${qa.run}`,reason:'QA transfer'};
    await ok(owner,'post','/treasury/transfers',d);await ok(owner,'post','/treasury/transfers',d);
    assert.equal((await ok(owner,'get','/treasury/summary')).accounts.reduce((n,a)=>n+a.balanceCents,0),12500);
    await ok(other,'post','/treasury/entries',{accountId:cashAccount._id,description:'forged cross tenant',direction:'OUT',amountCents:1,dueDate:'2026-09-18',reference:`forged-${qa.run}`},403);
  });
  await run('accounting runs alone and enforces double entries and idempotency',async()=>{
    await chooseModules(['ACCOUNTING_FISCAL']);await ok(owner,'get','/treasury/accounts',undefined,403);await ok(owner,'get','/finance/entries',undefined,403);
    debitAccount=await ok(owner,'post','/accounting/accounts',{code:'1.01',name:'QA assets',kind:'ASSET'});creditAccount=await ok(owner,'post','/accounting/accounts',{code:'4.01',name:'QA revenues',kind:'REVENUE'});
    const d={date:'2026-09-18',description:'QA double entry',reference:`journal-${qa.run}`,lines:[{accountId:debitAccount._id,debitCents:2000,creditCents:0},{accountId:creditAccount._id,debitCents:0,creditCents:2000}]};
    await ok(owner,'post','/accounting/journals',{...d,lines:[d.lines[0],{...d.lines[1],creditCents:1999}]},400);
    journal=await ok(owner,'post','/accounting/journals',d);assert.equal((await ok(owner,'post','/accounting/journals',d))._id,journal._id);
    const balance=await ok(owner,'get','/accounting/trial-balance?month=2026-09');assert.equal(balance.debitCents,2000);assert.equal(balance.creditCents,2000);assert.equal(balance.resultCents,2000);
  });
  await run('accounting closing prevents postings and allows audited reopening',async()=>{
    const c=await ok(owner,'post','/accounting/closing',{month:'2026-09',closed:true,version:0,reason:'QA close period'});
    await ok(owner,'post',`/accounting/journals/${journal._id}/reverse`,{date:'2026-09-19',version:0,reason:'QA reverse closed'},409);
    await ok(owner,'post','/accounting/closing',{month:'2026-09',closed:false,version:c.version,reason:'QA reopen period'});
    await ok(owner,'post',`/accounting/journals/${journal._id}/reverse`,{date:'2026-09-19',version:0,reason:'QA reverse opened'});
    assert.equal((await ok(owner,'get','/accounting/trial-balance?month=2026-09')).resultCents,0);
  });
  await run('accounting imports preserved sources once without requiring treasury operation access',async()=>{
    const d={source:'TREASURY',sourceId:cashEntry._id,debitAccountId:debitAccount._id,creditAccountId:creditAccount._id};
    const j=await ok(owner,'post','/accounting/imports',d);assert.equal((await ok(owner,'post','/accounting/imports',d))._id,j._id);
    const sources=await ok(owner,'get','/accounting/sources?month=2026-09');assert(sources.sources.find(s=>s.source==='TREASURY').items.some(i=>i._id===cashEntry._id&&i.imported));
    const obligation=await ok(owner,'post','/accounting/obligations',{name:'QA review documents',dueDate:'2026-09-30',notes:'Configured by accountant'});
    await ok(owner,'post',`/accounting/obligations/${obligation._id}/status`,{version:0,status:'DONE',reason:'QA verified documents'});
    assert.equal((await owner.api('get','/accounting/trial-balance/export?month=2026-09')).status,200);
    await ok(owner,'post','/accounting/accounts',{code:'9.01',name:'forged',kind:'ASSET',tenantId:b.tenant._id},400);
  });
  await ok(platform,'post',`${path}/subscription`,{...assignment,version:(await ok(owner,'get','/subscription')).subscription.version});
  if(process.env.COMMERCE_BROWSER==='true'){
    const {chromium}=await import('playwright-core');browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await run('browser: platform catalogs, contract and invoices are reachable',async()=>{
      await page.goto(`${qa.baseURL}/plataforma/login`);await page.locator('input[name=email]').fill(admin.email);await page.locator('input[name=password]').fill(admin.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/plataforma/empresas');
      await page.getByRole('heading',{name:'Painel da plataforma',exact:true}).waitFor();
      await page.getByRole('button',{name:'Planos e módulos',exact:true}).click();await page.getByRole('heading',{name:'Catálogo versionado',exact:true}).waitFor();
      await page.getByRole('button',{name:'Criar plano',exact:true}).click();await page.getByLabel('Código',{exact:true}).fill(`WEB_${qa.run.replaceAll('-','_').toUpperCase()}`);await page.getByLabel('Nome comercial',{exact:true}).fill(`Plano navegador QA ${qa.run}`);await page.getByLabel('Preço mensal (R$)',{exact:true}).fill('88,80');await page.getByLabel('Descrição',{exact:true}).fill('Plano criado por formulário');await page.getByLabel('Motivo da operação administrativa').fill(`QA ${qa.run}`);page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Salvar nova versão',exact:true}).click();await page.getByRole('heading',{name:`Plano navegador QA ${qa.run}`,exact:true}).waitFor();
      await page.goto(`${qa.baseURL}/plataforma/comercial?tenant=${a.tenant._id}`);await page.getByRole('heading',{name:'Faturamento manual',exact:true}).waitFor();await page.getByText('2026-10 · R$79.90',{exact:false}).count();
      for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await page.screenshot({path:`${qa.out}/commerce-platform.png`,fullPage:true});
    });
    await run('browser: approval and contract share one responsive workspace',async()=>{
      guard();const pending=await qa.company('PENDING');tenants.push(pending.tenant._id);users.push(pending.owner.id);
      await page.goto(`${qa.baseURL}/plataforma/empresas`);
      await page.getByRole('button',{name:'Empresas e aprova\u00e7\u00f5es',exact:true}).click();
      const card=page.locator('.company-grid article').filter({hasText:pending.tenant.tradeName});
      await card.getByRole('button',{name:'Detalhes',exact:true}).click();
      const detail=page.getByRole('article',{name:'Detalhes da empresa'});
      await detail.getByRole('button',{name:'Aprovar empresa',exact:true}).waitFor();
      for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
      page.once('dialog',d=>d.accept());await detail.getByRole('button',{name:'Aprovar empresa',exact:true}).click();
      await detail.getByRole('button',{name:'Suspender empresa',exact:true}).waitFor();
      assert.equal((await ok(platform,'get',`/platform/tenants/${pending.tenant._id}`)).status,'ACTIVE');
      await page.getByRole('region',{name:'Empresa em contexto'}).getByRole('button',{name:'Plano e cobran\u00e7as',exact:true}).click();
      await page.getByRole('button',{name:'Simular contrata\u00e7\u00e3o',exact:true}).waitFor();
      assert(page.url().endsWith('/plataforma/empresas'));assert.equal(await page.getByRole('main').count(),1);
      assert.equal(await page.getByRole('heading',{name:'Faturamento manual',exact:true}).count(),0);
      const blocked=await qa.session().init();assert.equal((await blocked.login(pending.owner)).status,200);
      await ok(blocked,'get','/products',undefined,403);
      const lockedContext=await browser.newContext();try{
        const lockedPage=await lockedContext.newPage();await lockedPage.goto(`${qa.baseURL}/login`);
        await lockedPage.locator('input[name=cnpj]').fill(pending.owner.cnpj);await lockedPage.locator('input[name=email]').fill(pending.owner.email);await lockedPage.locator('input[name=password]').fill(pending.owner.password);
        await lockedPage.getByRole('button',{name:'Entrar',exact:true}).click();await lockedPage.waitForURL('**/assinatura');
        assert.equal(await lockedPage.getByRole('link',{name:'Produtos',exact:true}).count(),0);assert.equal(await lockedPage.getByRole('link',{name:'Vendas',exact:true}).count(),0);
        await lockedPage.goto(`${qa.baseURL}/produtos`);await lockedPage.waitForURL('**/assinatura');
      }finally{await lockedContext.close();}

      await page.getByLabel('Plano',{exact:true}).selectOption('BASIC');
      await page.getByLabel('Fim da vig\u00eancia',{exact:true}).fill('2099-01-01');
      await page.getByLabel('Pr\u00f3ximo vencimento',{exact:true}).fill('2026-10-01');
      await page.getByLabel('Motivo da opera\u00e7\u00e3o administrativa').fill(`QA first assignment ${qa.run}`);
      await page.getByRole('button',{name:'Simular contrata\u00e7\u00e3o',exact:true}).click();
      await page.getByRole('button',{name:'Confirmar contrata\u00e7\u00e3o imediata',exact:true}).waitFor();page.once('dialog',d=>d.accept());
      await page.getByRole('button',{name:'Confirmar contrata\u00e7\u00e3o imediata',exact:true}).click();
      await page.getByRole('heading',{name:'Faturamento manual',exact:true}).waitFor();
      await ok(blocked,'get','/products');await ok(blocked,'get','/orders');await ok(blocked,'get','/finance/entries',undefined,403);

      await page.getByRole('button',{name:'Resumo',exact:true}).click();
      await page.getByRole('heading',{name:'Indicadores comerciais',exact:true}).waitFor();
      await page.screenshot({path:`${qa.out}/platform-unified-desktop.png`,fullPage:true});
      await page.setViewportSize({width:320,height:900});await page.screenshot({path:`${qa.out}/platform-unified-mobile.png`,fullPage:true});
    });
    await run('browser: owner sees contract and simulates without activating modules',async()=>{
      const ctx=await browser.newContext();try{const web=await ctx.newPage();web.on('pageerror',e=>errors.push(e.message));await web.goto(`${qa.baseURL}/login`);await web.locator('input[name=cnpj]').fill(a.owner.cnpj);await web.locator('input[name=email]').fill(a.owner.email);await web.locator('input[name=password]').fill(a.owner.password);await web.getByRole('button',{name:'Entrar',exact:true}).click();await web.waitForURL('**/vendas');await web.getByRole('link',{name:'Plano e assinatura',exact:true}).click();await web.getByRole('heading',{name:'Contrato atual',exact:true}).waitFor();await web.getByLabel('Vendas',{exact:false}).check();await web.getByRole('button',{name:'Calcular proposta',exact:true}).click();await web.getByRole('heading',{name:'Proposta calculada',exact:true}).waitFor();await web.getByRole('heading',{name:'Seus acessos: hoje e ap\u00f3s a contrata\u00e7\u00e3o',exact:true}).waitFor();assert(await web.locator('.access-comparison tbody tr').count()>0);assert.equal((await ok(owner,'get','/subscription')).subscription.snapshot.planCode,planCode);
        for(const width of [320,768,1440]){await web.setViewportSize({width,height:1000});assert(await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}await web.screenshot({path:`${qa.out}/commerce-owner.png`,fullPage:true});
      }finally{await ctx.close();}
    });
    await run('browser: treasury account and receivable forms save real data',async()=>{
      await chooseModules(['FINANCE']);const ctx=await browser.newContext();try{const web=await ctx.newPage();web.on('pageerror',e=>errors.push(e.message));await web.goto(`${qa.baseURL}/login`);await web.locator('input[name=cnpj]').fill(a.owner.cnpj);await web.locator('input[name=email]').fill(a.owner.email);await web.locator('input[name=password]').fill(a.owner.password);await web.getByRole('button',{name:'Entrar',exact:true}).click();await web.waitForURL('**/financeiro');await web.getByRole('button',{name:'Contas financeiras',exact:true}).click();const name='QA browser account '+qa.run;await web.getByLabel('Nome da conta').fill(name);await web.getByLabel('Saldo inicial (R$)').fill('100');const saved=web.waitForResponse(r=>r.url().endsWith('/treasury/accounts')&&r.request().method()==='POST');await web.getByRole('button',{name:'Cadastrar conta',exact:true}).click();assert.equal((await saved).status(),201);await web.getByText(name,{exact:true}).waitFor();await web.getByRole('button',{name:'Contas a pagar e receber',exact:true}).click();await web.getByLabel('Descrição',{exact:true}).fill('QA receivable browser '+qa.run);await web.locator('select[name=account]').selectOption({label:name});await web.getByLabel('Valor (R$)',{exact:true}).fill('12,34');const posted=web.waitForResponse(r=>r.url().endsWith('/treasury/entries')&&r.request().method()==='POST');await web.locator('form').filter({has:web.locator('input[name=description]')}).getByRole('button').click();assert.equal((await posted).status(),201);const entries=await ok(owner,'get',`/treasury/entries?search=${encodeURIComponent('QA receivable browser '+qa.run)}`);assert.equal(entries.total,1);assert.equal(entries.items[0].amountCents,1234);for(const width of [320,768,1440]){await web.setViewportSize({width,height:1000});assert(await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
      }finally{await ctx.close();}
    });
    await run('browser: accounting chart and balanced journal forms save real data',async()=>{
      await chooseModules(['ACCOUNTING_FISCAL']);const ctx=await browser.newContext();try{const web=await ctx.newPage();web.on('pageerror',e=>errors.push(e.message));await web.goto(`${qa.baseURL}/login`);await web.locator('input[name=cnpj]').fill(a.owner.cnpj);await web.locator('input[name=email]').fill(a.owner.email);await web.locator('input[name=password]').fill(a.owner.password);await web.getByRole('button',{name:'Entrar',exact:true}).click();await web.waitForURL('**/contabil');await web.getByRole('button',{name:'Plano de contas',exact:true}).click();for(const [code,name,kind]of[['9.1','QA browser debit','ASSET'],['9.2','QA browser credit','REVENUE']]){await web.getByLabel('Código',{exact:true}).fill(code);await web.getByLabel('Nome da conta').fill(name);await web.locator('select[name=kind]').selectOption(kind);const response=web.waitForResponse(r=>r.url().endsWith('/accounting/accounts')&&r.request().method()==='POST');await web.getByRole('button',{name:'Cadastrar conta',exact:true}).click();assert.equal((await response).status(),201);await web.getByText(code+' '+name,{exact:true}).waitFor();}await web.getByRole('button',{name:'Diário e lançamentos',exact:true}).click();await web.getByLabel('Histórico',{exact:true}).fill('QA journal browser '+qa.run);await web.locator('.journal-line').nth(0).getByRole('combobox').selectOption({label:'9.1 QA browser debit'});await web.locator('.journal-line').nth(1).getByRole('combobox').selectOption({label:'9.2 QA browser credit'});await web.locator('.journal-line').nth(0).getByLabel('Débito (R$)',{exact:true}).fill('25,50');await web.locator('.journal-line').nth(1).getByLabel('Crédito (R$)',{exact:true}).fill('25,50');const posted=web.waitForResponse(r=>r.url().endsWith('/accounting/journals')&&r.request().method()==='POST');await web.getByRole('button',{name:'Escriturar lançamento',exact:true}).click();assert.equal((await posted).status(),201);const rows=await ok(owner,'get',`/accounting/journals?search=${encodeURIComponent('QA journal browser '+qa.run)}`);assert.equal(rows.total,1);assert.equal(rows.items[0].totalCents,2550);for(const width of [320,768,1440]){await web.setViewportSize({width,height:1000});assert(await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
      }finally{await ctx.close();}
    });
    await run('browser: no unhandled JavaScript exception',async()=>assert.deepEqual(errors,[]));
  }
} catch(e) { results.push({name:'setup/dependent flow',status:'failed',error:String(e.message).slice(0,600)}); console.log('SETUP FAIL',String(e.message).slice(0,600)); }
finally {
  if(browser)await browser.close();
  await run('new test plans become unavailable without changing prior versions or contracts',async()=>{
    if(!cleanupPlatform)return;
    const catalog=await ok(cleanupPlatform,'get','/platform/commerce/catalog');
    for(const offer of catalog.filter(row=>ownedPlanCodes.has(row.code))){
      const stored=await qa.connection.models.CommercialOffer.findOne({code:offer.code,version:offer.version}).lean();
      assert(stored&&!qa.existedBefore('commercial_offer_versions_v2',stored._id));
      await ok(cleanupPlatform,'post','/platform/commerce/catalog/versions',{...offer,available:false,reason:`QA fixture encerrada e preservada ${qa.run}`});
    }
  });
  await run('record documents owned by this execution without deleting them',async()=>{
    guard(); const ids=users.map(id=>new qa.connection.base.Types.ObjectId(id));const manifest=[];
    for(const c of await qa.db.listCollections({},{nameOnly:true}).toArray()){
      const clauses=[{tenantId:{$in:tenants}},{actorId:{$in:ids}}];
      if(c.name==='tenants_v2')clauses.push({_id:{$in:tenants}});
      if(c.name==='users_v2')clauses.push({_id:{$in:ids}});
      if(c.name===audit.collection.name)clauses.push({_id:{$in:auditIds}});
      const rows=await qa.db.collection(c.name).find({$or:clauses},{projection:{_id:1}}).toArray();
      for(const row of rows){assert.equal(qa.existedBefore(c.name,row._id),false);manifest.push({collection:c.name,id:String(row._id)});}
    }
    await writeFile(`${qa.out}/commerce-created.json`,JSON.stringify(manifest,null,2));
    // Preserve fixtures as required by the current AGENTS.md; the manifest identifies this run.
  });
  await run('preexisting database documents remain unchanged',async()=>{const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);});
  await writeFile(`${qa.out}/commerce-results.json`,JSON.stringify({run:qa.run,results},null,2));
  console.log(JSON.stringify({run:qa.run,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,out:qa.out}));await qa.app.close();
}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
