import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
export async function startQa() {
  const uri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
  if (process.env.TEST_MONGODB_URI !== uri) throw new Error('Exact test URI required');
  const port = Number(process.env.SECURITY_QA_PORT || 4317);
  const baseURL = `http://127.0.0.1:${port}`;
  Object.assign(process.env, { MONGODB_URI: uri, NODE_ENV: 'test', JWT_SECRET: randomBytes(48).toString('hex'), FRONTEND_URL: baseURL });
  Object.assign(process.env, { MONGODB_USER: '', MONGODB_PASSWORD: '', MONGODB_TLS: 'false', MONGODB_TLS_CA_FILE: '' });
  for (const name of ['GENERAL','ADMIN','LOGIN','LOGOUT','ORDER_CREATE','PAYMENT']) process.env[`RATE_LIMIT_${name}`] = '10000';
  process.chdir(fileURLToPath(new URL('../apps/api/', import.meta.url)));
  const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
  require('reflect-metadata');
  const { NestFactory } = require('@nestjs/core');
  const { getModelToken, getConnectionToken } = require('@nestjs/mongoose');
  const bcrypt = require('bcrypt');
  const { AppModule } = await import('../apps/api/dist/app.module.js');
  const { configureSecurityHttp } = await import('../apps/api/dist/common/security-http.js');
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  configureSecurityHttp(app);
  app.getHttpAdapter().get('/api/qa-context', (_req,res) => res.json({database:'salgados_financeiro_test',mode:'local-preserve-data'}));
  await app.init();
  const connection=app.get(getConnectionToken());
  if(connection.name!=='salgados_financeiro_test')throw new Error('Wrong database');
  for(const model of Object.values(connection.models))await model.createIndexes();
  const users={};
  for(const role of ['ADMIN','CASHIER','KITCHEN']) {
    const password=randomBytes(24).toString('hex');
    const email=`qa-browser-${randomBytes(10).toString('hex')}@example.invalid`;
    const user=await app.get(getModelToken('User')).create({name:`QA Browser ${role}`,email,passwordHash:await bcrypt.hash(password,12),role});
    users[role]={email,password,id:String(user._id)};
  }
  await app.listen(port,'127.0.0.1');
  return {app,users,baseURL};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {app,baseURL}=await startQa();
  console.log(`QA ready ${baseURL}; generated fixtures retained; credentials are not logged`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}
