# MFI Route Optimizer — Final Acceptance Test

Run this **after all slices S1–S13 are complete**. It checks the finished project against what was promised: the Project Scope, [flow.md](flow.md), [architecture.md](architecture.md). The project is **ready for handoff (deployment-ready)** only when every item in sections 2–7 passes.

> **Deployment is not part of this test.** The project is handed off to a technical mentor, who deploys it. The development work ends with a complete, tested **deployment guide** ([deployment.md](deployment.md), see §8) so the mentor can deploy it without further help.

**How to use:** tick each box ☐ → ☑. Write any failure in the *Notes* column and fix it before sign-off. All tests run **locally**: use `npm run dev`, and for the performance and build checks a local production build (`npm run build` then `npm run start`).

| Field | Value |
|---|---|
| Local URL | `http://localhost:3000` |
| Commit / tag tested | |
| Tested by / date | |
| Demo accounts | Manager `manager@mfi.demo` · Field Officers `sunita.pawar@mfi.demo`, `rahul.jadhav@mfi.demo`, `priya.shinde@mfi.demo` (initial password = `SEED_PASSWORD`, shared privately — see [handoff.md](handoff.md) §5) |

---

## 1. What the project was expected to be

A web application for a microfinance (MFI) branch that plans **the most efficient daily routes for field officers** visiting village **Joint Liability Group (JLG) meetings**. It takes meeting locations and returns which officer visits which meetings, in what order and at what time. It accounts for **road travel time, meeting time windows, meeting durations, group priority, officer working hours and lunch breaks**.

* The core problem is a **Vehicle Routing Problem with Time Windows (VRPTW)**, solved with **Google OR-Tools**.
* Road travel times come from **OSRM** on **OpenStreetMap** data, with a **two-wheeler speed factor** and a PostgreSQL cache.
* Village locations come from the **Census of India 2011** village list (Baramati taluka, Pune district) with **DataMeet village boundaries**, refined with **OpenStreetMap (Overpass API)** settlement points.
* Real JLG data is not public, so the system runs on **realistic synthetic JLG data on real villages**, plus **manual entry forms with map-based location picking**.
* **Two roles:** a **Manager** who handles data, planning, users and settings, and **Field Officers** who see their own daily route.
* It is built as **one Next.js application** (TypeScript API routes plus one Python OR-Tools function), uses **Supabase PostgreSQL through Prisma** and **own JWT authentication**, and is built to be deployed on **Vercel + Supabase free tiers**. The receiving mentor carries out the deployment by following the deployment guide.
* It is a **non-commercial student mentoring project**.

---

## 2. Expected deliverables (from the Project Scope)

| # | Deliverable | Where | ☐ |
|---|---|---|---|
| D1 | Cleaned village dataset for Baramati taluka (OpenStreetMap + Census + DataMeet) | `data/villages_baramati.csv`, `scripts/data/` | ☐ |
| D2 | Seeded, reproducible synthetic data generator | `lib/synthetic.ts`, `scripts/generate-seed.ts` | ☐ |
| D3 | Database schema with seed data (Prisma schema + SQL migrations + seed SQL) | `prisma/`, `supabase/seed.sql` | ☐ |
| D4 | Travel-time matrix module with OSRM integration and PostgreSQL cache | `lib/travel/` | ☐ |
| D5 | Notebook comparing straight-line vs road travel times on a map | `scripts/notebooks/travel_time_comparison.ipynb` | ☐ |
| D6 | Optimizer function with configurable settings (speed factor, priority penalties, solver time limit) | `api/optimize.py`, `optimizer/` | ☐ |
| D7 | Documented API routes for data management and optimization | `app/api/`, [architecture.md §6](architecture.md) | ☐ |
| D8 | Saved plans with KPIs (meetings covered, high-priority coverage, distance, travel time, utilisation) | `plans` tables, Plans pages | ☐ |
| D9 | Unit tests for the optimizer on sample scenarios | `optimizer/tests/` | ☐ |
| D10 | JWT login with role-based access (Manager, Field Officer), including user management and password resets by the Manager | `lib/auth/`, `proxy.ts`, `/users` | ☐ |
| D11 | Manual data-entry forms for JLG groups, officers and branches with click-on-map location picking | `/jlg-groups`, `/officers`, `/branches` | ☐ |
| D12 | Planner (map with routes, per-officer timeline, KPIs, unassigned groups), plan history, officer day sheet with Google Maps navigation, settings | `/`, `/plans…`, `/my-day`, `/settings` | ☐ |
| D13 | Fully functional, deployment-ready web application (single Vercel project + Supabase) with a step-by-step deployment guide; deployed by the receiving mentor | repo, [deployment.md](deployment.md) | ☐ |
| D14 | Local development setup that runs the full application with a single command | `npm run dev` | ☐ |
| D15 | README with setup guide, architecture overview and API documentation | `README.md`, `docs/` | ☐ |
| D16 | Demo accounts for each role, loaded with synthetic data | seed | ☐ |
| D17 | Final project walkthrough and handoff | `docs/handoff.md`, `docs/mentoring.md`, this file | ☐ |

