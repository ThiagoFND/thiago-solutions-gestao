import type { Offer } from './commerce-api.service';
import { activeModuleCodes } from './system-modules';

export function availablePlanChoices(offers: readonly Offer[], historicalCode?: string) {
  const moduleAvailable = (code:string) => activeModuleCodes([code]).length>0&&offers.some(o=>o.kind==='MODULE'&&o.code===code&&o.active&&o.available&&!o.testOnly);
  const plans = offers.filter(o => o.kind === 'PLAN' && o.active && o.available && !o.testOnly && o.modules.every(moduleAvailable));
  const normalize = (name: string) => name.trim().toLocaleLowerCase('pt-BR');
  const choices = plans.map(o => ({
    code: o.code,
    label: normalize(o.name)==='personalizado'||plans.filter(p => normalize(p.name) === normalize(o.name)).length > 1 ? `${o.name} (${o.code})` : o.name,
    available: true,
    monthlyCents: o.monthlyCents as number | null,
  }));
  if (historicalCode && historicalCode !== 'CUSTOM' && !choices.some(o => o.code === historicalCode)) {
    const historical = offers.find(o => o.kind === 'PLAN' && o.code === historicalCode);
    const name = historical?.name && historical.name !== historicalCode ? `${historical.name} (${historicalCode})` : historicalCode;
    choices.push({code: historicalCode, label: `${name} — indisponível para nova contratação`, available: false, monthlyCents: null});
  }
  return choices;
}
