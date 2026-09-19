import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('apps/web/dist/web/browser');
const target = resolve('apps/api/public');

if (!existsSync(source)) {
  throw new Error(`Build do Angular não encontrado em: ${source}`);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log('Frontend copiado para o servidor NestJS.');
