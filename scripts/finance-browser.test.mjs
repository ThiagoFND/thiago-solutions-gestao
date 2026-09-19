import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const testUri = 'mongodb://127.0.0.1:27017/salgados_financeiro_test';
assert.equal(process.env.TEST_MONGODB_URI, testUri, 'Exige confirmação explícita do banco de teste antes de iniciar navegador/escritas');
const baseURL = process.env.FINANCE_BROWSER_URL || 'http://127.0.0.1:3000';
assert.equal(new URL(baseURL).hostname, '127.0.0.1');
const qaResponse = await fetch(`${baseURL}/api/qa-context`);
assert.ok(qaResponse.ok, 'Aplicação precisa expor contexto exclusivo de QA');
const qaContext = await qaResponse.json();
assert.equal(qaContext.database, 'salgados_financeiro_test');
assert.equal(qaContext.mode, 'local-preserve-data');
const run = `browser-${Date.now()}`;
const output = `docs/validacao-financeiro/browser/${run}`;
await mkdir(output, { recursive: true });
const results = [];
const errors = [];
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }) });
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(`page: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
const ready = async () => {
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('[role="alert"]').count(), 0, await page.locator('[role="alert"]').allTextContents());
};
async function check(name, work) {
  const start = Date.now();
  try {
    await work();
    await ready();
    assert.deepEqual(errors, [], 'Erros de console/página');
    results.push({ name, status: 'passed', durationMs: Date.now() - start });
    await page.screenshot({ path: `${output}/${results.length}.png`, fullPage: true });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', error: String(error), durationMs: Date.now() - start });
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    throw error;
  }
}
async function login(email) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill((email === process.env.FINANCE_KITCHEN_EMAIL ? process.env.FINANCE_KITCHEN_PASSWORD : email === process.env.FINANCE_CASHIER_EMAIL ? process.env.FINANCE_CASHIER_PASSWORD : process.env.FINANCE_ADMIN_PASSWORD) ?? (() => { throw new Error('Provide generated QA fixture password'); })());
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(url => url.pathname !== '/login');
  await ready();
}
async function tab(name) {
  await page.locator('.tabs').getByRole('button', { name, exact: true }).click();
  await ready();
}
async function submit(name, path) {
  const responsePromise = page.waitForResponse(response => response.url().includes(`/api/finance/${path}`) && response.request().method() === 'POST');
  await page.getByRole('button', { name, exact: true }).click();
  const response = await responsePromise;
  assert.ok(response.ok(), `${response.status()} ${await response.text()}`);
  const body = await response.json();
  await ready();
  return body;
}
async function create(description, recurring = false) {
  await tab('Nova conta');
  await page.locator('input[name="description"]').fill(description);
  await page.locator('select[name="categoryId"]').selectOption({ index: 1 });
  await page.locator('input[name="amount"]').fill('12,34');
  if (recurring) {
    await page.locator('input[name="recurring"]').check();
    await page.locator('input[name="installments"]').fill('2');
  }
  return submit('Salvar', recurring ? 'recurrences' : 'entries');
}
async function findEntry(description) {
  await tab('Contas');
  await page.locator('input[name="description"]').fill(description);
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await ready();
  const row = page.locator('tbody tr').filter({ hasText: description });
  assert.equal(await row.count(), 1);
  return row;
}
try {
  await check('Rota sem autenticação redireciona ao login', async () => {
    await page.goto('/financeiro');
    await page.waitForURL('**/login');
  });
  await check('Login ADMIN, menu e rota Financeiro', async () => {
    await login(process.env.FINANCE_ADMIN_EMAIL ?? (() => { throw new Error('Provide generated QA fixture email'); })());
    await page.getByRole('link', { name: 'Financeiro', exact: true }).click();
    await page.waitForURL('**/financeiro');
    await page.getByRole('heading', { name: 'Financeiro', exact: true }).waitFor();
  });
  await check('Cinco abas e resumo carregam', async () => {
    for (const name of ['Contas', 'Nova conta', 'Categorias', 'Recorrências', 'Resumo']) await tab(name);
    assert.equal(await page.locator('.cards article').count(), 8);
  });
  for (const origin of ['PF', 'PJ']) {
    const description = `${run}-${origin}`;
    await check(`Criar conta e registrar pagamento ${origin} pela UI`, async () => {
      const entry = await create(description);
      assert.equal(entry.description, description);
      const row = await findEntry(description);
      await row.getByRole('button', { name: 'Detalhes / histórico' }).click();
      await ready();
      await page.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
      await page.locator('input[name="paidAmount"]').fill(origin === 'PF' ? '13,00' : '12,34');
      await page.locator('select[name="payOrigin"]').selectOption(origin);
      const paid = await submit('Salvar pagamento', `entries/${entry._id}/payment`);
      assert.equal(paid.status, 'PAGO');
      assert.equal(paid.payment.origin, origin);
      assert.equal(paid.payment.paidAmountCents, origin === 'PF' ? 1300 : 1234);
      const details = page.locator('section.panel').filter({ has: page.getByRole('heading', { name: description, exact: true }) });
      assert.equal(await details.count(), 1);
      assert.ok((await details.innerText()).includes(origin));
      assert.ok(await page.locator('.history').count() >= 2);
      assert.equal(await page.getByRole('button', { name: 'Registrar pagamento', exact: true }).count(), 0);
    });
    await check(`Consulta filtrada de conta paga ${origin}`, async () => {
      const row = await findEntry(description);
      assert.equal(await row.locator('[data-status="PAGO"]').count(), 1);
      await page.locator('select[name="origin"]').selectOption(origin);
      await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
      await ready();
      assert.equal(await page.locator('tbody tr').filter({ hasText: description }).count(), 1);
      await page.locator('select[name="origin"]').selectOption('');
    });
  }
  await check('Criar recorrência e repetir geração sem duplicar', async () => {
    const description = `${run}-recorrente`;
    const recurrence = await create(description, true);
    let row = page.locator('tbody tr').filter({ hasText: description });
    while (await row.count() === 0) {
      const next = page.getByRole('button', { name: 'Próxima', exact: true });
      assert.ok(await next.isEnabled(), 'Recorrência criada deve aparecer em alguma página');
      await next.click();
      await ready();
    }
    for (let repetition = 0; repetition < 2; repetition++) {
      const responsePromise = page.waitForResponse(response => response.url().endsWith(`/recurrences/${recurrence._id}/generate`) && response.request().method() === 'POST');
      await row.getByRole('button', { name: /^Gerar / }).click();
      const response = await responsePromise;
      assert.ok(response.ok());
      const result = await response.json();
      assert.equal(result.created, 0);
      assert.equal(result.existing, 1);
      await ready();
    }
    const entry = await findEntry(description);
    assert.ok((await entry.innerText()).includes('parcela 1'));
  });
  for (const [role, email] of [['KITCHEN', process.env.FINANCE_KITCHEN_EMAIL], ['CASHIER', process.env.FINANCE_CASHIER_EMAIL]]) {
    await check(`${role}: menu oculto e acesso direto bloqueado`, async () => {
      await page.evaluate(() => localStorage.clear());
      await login(email);
      assert.equal(await page.getByRole('link', { name: 'Financeiro', exact: true }).count(), 0);
      await page.goto('/financeiro');
      await page.waitForURL(url => url.pathname !== '/financeiro');
      assert.equal(await page.getByRole('heading', { name: 'Financeiro', exact: true }).count(), 0);
    });
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  const report = { run, baseURL, database: testUri, finishedAt: new Date().toISOString(), passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, errors, results };
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
