import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { MODULE_CODES } from '../apps/api/src/commerce/commerce.domain.ts';
import { SYSTEM_MODULE_NAMES, systemModuleChoices } from '../apps/web/src/app/features/commerce/system-modules.ts';
registerHooks({resolve(specifier,context,nextResolve){return nextResolve(specifier==='./system-modules'&&context.parentURL?.endsWith('/plan-choices.ts')?'./system-modules.ts':specifier,context);}});
const { availablePlanChoices } = await import('../apps/web/src/app/features/commerce/plan-choices.ts');

const offer = (code, overrides = {}) => ({ code, kind: 'MODULE', name: 'QA Oferta 1789746169816-08f5470f85', monthlyCents: 1000, active: true, available: true, ...overrides });

test('frontend labels cover exactly the 13 canonical backend capabilities', () => {
  assert.equal(MODULE_CODES.length, 13);
  assert.deepEqual(Object.keys(SYSTEM_MODULE_NAMES).sort(), [...MODULE_CODES].sort());

  assert.equal(SYSTEM_MODULE_NAMES.TRACEABILITY, 'Qualidade e devoluções');
});

test('all canonical capabilities remain visible even with an incomplete catalog', () => {
  const choices = systemModuleChoices(MODULE_CODES, [offer('SALES')], 'MONTHLY');
  assert.deepEqual(choices.map(choice => choice.code), [...MODULE_CODES]);
  assert.equal(choices.filter(choice => choice.available).length, 1);
  assert.equal(choices.filter(choice => choice.priceCents === null).length, 12);
  assert.ok(choices.slice(1).every(choice => choice.unavailableReason === 'Preço não configurado'));
});

test('ignores arbitrary QA names and extraneous offers while preserving configured prices', () => {
  const offers = [offer('PURCHASES'), offer('TRACEABILITY', { name: 'QA Qualidade 1789746702043', monthlyCents: 1234 }), offer('QA_EXTRA')];
  const before = structuredClone(offers);
  const choices = systemModuleChoices(MODULE_CODES, offers, 'MONTHLY');
  assert.equal(choices.length, 13);
  assert.ok(choices.every(choice => !choice.name.includes('QA')));
  assert.equal(choices.find(choice => choice.code === 'PURCHASES').priceCents, 1000);
  assert.equal(choices.find(choice => choice.code === 'TRACEABILITY').priceCents, 1234);
  assert.deepEqual(offers, before);
});

test('annual prices use configured annual value or twelve monthly installments including zero', () => {
  const choices = systemModuleChoices(['SALES', 'FINANCE', 'PURCHASES'], [offer('SALES', { annualCents: 9000 }), offer('FINANCE'), offer('PURCHASES', { annualCents: 0 })], 'ANNUAL');
  assert.deepEqual(choices.map(choice => choice.priceCents), [9000, 12000, 0]);
  assert.ok(choices.every(choice => choice.available));
});

test('inactive and unavailable offers cannot be contracted but retain their actual price', () => {
  const choices = systemModuleChoices(['SALES', 'FINANCE'], [offer('SALES', { active: false }), offer('FINANCE', { available: false })], 'MONTHLY');
  assert.ok(choices.every(choice => !choice.available && choice.priceCents === 1000));
  assert.deepEqual(choices.map(choice => choice.unavailableReason), ['Oferta inativa', 'Indisponível para contratação']);
});

test('missing, invalid or non-module prices never become free selectable capabilities', () => {
  for (const offers of [[], [offer('SALES', { kind: 'PLAN' })], [offer('SALES', { monthlyCents: -1 })], [offer('SALES', { monthlyCents: NaN })], [offer('SALES', { monthlyCents: 0.5 })]]) {
    const [choice] = systemModuleChoices(['SALES'], offers, 'MONTHLY');
    assert.equal(choice.available, false);
    assert.equal(choice.priceCents, null);
  }
});

test('duplicate capability codes produce only one choice', () => {
  assert.equal(systemModuleChoices(['SALES', 'SALES'], [offer('SALES')], 'MONTHLY').length, 1);
});

test('test-only module is unavailable despite having a valid price',()=>{
  assert.equal(systemModuleChoices(['SALES'],[offer('SALES',{testOnly:true})],'MONTHLY')[0].available,false);
});

test('plan selector accepts commercial plans outside defaults and excludes ineligible plans',()=>{
  const plan=offer('REAL_SPECIAL',{kind:'PLAN',name:'Especial',modules:['SALES']});
  const choices=availablePlanChoices([offer('SALES'),plan,{...plan,code:'TEST',testOnly:true},{...plan,code:'INACTIVE',active:false},{...plan,code:'UNAVAILABLE',available:false},{...plan,code:'MISSING_MODULE',modules:['FINANCE']}]);
  assert.deepEqual(choices.map(choice=>choice.code),['REAL_SPECIAL']);
});

test('plan selector disambiguates names and retains unavailable historical selection disabled',()=>{
  const plan=offer('ONE',{kind:'PLAN',name:'Especial',modules:[]});
  const choices=availablePlanChoices([plan,{...plan,code:'TWO'},{...plan,code:'THREE',name:'Personalizado'}],'OLD');
  assert.deepEqual(choices.map(choice=>choice.label),['Especial (ONE)','Especial (TWO)','Personalizado (THREE)','OLD — indisponível para nova contratação']);
  assert.equal(choices[3].available,false);
  assert.equal(choices[3].monthlyCents,null);
});
