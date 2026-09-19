import { describe, expect, it } from 'vitest';
import { calculateQuote, contractableOffers, isTestOffer } from './commerce.domain.js';
import { suggestedOffers } from './commerce.defaults.js';
const legacy={code:'QA_1789747357953_104B012E37',kind:'PLAN' as const,name:'QA isolated commercial plan',reason:'QA 1789747357953-104b012e37'};
describe('Test fixtures versus commercial offers',()=>{
 it('recognizes exact legacy QA plan provenance',()=>expect(isTestOffer(legacy)).toBe(true));
 it.each(['Plano navegador QA','Plano navegador QA 1789747357953-104b012e37'])('recognizes WEB legacy name %s',name=>expect(isTestOffer({...legacy,code:'WEB_1789747357953_104B012E37',name})).toBe(true));
 it.each([{reason:'Outra razão comercial'},{name:'QA Consultoria'},{code:'QA_REAL_CUSTOMER'},{kind:'MODULE' as const}])('does not infer test status from incomplete provenance %j',change=>expect(isTestOffer({...legacy,...change})).toBe(false));
 it('explicit flags override inferred status in both directions',()=>{expect(isTestOffer({...legacy,testOnly:false})).toBe(false);expect(isTestOffer({...legacy,code:'REAL_PLAN',testOnly:true})).toBe(true);});
 it('blocks marked offers from new quotes',()=>{const offers=suggestedOffers().map(o=>o.code==='BASIC'?{...o,testOnly:true}:o);expect(()=>calculateQuote({offers,planCode:'BASIC',modules:[],cycle:'MONTHLY',promotions:[],at:'2026-09-18',installment:1})).toThrow(/indisponível/);});
 it('preserves legitimate custom plans beyond defaults',()=>{const offers=suggestedOffers();const custom={...offers.find(o=>o.code==='BASIC')!,code:'REAL_CUSTOM',name:'Plano especial'};expect(contractableOffers([...offers,custom])).toContain(custom);});
 it.each(['missing','inactive','test'])('hides plans requiring %s module',mode=>{const offers=suggestedOffers().flatMap(o=>o.code!=='SALES'?[o]:mode==='missing'?[]:[{...o,active:mode!=='inactive',testOnly:mode==='test'}]);expect(contractableOffers(offers).some(o=>o.kind==='PLAN'&&o.modules.includes('SALES'))).toBe(false);});
});
