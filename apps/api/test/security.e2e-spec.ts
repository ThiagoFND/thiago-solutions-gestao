import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { boot, fixture, login, ORIGIN } from './security-harness.js';

const withMongo = process.env.TEST_MONGODB_URI ? describe : describe.skip;
const rows = readFileSync(new URL('../../../docs/security-permissions.md', import.meta.url),'utf8').split('\n')
  .filter(x => /^\| (GET|POST|PATCH) \|/.test(x)).map(x => { const c=x.split('|').map(x=>x.trim()); return { method:c[1].toLowerCase(), path:c[2], roles:c[3] }; });
const missingId = '000000000000000000000001';
withMongo('Security HTTP real database, preserve data', () => {
  let app:any; const users:any={}; const sessions:any={}; let product:any; let order:any;
  beforeAll(async () => {
    app=await boot();
    for(const role of ['ADMIN','CASHIER','KITCHEN','OTHER_CASHIER']) {
      users[role]=await fixture(app,role==='OTHER_CASHIER'?'CASHIER':role);
      sessions[role]=await login(app,users[role]);
    }
    product=(await sessions.ADMIN.api('post','/products').send({name:`QA Security ${randomBytes(8).toString('hex')}`,category:'QA',priceCents:100,availabilityMode:'MADE_TO_ORDER'}).expect(201)).body;
    order=(await sessions.CASHIER.api('post','/orders').send({type:'TAKEAWAY',items:[{productId:product._id,quantity:1}]}).expect(201)).body;
  },120000);
  afterAll(async()=>{if(app)await app.close();});
  for (const row of rows.filter(x=>x.roles!=='Publico')) {
    const path=row.path.replace(':id',missingId);
    it(`401 ${row.method.toUpperCase()} ${row.path}`,async()=>{await (request(app.getHttpServer()) as any)[row.method](`/api${path}`).expect(401);});
    for(const [role,short] of [['ADMIN','A'],['CASHIER','C'],['KITCHEN','K']]) {
      it(`${role} ${row.method.toUpperCase()} ${row.path}`,async()=>{
        // Logout gets a separate session so this matrix cannot revoke the suite actors.
        const session=row.path==='/auth/logout'?await login(app,await fixture(app,role)):sessions[role];
        const response=await session.api(row.method,path).send(row.method==='get'?undefined:{});
        if (!row.roles.split(' ').includes(short)) expect(response.status).toBe(403);
        else expect([200,201,400,404,409],`allowed policy; empty mutation body/missing fixture ID: ${response.status}`).toContain(response.status);
      });
    }
  }
  it('40 documented HTTP handlers; both public authentication endpoints work',()=>{expect(rows).toHaveLength(40);expect(sessions.ADMIN.response.body.user.role).toBe('ADMIN');});
  it('IDOR details/update/finalize/cancel and lists protect owner',async()=>{
    for(const [method,suffix,body] of [['get','',undefined],['patch','',{type:'TAKEAWAY',items:[{productId:product._id,quantity:2}]}],['post','/finalize',{payments:[{method:'PIX',amountCents:100}]}],['post','/cancel',{reason:'Forbidden cross-owner'}]] as any[]) await sessions.OTHER_CASHIER.api(method,`/orders/${order._id}${suffix}`).send(body).expect(403);
    const list=(await sessions.OTHER_CASHIER.api('get','/orders').expect(200)).body;
    expect(list.some((x:any)=>x._id===order._id)).toBe(false);
    await sessions.CASHIER.api('get',`/orders/${order._id}`).expect(200);
    await sessions.ADMIN.api('get',`/orders/${order._id}`).expect(200);
  });
  it('rejects server ownership, unexpected fields, operators, depth, IDs, dates and pagination',async()=>{
    let deep:any=1;for(let i=0;i<10;i++)deep={nested:deep};
    for(const body of [{type:'TAKEAWAY',items:[],openedById:users.OTHER_CASHIER.id},{'$where':'sleep(1)'},{x:deep},{items:Array(101).fill({})}]) await sessions.CASHIER.api('post','/orders').send(body).expect(400);
    for(const path of ['/orders/not-id','/orders?status[$ne]=OPEN','/products?activeOnly[$ne]=true','/products?limit=101','/reports/daily?date=2026-02-30','/finance/entries?$where=true','/orders?sort=$where'])await sessions.ADMIN.api('get',path).expect(400);
  });
  it('products and production projections exclude internal and price fields for kitchen',async()=>{
    const products=(await sessions.KITCHEN.api('get','/products').expect(200)).body;
    for(const p of products){expect(Object.keys(p).every(k=>['_id','name','category','availableStock','minimumStock','availabilityMode','active'].includes(k))).toBe(true);}
    const production=(await sessions.KITCHEN.api('post','/productions').send({productId:product._id,quantity:1}).expect(201)).body;
    expect(Object.keys(production).every(k=>['_id','productId','productName','quantity','createdAt'].includes(k))).toBe(true);
    expect(JSON.stringify((await sessions.ADMIN.api('get','/users').expect(200)).body)).not.toMatch(/passwordHash|sessionVersion/);
  });
  it('successful allowed operational endpoints ADMIN/CASHIER/KITCHEN and all four sale methods',async()=>{
    const password=randomBytes(24).toString('hex');
    const u=(await sessions.ADMIN.api('post','/users').send({name:'QA HTTP User',email:`qa-${randomBytes(8).toString('hex')}@example.invalid`,password,role:'CASHIER'}).expect(201)).body;
    expect(JSON.stringify(u)).not.toContain(password);
    await sessions.ADMIN.api('patch',`/users/${u._id}`).send({name:'QA Updated User'}).expect(200);
    await sessions.ADMIN.api('patch',`/products/${product._id}`).send({minimumStock:1}).expect(200);
    for(const role of ['ADMIN','CASHIER']) {
      for(const method of ['CASH','PIX','DEBIT','CREDIT']) {
        const o=(await sessions[role].api('post','/orders').send({type:'TAKEAWAY',items:[{productId:product._id,quantity:1}]}).expect(201)).body;
        await sessions[role].api('patch',`/orders/${o._id}`).send({type:'TAKEAWAY',items:[{productId:product._id,quantity:2}]}).expect(200);
        await sessions[role].api('get',`/orders/${o._id}`).expect(200);
        await sessions[role].api('post',`/orders/${o._id}/finalize`).send({payments:[{method,amountCents:200}]}).expect(201);
      }
      const o=(await sessions[role].api('post','/orders').send({type:'TAKEAWAY',items:[{productId:product._id,quantity:1}]}).expect(201)).body;
      await sessions[role].api('post',`/orders/${o._id}/cancel`).send({reason:'QA cancellation'}).expect(201);
    }
    for(const role of ['ADMIN','KITCHEN']) {
      await sessions[role].api('post','/productions').send({productId:product._id,quantity:1}).expect(201);
      await sessions[role].api('get','/productions/today').expect(200);
    }
    await sessions.ADMIN.api('get','/reports/daily').expect(200);
  });
  it('HttpOnly host-only cookie attributes, CSRF, CORS and headers',async()=>{
    const c=sessions.ADMIN.response.headers['set-cookie'].join(';');
    expect(c).toContain('HttpOnly');expect(c).toContain('SameSite=Lax');expect(c).toContain('Path=/api');expect(c).toContain('Max-Age=900');expect(c).not.toContain('Domain=');
    await request(app.getHttpServer()).post('/api/auth/login').set('Origin',ORIGIN).send({email:users.ADMIN.email,password:users.ADMIN.password}).expect(403);
    await request(app.getHttpServer()).get('/api/auth/csrf').set('Origin','https://evil.example').expect(403);
    await request(app.getHttpServer()).options('/api/orders').set('Origin','https://evil.example').set('Access-Control-Request-Method','POST').expect(403);
    const r=await request(app.getHttpServer()).get('/api/auth/csrf').set('Origin',ORIGIN).expect(200);
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);expect(r.headers['access-control-allow-credentials']).toBe('true');
    expect(r.headers['x-content-type-options']).toBe('nosniff');expect(r.headers['content-security-policy']).toContain("frame-ancestors 'none'");expect(r.headers['cache-control']).toBe('no-store');expect(r.headers['strict-transport-security']).toBeUndefined();
  });
  it('expired/tampered/Bearer tokens fail; logout and account changes revoke sessions',async()=>{
    const jwt=app.get(JwtService);
    const expired=await jwt.signAsync({sub:users.ADMIN.id,version:0},{expiresIn:-1,issuer:'salgados-api',audience:'salgados-web'});
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',`salgados_session=${expired}`).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',`${sessions.ADMIN.cookie}x`).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization',`Bearer ${sessions.ADMIN.cookie.split('=')[1]}`).expect(401);
    const u=await fixture(app,'CASHIER');const s=await login(app,u);
    await s.api('post','/auth/logout').send({}).expect(201);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',s.cookie).expect(401);
    const renewed=await login(app,u);
    await sessions.ADMIN.api('patch',`/users/${u.id}`).send({active:false}).expect(200);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',renewed.cookie).expect(401);
  });
  it('generic login errors, no credentials in JSON or audit, bcrypt cost12',async()=>{
    const a=request.agent(app.getHttpServer());const csrf=(await a.get('/api/auth/csrf')).body.csrfToken;
    const fail=async(email:string)=>(await a.post('/api/auth/login').set('Origin',ORIGIN).set('X-CSRF-Token',csrf).send({email,password:randomBytes(20).toString('hex')}).expect(401)).body;
    expect(await fail(users.ADMIN.email)).toEqual(await fail(`missing-${randomBytes(6).toString('hex')}@example.invalid`));
    const json=JSON.stringify(sessions.ADMIN.response.body);expect(json).not.toContain(users.ADMIN.password);expect(json).not.toMatch(/accessToken|passwordHash|sessionVersion/);
    const audit=JSON.stringify((await sessions.ADMIN.api('get','/audit?limit=100').expect(200)).body);
    expect(audit).not.toContain(users.ADMIN.password);expect(audit).not.toContain(sessions.ADMIN.cookie.split('=')[1]);expect(audit).not.toContain(process.env.JWT_SECRET!);
    const stored=await app.get(getModelToken('User')).findById(users.ADMIN.id).select('+passwordHash');expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
  });
  it('role changes revoke the old session and enforce the new role after login',async()=>{
    const user=await fixture(app,'CASHIER');
    const old=await login(app,user);
    await sessions.ADMIN.api('patch',`/users/${user.id}`).send({role:'KITCHEN'}).expect(200);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie',old.cookie).expect(401);
    const current=await login(app,user);
    expect((await current.api('get','/auth/me').expect(200)).body.role).toBe('KITCHEN');
    await current.api('get','/productions/today').expect(200);
    await current.api('get','/orders').expect(403);
    await current.api('get','/finance/entries').expect(403);
  });
  it('login rate limit returns429 using configured boundary',async()=>{
    process.env.RATE_LIMIT_LOGIN='1';
    try { const a=request.agent(app.getHttpServer());const csrf=(await a.get('/api/auth/csrf')).body.csrfToken;await a.post('/api/auth/login').set('Origin',ORIGIN).set('X-CSRF-Token',csrf).send({email:users.ADMIN.email,password:users.ADMIN.password}).expect(429); }
    finally {process.env.RATE_LIMIT_LOGIN='10000';}
  });
  it('Socket.IO transport endpoint is not active',async()=>{const r=await request(app.getHttpServer()).get('/socket.io/?EIO=4&transport=polling');expect(r.status).toBe(404);});
});
