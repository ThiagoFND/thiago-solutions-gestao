import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { configureSecurityHttp } from '../src/common/security-http.js';
describe('Production HTTP config isolated without Mongo connection',()=>{
  it('emits Secure/HttpOnly/Lax/host-only cookies and HSTS over production config',async()=>{
    const saved={...process.env};let app:any;
    try {
      Object.assign(process.env,{NODE_ENV:'production',HTTPS_ENABLED:'true',FRONTEND_URL:'https://qa.example.invalid',JWT_SECRET:randomBytes(48).toString('hex')});
      const mod=await Test.createTestingModule({controllers:[AuthController],providers:[{provide:AuthService,useValue:{}},{provide:AuditService,useValue:{record:async()=>{}}}]}).compile();
      app=mod.createNestApplication({bodyParser:false,logger:false});configureSecurityHttp(app);await app.init();
      const r=await request(app.getHttpServer()).get('/api/auth/csrf').expect(200);
      const cookie=r.headers['set-cookie'].join(';');
      for(const attribute of ['Secure','HttpOnly','SameSite=Lax','Path=/api','Max-Age=900'])expect(cookie).toContain(attribute);
      expect(cookie).not.toContain('Domain=');expect(r.headers['strict-transport-security']).toContain('max-age=31536000');
    }finally {if(app)await app.close();process.env=saved;}
  });
});
