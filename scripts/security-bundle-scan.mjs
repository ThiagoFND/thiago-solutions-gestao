import { readFile,readdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const secrets=[];
for(const path of ['.env','apps/api/.env']) {
  try {for(const line of (await readFile(`${root}/${path}`,'utf8')).split(/\r?\n/)) {
    const m=line.match(/^([A-Z_]*(?:SECRET|PASSWORD|TOKEN|API_KEY)[A-Z_]*)=(.+)$/);
    if(m&&m[2].length>=8)secrets.push(m[2].replace(/^['"]|['"]$/g,''));
  }}catch(e){if(e.code!=='ENOENT')throw e;}
}
let files=0;const findings=[];
async function scan(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${e.name}`;if(e.isDirectory())await scan(path);else {
  files++;const text=await readFile(path,'utf8');
  if(/mongodb(?:\+srv)?:\/\/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\$2[aby]\$12\$/.test(text)||secrets.some(s=>text.includes(s)))findings.push(path.slice(root.length));
}}}
await scan(`${root}/apps/web/dist/web/browser`);
const result={files,knownLocalSecretsCompared:secrets.length,findings,passed:findings.length===0,limitations:'Pattern and known local values scan, not proof against unknown obfuscated secrets or git history'};
const run=process.env.SECURITY_QA_RUN;
if(!/^[a-zA-Z0-9_-]+$/.test(run??''))throw new Error('Unique SECURITY_QA_RUN required');
await writeFile(`${root}/docs/security-qa/${run}/bundle-scan.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(findings.length)process.exitCode=1;
