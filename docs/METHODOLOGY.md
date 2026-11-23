# Methodology, assumptions and interpretive guardrails

## Input contract and timing

The employee table is a snapshot (`Settings.snapshot_date`). Employee-level compensation amounts represent **annual total money amounts for each row**, with FTE used only for capacity and allocation. `Roles.monthly_units_per_fte` is monthly throughput per full FTE. `Workload_Forecast.monthly_workload_units` must be in the matching work unit for the same role. Avoid mixing unrelated workloads in one role. Forecast years should be consecutive, but the importer currently flags gaps as a warning and treats sequential available forecast rows as one planning period each.

## Demand equation

For role *r*, year-index *t*:

- Effective automation = clip(imported planned automation + scenario automation delta, **0**, role maximum automatable share).
- Effective monthly productivity = role monthly units/FTE × (1 + scenario productivity uplift)^(t+1).
- Demand FTE = workload units × (1 + scenario workload adjustment) × (1 − effective automation) / effective monthly productivity.

FTE is **not rounded** in internal calculations; the UI rounds for display. Assumes annual average monthly workload and equivalent productive FTE across the forecast. No seasonality, learning time, role substitution or overtime model is included.

## Supply equation and hiring intervention

- Opening FTE is sum of current employee FTE within a role for the first forecast year, then previous-year ending supply for following years.
- Effective attrition = clip(annual imported attrition + scenario delta, 0, 0.90).
- Pre-hire supply = opening FTE × (1 − effective attrition).
- Vacancy = max(0, demand − pre-hire supply).
- Total available modeled hiring = sum of all role vacancies × scenario hiring fulfillment percentage (0–100%).
- Hiring is allocated to role shortages in descending role criticality (`High`, `Medium`, other) then shortage magnitude.
- Ending supply = pre-hire supply + allocated hires.
- Signed gap = demand − ending supply. Total **unfilled role-level shortages** = sum of max(0, role gap). This differs from the net enterprise-level signed gap when some roles have surplus.

This is an explicit policy simulation: **hiring capacity is an input**, not a forecast of actual recruitment capability. Attrition applies uniformly to all roles. No redeployment is automatically assumed. Role capacity surplus is not silently reassigned to shortages elsewhere.

## Financial cost equation

- Snapshot cost per role FTE = sum across employees of (annual base pay + variable pay + benefits) / sum of role FTE.
- Each role's average cost per FTE is inflated yearly by (1 + imported salary inflation + scenario delta), clipped to −30% to +100%.
- Annual role labor cost = projected ending supply FTE × inflated role cost per FTE × (1 + employer overhead rate).
- Hiring cost = total modeled hired FTE × hiring cost per joiner. This treats fractional FTE hiring proportionally.
- Total projected annual spend = sum labor cost + hiring cost.

**Limitations:** Salary inflation is applied to all compensation components; the model assumes equal role-average cost for employees and new hires. It does not incorporate midpoint movement, compensation bands, taxes, contractor rate comparisons, training spend, severance, FX, absence, variable pay variability, time-to-fill, ramp-to-productivity, tenure, or recruiting cohorts. `training_cost_per_employee` is in the workbook for future expansion but is **not included** in cost calculations. The dashboard explicitly says so.

## Interpretation and safeguards

- Forecast results are **conditional scenario calculations**, not machine-learning predictions or evidence of causal impacts.
- No employment, termination, compensation or adverse-impact decisions should be made from this product alone.
- Evaluate legal constraints, employee impact, fairness, labor policy and financial validation before using scenario output for enterprise decisions.
- No worker names or personal identifiers beyond pseudonymous keys are required.
- No generative AI analysis, prompt endpoint, or external LLM data transfer is included.

## Suggested extensions

1. Aggregate-only upload mode and configurable fiscal calendars.
2. Historical actuals, forecast backtesting and uncertainty intervals.
3. Role-level hiring capacity limits, ramp-up timing and skills substitution constraints.
4. Separate reskilling, contractors and outsourcing interventions with incremental cost.
5. Formal constraint optimization, audit logs, sensitivity bands and enterprise access controls.

## Added scenario benchmark and executive metrics (v2)

The **baseline scenario** is computed from the same workbook and the documented default scenario sliders (zero deltas, 75% hiring fulfillment). Therefore it is an analytical comparison, not an externally validated business-as-usual forecast.

- **Demand coverage** = max(0, 1 − positive role-level gaps / total role FTE demand), if demand > 0; otherwise defined as 100% to indicate no modeled unmet demand. This is a staffing proxy, not a service-level KPI.
- **Gross role-level surplus** = sum across roles of max(0, ending supply − required FTE). Never offset this from shortages without a skill/role substitution decision.
- **Annual cost difference** = baseline annual spend − selected scenario annual spend; positive means the selected scenario is cheaper for that year.
- **Change in unmet demand** = baseline unfilled FTE − selected unfilled FTE; positive means fewer uncovered roles in selected scenario.
- **Cost per available FTE** = annual workforce spend / projected available FTE; mixes recurring labor and one-time hiring costs and should be labeled accordingly.

If cost savings come from unresolved shortages, do not present them as productivity or efficiency gains without measuring business impact.
