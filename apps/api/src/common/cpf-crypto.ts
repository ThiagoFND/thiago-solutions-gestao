import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeCpf } from './brazil-documents.js';

export interface CpfEnvelope { keyVersion: string; iv: string; tag: string; ciphertext: string }
export class CpfCrypto {
  private readonly encryptionKey: Buffer;
  private readonly hashKey: Buffer;
  constructor(env: NodeJS.ProcessEnv = process.env) {
    const readKey = (name: string) => {
      const value = env[name];
      if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error(`Invalid ${name} configuration`);
      const key = Buffer.from(value, 'base64');
      if (key.length !== 32 || key.toString('base64') !== value) throw new Error(`Invalid ${name} configuration`);
      return key;
    };
    this.encryptionKey = readKey('CPF_ENCRYPTION_KEY');
    this.hashKey = readKey('CPF_HASH_KEY');
    if (timingSafeEqual(this.encryptionKey, this.hashKey)) throw new Error('CPF keys must be independent');
  }
  hash(value: unknown): string { return createHmac('sha256', this.hashKey).update(normalizeCpf(value)).digest('hex'); }
  encrypt(value: unknown, tenantId: string): CpfEnvelope {
    const cpf = normalizeCpf(value);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(this.aad(tenantId));
    const ciphertext = Buffer.concat([cipher.update(cpf, 'utf8'), cipher.final()]);
    return { keyVersion: '1', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  }
  decrypt(envelope: CpfEnvelope, tenantId: string): string {
    if (envelope.keyVersion !== '1') throw new Error('Unsupported CPF key version');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(this.aad(tenantId));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return normalizeCpf(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
  }
  protect(value: unknown, tenantId: string) {
    const cpf = normalizeCpf(value);
    return { cpfEncrypted: this.encrypt(cpf, tenantId), cpfHash: this.hash(cpf), cpfLastDigits: cpf.slice(-2) };
  }
  private aad(tenantId: string): Buffer {
    if (!/^[a-f\d]{24}$/i.test(tenantId)) throw new Error('Invalid CPF tenant context');
    return Buffer.from(`cpf:v1:${tenantId.toLowerCase()}`, 'utf8');
  }
}
export function maskCpf(lastDigits?: string): string | null { return lastDigits && /^\d{2}$/.test(lastDigits) ? `***.***.***-${lastDigits}` : null; }
