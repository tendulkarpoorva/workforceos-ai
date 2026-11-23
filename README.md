# WorkforceOS | Workforce Decision Intelligence

**A deployable, self-service strategic workforce planning application.** Built for an executive demonstration and designed to analyze other users' data—not just a fixed demo.

## What is included

- Responsive executive cockpit with workforce demand/supply, cost outlook, department mix and strategic signals.
- **Excel Data Studio**: downloadable blank template and populated synthetic sample, drag-and-drop import, row-level validations, cross-tab checks, and on-screen data health.
- Multi-year FTE forecasting by role, workload, labor productivity, capped automation, attrition, and hiring capacity.
- Interactive Scenario Lab for demand, automation, productivity, attrition, recruiting feasibility and salary inflation.
- Role capacity explorer, department charts, role-gap table, CSV output, financial cost modeling.
- Calculation-led **Metrics & Methodology** page: 14 transparent formulas, a live worked example and a downloadable executive decision brief.
- Baseline-versus-selected scenario comparisons for annual workforce spend, unfilled role demand, hiring and total FTE requirements.
- **No generative AI tab, AI endpoint, API key or AI service dependency.**
- Local-first employee data import and analysis: no browser storage or database persistence.

## Run it locally

Requirements: **Node.js 22.12+** (required by the updated Vite build tooling).

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite. The demo workbook loads automatically on first visit.

## Deploy on Vercel (recommended)

1. Extract `WorkforceOS_AI_Project.zip` on your computer.
2. Create a GitHub repository and upload **the contents of the `workforceos-ai` directory** (not the ZIP alone). Use GitHub Desktop, `git push`, or upload files via browser.
3. In [Vercel](https://vercel.com/new), import the GitHub repository.
4. Framework preset: **Vite**; Build command: `npm run build`; Output directory: `dist` (also specified in `vercel.json`).
5. Deploy. The site will load its bundled fictional enterprise workbook automatically.
6. No environment variables or AI API keys are required.

The application requires no backend database and no credentials for its deterministic dashboards and simulations.

## Excel import requirements

Download either file from the site's Data Studio, or from `/public` in this project:

- `WorkforceOS_AI_Excel_Template.xlsx` — clear blank template with `START_HERE` and `FIELD_DICTIONARY`.
- `WorkforceOS_AI_Sample_Dataset.xlsx` — fictional enterprise data ready to analyze.

**Exact parsed sheet names and headers:**

| Worksheet | Column names (row 1) |
|---|---|
| `Employees` | `employee_id`, `role_id`, `department`, `location`, `fte`, `annual_base_pay`, `annual_variable_pay`, `annual_benefits_cost` |
| `Roles` | `role_id`, `role_title`, `department`, `work_unit`, `monthly_units_per_fte`, `max_automatable_share`, `criticality` |
| `Workload_Forecast` | `role_id`, `year`, `monthly_workload_units`, `planned_automation_pct` |
| `Assumptions` | `year`, `attrition_rate`, `salary_inflation_pct`, `hiring_cost_per_joiner`, `training_cost_per_employee`, `employer_overhead_pct` |
| `Settings` | `setting`, `value` (rows: `currency_code`, `snapshot_date`) |

`START_HERE` and `FIELD_DICTIONARY` are optional documentation tabs and are ignored by the parser.

- Data begins on row **2**. Do not merge data cells, rename parsed sheet tabs or column headers, or add a title row in a data sheet.
- Keep `employee_id` unique; `role_id` values must match Roles. Use pseudonymous employee IDs, never names/emails.
- Use decimal rates, e.g. **0.10 = 10%** (Excel percentage-formatted cells are fine if their underlying value is 0.10).
- `fte` must be greater than zero (maximum 1.5); monetary fields must be non-negative; role productivity must be positive.
- One workload record per role/year; every role needs a row for every forecast year, and every forecast year needs exactly one Assumptions row.
- `snapshot_date`: text formatted `YYYY-MM-DD`; `currency_code`: ISO three-letter code, e.g. `INR` or `USD`.
- Maximum **10MB** upload, **15,000 employees**, **10 forecast years**. Workbook is processed in your browser only.
- All numeric compensation values must be in the Settings currency. No FX conversion is performed.

**Important validation behavior:** Blocking errors leave the *previously loaded valid dataset* intact and display a validation report. Warnings do not block. Template-only blank files cannot be analyzed until completed.

## Methodology and limitations

See [docs/METHODOLOGY.md](docs/METHODOLOGY.md). The dataset is synthetic. All projections are deterministic **scenarios**, not historically validated machine learning forecasts. The role explorer is **not** a personal skills graph, and the financial model does **not** calculate validated reskilling ROI, pay equity, or labor-law compliance.

## Privacy and security

The Excel file is parsed client-side by `read-excel-file` and is **not uploaded to the server**. The AI endpoint is removed. Do not upload sensitive HR records to a public demo without organizational authorization. The sample workbook uses entirely fictional records.

**Production hardening needed before enterprise use:** authentication, tenant segregation, approved retention and DPA, audit trail, file scanning, rate limits for the paid AI API, security reviews and accessibility testing. There is no such claim for this portfolio edition.

## Project map

```
src/App.tsx         Executive UI, Data Studio, charts, simulations
src/data.ts        Read-only XLSX parsing and validation
src/model.ts       Workforce forecasting, scenario engine, exports
src/style.css      Responsive dark enterprise UI
public/*.xlsx      Real downloadable template and demo Excel
vercel.json        Vercel deployment defaults
```

## Technical verification note

The project is delivered as source code. This workspace cannot access the npm registry, so updated third-party dependencies cannot be installed or audited here. Calculation unit tests run successfully with `npm test`, but the complete Vite production build and end-to-end browser import are **not verified**. On your Mac, run `npm install`, `npm run build`, `npm test`, `npm audit --omit=dev` and `npm audit`. Do not deploy until the security audit and build pass. Review and fix any remaining findings.

## Dependency security changes in v2.0

- **Removed:** vulnerable npm `xlsx`/SheetJS 0.18.5. Replaced by `read-excel-file` 9.3.20+, a read-only browser parser. Its API is asynchronous, and all five data worksheets are parsed separately.
- **Removed:** `@vercel/node`, optional `/api/advise` and all generative-AI analysis code. This removes its `undici`, `busboy`, `@vercel/static-config`, and related transitive exposure from the project dependency tree.
- **Updated:** Vite 8.x and official React plugin 6.x for newer security fixes; these require modern Node.js.
- A changed package manifest does **not** prove zero vulnerabilities. Generate a new lockfile via `npm install`, run `npm audit`, verify the report, and commit `package-lock.json` alongside the code.
- Never use `npm audit fix --force` without reviewing breaking-version consequences.

## Model interpretation

**Understand the signs.** Positive role gap means a shortage; negative role gap means excess capacity. Aggregating signed gaps can hide shortages in some roles behind surpluses in others, so leadership should focus on **unfilled role demand** and demand coverage.

**Understand the counterfactual.** The Scenario Lab always compares the chosen inputs with the default scenario computed on the same workbook. A positive *annual cost difference* equals baseline spend minus selected spend (a modeled saving), but may accompany higher shortages. The cost and capacity outcomes should be evaluated jointly.

**Never assume validation beyond the data.** The scenario does not establish predictive accuracy or measure real workforce effectiveness; it is transparent quantitative planning, not automated hiring advice.