---

## 3. Functional acceptance tests

### 3.1 Authentication & roles

| # | Test | Expected | ☐ | Notes |
|---|---|---|---|---|
| A1 | Log in with a wrong password | "Incorrect email or password.", no cookie set | ☐ | |
| A2 | Log in as Manager | Lands on Planner `/`; sidebar: Planner, Plans, Data (JLG Groups, Officers, Branches, Generate Synthetic Data), Admin (Users, Settings) | ☐ | |
| A3 | Inspect cookies / storage | `session` cookie is HttpOnly + Secure; no token in localStorage | ☐ | |
| A4 | Log in as Field Officer | Lands on `/my-day`; sidebar shows only My Day | ☐ | |
| A5 | Field Officer opens `/jlg-groups`, `/`, `/users` | Redirected to `/my-day` | ☐ | |
| A6 | Field Officer calls `GET /api/groups` and `POST /api/plans/optimize` | 403 | ☐ | |
| A7 | Manager opens `/my-day` | Redirected to `/` | ☐ | |
| A8 | Logged-out user opens `/` or any `/api/*` route | Redirect to `/login` / 401 | ☐ | |
| A9 | Deactivate a user while they are logged in | Their next request is rejected; login shows "This account has been deactivated." | ☐ | |
| A10 | Login page | No forgot-password page; shows "Forgot your password? Ask your manager to reset it." | ☐ | |
| A11 | Logout | Cookie cleared, back on `/login` | ☐ | |
| A12 | Session expiry | After 8 h (or with a tampered cookie) the user is sent to `/login` | ☐ | |

### 3.2 Data management

| # | Test | Expected | ☐ | Notes |
|---|---|---|---|---|
| B1 | JLG Groups page | Seeded groups listed; stats (total, active, high priority, by source); data-overview mini map | ☐ | |
| B2 | Search + filters (priority, meeting day, source, status) + pagination | Results update correctly; page count right | ☐ | |
| B3 | Add group: pick village from list | Map pin jumps to the village | ☐ | |
| B4 | Add group: click map / drag pin / type lat-lng | Fields and pin stay in sync | ☐ | |
| B5 | Validation: end before start, pin outside Maharashtra, duration < 10, missing name/village | Inline errors, nothing saved | ☐ | |
| B6 | Save group, then hard-refresh | Group persists (stored in database), source `manual` | ☐ | |
| B7 | Edit, Duplicate, Deactivate/Reactivate group | Each works and persists | ☐ | |
| B8 | Assigned officer on a group | Optimizer only ever gives that group to that officer | ☐ | |
| B9 | Officers: add/edit (colour, custom start location, shift, break, max meetings), deactivate | Works and persists; inactive officers not offered in Planner | ☐ | |
| B10 | Branches: add/edit with map pin | Branch has its own form; persists | ☐ | |
| B11 | New officer/group forms | Pre-filled with the defaults saved in Settings | ☐ | |
| B12 | Synthetic data: Preview | Map of generated points + priority counts; nothing saved | ☐ | |
| B13 | Synthetic data: Generate (same seed twice) | Same groups each time (reproducible); tagged `synthetic` | ☐ | |
| B14 | Synthetic data: Replace existing | Old synthetic groups replaced; **manual groups untouched** | ☐ | |

### 3.3 Travel-time engine

| # | Test | Expected | ☐ | Notes |
|---|---|---|---|---|
| C1 | First optimize of a day | OSRM called; new rows in `travel_cache` | ☐ | |
| C2 | Repeat the same optimize | No new OSRM table calls (cache hits); faster | ☐ | |
| C3 | Change speed factor 1.0 → 1.2 | Travel minutes rise ~20%; cache rows unchanged | ☐ | |
| C4 | Invalid OSRM URL in Settings | Cannot be saved (validation); if OSRM is down, a clear "travel-time service unavailable" message appears, not a crash | ☐ | |
| C5 | Route lines on the map | Follow real roads (OSRM Route geometry), not straight lines | ☐ | |

### 3.4 Optimizer & Planner

