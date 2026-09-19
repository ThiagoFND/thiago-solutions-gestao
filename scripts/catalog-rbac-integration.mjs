import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { startTenancyQa, guard } from './tenancy-qa-harness.mjs';
guard();
const qa=await startTenancyQa({port:4337});
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {Types}=require('mongoose');
const results=[],tenants=[],users=[],auditIds=new Set();let browser;
const Audit=qa.connection.models.AuditEvent,originalCreate=Audit.create.bind(Audit);
Audit.create=async(...args)=>{const result=await originalCreate(...args);for(const row of Array.isArray(result)?result:[result])if(row?._id)auditIds.add(String(row._id));return result;};
const company=async(status='ACTIVE')=>{guard();const c=await qa.company(status);tenants.push(c.tenant._id);users.push(new Types.ObjectId(c.owner.id));return c;};
const fixture=async(role,tenant,status='ACTIVE')=>{guard();const u=await qa.fixture(role,tenant,status);users.push(new Types.ObjectId(u.id));return u;};
async function test(name,fn){try{await fn();results.push({name,status:'passed'});console.log(`PASS ${name}`);}catch(e){results.push({name,status:'failed',error:String(e.message).slice(0,700)});console.log(`FAIL ${name}: ${String(e.message).slice(0,350)}`);}}
async function login(user){const session=await qa.session().init();assert.equal((await session.login(user)).status,200);return session;}
async function ok(session,method,path,body,status=method==='post'?201:200){const r=await session.api(method,path,body);assert.equal(r.status,status,`${method} ${path}: ${r.status} ${JSON.stringify(r.body)}`);return r.body;}
const landing=(slug)=>({slug,publicName:'Ateliê Horizonte',logoUrl:'',coverUrl:'',slogan:'Escolhas para o seu dia',description:'Produtos e serviços da nossa empresa.',presentation:'Uma vitrine feita para apresentar nossa seleção.',theme:'violet',phone:'11999999999',whatsapp:'5511999999999',publicEmail:'public@example.invalid',address:'',hours:'Segunda a sexta, 9h às 18h',socialLinks:[],sections:['featured','products','about','contact'],additionalInfo:'',contactUrl:'',contactLabel:'Fale conosco',operatingNotice:'',shareTitle:'Horizonte',shareDescription:'Conheça nossos produtos',hideUnavailable:false,showDemandLabel:true,showPrices:true});
async function cleanup(){
 guard();assert.equal(qa.connection.name,'salgados_financeiro_test');
 const manifest=[];
 for(const c of await qa.db.listCollections({}, {nameOnly:true}).toArray()){
   const selectors=[{tenantId:{$in:tenants}}];
   if(c.name==='tenants_v2')selectors.push({_id:{$in:tenants}});
   if(c.name==='users_v2')selectors.push({_id:{$in:users}});
   if(c.name==='security_audit_events_v2')selectors.push({_id:{$in:[...auditIds].map(id=>new Types.ObjectId(id))}});
   const own=await qa.db.collection(c.name).find({$or:selectors},{projection:{_id:1}}).toArray();
   for(const doc of own){assert.equal(qa.existedBefore(c.name,doc._id),false,'Refusing cleanup of a previous document');manifest.push({collection:c.name,id:String(doc._id)});}
 }
 await writeFile(`${qa.out}/created-documents.json`,JSON.stringify({run:qa.run,documents:manifest},null,2));
 await writeFile(`${qa.out}/preserved-fixtures.json`,JSON.stringify({recorded:manifest.length,removed:0,note:'All fixtures preserved under current AGENTS instructions'},null,2));
}
try{
 if(!qa.transactions)throw new Error('Transactions required; no positive integration claimed');
 const a=await company(),b=await company(),pending=await company('PENDING'),suspended=await company('SUSPENDED');
 const owner=await login(a.owner),other=await login(b.owner),anon=await qa.session().init();
 const cashier=await fixture('CASHIER',a.tenant),kitchen=await fixture('KITCHEN',a.tenant),accountant=await fixture('ACCOUNTANT',a.tenant),platform=await fixture('PLATFORM_ADMIN',null),limited=await fixture('CASHIER',a.tenant);
 const cash=await login(cashier),cook=await login(kitchen),account=await login(accountant),global=await login(platform);
 let cat,cat2,foreign,stock,demand,bought,config,role;
 const createProduct=(name,supplyMode,categoryId=cat._id)=>ok(owner,'post','/products',{name,categoryId,supplyMode,origin:supplyMode==='COMPRADO_SOB_DEMANDA'?'PURCHASED_FOR_RESALE':'PRODUCED',priceCents:1250,published:true,featured:false});
 await test('categories: create, normalized duplicate, public/internal orders',async()=>{cat=await ok(owner,'post','/categories',{name:'Serviços',published:true,publicOrder:10,internalOrder:1});cat2=await ok(owner,'post','/categories',{name:'Eletrônicos',published:true,publicOrder:1,internalOrder:10});foreign=await ok(other,'post','/categories',{name:'Serviços',published:true});assert.equal((await owner.api('post','/categories',{name:'Servicos'})).status,409);const r=await ok(owner,'get','/categories?limit=100');assert.deepEqual(r.items.map(c=>c.name),['Serviços','Eletrônicos']);});
 await test('products: category and supply required; forged stock/tenant/enum rejected',async()=>{for(const dto of [{name:'Missing',origin:'PRODUCED',priceCents:100},{name:'Forged',origin:'PRODUCED',priceCents:100,categoryId:cat._id,supplyMode:'INVALID'},{name:'Forged',origin:'PRODUCED',priceCents:100,categoryId:cat._id,supplyMode:'CONTROLADO_POR_ESTOQUE',availableStock:999},{name:'Forged',origin:'PRODUCED',priceCents:100,categoryId:cat._id,supplyMode:'CONTROLADO_POR_ESTOQUE',tenantId:String(b.tenant._id)}])assert.equal((await owner.api('post','/products',dto)).status,400);assert.equal((await owner.api('post','/products',{name:'Foreign',origin:'PRODUCED',priceCents:100,categoryId:foreign._id,supplyMode:'CONTROLADO_POR_ESTOQUE'})).status,400);});
 await test('products: three supply modes, on-demand auto publication, no stock requirement',async()=>{stock=await createProduct('Peça pronta','CONTROLADO_POR_ESTOQUE',cat2._id);demand=await createProduct('Serviço personalizado','PRODUZIDO_SOB_DEMANDA');bought=await ok(owner,'post','/products',{name:'Equipamento por encomenda',categoryId:cat2._id,supplyMode:'COMPRADO_SOB_DEMANDA',origin:'PURCHASED_FOR_RESALE',priceCents:50000});assert.equal(bought.published,true);assert.equal(bought.availableStock,0);assert.equal(demand.availabilityMode,'MADE_TO_ORDER');});
 await test('landing: create configuration, preview before publication, slug uniqueness and malicious rejection',async()=>{config=await ok(owner,'put','/landing',landing(`qa-${qa.run}`));assert.equal((await anon.api('get',`/public/companies/${config.slug}`)).status,404);assert.equal((await owner.api('get','/landing/preview')).status,200);assert.equal((await other.api('put','/landing',landing(config.slug))).status,409);assert.equal((await owner.api('put','/landing',{...landing('../bad'),version:config.version})).status,400);config=await ok(owner,'post','/landing/publish',{version:config.version});});
 const page=()=>ok(anon,'get',`/public/companies/${config.slug}?limit=100`);
 await test('public DTO: safe allowlist, ordered categories, zero-stock unavailable, demand available',async()=>{const r=await page();assert.deepEqual(r.categories.map(c=>c.name),['Eletrônicos','Serviços']);assert.equal(r.products.find(p=>p.key===stock._id).available,false);assert.equal(r.products.find(p=>p.key===demand._id).available,true);assert.equal(r.products.find(p=>p.key===bought._id).available,true);const serialized=JSON.stringify(r);for(const key of ['tenantId','availableStock','minimumStock','updatedById','createdById','supplier','sessionVersion','passwordHash','origin','supplyMode'])assert.equal(serialized.includes(`"${key}"`),false,key);});
 await test('stock: production restores public availability, purchase restores stock, zero policy',async()=>{await ok(owner,'post','/productions',{productId:stock._id,quantity:4});assert.equal((await page()).products.find(p=>p.key===stock._id).available,true);config=await ok(owner,'put','/landing',{...landing(config.slug),version:config.version,hideUnavailable:true});stock=await ok(owner,'patch',`/products/${stock._id}`,{version:stock.version,origin:'PURCHASED_FOR_RESALE'});await ok(owner,'post',`/products/${stock._id}/purchases`,{quantity:2});assert.equal((await page()).products.find(p=>p.key===stock._id).available,true);});
 await test('manual hiding overrides demand and unhide restores; featured and persisted order',async()=>{demand=await ok(owner,'patch',`/products/${demand._id}`,{version:demand.version,manuallyHidden:true});assert.equal((await page()).products.some(p=>p.key===demand._id),false);demand=await ok(owner,'patch',`/products/${demand._id}`,{version:demand.version,manuallyHidden:false,featured:true,publicOrder:0});const r=await page();assert.equal(r.products.find(p=>p.key===demand._id).available,true);assert.equal(r.featured.some(p=>p.key===demand._id),true);});
 await test('categories: inactive/unpublished/archive hide products; optimistic edit conflict; safe move',async()=>{cat=await ok(owner,'patch',`/categories/${cat._id}`,{name:cat.name,version:cat.version,active:false});assert.equal((await page()).products.some(p=>p.key===demand._id),false);assert.equal((await owner.api('patch',`/categories/${cat._id}`,{name:cat.name,version:0})).status,409);cat=await ok(owner,'patch',`/categories/${cat._id}`,{name:cat.name,version:cat.version,active:true,published:false});assert.equal((await page()).products.some(p=>p.key===demand._id),false);cat=await ok(owner,'patch',`/categories/${cat._id}`,{name:cat.name,version:cat.version,published:true});assert.equal((await page()).products.find(p=>p.key===demand._id).available,true);assert.equal((await owner.api('post',`/categories/${cat._id}/move-products`,{destinationId:foreign._id,version:cat.version})).status,409);await ok(owner,'post',`/categories/${cat._id}/move-products`,{destinationId:cat2._id,version:cat.version});cat=(await ok(owner,'get','/categories?limit=100')).items.find(c=>c._id===cat._id);cat=await ok(owner,'patch',`/categories/${cat._id}`,{name:cat.name,version:cat.version,archived:true});assert.equal((await page()).categories.some(c=>c.key===cat._id),false);demand=(await ok(owner,'get','/products')).find(p=>p._id===demand._id);});
 await test('public search, pagination, literal input and no write endpoints',async()=>{const r=await ok(anon,'get',`/public/companies/${config.slug}?search=${encodeURIComponent('personalizado')}&limit=1`);assert.equal(r.total,1);assert.equal(r.products.length,1);assert.equal((await anon.api('get',`/public/companies/${config.slug}?limit=101`)).status,400);assert.equal((await anon.api('get',`/public/companies/${config.slug}?search[$ne]=x`)).status,400);for(const method of ['post','patch','put'])assert.equal((await anon.api(method,`/public/companies/${config.slug}`,{})).status,404);for(const path of ['/public/orders','/public/cart','/public/checkout'])assert.equal((await anon.api('post',path,{})).status,404);});
 await test('internal sales only: anonymous denied, demand sale, immutable item snapshot',async()=>{assert.equal((await anon.api('post','/orders',{items:[]})).status,401);const order=await ok(cash,'post','/orders',{type:'TAKEAWAY',items:[{productId:demand._id,quantity:1}]});assert.equal(order.items[0].supplyMode,'PRODUZIDO_SOB_DEMANDA');assert.ok(order.items[0].category);const name=order.items[0].name;demand=await ok(owner,'patch',`/products/${demand._id}`,{version:demand.version,name:'Nome alterado'});const edited=await ok(cash,'patch',`/orders/${order._id}`,{type:'TAKEAWAY',items:[{productId:demand._id,quantity:2}]});assert.equal(edited.items[0].name,name);assert.equal(edited.items[0].unitPriceCents,1250);await ok(cash,'post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:2500}]});});
 await test('tenant isolation and malformed IDs on categories/products/configuration/roles',async()=>{assert.equal((await other.api('patch',`/products/${stock._id}`,{version:stock.version,name:'Intrusion'})).status,404);assert.equal((await other.api('patch',`/categories/${cat._id}`,{name:'Intrusion',version:cat.version})).status,404);assert.equal((await owner.api('patch','/categories/not-an-id',{name:'Invalid',version:0})).status,400);assert.equal((await other.api('get','/landing')).body,null);assert.equal((await global.api('get','/landing')).status,403);});
 await test('roles: catalog, unknown/duplicate permissions, protected names and create',async()=>{const c=await ok(owner,'get','/roles/permissions');assert.ok(c.some(p=>p.key==='vendas.criar'));assert.equal(JSON.stringify(c).includes('PLATFORM_ADMIN'),false);for(const permissions of [['PLATFORM_ADMIN'],['vendas.criar','vendas.criar'],['invented']])assert.equal((await owner.api('post','/roles',{name:'Inválido',description:'',permissions})).status,400);assert.equal((await owner.api('post','/roles',{name:'OWNER',description:'',permissions:[]})).status,400);role=await ok(owner,'post','/roles',{name:'Leitor de catálogo',description:'Somente consulta',permissions:['produtos.visualizar','categorias.visualizar']});});
 let limitedSession;
 await test('roles: assignment revokes session and removes fallback legacy sales access',async()=>{limitedSession=await login(limited);await ok(owner,'post',`/roles/${role._id}/assign/${limited.id}`);assert.equal((await limitedSession.api('get','/auth/me')).status,401);limitedSession=await login(limited);assert.equal((await limitedSession.api('get','/products')).status,200);assert.equal((await limitedSession.api('post','/orders',{type:'TAKEAWAY',items:[]})).status,403);assert.equal((await limitedSession.api('get','/roles')).status,403);});
 await test('roles: edit, session revocation, authorized custom sales and duplication',async()=>{role=await ok(owner,'patch',`/roles/${role._id}`,{name:role.name,description:'Autorizado',permissions:['produtos.visualizar','categorias.visualizar','vendas.visualizar','vendas.criar'],version:role.version});assert.equal((await limitedSession.api('get','/auth/me')).status,401);limitedSession=await login(limited);const order=await ok(limitedSession,'post','/orders',{type:'TAKEAWAY',items:[{productId:bought._id,quantity:1}]});assert.equal((await limitedSession.api('post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:50000}]})).status,403);const copy=await ok(owner,'post',`/roles/${role._id}/duplicate`,{name:'Cópia segura'});assert.deepEqual(copy.permissions,role.permissions);assert.equal((await other.api('get',`/roles/${role._id}/users`)).status,404);});
 await test('roles: privilege escalation, own role, cross tenant, OWNER and platform protected',async()=>{const restricted=await ok(owner,'post','/roles',{name:'Gestor limitado',description:'',permissions:['cargos.visualizar','cargos.criar','cargos.editar','cargos.atribuir','usuarios.alterar_cargo','usuarios.visualizar']});await ok(owner,'post',`/roles/${restricted._id}/assign/${limited.id}`);limitedSession=await login(limited);assert.equal((await limitedSession.api('post','/roles',{name:'Escalada',description:'',permissions:['financeiro.pagar']})).status,403);assert.equal((await limitedSession.api('post',`/roles/${role._id}/assign/${cashier.id}`)).status,403);assert.equal((await limitedSession.api('post',`/roles/${restricted._id}/assign/${limited.id}`)).status,403);assert.equal((await limitedSession.api('patch',`/roles/${restricted._id}`,{name:restricted.name,description:'',permissions:restricted.permissions,version:restricted.version})).status,403);assert.equal((await owner.api('post',`/roles/${role._id}/assign/${a.owner.id}`)).status,403);assert.equal((await owner.api('post',`/roles/${role._id}/assign/${platform.id}`)).status,404);assert.equal((await other.api('post',`/roles/${role._id}/assign/${b.owner.id}`)).status,403);assert.equal((await owner.api('patch',`/users/${a.owner.id}/role`,{role:'PLATFORM_ADMIN'})).status,400);assert.equal((await owner.api('patch',`/users/${a.owner.id}/status`,{status:'INACTIVE'})).status,403);});
 await test('roles: deactivation/archive revoke member access and retain audit/history',async()=>{await ok(owner,'post',`/roles/${role._id}/assign/${limited.id}`);limitedSession=await login(limited);role=await ok(owner,'patch',`/roles/${role._id}`,{name:role.name,description:role.description,permissions:role.permissions,active:false,archived:true,version:role.version});assert.equal((await limitedSession.api('get','/auth/me')).status,401);limitedSession=await login(limited);assert.equal((await limitedSession.api('get','/products')).status,403);assert.ok((await ok(owner,'get',`/roles/${role._id}/history`)).items.some(e=>e.action==='assigned'));assert.ok(await qa.db.collection('security_audit_events_v2').countDocuments({tenantId:a.tenant._id,action:'role.permissions_changed'}));});
 await test('all controllers: current endpoint inventory, anonymous 401 and empty role 403',async()=>{
   const {PATH_METADATA,METHOD_METADATA}=require('@nestjs/common/constants'),{RequestMethod}=require('@nestjs/common');
   const controllers=new Set(),matrix=[];
   async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${entry.name}`;if(entry.isDirectory())await walk(path);else if(/\.(controller|module)\.js$/.test(entry.name)){const module=await import(pathToFileURL(path));for(const value of Object.values(module))if(typeof value==='function'&&Reflect.hasMetadata(PATH_METADATA,value))controllers.add(value);}}}
   await walk(new URL('../apps/api/dist',import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));
   for(const controller of controllers)for(const name of Object.getOwnPropertyNames(controller.prototype)){
     const handler=controller.prototype[name],method=Reflect.getMetadata(METHOD_METADATA,handler??{});if(method===undefined)continue;
     const path=('/'+Reflect.getMetadata(PATH_METADATA,controller)+'/'+Reflect.getMetadata(PATH_METADATA,handler)).replace(/\/+$/,'').replace(/\/+/g,'/');
     const publicRoute=Reflect.getMetadata('isPublic',handler)??Reflect.getMetadata('isPublic',controller),sessionOnly=Reflect.getMetadata('sessionOnly',handler)??Reflect.getMetadata('sessionOnly',controller);
     const permissions=Reflect.getMetadata('permissions',handler)??Reflect.getMetadata('permissions',controller),roles=Reflect.getMetadata('roles',handler)??Reflect.getMetadata('roles',controller);
     matrix.push({method:RequestMethod[method],path,public:!!publicRoute,sessionOnly:!!sessionOnly,permissions,roles});
     if(publicRoute)continue;
     assert.ok(sessionOnly||permissions?.length||roles?.length,`Missing policy ${path}`);
     const uri=path.replace(/:\w+/g,'000000000000000000000001'),verb=RequestMethod[method].toLowerCase(),body=verb==='get'?undefined:{};
     assert.equal((await anon.api(verb,uri,body)).status,401,`Anonymous ${verb} ${uri}`);
     if(!sessionOnly)assert.equal((await limitedSession.api(verb,uri,body)).status,403,`No permission ${verb} ${uri}`);
   }
   assert.equal(matrix.length,125);await writeFile(`${qa.out}/endpoint-matrix.json`,JSON.stringify(matrix,null,2));
 });
 await test('images: real MIME, fake MIME, traversal, size, tenant isolation and publication boundary',async()=>{
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
   async function upload(session,bytes,mime,name){const csrf=(await session.api('get','/auth/csrf')).body.csrfToken;const form=new FormData();form.append('file',new Blob([bytes],{type:mime}),name);const r=await fetch(`${qa.baseURL}/api/catalog-images`,{method:'POST',headers:{Origin:qa.baseURL,Cookie:[...session.cookies].map(([k,v])=>`${k}=${v}`).join('; '),'X-CSRF-Token':csrf},body:form});return {status:r.status,body:await r.json()};}
   assert.equal((await upload(owner,Buffer.from('<script/>'),'image/png','fake.png')).status,400);
   assert.equal((await upload(owner,png,'image/jpeg','fake.jpg')).status,400);
   assert.equal((await upload(owner,Buffer.alloc(2*1024*1024+1),'image/png','large.png')).status,413);
   assert.equal((await upload(limitedSession,png,'image/png','image.png')).status,403);
   const image=await upload(owner,png,'image/png','image.png');assert.equal(image.status,201);
   assert.equal((await anon.api('get',image.body.url.replace('/api',''))).status,404);
   assert.equal((await other.api('get',image.body.previewUrl.replace('/api',''))).status,404);
   assert.equal((await other.api('put','/landing',{...landing(`foreign-${qa.run}`),logoUrl:image.body.url})).status,400);
   config=await ok(owner,'put','/landing',{...landing(config.slug),version:config.version,logoUrl:image.body.url});
   assert.equal((await anon.api('get',image.body.url.replace('/api',''))).status,200);
   const binary=await fetch(`${qa.baseURL}${image.body.url}`);assert.equal(binary.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await binary.arrayBuffer()),png);
   config=await ok(owner,'post','/landing/unpublish',{version:config.version});assert.equal((await anon.api('get',image.body.url.replace('/api',''))).status,404);
   assert.equal((await owner.api('get',image.body.previewUrl.replace('/api',''))).status,200);config=await ok(owner,'post','/landing/publish',{version:config.version});
 });
 await test('company states and publication revoke public access immediately',async()=>{for(const c of [pending,suspended]){guard();await qa.connection.models.LandingConfig.create({...landing(`blocked-${c.tenant._id}`),tenantId:c.tenant._id,updatedById:c.owner.id,published:true});assert.equal((await anon.api('get',`/public/companies/blocked-${c.tenant._id}`)).status,404);}config=await ok(owner,'post','/landing/unpublish',{version:config.version});assert.equal((await anon.api('get',`/public/companies/${config.slug}`)).status,404);config=await ok(owner,'post','/landing/publish',{version:config.version});guard();await qa.connection.models.Tenant.updateOne({_id:a.tenant._id},{$set:{status:'SUSPENDED'}});assert.equal((await anon.api('get',`/public/companies/${config.slug}`)).status,404);await qa.connection.models.Tenant.updateOne({_id:a.tenant._id},{$set:{status:'ACTIVE'}});assert.equal((await page()).company.slug,config.slug);});
 await test('security headers, cookie flags, CSRF, CORS and public rate limiting',async()=>{const r=await anon.api('get',`/public/companies/${config.slug}`);assert.ok(r.headers.get('content-security-policy').includes("object-src 'none'"));assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('cache-control'),'no-store');const session=await qa.session().init(),auth=await session.login(a.owner);assert.ok(auth.headers.getSetCookie().some(c=>c.includes('HttpOnly')&&c.includes('SameSite=Lax')));assert.equal((await owner.api('post','/categories',{name:'CSRF'},{'X-CSRF-Token':''})).status,403);assert.equal((await owner.api('get','/categories',undefined,{Origin:'https://evil.invalid'})).status,403);process.env.RATE_LIMIT_GENERAL='1';assert.equal((await anon.api('get',`/public/companies/${config.slug}`)).status,429);process.env.RATE_LIMIT_GENERAL='10000';});
 await test('legacy permissions: kitchen/finance isolation preserved',async()=>{assert.equal((await cook.api('get','/finance/summary?month=9&year=2026')).status,403);assert.equal((await account.api('get','/orders')).status,403);assert.equal((await cook.api('get','/productions/today')).status,200);assert.equal((await account.api('get','/finance/categories')).status,200);assert.equal((await cash.api('get','/inventory/ingredients')).status,403);});
 await test('last OWNER: direct and concurrent deactivation preserve an active owner',async()=>{
   const manager=await ok(owner,'post','/roles',{name:'Gestão de status',description:'',permissions:['usuarios.visualizar','usuarios.inativar']});await ok(owner,'post',`/roles/${manager._id}/assign/${limited.id}`);const session=await login(limited);
   assert.equal((await session.api('patch',`/users/${a.owner.id}/status`,{status:'INACTIVE'})).status,409);
   const second=await fixture('OWNER',a.tenant);
   // Deliberate simultaneous requests verify database serialization; no parallel agents.
   const responses=await Promise.all([a.owner,second].map(u=>session.api('patch',`/users/${u.id}/status`,{status:'INACTIVE'})));
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
   const members=await qa.connection.models.User.find({tenantId:a.tenant._id,role:'OWNER'}).lean();assert.equal(members.filter(u=>u.status==='ACTIVE').length,1);
   const survivor=members.find(u=>u.status==='ACTIVE'),inactive=members.find(u=>u.status==='INACTIVE');const restorer=await login(String(survivor._id)===a.owner.id?a.owner:second);
   await ok(restorer,'patch',`/users/${inactive._id}/status`,{status:'ACTIVE'});assert.equal((await owner.login(a.owner)).status,200);
   assert.ok(await qa.db.collection('security_audit_events_v2').countDocuments({tenantId:a.tenant._id,action:'member.status','before.status':'ACTIVE','after.status':'INACTIVE'}));
 });
 await test('finance to ingredients to production: real receipt, recipe, stock and rollback integration',async()=>{
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife'}).format(new Date());
   const fc=await ok(owner,'post','/finance/categories',{name:'Materiais de fabricação',type:'CUSTO_PRODUCAO'});
   const entry=await ok(owner,'post','/finance/entries',{description:'Compra de material',categoryId:fc._id,type:'CUSTO_PRODUCAO',nature:'VARIAVEL',entryKind:'INPUT_PURCHASE',expectedAmountCents:1000,competence:today.slice(0,7),purchaseDate:today,dueDate:today,quantity:10,unit:'KG'});
   const material=await ok(owner,'post','/inventory/ingredients',{name:'Matéria-prima',unit:'KG',minimumStock:1});
   const receipt=await ok(owner,'post','/inventory/receipts',{ingredientId:material._id,financialEntryId:entry._id});assert.equal(receipt.costCents,1000);
   const manufactured=await createProduct('Peça fabricada','CONTROLADO_POR_ESTOQUE',cat2._id);
   await ok(owner,'put',`/inventory/recipes/${manufactured._id}`,{yieldQuantity:10,components:[{ingredientId:material._id,quantity:1}]});
   const produced=await ok(cook,'post','/productions',{productId:manufactured._id,quantity:2,idempotencyKey:`${qa.run}-recipe`});assert.equal(produced.ingredientCostCents,20);
   assert.equal((await qa.connection.models.Ingredient.findById(material._id)).stockMicros,9800000);
   assert.equal((await page()).products.find(p=>p.key===manufactured._id).available,true);
   const before=await qa.connection.models.Ingredient.findById(material._id).lean();const original=qa.connection.models.IngredientMovement.create;
   qa.connection.models.IngredientMovement.create=async()=>{throw new Error('Injected QA rollback');};
   try{assert.equal((await cook.api('post','/productions',{productId:manufactured._id,quantity:1,idempotencyKey:`qa-${qa.run}-rollback`})).status,500);}finally{qa.connection.models.IngredientMovement.create=original;}
   assert.deepEqual(await qa.connection.models.Ingredient.findById(material._id).lean(),before);
 });
 await test('category reorder moves one position atomically and keeps internal order independent',async()=>{
   const first=await ok(owner,'post','/categories',{name:'Ordem Alfa',publicOrder:20,internalOrder:20,published:true});
   const second=await ok(owner,'post','/categories',{name:'Ordem Beta',publicOrder:30,internalOrder:30,published:true});
   await ok(owner,'post',`/categories/${second._id}/order`,{scope:'publicOrder',direction:'UP',version:second.version});
   const pub=(await page()).categories.map(c=>c.key);assert.ok(pub.indexOf(second._id)<pub.indexOf(first._id));
   const internal=(await ok(owner,'get','/categories?limit=100')).items.map(c=>c._id);assert.ok(internal.indexOf(first._id)<internal.indexOf(second._id));
   assert.equal((await owner.api('post',`/categories/${second._id}/order`,{scope:'publicOrder',direction:'DOWN',version:second.version})).status,409);
 });
 await test('legacy product without version can be explicitly classified without a migration',async()=>{
   guard();const _id=new Types.ObjectId();await qa.db.collection('products_v2').insertOne({_id,tenantId:a.tenant._id,name:'Legado preservado',category:'Categoria antiga',origin:'PRODUCED',priceCents:100,availabilityMode:'PRODUCTION_CONTROLLED',availableStock:0,minimumStock:0,active:true});
   const edited=await ok(owner,'patch',`/products/${_id}`,{categoryId:cat2._id,supplyMode:'CONTROLADO_POR_ESTOQUE',version:0,imageUrl:''});assert.equal(edited.version,1);assert.equal(edited.categoryId,cat2._id);assert.equal((await page()).products.some(p=>p.key===String(_id)),false);
 });
 await test('users: direct custom role approval, effective permissions, revocation and assignment boundaries',async()=>{
   const reader=await ok(owner,'post','/roles',{name:'Cargo para aprovar membros',description:'',permissions:['produtos.visualizar']});
   const target=await fixture(null,a.tenant,'PENDING');
   for(const dto of [{},{customRoleId:'invalid'},...['CASHIER','KITCHEN','ACCOUNTANT','PLATFORM_ADMIN'].map(role=>({role})),{role:'CASHIER',customRoleId:reader._id}])assert.equal((await owner.api('post',`/users/${target.id}/approve`,dto)).status,400);
   const otherRole=await ok(other,'post','/roles',{name:'Cargo externo',description:'',permissions:[]});
   assert.equal((await owner.api('post',`/users/${target.id}/approve`,{customRoleId:otherRole._id})).status,404);
   assert.equal((await qa.connection.models.User.findById(target.id)).status,'PENDING');
   const rolesModel=qa.connection.models.CustomRole,updateHistory=rolesModel.updateOne;
   rolesModel.updateOne=async()=>{throw new Error('Injected assignment history rollback');};
   try{assert.equal((await owner.api('post',`/users/${target.id}/approve`,{customRoleId:reader._id})).status,500);}finally{rolesModel.updateOne=updateHistory;}
   const unchanged=await qa.connection.models.User.findById(target.id);assert.equal(unchanged.status,'PENDING');assert.equal(unchanged.customRoleId,undefined);
   const approved=await ok(owner,'post',`/users/${target.id}/approve`,{customRoleId:reader._id});assert.equal(approved.status,'ACTIVE');assert.equal(approved.customRoleId,reader._id);assert.equal(approved.role,'MEMBER');
   const session=await login(target);assert.deepEqual((await ok(session,'get','/auth/me')).permissions,['produtos.visualizar']);assert.equal((await session.api('post','/orders',{})).status,403);
   const replacement=await ok(owner,'post','/roles',{name:'Cargo substituto para membros',description:'',permissions:['categorias.visualizar']});
   await ok(owner,'patch',`/users/${target.id}/role`,{customRoleId:replacement._id});assert.equal((await session.api('get','/auth/me')).status,401);
   assert.ok((await ok(owner,'get',`/roles/${reader._id}/history`)).items.some(e=>e.action==='removed'));
   assert.ok((await ok(owner,'get',`/roles/${replacement._id}/history`)).items.some(e=>e.action==='assigned'));
   for(const id of [a.owner.id,platform.id])assert.ok([403,404].includes((await owner.api('patch',`/users/${id}/role`,{customRoleId:reader._id})).status));
   const disabled=await ok(owner,'patch',`/roles/${replacement._id}`,{name:replacement.name,description:'',permissions:replacement.permissions,active:false,version:replacement.version});
   assert.equal((await owner.api('patch',`/users/${target.id}/role`,{customRoleId:disabled._id})).status,404);
   const managerRole=await ok(owner,'post','/roles',{name:'Aprovador restrito',description:'',permissions:['usuarios.aprovar','cargos.atribuir']});
   const manager=await fixture('CASHIER',a.tenant);await ok(owner,'post',`/roles/${managerRole._id}/assign/${manager.id}`);const managerSession=await login(manager),next=await fixture(null,a.tenant,'PENDING');
   assert.equal((await managerSession.api('post',`/users/${next.id}/approve`,{customRoleId:reader._id})).status,403);assert.equal((await qa.connection.models.User.findById(next.id)).status,'PENDING');
 });
 if(process.env.CATALOG_BROWSER==='true'){
   const { chromium }=await import('playwright-core');browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext();const web=await ctx.newPage();const jsErrors=[];web.on('pageerror',e=>jsErrors.push(e.message));
   await test('browser: uploaded product images decode, gallery without description and featured image',async()=>{
     guard();const original=await qa.connection.models.CatalogImage.findById(config.logoUrl.split('/').pop()).select('+bytes');
     const extra=await qa.connection.models.CatalogImage.create({tenantId:a.tenant._id,createdById:a.owner.id,mime:original.mime,bytes:original.bytes});
     const extraUrl=`/api/public/images/${extra._id}`;
     await ok(owner,'post','/products',{name:'Imagem de teste',categoryId:cat2._id,supplyMode:'COMPRADO_SOB_DEMANDA',origin:'PURCHASED_FOR_RESALE',priceCents:100,imageUrl:config.logoUrl,additionalImages:[extraUrl],featured:true});
     await web.goto(`${qa.baseURL}/empresa/${config.slug}`);
     const card=web.locator('.product-card').filter({has:web.getByRole('heading',{name:'Imagem de teste',exact:true})});await card.waitFor();
     for(const selector of ['.identity img','.featured-image','.main-photo','.thumbnails img']){
       const img=web.locator(selector).first();await img.scrollIntoViewIfNeeded();await web.waitForFunction(selector=>{const img=document.querySelector(selector);return img?.complete&&img.naturalWidth>0;},selector,{timeout:10000});
     }
     assert.equal(await card.locator('details').count(),0);
     const photos=card.locator('.thumbnails button');assert.equal(await photos.count(),2);
     const active=async index=>web.waitForFunction(el=>el.getAttribute('aria-pressed')==='true',await photos.nth(index).elementHandle(),{timeout:5000});
     await photos.nth(1).click();assert.equal(await card.locator('.main-photo').getAttribute('src'),extraUrl);await card.locator('.main-photo').evaluate(img=>img.decode());
     await card.getByRole('button',{name:'Foto anterior',exact:true}).click();await active(0);
     await photos.nth(0).focus();await web.keyboard.press('ArrowRight');await active(1);
     await card.locator('.stage').dispatchEvent('touchstart',{touches:[{identifier:0,clientX:180,clientY:100}]});await card.locator('.stage').dispatchEvent('touchend',{changedTouches:[{identifier:0,clientX:50,clientY:105}]});await active(0);
     await card.getByRole('button',{name:'Próxima foto',exact:true}).click();await active(1);
   });
   await test('browser: section links retain company slug and scroll to correct section',async()=>{
     const nav=web.getByRole('navigation',{name:'Navegação da vitrine'});
     for(const [name,id] of [['Produtos','catalogo'],['Sobre','sobre'],['Contato','contato']]){
       await nav.getByRole('link',{name,exact:true}).click();assert.equal(new URL(web.url()).pathname,`/empresa/${config.slug}`);assert.equal(new URL(web.url()).hash,`#${id}`);
       assert.equal(await web.locator(`#${id}`).evaluate(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}),true);
     }
     await web.getByRole('link',{name:'Explorar produtos'}).click();assert.equal(new URL(web.url()).hash,'#catalogo');
   });
   await test('browser: public showcase search, no purchase controls, responsive 320/768/1440',async()=>{await web.goto(`${qa.baseURL}/empresa/${config.slug}`);await web.getByRole('heading',{name:'Escolhas para o seu dia'}).waitFor();assert.equal(await web.getByRole('button',{name:/comprar|carrinho|checkout|reservar/i}).count(),0);for(const width of [320,768,1440]){await web.setViewportSize({width,height:1000});assert.equal(await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await web.screenshot({path:`${qa.out}/public-${width}.png`,fullPage:true});}await web.getByLabel('Buscar produtos').fill('Equipamento');await web.getByRole('button',{name:'Buscar',exact:true}).click();await web.getByText('1 produtos',{exact:true}).waitFor();});
   await test('browser: login and landing QR/preview',async()=>{await web.goto(`${qa.baseURL}/login`);await web.locator('input[name="cnpj"]').fill(a.owner.cnpj);await web.locator('input[name="email"]').fill(a.owner.email);await web.locator('input[name="password"]').fill(a.owner.password);await web.getByRole('button',{name:'Entrar',exact:true}).click();await web.waitForURL('**/dashboard');await web.goto(`${qa.baseURL}/vitrine`);await web.getByRole('heading',{name:'Vitrine pública',exact:true}).waitFor();await web.getByAltText('QR Code do link público da empresa').waitFor();assert.equal(await web.getByLabel('Link público',{exact:true}).inputValue(),`${qa.baseURL}/empresa/${config.slug}`);await web.screenshot({path:`${qa.out}/config.png`,fullPage:true});});
   await test('browser: invalid landing fields show errors and publication preserves unsaved edits',async()=>{
     let writes=0;const listener=req=>{if(req.method()==='PUT'&&req.url().endsWith('/api/landing'))writes++;};web.on('request',listener);
     try{
       await web.locator('[name="phone"]').fill('abc');
       await web.getByRole('button',{name:'Salvar alterações',exact:true}).click();
       await web.getByText('Telefone: informe de 10 a 15 dígitos, sem espaços ou pontuação.',{exact:true}).first().waitFor();
       assert.equal(writes,0);assert.equal(await web.locator('[name="phone"]').inputValue(),'abc');
       await web.locator('[name="phone"]').fill('1133334444');
       await web.locator('[name="social"]').fill('instagram.com/empresa');
       await web.getByRole('button',{name:'Salvar alterações',exact:true}).click();
       await web.getByText('Redes sociais: use até 8 links completos iniciados por https://, um por linha.',{exact:true}).first().waitFor();assert.equal(writes,0);
       await web.locator('[name="address"]').fill('Edicao ainda nao salva');
       await web.getByRole('button',{name:'Despublicar',exact:true}).click();
       await web.getByText('Existem alterações não salvas. Salve a configuração antes de publicar ou despublicar.',{exact:true}).first().waitFor();
       assert.equal(await web.locator('[name="address"]').inputValue(),'Edicao ainda nao salva');assert.equal((await ok(owner,'get','/landing')).published,true);
     }finally{web.off('request',listener);await web.reload();await web.getByAltText('QR Code do link público da empresa').waitFor();}
   });
   await test('browser: all landing contacts, sections, flags and sharing persist after reload',async()=>{
     const field=name=>name.startsWith('section-')?web.locator('fieldset').filter({has:web.locator('legend').filter({hasText:/Conte/})}).locator('input[type=checkbox]').nth(['section-featured','section-products','section-about','section-contact'].indexOf(name)):web.locator(`[name="${name}"]`);
     const fields={phone:'1133334444',whatsapp:'5511999998888',publicEmail:'contato@example.invalid',address:'Rua de teste 123',hours:'Segunda a sexta, 9h - 18h',social:'https://example.invalid/social\nhttps://example.invalid/profile',contactUrl:'https://example.invalid/contato',contactLabel:'Entre em contato',notice:'Atendimento normal',additionalInfo:'Informacao complementar',shareTitle:'Titulo de compartilhamento',shareDescription:'Descricao para compartilhar'};
     try {
       for(const [name,value] of Object.entries(fields))await web.locator(`[name="${name}"]`).fill(value);
       for(const name of ['showPrices','showDemandLabel','hideUnavailable','section-featured','section-products','section-about','section-contact'])await field(name).uncheck();
       await web.locator('[name="hideUnavailable"]').check();
       const response=web.waitForResponse(r=>r.url().endsWith('/api/landing')&&r.request().method()==='PUT',{timeout:10000});
       await web.getByRole('button',{name:'Salvar configuração',exact:true}).click();assert.equal((await response).status(),200);
       await web.reload();await web.getByAltText('QR Code do link público da empresa').waitFor();
       for(const [name,value] of Object.entries(fields))assert.equal(await web.locator(`[name="${name}"]`).inputValue(),value,name);
       for(const name of ['showPrices','showDemandLabel','section-featured','section-products','section-about','section-contact'])assert.equal(await field(name).isChecked(),false,name);
       assert.equal(await web.locator('[name="hideUnavailable"]').isChecked(),true);
       const stored=await ok(owner,'get','/landing');assert.deepEqual(stored.sections,[]);assert.equal(stored.showPrices,false);assert.equal(stored.hideUnavailable,true);assert.equal(stored.operatingNotice,fields.notice);
       const publicData=await page();assert.equal(publicData.company.publicEmail,fields.publicEmail);assert.equal(publicData.company.shareTitle,fields.shareTitle);assert.equal(publicData.products.some(p=>p.priceCents!==undefined),false);
     } finally {const latest=await ok(owner,'get','/landing');config=await ok(owner,'put','/landing',{...landing(config.slug),logoUrl:config.logoUrl,version:latest.version});}
   });
   await test('browser: category and product forms save by button; demand auto published',async()=>{await web.goto(`${qa.baseURL}/categorias`);await web.getByLabel('Nome',{exact:true}).fill('Categoria browser');await web.getByLabel('Exibir na vitrine').check();await web.getByRole('button',{name:'Salvar categoria',exact:true}).click();await web.getByText('Categoria salva.',{exact:true}).waitFor();await web.goto(`${qa.baseURL}/produtos`);await web.getByLabel('Nome',{exact:true}).fill('Produto browser');await web.locator('select[name=categoryId]').selectOption({label:'Categoria browser'});await web.locator('select[name=supplyMode]').selectOption('COMPRADO_SOB_DEMANDA');await web.getByLabel('Preço (R$)',{exact:true}).fill('39.90');await web.getByRole('button',{name:'Salvar produto',exact:true}).click();await web.getByText('Produto salvo.',{exact:true}).waitFor();for(const width of [320,768,1440]){await web.setViewportSize({width,height:1000});assert.equal(await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}});
   await test('browser: users selector lists tenant roles and approves/changes custom role',async()=>{
     const pendingMember=await fixture(null,a.tenant,'PENDING');
     const roleA=await ok(owner,'post','/roles',{name:'Cargo da empresa no seletor',description:'',permissions:['produtos.visualizar']});
     const roleB=await ok(owner,'post','/roles',{name:'Outro cargo no seletor',description:'',permissions:['categorias.visualizar']});
     await web.goto(`${qa.baseURL}/usuarios`);
     let card=web.locator('article').filter({hasText:pendingMember.email});
     await card.getByLabel('Cargo de acesso').selectOption(`custom:${roleA._id}`);
     for(const name of ['Caixa','Cozinha','Contador'])assert.equal(await card.getByRole('option',{name,exact:true}).count(),0);
     assert.equal(await card.locator('option').filter({hasText:'Cargo externo'}).count(),0);assert.equal(await card.locator('option').filter({hasText:'Cargo substituto para membros'}).count(),0);
     web.once('dialog',d=>d.accept());const approved=web.waitForResponse(r=>r.url().endsWith(`/users/${pendingMember.id}/approve`));await card.getByRole('button',{name:'Aprovar',exact:true}).click();assert.equal((await approved).status(),201);
     await web.getByRole('alert').filter({hasText:'Alteração salva'}).waitFor();await web.locator('select[name=status]').selectOption('ACTIVE');
     card=web.locator('article').filter({hasText:pendingMember.email});await card.locator('p').filter({hasText:'Cargo da empresa no seletor'}).waitFor();
     await card.getByLabel('Cargo de acesso').selectOption(`custom:${roleB._id}`);web.once('dialog',d=>d.accept());const changed=web.waitForResponse(r=>r.url().endsWith(`/users/${pendingMember.id}/role`));await card.getByRole('button',{name:'Alterar perfil',exact:true}).click();assert.equal((await changed).status(),200);
     assert.equal((await qa.connection.models.User.findById(pendingMember.id)).customRoleId.toString(),roleB._id);
   });
   await test('browser: custom role form, grouped permissions and assignment',async()=>{await web.goto(`${qa.baseURL}/cargos`);await web.getByLabel('Nome do cargo').fill('Cargo navegador');const permissions=web.locator('fieldset').filter({has:web.locator('legend',{hasText:'Produtos'})});await permissions.getByLabel('Visualizar',{exact:false}).check();await web.locator('fieldset').filter({has:web.locator('legend',{hasText:'Categorias'})}).getByLabel('Visualizar',{exact:false}).check();web.once('dialog',d=>d.accept());await web.getByRole('button',{name:'Salvar cargo',exact:true}).click();await web.getByText('Cargo salvo. Sessões afetadas revogadas.',{exact:true}).waitFor();await web.locator('article.item').filter({has:web.getByRole('heading',{name:'Cargo navegador',exact:true})}).getByRole('button',{name:'Abrir cargo'}).click();await web.locator('select').selectOption(cashier.id);web.once('dialog',d=>d.accept());await web.getByRole('button',{name:'Atribuir cargo',exact:true}).click();await web.getByText('Cargo atribuído. O usuário precisa entrar novamente.',{exact:true}).waitFor();await web.screenshot({path:`${qa.out}/roles.png`,fullPage:true});});
   await test('browser: assigned user sees only permitted menus and protected route redirects',async()=>{const limitedContext=await browser.newContext();try{const restricted=await limitedContext.newPage();restricted.on('pageerror',e=>jsErrors.push(e.message));await restricted.goto(`${qa.baseURL}/login`);await restricted.locator('input[name=cnpj]').fill(cashier.cnpj);await restricted.locator('input[name=email]').fill(cashier.email);await restricted.locator('input[name=password]').fill(cashier.password);await restricted.getByRole('button',{name:'Entrar',exact:true}).click();await restricted.waitForURL('**/produtos');const nav=restricted.getByRole('navigation',{name:'Menu principal'});assert.equal(await nav.getByRole('link',{name:'Produtos',exact:true}).count(),1);assert.equal(await nav.getByRole('link',{name:'Financeiro',exact:true}).count(),0);assert.equal(await nav.getByRole('link',{name:'Cargos e permissões',exact:true}).count(),0);assert.equal(await restricted.getByRole('button',{name:'Salvar produto',exact:true}).count(),0);await restricted.goto(`${qa.baseURL}/cargos`);await restricted.waitForURL('**/meu-perfil');}finally{await limitedContext.close();}});
   await test('browser: all administrative screens fit mobile, tablet and desktop',async()=>{for(const path of ['categorias','produtos','vitrine','cargos']){await web.goto(`${qa.baseURL}/${path}`);await web.locator('main h1').waitFor();for(const width of [320,768,1440]){await web.setViewportSize({width,height:1000});assert.equal(await web.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${path}/${width}`);}await web.screenshot({path:`${qa.out}/${path}-desktop.png`,fullPage:true});}});
   await test('browser: public failure state retries successfully and text cannot inject markup',async()=>{await ok(owner,'post','/products',{name:'Texto público seguro',categoryId:cat2._id,supplyMode:'PRODUZIDO_SOB_DEMANDA',origin:'PRODUCED',priceCents:100,shortDescription:'<script>alert(1)</script>'});await web.route('**/api/public/companies/**',route=>route.fulfill({status:500,contentType:'application/json',body:'{"message":"Erro interno"}'}));await web.goto(`${qa.baseURL}/empresa/${config.slug}`);await web.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();await web.unroute('**/api/public/companies/**');await web.getByRole('button',{name:'Tentar novamente',exact:true}).click();await web.getByRole('heading',{name:'Escolhas para o seu dia'}).waitFor();await web.getByText('<script>alert(1)</script>',{exact:true}).waitFor();assert.equal(await web.locator('main script').count(),0);});
   await test('browser: no unhandled JavaScript exceptions',async()=>assert.deepEqual(jsErrors,[]));
 }
}catch(e){results.push({name:'setup/dependent flow',status:'failed',error:String(e.message).slice(0,700)});console.log('SETUP FAILURE',String(e.message).slice(0,500));}
finally{
 if(browser)await browser.close();
 await test('record and preserve documents owned by this run',cleanup);
 await test('all previous MongoDB documents remain unchanged',async()=>{const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);});
 await writeFile(`${qa.out}/catalog-results.json`,JSON.stringify({run:qa.run,results},null,2));
 console.log(JSON.stringify({run:qa.run,out:qa.out,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));
 await qa.app.close();
}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
