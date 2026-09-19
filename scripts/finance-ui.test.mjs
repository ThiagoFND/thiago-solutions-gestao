import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyInput, today } from '../apps/web/src/app/features/finance/finance.models.ts';

test('converte entradas monetárias decimais sem arredondamento implícito', () => {
  for (const [value, cents] of [['0,01', 1], ['1.01', 101], ['12,3', 1230], [' 123 ', 12300], ['10000000000', 1000000000000]]) {
    assert.equal(moneyInput(value), cents);
  }
});

test('rejeita valor vazio, inválido, fracionário demais e acima dos limites', () => {
  for (const value of ['', '0', '-1', '1,001', '1.001', '1.000,00', '1e3', 'Infinity', 'NaN', '10000000000,01', '9007199254740992']) {
    assert.throws(() => moneyInput(value), Error, value);
  }
});

test('hoje permanece no dia anterior em Recife após a virada UTC', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-13T01:00:00Z') });
  assert.equal(today(), '2026-09-12');
});