| # | Test | Expected | ☐ | Notes |
|---|---|---|---|---|
| D-1 | Planner for a weekday | Lists only active groups meeting on that weekday; Sunday shows "No meetings are held on Sundays" | ☐ | |
| D-2 | Include/exclude meetings and officers, search, priority filter, select/clear all | Counts in footer update | ☐ | |
| D-3 | Optimize Routes | Loading "Fetching travel times…" → "Optimizing routes…" → results | ☐ | |
| D-4 | Every scheduled stop | Meeting starts inside its window (or ≤ 15 min late only if *Allow late arrival* is on) | ☐ | |
| D-5 | Every route | Starts at shift start from the start location and returns before shift end | ☐ | |
| D-6 | Lunch break | Placed within the day on routes that span it; shown on timeline and day sheet | ☐ | |
| D-7 | Max meetings per officer | Never exceeded | ☐ | |
| D-8 | Not enough time for all meetings | Low-priority groups are dropped before high-priority ones; each dropped group shows a reason | ☐ | |
| D-9 | Balance workload on vs off | Meetings spread more evenly when on | ☐ | |
| D-10 | Solver time limit | Solve finishes within the configured limit | ☐ | |
| D-11 | Map | Numbered coloured stops per officer, grey hollow markers for not scheduled, branch marker, legend show/hide per officer, *Fit to routes* | ☐ | |
| D-12 | Summary | KPIs (planned x/y, high-priority x/y, distance, travel time, utilisation, status + solve time), officer cards, Not-scheduled list | ☐ | |
| D-13 | Timeline | One row per officer 08:00–18:00: travel, waiting, meetings, break, meeting windows; hover tooltips show times | ☐ | |
| D-14 | Infeasible input (e.g. no officer can reach anything) | Status `infeasible` + guidance notice, no crash | ☐ | |
| D-15 | Save plan | Toast; button shows "Saved"; appears in Plans | ☐ | |
| D-16 | Optimizer unit tests (*local*) | `npm run test:py` all pass | ☐ | |

### 3.5 Plans, day sheet & My Day

| # | Test | Expected | ☐ | Notes |
|---|---|---|---|---|
| E1 | `/plans` | Saved plans only, newest first, with officers, meetings, distance, status, creator | ☐ | |
| E2 | Plan detail | KPIs, map, timeline, officer cards, not-scheduled list | ☐ | |
| E3 | Export CSV | File with one row per stop + not-scheduled rows | ☐ | |
| E4 | Print (detail + day sheet) | Clean printable page | ☐ | |
| E5 | Day sheet | Start → legs → break (before the leg it delays) → stops (arrive, wait, meeting, members, priority) → return; totals correct | ☐ | |
| E6 | Navigate button | Opens Google Maps directions to the stop | ☐ | |
| E7 | Mark visited | Toggles and updates "x / y done" | ☐ | |
| E8 | Field Officer My Day (phone width) | Shows their latest saved route; officer with none sees "No route planned yet" | ☐ | |

### 3.6 Users & Settings

| # | Test | Expected | ☐ | Notes |
|---|---|---|---|---|
| F1 | Add Field Officer without linked officer | Validation error | ☐ | |
| F2 | Add user with generated initial password | User can log in with it | ☐ | |
| F3 | Link an officer already linked to another user | Not allowed | ☐ | |
| F4 | Duplicate email | Rejected with a clear message | ☐ | |
| F5 | Reset password | Old password fails, new works; copy button works | ☐ | |
| F6 | Own account | Cannot deactivate self or change own role (UI disabled **and** API returns 400) | ☐ | |
| F7 | Settings save / discard | Saved values persist after refresh; Discard restores | ☐ | |
| F8 | Settings validation | Shift end before start, bad OSRM URL, time limit outside 1–60 → error, not saved | ☐ | |

---

## 4. Non-functional checks

| # | Area | Check | ☐ | Notes |
|---|---|---|---|---|
| N1 | Responsive | Every page usable at 375 px (mobile menu, planner panel sheet, tables scroll) and on desktop | ☐ | |
| N2 | Themes | Light and dark mode correct on all pages (badges, warnings, maps readable) | ☐ | |
| N3 | UI fidelity | Pages match the reference design in `D:\CreatED-MFI\frontend` | ☐ | |
| N4 | Performance (local production build) | Pages load < 3 s; optimize for one day (≈8 groups, 3 officers) < 15 s on first run, < 5 s with cache | ☐ | |
| N5 | Errors | No console errors; API errors show friendly messages; no stack traces shown to users | ☐ | |
| N6 | Accessibility basics | Form labels, button labels on icon buttons, keyboard can reach all actions, visible focus | ☐ | |
| N7 | Code quality (*local*) | `npm run typecheck`, `npm run lint`, `npm run build`, `pytest` all pass | ☐ | |
| N8 | OSM etiquette | Map shows "© OpenStreetMap contributors"; OSRM calls are cached and throttled | ☐ | |

---

## 5. Security checks

