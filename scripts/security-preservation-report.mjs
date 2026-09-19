import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
const uri='mongodb://127.0.0.1:27017/salgados_financeiro_test';
if(process.env.TEST_MONGODB_URI!==uri)throw new Error('Exact test URI required');
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {MongoClient,BSON}=require('mongodb');
const run=process.env.SECURITY_QA_RUN;
if(!/^[a-zA-Z0-9_-]+$/.test(run??''))throw new Error('Unique SECURITY_QA_RUN required');
const folder=new URL(`../docs/security-qa/${run}/`,import.meta.url);
const before=JSON.parse(await readFile(new URL('before-db.json',folder),'utf8')).salgados_financeiro_test;
const after=JSON.parse(await readFile(new URL('after-db.json',folder),'utf8')).salgados_financeiro_test;
const changed=[];let preserved=0;
for(const [name,rows]of Object.entries(before))for(const [id,hash]of Object.entries(rows)){
  if(after[name]?.[id]!==hash)changed.push({collection:name,id,removed:!after[name]?.[id]});else preserved++;
}
const client=new MongoClient(uri,{serverSelectionTimeoutMS:5000});let counter;
try{
  await client.connect();const current=await client.db('salgados_financeiro_test').collection('counters').findOne({key:'orders'});
  // Counter has no timestamps. Recover its prior integer value by verifying the exact
  // initial full-document SHA256; no database writes and no unverified inference.
  if(current)for(let value=current.value;value>=Math.max(0,current.value-10000);value--){
    const candidate={...current,value};const hash=createHash('sha256').update(BSON.EJSON.stringify(candidate,{relaxed:false})).digest('hex');
    if(hash===before.counters?.[String(current._id)]){counter={before:value,after:current.value,delta:current.value-value,verification:'initial full-document SHA256 match after replacing only integer value'};break;}
  }
}finally{await client.close();}
const expectedDelta=Object.keys(after.orders??{}).length-Object.keys(before.orders??{}).length;
const result={strictSnapshotPassed:changed.length===0,businessRecordsPreserved:changed.length===0||(changed.length===1&&changed[0].collection==='counters'&&!changed[0].removed&&counter?.delta===expectedDelta),unchangedExistingDocuments:preserved,changed,counter,counts:Object.fromEntries(Object.keys(after).map(name=>[name,{before:Object.keys(before[name]??{}).length,after:Object.keys(after[name]).length,added:Object.keys(after[name]).length-Object.keys(before[name]??{}).length}]))};
await writeFile(new URL('preservation-analysis.json',folder),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
if(!result.businessRecordsPreserved)process.exitCode=1;
