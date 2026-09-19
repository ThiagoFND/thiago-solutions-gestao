export function proposalTotal(lines: { quantity: number; unitCents: number }[], discountCents: number) {
  if (!lines.length || lines.length > 100) throw new Error('Informe de 1 a 100 itens.');
  let subtotalCents = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1_000_000 || !Number.isSafeInteger(line.unitCents) || line.unitCents < 0) throw new Error('Quantidade ou preço inválido.');
    subtotalCents += line.quantity * line.unitCents;
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 1_000_000_000_000) throw new Error('Total fora do limite.');
  }
  if (!Number.isSafeInteger(discountCents) || discountCents < 0 || discountCents > subtotalCents) throw new Error('Desconto inválido.');
  return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents };
}
export function opportunityTransition(from: string, to: string, reason: string) {
  if (from !== 'OPEN' || !['WON', 'LOST'].includes(to)) throw new Error('Somente negociações abertas podem ser encerradas.');
  if (reason.trim().length < 5) throw new Error('Informe o resultado da negociação com pelo menos 5 caracteres.');
}
