const labels:Record<string,string>={
 'subscription.created':'Assinatura criada','subscription.changed':'Plano ou condições da assinatura alterados',
 'subscription.active':'Assinatura ativada','subscription.trial':'Período de teste iniciado','subscription.suspended':'Assinatura suspensa',
 'subscription.canceled':'Assinatura cancelada','subscription.expired':'Assinatura encerrada','subscription.pending_payment':'Assinatura aguardando pagamento','subscription.past_due':'Assinatura em atraso',
 'subscription.change.scheduled':'Alteração de plano agendada','subscription.schedule.materialized':'Alteração agendada aplicada',
 'invoice.created':'Cobrança criada','invoice.open':'Cobrança aberta','invoice.paid':'Pagamento confirmado','invoice.waived':'Isenção concedida',
 'invoice.canceled':'Cobrança cancelada','invoice.draft.corrected':'Rascunho de cobrança corrigido',
 'subscription.requested':'Solicitação comercial recebida','subscription.request.approved':'Solicitação aprovada','subscription.request.rejected':'Solicitação recusada',
 'catalog.initialized':'Catálogo comercial configurado','offer.version.created':'Nova versão de oferta criada','discount.version.created':'Desconto atualizado','coupon.updated':'Cupom atualizado','coupon.redeemed':'Cupom utilizado',
 ACTIVE:'Ativa',PENDING:'Pendente',REJECTED:'Recusada',INACTIVE:'Inativa',TRIAL:'Em teste',PENDING_PAYMENT:'Aguardando pagamento',PAST_DUE:'Em atraso',SUSPENDED:'Suspensa',CANCELED:'Cancelada',EXPIRED:'Expirada',DRAFT:'Rascunho',OPEN:'Em aberto',PAID:'Paga',OVERDUE:'Vencida',WAIVED:'Isenta',NONE:'Sem cobrança',NOT_CONTRACTED:'Sem assinatura'
};
export const commercialLabel=(value:string)=>labels[value]??'Atualização comercial';
