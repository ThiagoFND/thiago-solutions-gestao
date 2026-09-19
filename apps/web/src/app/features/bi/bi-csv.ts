/** Fixed four-column import, not arbitrary expressions or executable spreadsheet content. */
export function parseBiCsv(input:string,unit:string){
 if(input.length>500000)throw new Error('O arquivo excede 500 mil caracteres.');
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 const text=input.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field.length)throw new Error('Aspas inválidas no CSV.');else quoted=!quoted;}else if(!quoted&&(c===';'||c==='\n')){row.push(field);field='';if(c==='\n'){rows.push(row);row=[];}}else if(c!=='\r'||quoted)field+=c;}
 if(quoted)throw new Error('Aspas não fechadas no CSV.');if(field||row.length){row.push(field);rows.push(row);}
 if(rows.shift()?.map(s=>s.trim().toLowerCase()).join(';')!=='chave;data;valor;categoria')throw new Error('Use o cabeçalho chave;data;valor;categoria.');
 const data=rows.filter(r=>r.some(v=>v.trim()));if(!data.length||data.length>500)throw new Error('Importe de 1 a 500 linhas por vez.');
 const keys=new Set<string>();return data.map((r,i)=>{if(r.length!==4)throw new Error(`Linha ${i+2}: use quatro colunas.`);const [key,date,raw,category]=r.map(s=>s.trim());if(!/^[A-Za-z0-9_.:-]{1,100}$/.test(key)||keys.has(key))throw new Error(`Linha ${i+2}: chave inválida ou repetida.`);keys.add(key);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error(`Linha ${i+2}: data inválida.`);return {key,date,value:biValue(raw,unit),category};});
}
export function biValue(raw:string,unit:string){
 const pattern=unit==='BRL_CENTS'?/^-?\d+(?:[.,]\d{1,2})?$/:/^-?\d+$/;if(!pattern.test(raw.trim()))throw new Error('Valor inválido. Use reais com até duas casas, ou número inteiro para unidades/minutos.');const value=unit==='BRL_CENTS'?Math.round(Number(raw.replace(',','.'))*100):Number(raw);if(!Number.isSafeInteger(value)||Math.abs(value)>1e12)throw new Error('Valor fora do limite.');return value;
}
