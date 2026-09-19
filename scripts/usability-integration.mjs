import { startTenancyQa } from './tenancy-qa-harness.mjs';
import { usabilityChecks } from './usability-checks.mjs';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const qa=await startTenancyQa(),results=[];
async function check(name,work){try{await work();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.message});console.log('FAIL '+name+': '+e.message);}}
try{await usabilityChecks(qa,check,process.env.USABILITY_BROWSER==='true');}catch(e){results.push({name:'setup/sequence',status:'failed',error:e.message});console.log(e.stack);}finally{await check('preserve all preexisting documents',async()=>{const p=await qa.preserve();assert.equal(p.missing,0);assert.equal(p.changed,0);console.log(`PRESERVED ${p.unchanged}/${p.previous}`);});await qa.app.close();await writeFile(`${qa.out}/usability-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({run:qa.run,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));if(results.some(r=>r.status==='failed'))process.exitCode=1;}
