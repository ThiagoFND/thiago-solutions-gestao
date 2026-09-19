import {createRequire} from 'node:module';
const uri='mongodb://127.0.0.1:27017/salgados_financeiro_test';
const guard=()=>{if(process.env.TEST_MONGODB_URI!==uri||process.env.MONGODB_URI&&process.env.MONGODB_URI!==uri)throw new Error('Exact authorized test URI required');};
guard();const flags=process.argv.slice(2);if(flags.length>1||flags.some(f=>!['--diagnose','--dry-run','--apply'].includes(f)))throw new Error('Choose one mode: --diagnose, --dry-run or --apply');
const apply=flags.includes('--apply'),require=createRequire(new URL('../apps/api/package.json',import.meta.url));require('reflect-metadata');
const mongoose=require('mongoose');
const {BUSINESS_MODELS}=await import('../apps/api/dist/business/business.schemas.js');
const {leadSchema}=await import('../apps/api/dist/portfolio/portfolio.module.js');
const {definitions:quality}=await import('../apps/api/dist/inventory/quality.module.js');
const expansion=[];
for(const [file,name] of [['inventory/manual-stock.module','MANUAL_STOCK_MODELS'],['crm/crm.schemas','CRM_MODELS'],['service-orders/service-orders.schemas','SERVICE_MODELS'],['contracts/contracts.schemas','CONTRACT_MODELS'],['loyalty/loyalty.schemas','LOYALTY_MODELS'],['projects/projects.schemas','PROJECT_MODELS'],['purchases/purchases.schemas','PURCHASE_MODELS'],['logistics/logistics.schemas','LOGISTICS_MODELS'],['bi/bi.schemas','BI_MODELS'],['documents/documents.schemas','DOCUMENT_MODELS'],['branches/branches.module','BRANCH_MODELS']]){
 const exports=await import(`../apps/api/dist/${file}.js`);expansion.push(...exports[name]);
}
const connection=await mongoose.createConnection(uri,{autoCreate:false,autoIndex:false}).asPromise();
try{if(connection.name!=='salgados_financeiro_test')throw new Error('Wrong database');const results=[];
 for(const definition of [...BUSINESS_MODELS,{name:'PlatformLead',schema:leadSchema},...quality,...expansion]){const model=connection.model(definition.name,definition.schema);let current=[];try{current=await model.collection.indexes();}catch(e){if(e.code!==26)throw e;}
 const missing=definition.schema.indexes().filter(([key,opts])=>!current.some(i=>JSON.stringify(i.key)===JSON.stringify(key)&&(!opts.unique||i.unique)&&JSON.stringify(i.partialFilterExpression??null)===JSON.stringify(opts.partialFilterExpression??null))).map(([key,opts])=>({key,unique:!!opts.unique}));
 if(apply){guard();await model.createCollection();await model.createIndexes();}results.push({collection:model.collection.name,missing,applied:apply});}
 console.log(JSON.stringify({mode:apply?'apply-test-only':'diagnose/dry-run',results},null,2));
}finally{await connection.close();}
