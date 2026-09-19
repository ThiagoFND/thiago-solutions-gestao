import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const URI='mongodb://127.0.0.1:27017/salgados_financeiro_test';
if(process.env.TEST_MONGODB_URI!==URI || process.env.MONGODB_URI&&process.env.MONGODB_URI!==URI)throw new Error('Exact authorized test URI required');
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));const {MongoClient,ObjectId}=require('mongodb');
const mode=process.argv[2]??'dry-run';if(!['diagnose','dry-run','apply'].includes(mode))throw new Error('Invalid mode');
if(mode==='apply'&&process.env.APPROVED_USABILITY_MIGRATION!=='APPLY_REVIEWED_PLAN')throw new Error('Reviewed plan and separate authorization required');
const plan=process.env.USABILITY_MIGRATION_PLAN?JSON.parse(await readFile(process.env.USABILITY_MIGRATION_PLAN,'utf8')):[];
if(!Array.isArray(plan))throw new Error('Plan must be an array');
const client=new MongoClient(URI);await client.connect();
try{
 const db=client.db('salgados_financeiro_test'),products=db.collection('products_v2'),seen=new Set(),changes=[],conflicts=[];
 for(const entry of plan){if(!entry||Object.keys(entry).some(k=>!['id','tenantId','origin','salesGroup'].includes(k))||!ObjectId.isValid(entry.id)||!ObjectId.isValid(entry.tenantId)||!['PRODUCED','PURCHASED_FOR_RESALE'].includes(entry.origin)||!['SNACKS','BEVERAGES','OTHER'].includes(entry.salesGroup)||seen.has(entry.id))throw new Error('Invalid or duplicate plan entry');seen.add(entry.id);const row=await products.findOne({_id:new ObjectId(entry.id),tenantId:new ObjectId(entry.tenantId)});if(!row){conflicts.push(entry.id);continue;}if(row.origin===entry.origin&&row.salesGroup===entry.salesGroup)continue;if(row.origin&&row.origin!==entry.origin||row.salesGroup&&row.salesGroup!==entry.salesGroup){conflicts.push(entry.id);continue;}changes.push({entry,row});}
 const report={mode,totalProducts:await products.countDocuments(),unclassified:await products.countDocuments({$or:[{origin:{$exists:false}},{salesGroup:{$exists:false}}]}),planned:plan.length,affected:changes.length,conflicts:conflicts.length,invalidPhones:0,invalidEmails:0,emailConflicts:0,applied:0};
 for(const collection of ['users_v2','tenants_v2']){const emails=new Set();for await(const row of db.collection(collection).find({},{projection:{phone:1,email:1,corporateEmail:1,tenantId:1}})){if(row.phone&&!/^\d{10,11}$/.test(row.phone))report.invalidPhones++;const email=row.email??row.corporateEmail;if(email){const normalized=email.replace(/\s/g,'').toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized))report.invalidEmails++;const key=String(row.tenantId??'global')+':'+normalized;if(emails.has(key))report.emailConflicts++;emails.add(key);}}}
 if(mode==='apply'){
  if(conflicts.length||report.emailConflicts)throw new Error('Resolve conflicts before apply');
  const session=client.startSession();try{await session.withTransaction(async()=>{for(const {entry,row}of changes){const filter={_id:row._id,tenantId:row.tenantId,origin:row.origin??{$exists:false},salesGroup:row.salesGroup??{$exists:false}};const result=await products.updateOne(filter,{$set:{origin:entry.origin,salesGroup:entry.salesGroup}},{session});if(result.modifiedCount!==1)throw new Error('Concurrent change: abort migration');} });report.applied=changes.length;}finally{await session.endSession();}
 }
 console.log(JSON.stringify(report,null,2));if(conflicts.length)process.exitCode=1;
}finally{await client.close();}
