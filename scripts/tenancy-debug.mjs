import {createRequire} from 'node:module';
const uri='mongodb://127.0.0.1:27017/salgados_financeiro_test';if(process.env.TEST_MONGODB_URI!==uri)throw Error('URI');
const require=createRequire(new URL('../apps/api/package.json',import.meta.url)),mongoose=require('mongoose');require('reflect-metadata');
const {ProductSchema}=await import('../apps/api/dist/products/product.schema.js');const {UserSchema}=await import('../apps/api/dist/users/user.schema.js');
const c=await mongoose.createConnection(uri,{autoCreate:false,autoIndex:false}).asPromise();
const p=c.model('Product',ProductSchema),u=c.model('User',UserSchema);const row=await p.findOne({name:/1789523471008/});
for(const tenantId of [row.tenantId,String(row.tenantId)]){const q=p.find({tenantId,_id:row._id,active:true});console.log({type:typeof tenantId,cast:q.cast(p),count:(await q).length});}
const audits=await c.db.collection('security_audit_events_v2').aggregate([{$group:{_id:{$type:'tenantId'},count:{$sum:1}}}]).toArray();console.log(audits);
const user=await u.findOne({name:'QA CASHIER'}).select('+sessionVersion');console.log({userTenantType:typeof user.tenantId,version:user.sessionVersion});
await c.close();
console.log(Object.fromEntries(Object.entries(ProductSchema.paths).map(([k,v])=>[k,v.instance])));
