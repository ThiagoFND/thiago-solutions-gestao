export function balancedTotal(lines:{debitCents:number;creditCents:number}[]) {
 if(lines.length<2||lines.length>50)throw new Error('Informe entre 2 e 50 partidas.');
 let debit=0,credit=0;
 for(const line of lines){if(![line.debitCents,line.creditCents].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e12)||!((line.debitCents>0)!==(line.creditCents>0)))throw new Error('Cada partida deve ter somente débito ou crédito positivo.');debit+=line.debitCents;credit+=line.creditCents;}
 if(!Number.isSafeInteger(debit)||!Number.isSafeInteger(credit)||debit!==credit||debit<=0)throw new Error('Débitos e créditos devem ser iguais e positivos.');
 return debit;
}
