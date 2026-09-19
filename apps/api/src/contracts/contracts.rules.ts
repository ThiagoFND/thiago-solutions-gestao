/** Civil dates, without device/server timezone conversion. */
export function civilDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2199-12-31' || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value) throw new Error('Data civil inválida.');
  return value;
}
export function cycleDate(start: string, end: string, months: number, day: number, competence: string) {
  civilDate(start); civilDate(end);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence) || ![1, 3, 12].includes(months) || !Number.isInteger(day) || day < 1 || day > 31 || end < start) throw new Error('Recorrência inválida.');
  const [year, month] = competence.split('-').map(Number), [sy, sm] = start.split('-').map(Number);
  const offset = (year - sy) * 12 + month - sm;
  if (offset < 0 || offset % months !== 0 || competence > end.slice(0, 7)) throw new Error('Competência fora da recorrência contratada.');
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const due = civilDate(`${competence}-${String(Math.min(day, last)).padStart(2, '0')}`);
  if (due < start || due > end) throw new Error('Vencimento fora da vigência.');
  return due;
}
