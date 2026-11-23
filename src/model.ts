import type {Dataset,Role} from './data';
export type Scenario={growth:number;automation:number;productivity:number;attrition:number;hiringCapacity:number;payInflation:number};
export const defaults:Scenario={growth:0,automation:0,productivity:0,attrition:0,hiringCapacity:75,payInflation:0};
export type RoleResult={role_id:string;role_title:string;department:string;criticality:string;demand:number;openingSupply:number;organicSupply:number;hired:number;endingSupply:number;gap:number;grossCost:number;automation:number;year:number};
export type YearResult={year:number;demand:number;organicSupply:number;supply:number;gap:number;hired:number;exits:number;laborCost:number;hiringCost:number;totalCost:number;unfilled:number;rows:RoleResult[]};
export type ModelResult={years:YearResult[];headcount:number;baseFte:number;startingAnnualCost:number;departments:{name:string;demand:number;supply:number;gap:number;cost:number}[];currency:string};
export const pct=(v:number)=>`${(v*100).toFixed(1)}%`;
export const compact=(x:number,currency?:string)=>{if(currency){try{return new Intl.NumberFormat('en',{style:'currency',currency,notation:'compact',maximumFractionDigits:1}).format(x)}catch {return `${currency} ${Math.round(x).toLocaleString()}`;}}return new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(x)};
const clamp=(x:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,x));
const key=(id:string,year:number)=>`${id}|${year}`;
export function runModel(data:Dataset,scenario:Scenario):ModelResult {
 const years=[...new Set(data.workloads.map(f=>f.year))].sort((a,b)=>a-b);
 const roles=data.roles;
 const supply=new Map<string,number>();const avgCost=new Map<string,number>();
 const totalFte=new Map<string,number>();const costs=new Map<string,number>();
 for(const emp of data.employees){const fte=Number(emp.fte);totalFte.set(emp.role_id,(totalFte.get(emp.role_id)||0)+fte);costs.set(emp.role_id,(costs.get(emp.role_id)||0)+Number(emp.annual_base_pay)+Number(emp.annual_variable_pay)+Number(emp.annual_benefits_cost));}
 for(const role of roles){supply.set(role.role_id,totalFte.get(role.role_id)||0);avgCost.set(role.role_id,(costs.get(role.role_id)||0)/(totalFte.get(role.role_id)||1));}
 const forecasts=new Map(data.workloads.map(f=>[key(f.role_id,f.year),f]));const assumptions=new Map(data.assumptions.map(a=>[a.year,a]));
 const output:YearResult[]=[];
 years.forEach((year,i)=>{
  const a=assumptions.get(year);if(!a)return;
  const attrition=clamp(a.attrition_rate+scenario.attrition/100,0,0.9);
  const inflation=clamp(a.salary_inflation_pct+scenario.payInflation/100,-0.3,1);
  // First calculate all demand and pre-hire supply. Then allocate capped hiring capacity to critical shortages.
  const preliminary=roles.map((r:Role)=>{
   const f=forecasts.get(key(r.role_id,year));
   const auto=clamp((Number(f?.planned_automation_pct)||0)+scenario.automation/100,0,Number(r.max_automatable_share));
   const prod=Number(r.monthly_units_per_fte)*Math.pow(1+scenario.productivity/100,i+1);
   const demand=((Number(f?.monthly_workload_units)||0)*(1+scenario.growth/100)*(1-auto))/Math.max(0.001,prod);
   const openingSupply=supply.get(r.role_id)||0; const organicSupply=openingSupply*(1-attrition);
   return {r,demand,openingSupply,organicSupply,auto,shortage:Math.max(0,demand-organicSupply)};
  });
  const vacancies=preliminary.reduce((s,r)=>s+r.shortage,0);
  const cap=vacancies*clamp(scenario.hiringCapacity/100,0,1);
  const priority=(v:string)=>v.toLowerCase()==='high'?3:v.toLowerCase()==='medium'?2:1;
  let remaining=cap;
  const hired=new Map<string,number>();
  for(const p of [...preliminary].sort((a,b)=>priority(b.r.criticality)-priority(a.r.criticality)||b.shortage-a.shortage)){
   const n=Math.min(remaining,p.shortage);hired.set(p.r.role_id,n);remaining-=n;
  }
  const rows:RoleResult[]=preliminary.map(p=>{
   const h=hired.get(p.r.role_id)||0;const endingSupply=p.organicSupply+h;
   const oldCost=avgCost.get(p.r.role_id)||0;const nextCost=oldCost*(1+inflation);avgCost.set(p.r.role_id,nextCost);supply.set(p.r.role_id,endingSupply);
   return {role_id:p.r.role_id,role_title:p.r.role_title,department:p.r.department,criticality:p.r.criticality,demand:p.demand,openingSupply:p.openingSupply,organicSupply:p.organicSupply,hired:h,endingSupply,gap:p.demand-endingSupply,grossCost:endingSupply*nextCost*(1+a.employer_overhead_pct),automation:p.auto,year};
  });
  const sum=(fn:(r:RoleResult)=>number)=>rows.reduce((s,r)=>s+fn(r),0);
  const hires=sum(r=>r.hired);const laborCost=sum(r=>r.grossCost);const hiringCost=hires*a.hiring_cost_per_joiner;
  output.push({year,demand:sum(r=>r.demand),organicSupply:sum(r=>r.organicSupply),supply:sum(r=>r.endingSupply),gap:sum(r=>r.gap),hired:hires,exits:sum(r=>r.openingSupply)*attrition,laborCost,hiringCost,totalCost:laborCost+hiringCost,unfilled:sum(r=>Math.max(0,r.gap)),rows});
 });
 const last=output.at(-1);const dep=new Map<string,{name:string;demand:number;supply:number;gap:number;cost:number}>();
 for(const row of last?.rows||[]){const current=dep.get(row.department)||{name:row.department,demand:0,supply:0,gap:0,cost:0};current.demand+=row.demand;current.supply+=row.endingSupply;current.gap+=row.gap;current.cost+=row.grossCost;dep.set(row.department,current);}
 return {years:output,headcount:data.employees.length,baseFte:[...totalFte.values()].reduce((a,b)=>a+b,0),startingAnnualCost:[...costs.values()].reduce((a,b)=>a+b,0),departments:[...dep.values()].sort((a,b)=>b.demand-a.demand),currency:data.currency};
}
export function buildBrief(model:ModelResult){
 const last=model.years.at(-1);if(!last)return ['Load a valid dataset to generate decision insights.'];
 const maxRisk=[...last.rows].filter(r=>r.gap>0).sort((a,b)=>b.gap-a.gap).slice(0,3);
 const first=model.years[0];const costDelta=first?((last.totalCost/Math.max(1,first.totalCost))-1):0;
 const messages=[`By ${last.year}, modeled workforce demand is ${Math.round(last.demand).toLocaleString()} FTE against ${Math.round(last.supply).toLocaleString()} projected available FTE. The net gap is ${Math.round(last.gap).toLocaleString()} FTE.`,
 `The model adds approximately ${Math.round(model.years.reduce((s,y)=>s+y.hired,0)).toLocaleString()} FTE through hiring across the forecast horizon. This is an assumed staffing intervention, not an observed hiring forecast.`,
 `Total modeled annual workforce cost changes ${costDelta>=0?'up':'down'} ${Math.abs(costDelta*100).toFixed(1)}% between ${first?.year} and ${last.year}; compare this with budget and business output before approving the plan.`];
 if(maxRisk.length)messages.push(`Highest unresolved shortages: ${maxRisk.map(r=>`${r.role_title} (${Math.ceil(r.gap)} FTE)`).join(', ')}. Prioritize job-design review, internal mobility, reskilling, and targeted recruitment.`);
 else messages.push('No positive role-level shortage remains after modeled hiring; assess potential surplus, deployment quality, and the affordability of this plan.');
 messages.push('Method note: workload-based demand, role-level attrition and capped automation are deterministic scenarios. No machine-learning forecast or validated AI recommendation is claimed.');
 return messages;
}
export function exportCsv(model:ModelResult){const rows=[['year','role_id','role_title','department','demand_fte','organic_supply_fte','hires_fte','ending_supply_fte','gap_fte','annual_labor_cost'],...model.years.flatMap(y=>y.rows.map(r=>[y.year,r.role_id,r.role_title,r.department,r.demand.toFixed(2),r.organicSupply.toFixed(2),r.hired.toFixed(2),r.endingSupply.toFixed(2),r.gap.toFixed(2),r.grossCost.toFixed(0)]))];return rows.map(r=>r.map(v=>{const cell=String(v);const dangerous=/^[=+@\-\t\r]/.test(cell) && !/^-?\d+(\.\d+)?$/.test(cell);const safe=dangerous?"'"+cell:cell;return `"${safe.replaceAll('"','""')}"`;}).join(',')).join('\n');}
