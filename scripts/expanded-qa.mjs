import assert from 'node:assert/strict';
import { guard } from './tenancy-qa-harness.mjs';
export async function grantModules(qa, company, modules) {
  guard();
  assert(!qa.existedBefore('tenants_v2', company.tenant._id), 'Only new QA companies may receive synthetic contracts');
  return qa.connection.models.CommercialSubscription.create({tenantId:company.tenant._id,version:1,status:'ACTIVE',startsAt:new Date('2026-01-01'),endsAt:new Date('2099-01-01'),nextDueAt:new Date('2026-10-01'),snapshot:{cycle:'MONTHLY',currency:'BRL',planCode:'QA_'+qa.run,modules,limits:{activeUsers:25,products:1000,categories:100,storageBytes:1e9,landingPages:1},items:[],subtotalCents:0,discountCents:0,totalCents:0,afterPromotionCents:0,applied:[],rejected:[],dependenciesAdded:[],quotedAt:new Date().toISOString()},promotions:[],installment:1,actorId:company.owner.id});
}
export async function ok(session, method, path, body, status=method==='post'?201:200) {
  const r=await session.api(method,path,body);assert.equal(r.status,status,`${path}: ${JSON.stringify(r.body).slice(0,350)}`);return r.body;
}