| # | Check | ☐ | Notes |
|---|---|---|---|
| S1 | Passwords stored only as bcrypt hashes; never returned by any API | ☐ | |
| S2 | JWT in HttpOnly, Secure, SameSite=Lax cookie; 8 h expiry; signed with `JWT_SECRET` | ☐ | |
| S3 | Every `/api/*` route (except login) checks the session and role; Python `/api/optimize` rejects missing/invalid/non-manager tokens | ☐ | |
| S4 | RLS enabled on every table with no policies; Supabase anon REST key cannot read any table | ☐ | |
| S5 | All write inputs validated (zod) and DB check constraints present | ☐ | |
| S6 | No secrets in the repo (`git grep` for DB password / JWT secret finds nothing); `.env` git-ignored; `.env.example` complete | ☐ | |
| S7 | Temporary dev routes removed (`/api/health/db`, `/api/dev/matrix`) | ☐ | |

---

## 6. Database & reproducibility checks

| # | Check | ☐ | Notes |
|---|---|---|---|
| R1 | All migrations in `prisma/migrations/` run in order on an **empty** Supabase project without errors (SQL editor **or** `npx prisma migrate deploy`) | ☐ | |
| R2 | `prisma/schema.prisma` matches the live database (`prisma migrate diff --from-url … --to-schema-datamodel …` prints no changes) | ☐ | |
| R3 | `supabase/seed.sql` loads the demo data; running it twice creates no duplicates | ☐ | |
| R4 | `npm run seed:sql` regenerates an identical `seed.sql` (same seed ⇒ same data) | ☐ | |
| R5 | Data scripts (`fetch_villages.py`, `fetch_census.py`, `join_census.py`) and the comparison notebook run top to bottom | ☐ | |

---

## 7. Handoff readiness (deployment-ready, not deployed)

These checks confirm the mentor will be able to deploy. They do **not** involve deploying.

| # | Check | ☐ | Notes |
|---|---|---|---|
| P1 | `npm run build` succeeds and `npm run start` serves the app locally; the full demo works end to end on it (Manager optimizes → saves → Field Officer sees My Day at phone width) | ☐ | |
| P2 | Deployment configuration is in the repo: `requirements.txt` for the Python function, `maxDuration` set for `/api/optimize` and `/api/plans/optimize`, and production handling of `OPTIMIZER_URL` | ☐ | |
| P3 | OR-Tools package size checked against Vercel's Python function limit, with the result written in the deployment guide | ☐ | |
| P4 | [deployment.md](deployment.md) exists and covers every item in §8 | ☐ | |
| P5 | Fresh clone + README only → app runs locally with one `npm run dev` | ☐ | |
| P6 | `.env.example` lists every variable the deployment guide asks the mentor to set | ☐ | |
| P7 | "Demo environment — synthetic data" note visible on the login page | ☐ | |

### Sign-off

| Result | ☐ |
|---|---|
| All items in sections 2–7 pass → **Ready for handoff (deployment-ready)** | ☐ |
| Signed off by / date | |

---

## 8. Deployment guide — to be written by the development chat (S13)

The development chat **does not deploy**. At the end of the build (slice S13) it writes **`docs/deployment.md`**, a step-by-step guide the receiving mentor can follow alone. It must cover:

1. **Prerequisites:** GitHub, Vercel and Supabase accounts (free tiers); what each is used for.
2. **Database (Supabase):**
   * create the project and choose the region;
   * run every `prisma/migrations/*/migration.sql` in order in the SQL editor (or `npx prisma migrate deploy`), then `supabase/seed.sql`;
   * where to find the **pooled** connection string (port 6543, for `DATABASE_URL`) and the **direct** one (port 5432, for `DIRECT_URL`);
   * how to confirm that row-level security is enabled.
3. **Secrets:** how to generate a strong `JWT_SECRET`. The same value must be used by both the Next.js and Python parts.
4. **Vercel project:** import the GitHub repo; framework preset; root directory; how Vercel detects the Python function (`api/optimize.py` + `requirements.txt`) alongside Next.js; Python version.
5. **Environment variables:** every variable with an example value and whether it goes in Production, Preview or both. This includes what `OPTIMIZER_URL` should be in production.
6. **Deploy,** and read the build logs, including where the Python function's build appears.
7. **Post-deploy smoke test:** a short checklist the mentor can run on the live URL:
   * login as each role;
   * optimize a day, save the plan, open the plan;
   * Field Officer My Day on a phone;
   * the Python function rejects a request without a token.
8. **Updating:** how redeploys happen on push, and how to apply a new migration in production.
9. **Free-tier notes:** Supabase pauses after ~7 days idle (how to resume it); the Vercel Hobby plan is for non-commercial use; OSRM public server has no uptime guarantee (cached results keep working); expect cold starts on the first optimize.
10. **Troubleshooting:** common failures and fixes. At minimum:
    * database connection or pooling errors;
    * `JWT_SECRET` mismatch (users logged out, or optimizer returns 401);
    * Python function too large or timing out;
    * OSRM unavailable;
    * a migration not applied.

---

For the handoff itself — what the project is, what was built, where everything is and how to set it up — see [handoff.md](handoff.md).
