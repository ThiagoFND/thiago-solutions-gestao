export function validateDependencies(tasks:{id:string;dependencies:string[]}[],id:string,dependencies:string[]){
 const graph=new Map(tasks.map(t=>[t.id,t.dependencies]));graph.set(id,dependencies);
 if(dependencies.some(d=>!graph.has(d)||d===id))throw new Error('Dependência inválida.');
 const visiting=new Set<string>(),done=new Set<string>();
 function visit(node:string){if(visiting.has(node))throw new Error('Dependência circular.');if(done.has(node))return;visiting.add(node);for(const dependency of graph.get(node)??[])visit(dependency);visiting.delete(node);done.add(node);}
 for(const node of graph.keys())visit(node);
}
export function timeMinutes(start:string,end:string,now=new Date()){
 if(![start,end].every(d=>/(Z|[+-]\d{2}:\d{2})$/.test(d)))throw new Error('Informe o fuso do período.');
 const a=new Date(start).getTime(),b=new Date(end).getTime(),duration=b-a;
 if(!Number.isFinite(duration)||duration<=0||duration>86400000||duration%60000!==0||b>now.getTime())throw new Error('Use minutos completos, no passado, até 24 horas por apontamento.');return duration/60000;
}
