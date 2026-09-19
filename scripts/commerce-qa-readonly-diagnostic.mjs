import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const {MongoClient}=require('mongodb');
const databases=['salgados_financeiro_test','salgados_mvp'];
const out=new URL('../docs/qa-catalogo-diagnostico-2026-09-18.json',import.meta.url);
const qaName=/\bQA\b|^QA_|^WEB_/i;
function safeDatabase(uri){try{const value=new URL(uri);return {host:value.hostname,database:value.pathname.slice(1),credentialsPresent:!!(value.username||value.password)};}catch{return {invalid:true};}}
const configuration={environment:process.env.MONGODB_URI?safeDatabase(process.env.MONGODB_URI):null,files:[]};
for(const file of ['.env','apps/api/.env']){
 try{const content=await readFile(new URL('../'+file,import.meta.url),'utf8');const match=content.match(/^\s*MONGODB_URI\s*=\s*(.*?)\s*$/m);configuration.files.push({file,...(match?safeDatabase(match[1].replace(/^['"]|['"]$/g,'')):{mongodbUriAbsent:true})});}catch(error){if(error.code!=='ENOENT')throw error;}
}
const client=new MongoClient('mongodb://127.0.0.1:27017',{serverSelectionTimeoutMS:5000,appName:'commerce-qa-readonly-diagnostic'});
const results=[];
const snapshotFilter=(code,prefix='snapshot')=>({$or:[{[prefix+'.planCode']:code},{[prefix+'.items.code']:code},{[prefix+'.modules']:code}]});
try{
 await client.connect();
 for(const database of databases){
  const db=client.db(database),offers=db.collection('commercial_offer_versions_v2');
  const versions=await offers.find({}, {projection:{_id:0,code:1,name:1,kind:1,version:1,reason:1,active:1,available:1,modules:1}}).sort({code:1,version:-1}).toArray();
  const latest=[...new Map(versions.slice().reverse().map(row=>[row.code,row])).values()];
  const candidates=latest.filter(row=>qaName.test(row.code)||qaName.test(row.name));
  const links=[];
  for(const row of candidates){
   const eventMatch={$or:[{resourceId:row.code},{'before.code':row.code},{'after.code':row.code},...['before.snapshot','after.snapshot','before.scheduled.snapshot','after.scheduled.snapshot'].flatMap(prefix=>snapshotFilter(row.code,prefix).$or)]};
   const [subscriptions,scheduled,invoices,requests,events]=await Promise.all([
    db.collection('commercial_subscriptions_v2').countDocuments(snapshotFilter(row.code)),
    db.collection('commercial_subscriptions_v2').countDocuments(snapshotFilter(row.code,'scheduled.snapshot')),
    db.collection('commercial_invoices_v2').countDocuments(snapshotFilter(row.code)),
    db.collection('commercial_requests_v2').countDocuments(snapshotFilter(row.code)),
    db.collection('commercial_events_v2').countDocuments(eventMatch),
   ]);
   links.push({...row,versions:versions.filter(version=>version.code===row.code).length,links:{subscriptions,scheduled,invoices,requests,events}});
  }
  results.push({database,offerVersionCount:versions.length,latestOfferCount:latest.length,latestModuleCount:latest.filter(row=>row.kind==='MODULE').length,qaNamedLatestCount:candidates.length,qaNamedOffers:links});
 }
}finally{await client.close();}
const report={at:new Date().toISOString(),mode:'direct-driver-read-only',configuration,limitations:['No API called; no models, indexes, writes, deletes or migrations used.','Environment files describe disk configuration, not the effective environment of existing processes.','QA name/reason detection is diagnostic, not authorization to change data.'],results};
await writeFile(out,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
