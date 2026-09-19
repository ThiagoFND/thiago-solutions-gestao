import { TenancyService } from '../tenants/tenancy.service.js';
import { PlatformController } from '../tenants/platform.controller.js';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { SecurityGuard } from './security.guard.js';
import { securityConfig } from '../common/security.config.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: securityConfig().secret,
        signOptions: { expiresIn: '15m', algorithm: 'HS256', issuer: 'salgados-api', audience: 'salgados-web' },
      }),
    }),
  ],
  controllers: [AuthController, PlatformController],
  providers: [
    AuthService, TenancyService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: SecurityGuard },
  ],
})
export class AuthModule {}
