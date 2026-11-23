import {readSheet} from 'read-excel-file/browser';

export type Employee={employee_id:string;role_id:string;department:string;location:string;fte:number;annual_base_pay:number;annual_variable_pay:number;annual_benefits_cost:number};
export type Role={role_id:string;role_title:string;department:string;work_unit:string;monthly_units_per_fte:number;max_automatable_share:number;criticality:string};
export type Forecast={role_id:string;year:number;monthly_workload_units:number;planned_automation_pct:number};
export type Assumption={year:number;attrition_rate:number;salary_inflation_pct:number;hiring_cost_per_joiner:number;training_cost_per_employee:number;employer_overhead_pct:number};
export type Dataset={employees:Employee[];roles:Role[];workloads:Forecast[];assumptions:Assumption[];currency:string;snapshot:string;source:string};
export type ValidationIssue={level:'error'|'warning';sheet:string;row:number;message:string};
export type ValidationResult={data?:Dataset;issues:ValidationIssue[];counts:Record<string,number>};
export const sheetDefs:Record<string,string[]>={
 Employees:['employee_id','role_id','department','location','fte','annual_base_pay','annual_variable_pay','annual_benefits_cost'],
 Roles:['role_id','role_title','department','work_unit','monthly_units_per_fte','max_automatable_share','criticality'],
 Workload_Forecast:['role_id','year','monthly_workload_units','planned_automation_pct'],
 Assumptions:['year','attrition_rate','salary_inflation_pct','hiring_cost_per_joiner','training_cost_per_employee','employer_overhead_pct'],
 Settings:['setting','value']
};
const numeric:Record<string,string[]>={Employees:['fte','annual_base_pay','annual_variable_pay','annual_benefits_cost'],Roles:['monthly_units_per_fte','max_automatable_share'],Workload_Forecast:['year','monthly_workload_units','planned_automation_pct'],Assumptions:['year','attrition_rate','salary_inflation_pct','hiring_cost_per_joiner','training_cost_per_employee','employer_overhead_pct']};
const rateFields=new Set(['max_automatable_share','planned_automation_pct','attrition_rate','salary_inflation_pct','employer_overhead_pct']);
const nonnegFields=new Set(['annual_base_pay','annual_variable_pay','annual_benefits_cost','monthly_workload_units','hiring_cost_per_joiner','training_cost_per_employee']);
const issue=(arr:ValidationIssue[],level:'error'|'warning',sheet:string,row:number,message:string)=>{if(arr.length<250)arr.push({level,sheet,row,message});};
const clean=(x:unknown)=>String(x??'').trim();
type RawRows = (string|number|boolean|Date|null)[][];
function normalizeRows(raw:RawRows, headers:string[]):Record<string,unknown>[] {
 return raw.slice(1).map((values,i)=>Object.fromEntries([...headers.map((h,k)=>[h,values[k]??'']),['__row',i+2]]))
 .filter(row=>headers.some(h=>h&&clean(row[h])!==''));
}
export async function parseWorkbook(buffer:ArrayBuffer, source='Uploaded workbook'):Promise<ValidationResult> {
 const issues:ValidationIssue[]=[];const counts:Record<string,number>={};
 const mapped:Record<string,Record<string,unknown>[]>={};
 // Only the five documented, read-only data tabs are parsed. The file is never sent to a server.
 for(const [tab,expected] of Object.entries(sheetDefs)){
  let raw:RawRows;
  try {raw=await readSheet(buffer,tab) as RawRows;}
  catch (err) {
   const detail=err instanceof Error?err.message:'';
   issue(issues,'error',tab,1,detail.toLowerCase().includes('sheet')?`Missing or unreadable worksheet “${tab}”.`:`Workbook could not be read (${tab}). Confirm this is a valid .xlsx file.`);
   continue;
  }
  if(raw.length>20006){issue(issues,'error',tab,2,'More than 20,000 rows in one worksheet; split or aggregate the data.');continue;}
  const headers=(raw[0]||[]).map(clean);
  for(const col of expected)if(!headers.includes(col))issue(issues,'error',tab,1,`Missing required column “${col}”.`);
  if(headers.some((h,i)=>h&&headers.indexOf(h)!==i))issue(issues,'error',tab,1,'Duplicate column headers are not permitted.');
  mapped[tab]=normalizeRows(raw,headers);counts[tab]=mapped[tab].length;
  if(!mapped[tab].length)issue(issues,'error',tab,2,'No data rows found.');
  for(const row of mapped[tab]){
    const r=Number(row.__row);
    for(const col of expected){const value=row[col];if(col!=='value'&&clean(value)==='')issue(issues,'error',tab,r,`${col} is required.`);}
    for(const col of numeric[tab]||[]){
      const val=row[col];if(clean(val)==='')continue;
      const n=Number(val);
      if(!Number.isFinite(n))issue(issues,'error',tab,r,`${col} must be a number.`);
      else if(rateFields.has(col)&&(n<0||n>1))issue(issues,'error',tab,r,`${col} must be a decimal between 0 and 1 (e.g. 0.12 for 12%).`);
      else if(nonnegFields.has(col)&&n<0)issue(issues,'error',tab,r,`${col} cannot be negative.`);
      else if(col==='fte'&&(n<=0||n>1.5))issue(issues,'error',tab,r,'fte must be greater than 0 and no more than 1.5.');
      else if(col==='monthly_units_per_fte'&&n<=0)issue(issues,'error',tab,r,'Productivity must be greater than 0.');
      if(col==='year'&&!Number.isInteger(n))issue(issues,'error',tab,r,'year must be a whole number.');
    }
  }
 }
 if(issues.some(x=>x.level==='error'))return {issues,counts};
 const e=mapped.Employees as unknown as Employee[];const r=mapped.Roles as unknown as Role[];const f=mapped.Workload_Forecast as unknown as Forecast[];const a=mapped.Assumptions as unknown as Assumption[];
 const settings=new Map(mapped.Settings.map(v=>[clean(v.setting),clean(v.value)]));
 const currency=settings.get('currency_code')||''; const snapshot=settings.get('snapshot_date')||'';
 if(!/^[A-Z]{3}$/.test(currency))issue(issues,'error','Settings',2,'currency_code must be a three-letter ISO code (e.g. INR, USD).');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(snapshot)||!Number.isFinite(Date.parse(snapshot)))issue(issues,'error','Settings',3,'snapshot_date must be YYYY-MM-DD.');
 const roleIds=new Set<string>();
 for(const role of r){if(roleIds.has(clean(role.role_id)))issue(issues,'error','Roles',Number((role as unknown as Record<string,unknown>).__row),`Duplicate role_id: ${role.role_id}`);roleIds.add(clean(role.role_id));}
 const employees=new Set<string>();
 for(const emp of e){const n=Number((emp as unknown as Record<string,unknown>).__row);if(employees.has(clean(emp.employee_id)))issue(issues,'error','Employees',n,`Duplicate employee_id: ${emp.employee_id}`);employees.add(clean(emp.employee_id));if(!roleIds.has(clean(emp.role_id)))issue(issues,'error','Employees',n,`Unknown role_id: ${emp.role_id}`);const role=r.find(v=>v.role_id===emp.role_id);if(role&&clean(role.department)!==clean(emp.department))issue(issues,'warning','Employees',n,`Employee department differs from Roles (${role.department}).`);}
 const forecastKeys=new Set<string>();const years=new Set<number>();
 for(const item of f){const n=Number((item as unknown as Record<string,unknown>).__row);const key=`${item.role_id}|${item.year}`;if(forecastKeys.has(key))issue(issues,'error','Workload_Forecast',n,`Duplicate role/year: ${key}`);forecastKeys.add(key);years.add(Number(item.year));if(!roleIds.has(clean(item.role_id)))issue(issues,'error','Workload_Forecast',n,`Unknown role_id: ${item.role_id}`);const role=r.find(v=>v.role_id===item.role_id);if(role&&Number(item.planned_automation_pct)>Number(role.max_automatable_share))issue(issues,'warning','Workload_Forecast',n,'Planned automation exceeds role cap; engine will cap it.');}
 if(years.size>10)issue(issues,'error','Workload_Forecast',2,'Maximum 10 forecast years supported.');
 const assumptionsYears=new Set<number>();for(const item of a){const n=Number((item as unknown as Record<string,unknown>).__row);if(assumptionsYears.has(Number(item.year)))issue(issues,'error','Assumptions',n,`Duplicate year: ${item.year}`);assumptionsYears.add(Number(item.year));}
 for(const y of years){if(!assumptionsYears.has(y))issue(issues,'error','Assumptions',2,`Missing assumptions for ${y}.`);for(const role of r)if(!forecastKeys.has(`${role.role_id}|${y}`))issue(issues,'error','Workload_Forecast',2,`Missing workload for ${role.role_id} in ${y}.`);}
 const sortedYears=[...years].sort((x,y)=>x-y);if(sortedYears.some(y=>y<=Number(snapshot.slice(0,4))))issue(issues,'error','Workload_Forecast',2,'Forecast years must be later than the snapshot year.');if(sortedYears.some((year,i)=>i&&year!==sortedYears[i-1]+1))issue(issues,'error','Workload_Forecast',2,'Forecast years are not consecutive; time-based calculations treat each row as one planning period.');
 if(!e.length||!r.length||!f.length||!a.length)issue(issues,'error','Workbook',0,'All core tables must contain data.');
 if(e.length>15000)issue(issues,'error','Employees',2,'Maximum 15,000 employees supported in browser demo.');
 if(e.length<20)issue(issues,'warning','Employees',2,'Small sample: workforce rates may be unstable.');
 if(issues.some(x=>x.level==='error'))return {issues,counts};
 const num=(items:Record<string,unknown>[],keys:string[])=>items.map(row=>{const copy={...row};delete copy.__row;for(const k of keys)copy[k]=Number(copy[k]);return copy;});
 return {issues,counts,data:{employees:num(e as unknown as Record<string,unknown>[],numeric.Employees) as unknown as Employee[],roles:num(r as unknown as Record<string,unknown>[],numeric.Roles) as unknown as Role[],workloads:num(f as unknown as Record<string,unknown>[],numeric.Workload_Forecast) as unknown as Forecast[],assumptions:num(a as unknown as Record<string,unknown>[],numeric.Assumptions) as unknown as Assumption[],currency,snapshot,source}};
}
