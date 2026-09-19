import { createRequire } from 'node:module';
const uri='mongodb://127.0.0.1:27017/salgados_financeiro_test';
if(process.env.TEST_MONGODB_URI!==uri || process.env.MONGODB_URI && process.env.MONGODB_URI!==uri)throw new Error('Exact authorized test URI required');
const apply=process.argv.includes('--apply');
if(process.argv.some(a=>a.startsWith('--')&&!['--apply','--diagnose','--dry-run'].includes(a)))throw new Error('Unsupported option');
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const mongoose=require('mongoose');
const {COMMERCIAL_MODELS}=await import('../apps/api/dist/commerce/commerce.schemas.js');
const connection=await mongoose.createConnection(uri,{autoIndex:false,autoCreate:false}).asPromise();
try{
  if(connection.name!=='salgados_financeiro_test')throw new Error('Wrong database');
  const results=[];
  for(const definition of COMMERCIAL_MODELS){
    const model=connection.model(definition.name,definition.schema);let current=[];
    try{current=await model.collection.indexes();}catch(e){if(e.code!==26)throw e;}
    const missing=model.schema.indexes().filter(([key,options])=>!current.some(i=>JSON.stringify(i.key)===JSON.stringify(key)&&(!options.unique||i.unique))).map(([key,options])=>({key,unique:!!options.unique}));
    if(apply){if(process.env.TEST_MONGODB_URI!==uri)throw new Error('Test URI changed');await model.createCollection();await model.createIndexes();}
    results.push({collection:model.collection.name,missing,applied:apply});
  }
  console.log(JSON.stringify({mode:apply?'apply-test-only':'diagnose/dry-run',results},null,2));
}finally{await connection.close();}
