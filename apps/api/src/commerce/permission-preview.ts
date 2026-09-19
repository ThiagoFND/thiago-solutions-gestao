import { PERMISSION_CATALOG } from '../auth/permissions.js';
import { effectivePermissions, type ModuleCode } from './commerce.domain.js';

/** Uses configured role capabilities, not the already masked current permissions. */
export function permissionPreview(configured: string[], current: string[], proposedModules: ModuleCode[]) {
  const proposed = new Set(effectivePermissions(configured, proposedModules));
  const present = new Set(current);
  const permissions = PERMISSION_CATALOG.filter(p => present.has(p.key) || proposed.has(p.key)).map(p => ({
    key: p.key, module: p.module, moduleName: p.moduleName, name: p.name,
    current: present.has(p.key), proposed: proposed.has(p.key),
    change: present.has(p.key) ? proposed.has(p.key) ? 'KEPT' : 'REMOVED' : 'ADDED',
  }));
  return {
    currentCount: permissions.filter(p => p.current).length,
    proposedCount: permissions.filter(p => p.proposed).length,
    addedCount: permissions.filter(p => p.change === 'ADDED').length,
    removedCount: permissions.filter(p => p.change === 'REMOVED').length,
    keptCount: permissions.filter(p => p.change === 'KEPT').length,
    permissions,
  };
}
