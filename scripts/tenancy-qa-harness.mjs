import { createRequire } from 'node:module';
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
export const URI='mongodb://127.0.0.1:27017/salgados_financeiro_test';
export function guard(){if(process.env.TEST_MONGODB_URI!==URI || (process.env.MONGODB_URI && process.env.MONGODB_URI!==URI))throw new Error('Exact authorized test URI required');}
export function documentNumber(cpf=false){
 let digits=Array.from({length:cpf?9:12},()=>randomInt(10));
 if(!cpf) digits[0]=randomInt(1,10);
 for(let round=0;round<2;round++){
  const weights=cpf?Array.from({length:digits.length},(_,i)=>digits.length+1-i):digits.length===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];
  const rest=digits.reduce((s,n,i)=>s+n*weights[i],0)%11;digits.push(rest<2?0:11-rest);
 }return digits.join('');
}
export async function startTenancyQa(options={}){
 guard();
 const run=`${Date.now()}-${randomBytes(5).toString('hex')}`;
 const out=fileURLToPath(new URL(`../docs/tenancy-qa/${run}/`,import.meta.url));await mkdir(out,{recursive:true});
 const port=options.port??4329;if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Invalid QA port');
 Object.assign(process.env,{MONGODB_URI:URI,NODE_ENV:'test',TENANCY_V2_ENABLED:'true',JWT_SECRET:randomBytes(48).toString('hex'),CPF_ENCRYPTION_KEY:randomBytes(32).toString('base64'),CPF_HASH_KEY:randomBytes(32).toString('base64'),FRONTEND_URL:`http://127.0.0.1:${port}`,MONGODB_USER:'',MONGODB_PASSWORD:'',MONGODB_TLS:'false',MONGODB_TLS_CA_FILE:'',ATTACHMENT_STORAGE_DIR:fileURLToPath(new URL(`../.qa-attachments/${run}/`,import.meta.url))});
 for(const group of ['GENERAL','ADMIN','LOGIN','LOGOUT','PAYMENT','ORDER_CREATE','PLATFORM_LOGIN','PLATFORM','ONBOARDING','LOOKUP','ACCESS_REQUEST'])process.env[`RATE_LIMIT_${group}`]='10000';
 const require=createRequire(new URL('../apps/api/package.json',import.meta.url));require('reflect-metadata');
 const mongoose=require('mongoose'),bcrypt=require('bcrypt'),{NestFactory}=require('@nestjs/core'),{getConnectionToken}=require('@nestjs/mongoose');
 const {AppModule}=await import('../apps/api/dist/app.module.js');
 const {configureSecurityHttp}=await import('../apps/api/dist/common/security-http.js');
 const app=await NestFactory.create(AppModule,{bodyParser:false,logger:false,abortOnError:false});
 configureSecurityHttp(app);
 const connection=app.get(getConnectionToken());if(connection.name!=='salgados_financeiro_test')throw new Error('Wrong database');
 const db=connection.db;
 const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const fingerprint=v=>createHash('sha256').update(JSON.stringify(canonical(mongoose.mongo.BSON.EJSON.serialize(v)))).digest('hex');
 const before=new Map();
 for(const c of await db.listCollections({}, {nameOnly:true}).toArray()){
  const docs=await db.collection(c.name).find({}).toArray();before.set(c.name,new Map(docs.map(d=>[String(d._id),fingerprint(d)])));
 }
 guard();for(const model of Object.values(connection.models)){await model.createCollection();await model.createIndexes();}
 const hello=await db.admin().command({hello:1});const transactions=!!hello.setName||hello.msg==='isdbgrid';
 // Serve the reviewed Angular build without copying over existing public assets.
 const express=require('express');const web=fileURLToPath(new URL('../apps/web/dist/web/browser/',import.meta.url));
 app.use(express.static(web));app.use((req,res,next)=>{if(req.method==='GET'&&!req.path.startsWith('/api')&&!req.path.startsWith('/socket.io'))return res.sendFile(`${web}/index.html`);next();});
 await app.listen(port,'127.0.0.1');const baseURL=`http://127.0.0.1:${port}`;
 async function fixture(role,tenant,status='ACTIVE'){
  guard();const password=randomBytes(24).toString('hex'),email=`qa-${run}-${randomBytes(5).toString('hex')}@example.invalid`;
  const user=await connection.models.User.create({name:`QA ${role??'PENDING'}`,email,passwordHash:await bcrypt.hash(password,12),role,tenantId:tenant?tenant._id:null,status});
  return {id:String(user._id),email,password,role,cnpj:tenant?.cnpj,tenantId:tenant?String(tenant._id):null};
 }
 async function company(status='ACTIVE'){
  guard();const id=new mongoose.Types.ObjectId(),ownerId=new mongoose.Types.ObjectId();
  const tenant=await connection.models.Tenant.create({_id:id,ownerId,cnpj:documentNumber(),legalName:`QA ${run}`,tradeName:`QA ${run}`,corporateEmail:`qa-${run}@example.invalid`,phone:'11999999999',status});
  const password=randomBytes(24).toString('hex'),email=`owner-${run}-${randomBytes(5).toString('hex')}@example.invalid`;
  await connection.models.User.create({_id:ownerId,tenantId:id,name:'QA Owner',email,passwordHash:await bcrypt.hash(password,12),role:'OWNER',status:status==='PENDING'?'PENDING':'ACTIVE'});
  return {tenant,owner:{id:String(ownerId),email,password,role:'OWNER',cnpj:tenant.cnpj,tenantId:String(id)}};
 }
 function session(){
  const cookies=new Map();let csrf='';
  const api=async(method,path,body,headers={})=>{
   const response=await fetch(`${baseURL}/api${path}`,{method:method.toUpperCase(),headers:{Origin:baseURL,Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(csrf?{'X-CSRF-Token':csrf}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
   for(const cookie of response.headers.getSetCookie()){const [k,v]=cookie.split(';')[0].split('=');cookies.set(k,v);}
   const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=null;}
   return {status:response.status,body:data,text,headers:response.headers};
  };
  return {api,cookies,async init(){const r=await api('get','/auth/csrf');csrf=r.body.csrfToken;return this;},async login(user){const body={email:user.email,password:user.password,...(user.role==='PLATFORM_ADMIN'?{}:{cnpj:user.cnpj})};return api('post',user.role==='PLATFORM_ADMIN'?'/auth/platform-login':'/auth/login',body);}};
 }
 async function preserve(){
  let previous=0,unchanged=0,missing=0,changed=0,total=0;const differences=[];
  for(const c of await db.listCollections({}, {nameOnly:true}).toArray()){
   const docs=await db.collection(c.name).find({}).toArray();total+=docs.length;const now=new Map(docs.map(d=>[String(d._id),fingerprint(d)]));
   for(const [id,hash]of before.get(c.name)??[]){previous++;if(!now.has(id)){missing++;differences.push({collection:c.name,id,kind:'missing'});}else if(now.get(id)!==hash){changed++;differences.push({collection:c.name,id,kind:'changed'});}else unchanged++;}
   before.delete(c.name);
  }
  for(const prior of before.values()){previous+=prior.size;missing+=prior.size;}
  const report={run,transactions,previous,unchanged,missing,changed,total,differences};await writeFile(`${out}/preservation.json`,JSON.stringify(report,null,2));return report;
 }
 return {app,connection,db,transactions,run,out,baseURL,fixture,company,session,preserve,documentNumber, existedBefore:(collection,id)=>before.get(collection)?.has(String(id))??false};
}
