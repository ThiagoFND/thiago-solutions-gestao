/** Explicit first platform administrator. Never imported by the application. */
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
const uri='mongodb://127.0.0.1:27017/salgados_financeiro_test';
if(process.env.TEST_MONGODB_URI!==uri || process.env.MONGODB_URI!==uri)throw new Error('This delivery only permits the explicitly authorized test database');
if(process.env.TENANCY_BOOTSTRAP_CONFIRM!=='CREATE_FIRST_PLATFORM_ADMIN')throw new Error('Explicit first administrator confirmation required');
const name=process.env.PLATFORM_ADMIN_NAME?.trim(),email=process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.PLATFORM_ADMIN_PASSWORD;
if(!name||name.length<2||name.length>120||!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password||password.length<12||Buffer.byteLength(password)>72)throw new Error('Valid administrator name, email and strong password are required in environment variables');
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));require('reflect-metadata');
const mongoose=require('mongoose'),bcrypt=require('bcrypt');
const {UserSchema}=await import('../apps/api/dist/users/user.schema.js');const {AuditEventSchema}=await import('../apps/api/dist/audit/audit-event.schema.js');
let connection;
try{
 connection=await mongoose.createConnection(uri,{autoCreate:false,autoIndex:false,serverSelectionTimeoutMS:5000}).asPromise();
 const hello=await connection.db.admin().command({hello:1});if(!hello.setName&&hello.msg!=='isdbgrid')throw new Error('Transactional MongoDB is required before any write');
 const user=connection.model('User',UserSchema),audit=connection.model('AuditEvent',AuditEventSchema),passwordHash=await bcrypt.hash(password,12);
 await connection.transaction(async session=>{
  if(await user.exists({role:'PLATFORM_ADMIN'}).session(session))throw new Error('A platform administrator already exists; bootstrap refused');
  // Unique manifest serializes simultaneous bootstrap attempts; all writes are atomic.
  await connection.db.collection('tenancy_migrations_v2').insertOne({_id:'first-platform-admin-v1',kind:'bootstrap',runId:randomBytes(16).toString('hex'),createdAt:new Date()},{session});
  const [admin]=await user.create([{name,email,passwordHash,tenantId:null,role:'PLATFORM_ADMIN',status:'ACTIVE'}],{session});
  await audit.create([{tenantId:null,actorId:admin._id,actorRole:'PLATFORM_ADMIN',action:'platform.bootstrap',outcome:'success',resourceType:'users',resourceId:admin._id}],{session});
 });
 console.log(JSON.stringify({created:1,role:'PLATFORM_ADMIN',audited:true}));
}catch{console.error('Platform bootstrap failed; verify prerequisites and existing administrator without exposing credentials.');process.exitCode=1;}
finally{if(connection)await connection.close();}
