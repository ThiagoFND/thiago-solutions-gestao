import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { startTenancyQa } from './tenancy-qa-harness.mjs';
const qa=await startTenancyQa(),results=[];let browser,currentPage;
async function check(name,fn){if(process.env.OPERATIONAL_FOCUS==='browser' && !name.startsWith('browser') && name!=='all prior documents preserved')return;try{await fn();results.push({name,status:'passed'});console.log(`PASS ${name}`);}catch(e){results.push({name,status:'failed',error:e.stack});console.log(`FAIL ${name}: ${e.message}`);if(name.startsWith('browser ingredient')&&currentPage){console.log(await currentPage.locator('.recipe').innerHTML());await currentPage.screenshot({path:`${qa.out}/recipe-failure.png`,fullPage:true});}}}
async function expect(call,status){const r=await call;assert.equal(r.status,status,JSON.stringify(r.body));return r.body;}
try{
 assert.equal(qa.transactions,true,'Transações necessárias; não executar positivos como aprovados em standalone.');
 const a=await qa.company(),b=await qa.company(),s=await qa.session().init(),other=await qa.session().init();
 await expect(s.login(a.owner),200);await expect(other.login(b.owner),200);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Recife'}).format(new Date()),month=today.slice(0,7),models=qa.connection.models;
 const ownerFilter={tenantId:a.tenant._id};
 const snapshot=async()=>JSON.stringify(await Promise.all(['Ingredient','Recipe','IngredientReceipt','IngredientMovement','Product','Production','StockMovement'].map(async name=>[name,await models[name].find(ownerFilter).sort({_id:1}).lean()])));
 const product=async(name,origin='PRODUCED',mode='PRODUCTION_CONTROLLED')=>expect(s.api('post','/products',{name,category:'QA',priceCents:500,minimumStock:2,availabilityMode:mode,origin,salesGroup:origin==='PRODUCED'?'SNACKS':'BEVERAGES'}),201);
 const p=await product('Operational QA'),legacy=await product('Legacy QA'),resale=await product('Resale QA','PURCHASED_FOR_RESALE'),ondemand=await product('Demand QA','PRODUCED','MADE_TO_ORDER');
 const category=await expect(s.api('post','/finance/categories',{name:'Operational ingredients',type:'CUSTO_PRODUCAO'}),201);
 const purchase=async(description,quantity,cents,unit='KG')=>expect(s.api('post','/finance/entries',{description,type:'CUSTO_PRODUCAO',categoryId:category._id,entryKind:'INPUT_PURCHASE',nature:'VARIAVEL',expectedAmountCents:cents,competence:month,purchaseDate:today,dueDate:today,quantity,unit}),201);
 let flour,receipt,first,second,recipe;
 await check('ingredients and linked receipt preserve financial snapshot',async()=>{
  flour=await expect(s.api('post','/inventory/ingredients',{name:'Flour QA',unit:'KG',minimumStock:1}),201);first=await purchase('Flour initial QA',10,1000);
  const before=await models.FinancialEntry.findById(first._id).lean();receipt=await expect(s.api('post','/inventory/receipts',{ingredientId:flour._id,financialEntryId:first._id}),201);
  assert.equal(receipt.costCents,1000);assert.equal(receipt.description,first.description);assert.equal(receipt.financialVersion,first.version);assert.deepEqual(await models.FinancialEntry.findById(first._id).lean(),before);
 });
 await check('receipt retry and concurrent receipt cannot double stock',async()=>{
  const body={ingredientId:flour._id,financialEntryId:first._id};const replies=await Promise.all([expect(s.api('post','/inventory/receipts',body),201),expect(s.api('post','/inventory/receipts',body),201)]);assert.ok(replies.every(x=>x._id===receipt._id));
  second=await purchase('Flour second QA',20,4000);const parallel=await Promise.all([expect(s.api('post','/inventory/receipts',{...body,financialEntryId:second._id}),201),expect(s.api('post','/inventory/receipts',{...body,financialEntryId:second._id}),201)]);assert.equal(parallel[0]._id,parallel[1]._id);
  const item=(await expect(s.api('get','/inventory/ingredients'),200)).items.find(x=>x._id===flour._id);assert.equal(item.stock,30);assert.equal(item.stockValueCents,5000);
 });
 await check('recipe weighted cost and optimistic edit validation',async()=>{
  recipe=await expect(s.api('put',`/inventory/recipes/${p._id}`,{yieldQuantity:10,components:[{ingredientId:flour._id,quantity:2}]}),200);
  const cost=await expect(s.api('get',`/inventory/recipes/${p._id}/cost`),200);assert.equal(cost.available,true);assert.equal(cost.totalCostCents,333);assert.equal(cost.unitCostCents,33.3);
  await expect(s.api('put',`/inventory/recipes/${p._id}`,{yieldQuantity:10,components:[{ingredientId:flour._id,quantity:2}],version:999}),409);
  await expect(s.api('put',`/inventory/recipes/${resale._id}`,{yieldQuantity:10,components:[{ingredientId:flour._id,quantity:2}]}),400);
 });
 await check('production atomically consumes proportional input and snapshots cost',async()=>{
  const result=await expect(s.api('post','/productions',{productId:p._id,quantity:5,idempotencyKey:`${qa.run}-first`}),201);assert.equal(result.ingredientCostCents,167);assert.equal(result.ingredientCostPerUnitCents,33.4);
  const item=await models.Ingredient.findById(flour._id).lean();assert.equal(item.stockMicros,29000000);assert.equal(item.stockValueCents,4833);assert.equal((await models.Product.findById(p._id)).availableStock,5);
 });
 await check('production retry is idempotent and rejects changed payload',async()=>{
  const before=await snapshot();const response=await expect(s.api('post','/productions',{productId:p._id,quantity:5,idempotencyKey:`${qa.run}-first`}),201);assert.equal(response.replayed,true);assert.equal(await snapshot(),before);
  await expect(s.api('post','/productions',{productId:p._id,quantity:6,idempotencyKey:`${qa.run}-first`}),409);await expect(s.api('post','/productions',{productId:p._id,quantity:1}),400);assert.equal(await snapshot(),before);
 });
 await check('insufficient ingredient leaves all business documents unchanged',async()=>{
  const before=await snapshot();await expect(s.api('post','/productions',{productId:p._id,quantity:1000,idempotencyKey:`${qa.run}-insufficient`}),409);assert.equal(await snapshot(),before);
 });
 await check('injected failure after ingredient debit rolls back every mutation',async()=>{
  const before=await snapshot(),original=models.IngredientMovement.create;
  models.IngredientMovement.create=async()=>{throw new Error('QA injected ingredient movement failure');};
  try{await expect(s.api('post','/productions',{productId:p._id,quantity:1,idempotencyKey:`${qa.run}-rollback`}),500);}finally{models.IngredientMovement.create=original;}
  assert.equal(await snapshot(),before);
 });
 await check('competing productions cannot overdraw last ingredient stock',async()=>{
  const scarce=await expect(s.api('post','/inventory/ingredients',{name:'Scarce QA',unit:'KG'}),201),entry=await purchase('Scarce purchase QA',1,100);await expect(s.api('post','/inventory/receipts',{ingredientId:scarce._id,financialEntryId:entry._id}),201);
  recipe=await expect(s.api('put',`/inventory/recipes/${p._id}`,{yieldQuantity:1,components:[{ingredientId:flour._id,quantity:1},{ingredientId:scarce._id,quantity:1}],version:recipe.version}),200);
  const before=await models.Ingredient.findById(flour._id).lean();const replies=await Promise.all(['a','b'].map(key=>s.api('post','/productions',{productId:p._id,quantity:1,idempotencyKey:`${qa.run}-race-${key}`})));assert.deepEqual(replies.map(r=>r.status).sort(),[201,409]);assert.equal((await models.Ingredient.findById(scarce._id)).stockMicros,0);assert.equal((await models.Ingredient.findById(flour._id)).stockMicros,before.stockMicros-1000000);
 });
 await check('legacy production remains available without claiming calculated cost',async()=>{const result=await expect(s.api('post','/productions',{productId:legacy._id,quantity:3}),201);assert.equal(result.ingredientCostCents,undefined);assert.equal((await expect(s.api('get',`/inventory/recipes/${legacy._id}/cost`),200)).available,false);});
 await check('cross tenant IDs and unauthorized roles denied',async()=>{
  await expect(other.api('get',`/inventory/recipes/${p._id}`),404);await expect(other.api('get',`/inventory/recipes/${p._id}/cost`),404);await expect(other.api('post','/inventory/receipts',{ingredientId:flour._id,financialEntryId:first._id}),404);
  assert.equal((await expect(other.api('get','/inventory/ingredients'),200)).total,0);assert.equal((await expect(other.api('get',`/reports/overview?month=${month}`),200)).financial.revenueCents,0);
  for(const role of ['KITCHEN','CASHIER','ACCOUNTANT']){const u=await qa.fixture(role,a.tenant),session=await qa.session().init();await expect(session.login(u),200);await expect(session.api('get',`/reports/overview?month=${month}`),403);await expect(session.api('post','/inventory/ingredients',{name:'Forbidden QA',unit:'KG'}),403);await expect(session.api('get','/inventory/purchases'),403);await expect(session.api('get','/inventory/ingredients'),role==='KITCHEN'?200:403);}
 });
 await check('invalid units precision duplicate components and cancelled purchases rejected',async()=>{
  const wrongUnit=await expect(s.api('post','/inventory/ingredients',{name:'Liquid QA',unit:'L'}),201);await expect(s.api('post','/inventory/receipts',{ingredientId:wrongUnit._id,financialEntryId:first._id}),409);
  const canceled=await purchase('Canceled purchase QA',1,777);await expect(s.api('post',`/finance/entries/${canceled._id}/cancel`,{reason:'QA cancellation',version:canceled.version}),201);await expect(s.api('post','/inventory/receipts',{ingredientId:flour._id,financialEntryId:canceled._id}),400);
  await expect(s.api('post','/inventory/ingredients',{name:'Invalid precision',unit:'KG',minimumStock:0.0000001}),400);
  await expect(s.api('put',`/inventory/recipes/${p._id}`,{yieldQuantity:1,version:recipe.version,components:[{ingredientId:flour._id,quantity:1},{ingredientId:flour._id,quantity:1}]}),400);
 });
 await check('financial operational result excludes personal cancelled and open orders',async()=>{
  for(const [type,amount]of [['DESPESA_OPERACIONAL',200],['DESPESA_PESSOAL',999]]){const cat=await expect(s.api('post','/finance/categories',{name:`Category ${type}`,type}),201);await expect(s.api('post','/finance/entries',{description:`Expense ${type}`,categoryId:cat._id,type,nature:'FIXA',expectedAmountCents:amount,dueDate:today,competence:month}),201);}
  const order=await expect(s.api('post','/orders',{type:'TAKEAWAY',items:[{productId:p._id,quantity:2}]}),201);await expect(s.api('post',`/orders/${order._id}/finalize`,{payments:[{method:'PIX',amountCents:1000}]}),201);
  await expect(s.api('post','/orders',{type:'TAKEAWAY',items:[{productId:p._id,quantity:1}]}),201);
  const overview=await expect(s.api('get',`/reports/overview?month=${month}`),200);assert.deepEqual(overview.financial,{revenueCents:1000,productionCostsCents:5100,operationalExpensesCents:200,grossProfitCents:-4100,operatingResultCents:-4300,operatingMarginPercent:-430,operationalCoverageGapCents:0,orderCount:1,averageTicketCents:1000});assert.equal(overview.heatmap.reduce((n,x)=>n+x.orderCount,0),1);assert.equal(overview.trend.reduce((n,x)=>n+x.soldQuantity,0),2);assert.equal(overview.topQuantity[0].productId,p._id);assert.ok(!overview.lowStock.some(x=>x.productId===ondemand._id));assert.equal(overview.productionCost.coveredQuantity,6);assert.equal(overview.productionCost.uncoveredQuantity,3);assert.equal(overview.surplus.find(x=>x.productId===p._id).difference,4);
  await expect(s.api('get','/reports/overview?month=2026-13'),400);
 });
 if(process.env.OPERATIONAL_BROWSER==='true'){
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'})});const context=await browser.newContext({baseURL:qa.baseURL}),page=await context.newPage(),errors=[];currentPage=page;page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await check('browser public landing brand and real navigation',async()=>{await page.goto('/');await page.getByRole('heading',{name:/Mais clareza/}).waitFor();await page.waitForTimeout(1500);assert.equal(new URL(page.url()).pathname,'/');assert.ok((await page.locator('body').innerText()).includes('Thiago Solutions'));assert.equal(await page.locator('a[href="/cadastrar-empresa"]').count()>0,true);await page.locator('header a.login-link').click();await page.waitForURL('**/login');});
  await page.locator('[name=cnpj]').fill(a.owner.cnpj);await page.locator('[name=email]').fill(a.owner.email);await page.locator('[name=password]').fill(a.owner.password);await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/dashboard');
  await check('browser monthly overview heatmap charts empty state and errors',async()=>{
   await page.getByRole('heading',{name:'Visão geral',exact:true}).waitFor();await page.getByRole('heading',{name:'Horários de pico'}).waitFor();assert.equal(await page.locator('.heat-cell').count(),168);assert.equal(await page.locator('.bar-chart .day-bars').count()>27,true);
   await page.locator('[name=month]').fill('2001-01');await page.getByRole('button',{name:'Consultar mês'}).click();await page.getByText('Nenhuma venda finalizada neste mês.').waitFor();
   await page.route('**/api/reports/overview?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Falha QA temporária'})}));await page.getByRole('button',{name:'Consultar mês'}).click();await page.getByRole('alert').filter({hasText:'Falha QA temporária'}).waitFor();await page.unroute('**/api/reports/overview?*');await page.locator('[name=month]').fill(month);await page.getByRole('button',{name:'Consultar mês'}).click();await page.getByRole('heading',{name:'Horários de pico'}).waitFor();
  });
  const browserProduct=await product('Browser production QA'),browserPurchase=await purchase('Browser purchase QA',5,500);
  await check('browser ingredient receipt recipe and kitchen production end to end',async()=>{
   await page.goto('/insumos');await page.locator('[name=ingredientName]').fill('Browser ingredient QA');await page.getByRole('button',{name:'Cadastrar insumo',exact:true}).click();await page.getByRole('cell',{name:'Browser ingredient QA',exact:true}).waitFor();const ingredient=(await expect(s.api('get','/inventory/ingredients?limit=100'),200)).items.find(i=>i.name==='Browser ingredient QA');
   await page.locator('[name=financialEntryId]').selectOption(browserPurchase._id);await page.locator('[name=receiptIngredientId]').selectOption(ingredient._id);await page.getByRole('button',{name:'Confirmar recebimento'}).click();await page.getByRole('status').filter({hasText:'Recebimento registrado'}).waitFor();
   await page.getByRole('button',{name:'Fichas técnicas',exact:true}).click();await page.locator('[name=recipeProduct]').selectOption(browserProduct._id);await page.locator('[name=yieldQuantity]').fill('10');await page.locator('.component-row select').first().selectOption(ingredient._id);await page.locator('.component-row input').first().fill('1');await page.getByRole('button',{name:'Salvar ficha técnica'}).click();await page.getByRole('status').filter({hasText:'Ficha técnica salva'}).waitFor();
   await page.goto('/cozinha');await page.locator('[name=product]').selectOption(browserProduct._id);await page.getByRole('heading',{name:'Consumo de insumos'}).waitFor();await page.locator('[name=quantity]').fill('2');const response=page.waitForResponse(r=>r.url().endsWith('/productions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Confirmar produção'}).click();const r=await response;assert.equal(r.status(),201);assert.equal((await r.json()).ingredientCostCents,20);assert.equal((await models.Ingredient.findById(ingredient._id)).stockMicros,4800000);
  });
  for(const path of ['/','/dashboard','/insumos','/cozinha'])await check(`browser responsive ${path}`,async()=>{await page.goto(path);await page.locator('h1').waitFor();for(const width of [320,768,1440]){await page.setViewportSize({width,height:900});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${path} ${width}`);await page.screenshot({path:`${qa.out}/operational-${path.replaceAll('/','')||'landing'}-${width}.png`,fullPage:true});}});
  await check('browser no uncaught application errors',async()=>assert.deepEqual(errors,[]));await context.close();
 }
}catch(e){results.push({name:'setup/sequence',status:'failed',error:e.stack});console.log(e.stack);}finally{
 if(browser)await browser.close();await check('all prior documents preserved',async()=>{const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);console.log(`PRESERVED ${p.unchanged}/${p.previous}`);});await qa.app.close();await writeFile(`${qa.out}/operational-results.json`,JSON.stringify(results,null,2));const summary={run:qa.run,passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length};console.log(JSON.stringify(summary));if(summary.failed)process.exitCode=1;
}




