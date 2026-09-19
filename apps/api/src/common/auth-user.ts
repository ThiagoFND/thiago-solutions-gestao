import { UserRole, UserStatus, TenantStatus } from './enums.js';
import { AUTHORIZED_CAPABILITIES } from '../auth/permissions.js';

export interface AuthUser {
  subscriptionAllowed?: boolean;
  contractedModules?: string[];
  permissions?: string[];
  customRoleId?: string;
  customRoleName?: string;
  [AUTHORIZED_CAPABILITIES]?: string[];
  sub: string;
  name: string;
  email: string;
  role: UserRole | null;
  status: UserStatus;
  tenantId: string | null;
  tenantStatus: TenantStatus | null;
  sessionVersion?: number;
  tenantVersion?: number;
}
