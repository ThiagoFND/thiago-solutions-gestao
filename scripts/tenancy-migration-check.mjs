import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { URI, guard, documentNumber } from './tenancy-qa-harness.mjs';
guard();const require=createRequire(new URL('../apps/api/package.json',import.meta.url)),mongoose=require('mongoose');
const root=fileURLToPath(new URL('../',import.meta.url)),run=`migration-${Date.now()}-${randomBytes(4).toString('hex')}`,out=`${root}/docs/tenancy-qa/${run}`;await mkdir(out,{recursive:true});
const connection=await mongoose.createConnection(URI,{autoCreate:false,autoIndex:false}).asPromise();let planFile;
try{
 const snapshot=async()=>{const result={};for(const c of await connection.db.listCollections({}, {nameOnly:true}).toArray()){const rows=await connection.db.collection(c.name).find({}).sort({_id:1}).toArray();result[c.name]={count:rows.length,hash:createHash('sha256').update(mongoose.mongo.BSON.EJSON.stringify(rows)).digest('hex')};}return result;};
 const before=await snapshot();const owner=await connection.db.collection('users').findOne({role:'ADMIN',active:{$ne:false}});assert.ok(owner,'Legacy test owner required for dry-run');
 planFile=`${out}/private-plan.json`;await writeFile(planFile,JSON.stringify({runId:run,tenantId:String(new mongoose.Types.ObjectId()),ownerId:String(owner._id),counterId:String(new mongoose.Types.ObjectId()),effectiveAt:'2026-09-15T00:00:00.000Z',company:{cnpj:documentNumber(),legalName:'QA Migration',tradeName:'QA Migration',corporateEmail:'migration@example.invalid',phone:'11999999999'}}));
 const results=[];for(const mode of ['diagnose','dry-run']){
  const r=spawnSync(process.execPath,['scripts/tenancy-storage.mjs',mode],{cwd:root,env:{...process.env,TEST_MONGODB_URI:URI,TENANCY_MIGRATION_PLAN:planFile},encoding:'utf8'});
  if(r.error)throw new Error(`Read-only subprocess failed: ${r.error.code}`);
  await writeFile(`${out}/${mode}.json`,r.stdout??'');const report=JSON.parse(r.stdout);results.push({mode,exitCode:r.status,ready:report.ready,planned:report.planned,conflicts:report.conflicts,referencesMissing:report.referencesMissing});assert.equal(r.status,0);
 }
 assert.deepEqual(await snapshot(),before);await writeFile(`${out}/results.json`,JSON.stringify({results,preserved:true,documents:Object.values(before).reduce((s,x)=>s+x.count,0)},null,2));console.log(JSON.stringify({run,results,preserved:true}));
}finally{if(planFile)await unlink(planFile);await connection.close();}
