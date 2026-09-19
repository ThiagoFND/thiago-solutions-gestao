import { describe,it,expect } from 'vitest';
import { validateAssessment } from './quality.module.js';
const valid=()=>({decision:'APPROVED',assessments:['IDENTITY','PACKAGING','CONDITION','VALIDITY'].map(code=>({code,result:'PASS'}))});
describe('Avaliação para reposição',()=>{
 it('aceita avaliação completa e prazo válido',()=>expect(()=>validateAssessment(valid(),'2099-12-31')).not.toThrow());
 it('não permite validade vencida',()=>expect(()=>validateAssessment(valid(),'2020-01-01')).toThrow());
 it('não aprova identidade ou condição não verificadas',()=>{for(const index of [0,2]){const d=valid();d.assessments[index].result='NOT_APPLICABLE';expect(()=>validateAssessment(d)).toThrow();}});
 it('não libera um item com qualquer falha',()=>{for(let i=0;i<4;i++){const d=valid();d.assessments[i].result='FAIL';expect(()=>validateAssessment(d)).toThrow();}});
 it('recusa avaliações repetidas ou ausentes',()=>{const d=valid();d.assessments[1].code='IDENTITY';expect(()=>validateAssessment(d)).toThrow();});
 it('reprovação preserva a evidência de não conformidade',()=>{const d=valid();d.decision='REJECTED';d.assessments[0].result='FAIL';expect(()=>validateAssessment(d,'2020-01-01')).not.toThrow();});
});
