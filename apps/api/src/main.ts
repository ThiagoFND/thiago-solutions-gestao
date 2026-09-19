import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureSecurityHttp } from './common/security-http.js';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureSecurityHttp(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
