import { describe, it, expect, vi } from 'vitest';
import { recommend, SERVICES, SEGMENT_PLANS } from './portfolio.catalog.js';
import { PortfolioService, ResendLeadTransport } from './portfolio.module.js';

describe('Orientação comercial',()=>{
 it('recomenda apenas a necessidade identificada',()=>expect(recommend('Preciso controlar meu estoque e a reposição dos produtos.').modules.map(m=>m.code)).toEqual(['INVENTORY']));
 it('não inventa solução para relato inconclusivo',()=>expect(recommend('Quero melhorar a rotina do meu negócio.').kind).toBe('DISCOVERY'));
 it('respeita negação explícita',()=>expect(recommend('Não quero estoque. Quero uma vitrine para divulgar produtos.').modules.map(m=>m.code)).toEqual(['LANDING_PAGE']));
 it('deduplica escolhas e não acrescenta dependências',()=>expect(recommend('', ['SALES','SALES']).modules.map(m=>m.code)).toEqual(['SALES']));
 it('sugere pacote somente quando a composição coincide',()=>{expect(recommend('',SEGMENT_PLANS[0].modules).plan?.code).toBe('RETAIL');expect(recommend('',['SALES','INVENTORY']).plan).toBeNull();});
 it('catálogo público não contém preços',()=>expect(JSON.stringify({SERVICES,SEGMENT_PLANS})).not.toMatch(/Cents|price|R\$/));
 it('identifica integrações externas sem simular disponibilidade',()=>expect(recommend('Preciso emitir nota fiscal para os meus pedidos.').modules.find(m=>m.code==='FISCAL_ISSUANCE')?.state).toBe('EXTERNAL'));
});
describe('Fila de e-mail',()=>{
 const make=(send:any,attempts=1,firstAttemptAt?:Date)=>{
  const lead={_id:'id',attempts,firstAttemptAt};const model={findOneAndUpdate:vi.fn().mockResolvedValue(lead),updateOne:vi.fn().mockResolvedValue({})};
  const email={configured:()=>true,send};return {model,email,service:new PortfolioService(model as any,{} as any,{} as any,email)};
 };
 it('registra aceite do provedor, sem declarar entrega ao destinatário',async()=>{const {service,model}=make(vi.fn().mockResolvedValue('receipt'));await service.deliver();expect(model.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({attempts:1}),expect.objectContaining({$set:{emailStatus:'ACCEPTED',providerId:'receipt'}}));});
 it('mantém tentativa com falha para repetição limitada',async()=>{const {service,model}=make(vi.fn().mockRejectedValue(new Error('secret')));await service.deliver();expect(model.updateOne.mock.calls.at(-1)?.[1].$set.emailStatus).toBe('PENDING');expect(JSON.stringify(model.updateOne.mock.calls)).not.toContain('secret');});
 it('interrompe após limite de tentativas',async()=>{const {service,model}=make(vi.fn().mockRejectedValue(new Error()),5);await service.deliver();expect(model.updateOne.mock.calls.at(-1)?.[1].$set.emailStatus).toBe('FAILED');});
 it('recupera lease abandonado no limite sem reenviar',async()=>{const send=vi.fn();const {service,model}=make(send,6);await service.deliver();expect(send).not.toHaveBeenCalled();expect(model.updateOne.mock.calls.at(-1)?.[1].$set.emailStatus).toBe('FAILED');});
 it('não repete fora da janela de idempotência',async()=>{const send=vi.fn();const {service}=make(send,2,new Date(Date.now()-21*3600000));await service.deliver();expect(send).not.toHaveBeenCalled();});
 it('não envia e-mails reais em ambiente de testes',()=>{vi.stubEnv('NODE_ENV','test');vi.stubEnv('LEAD_EMAIL_ENABLED','true');try{expect(new ResendLeadTransport().configured()).toBe(false);}finally{vi.unstubAllEnvs();}});
});
