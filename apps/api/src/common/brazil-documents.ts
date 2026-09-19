/** Accept only exact numeric or conventional masked documents. */
export function normalizeCpf(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value)) throw new Error('Invalid CPF');
  const digits = value.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) throw new Error('Invalid CPF');
  for (const length of [9, 10]) {
    const sum = [...digits.slice(0, length)].reduce((total, digit, i) => total + Number(digit) * (length + 1 - i), 0);
    if (Number(digits[length]) !== ((sum * 10) % 11) % 10) throw new Error('Invalid CPF');
  }
  return digits;
}
export function normalizeCnpj(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(value)) throw new Error('Invalid CNPJ');
  const digits = value.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) throw new Error('Invalid CNPJ');
  for (const length of [12, 13]) {
    const sum = [...digits.slice(0, length)].reduce((total, digit, i) => total + Number(digit) * ((length - 1 - i) % 8 + 2), 0);
    const remainder = sum % 11;
    if (Number(digits[length]) !== (remainder < 2 ? 0 : 11 - remainder)) throw new Error('Invalid CNPJ');
  }
  return digits;
}
export function isValidCnpj(value: unknown): boolean { try { normalizeCnpj(value); return true; } catch { return false; } }
export function isValidCpf(value: unknown): boolean { try { normalizeCpf(value); return true; } catch { return false; } }
