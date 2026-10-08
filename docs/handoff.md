# Handoff — MFI Route Optimizer

For the **technical mentor** who receives this project, deploys it and walks a student through it. Read this page first; it points to everything else. The repository is self-contained: what the project is, how it is built, what was used and how to set it up are all in it.

---

## 1. What the project is

A web application for a **microfinance (MFI) branch** that plans the daily routes of its **field officers**. Officers ride two-wheelers to village **JLG (Joint Liability Group) meetings**. Every group meets on a fixed weekday inside a time window (e.g. Monday 09:00–10:30), a meeting takes 30–45 minutes, groups have a priority (overdue repayments, loan disbursement, new group, routine), and officers work fixed hours with a lunch break.

Each day the **Manager** must decide *which officer visits which meetings, in what order and when*, so that urgent meetings are covered and road travel is as short as possible. This is a **Vehicle Routing Problem with Time Windows (VRPTW)**, solved with **Google OR-Tools**.

* **Region:** Baramati taluka, Pune district, Maharashtra — real villages.
* **Data:** real JLG data is private, so the app uses **realistic synthetic JLG groups placed on real villages**, plus manual entry forms with a map picker.
* **Users:** a **Manager** (data, planning, users, settings) and **Field Officers** (see only their own day, on a phone).
* **Nature:** a non-commercial student mentoring project; built for free tiers (Vercel Hobby + Supabase Free).

## 2. What we have built

A complete, tested, **deployment-ready** application (not yet deployed — deploying is the mentor's step):

| Area | What exists |
|---|---|
| **Planner** | pick a date → meetings of that weekday → choose meetings and officers → **Optimize Routes** → map with road-shaped routes per officer, KPIs (meetings planned, high-priority coverage, distance, travel time, utilisation, solver status), a per-officer timeline (travel, waiting, meetings, lunch, windows), the "not scheduled" list with reasons → **Save plan** |
| **Plans** | history of saved plans; plan detail with map, timeline, CSV export and print; a printable **day sheet** per officer |
| **My Day** (Field Officer, phone) | their latest saved route: start → legs → lunch → stops (arrive, wait, meeting) → return, with **Google Maps navigation** and "mark visited" |
| **Data management** | JLG groups (search, filters, add/edit/duplicate/deactivate, **click-on-map location**), officers (shift, break, colour, start location), branches, and a **seeded synthetic data generator** with map preview |
| **Admin** | users (add, roles, link to an officer, deactivate, **password reset by the manager**), settings (working defaults, OSRM server, two-wheeler speed factor, priority penalties, solver time limit, balance workload) |
| **Optimizer** | Python function (FastAPI + OR-Tools): time windows, meeting durations, shifts, lunch break, max meetings per officer, priority penalties, pinned officer, optional workload balancing, time limit; **22 unit tests** |
| **Travel times** | public OSRM server (car times × two-wheeler speed factor), every pair cached in PostgreSQL, throttled; comparison notebook (straight line vs road) |
| **Real village data** | 117 Baramati villages from the Census of India 2011 + DataMeet village boundaries + OpenStreetMap, with a reproducible data pipeline |
| **Security** | own JWT login (bcrypt, httpOnly cookie, 8 h), two roles enforced on every page and API route, row-level security on every table, validation on every write, no secrets or passwords in the code |
| **Documentation** | this handoff, a mentoring plan, flow, architecture, deployment guide, acceptance checklist and its results |

**Architecture in one line:** one Next.js project (pages + TypeScript API routes) + one Python serverless function for the solver, on one Vercel deployment, with Supabase PostgreSQL accessed through Prisma. The Python function never touches the database — the TypeScript side prepares everything and stores the result.

**How it was built:** in **13 slices** (S1–S13) mapped to the three scope phases, each verified before the next. The reasons behind the design are in [architecture.md](architecture.md) (notably §1 and the implementation notes in §8) and in comments at the top of the key files.

---

## 3. Where to find what

| Question | Where it is answered |
|---|---|
| **What is it?** Purpose, users, problem, scope | this file §1–2, `README.md`, [flow.md](flow.md) §1–2, [test.md](test.md) §1 |
| **How does it work?** User journeys, auth flow, optimize flow, page map | [flow.md](flow.md) |
| **How is it built?** System diagram, folder layout, data model, API routes, travel-time engine, OR-Tools model, security | [architecture.md](architecture.md) |
| **What was used?** Next.js, TypeScript, Tailwind, shadcn/ui, React-Leaflet, Prisma, Supabase PostgreSQL, jose/bcrypt JWT auth, Python, FastAPI, Google OR-Tools, PyJWT, OSRM, OpenStreetMap/Overpass, Census of India data, DataMeet, pandas, rapidfuzz, Jupyter, Folium, Vercel | [architecture.md](architecture.md) §3 |
| **Why was it built this way?** Agreed decisions, trade-offs, OR-Tools details | [architecture.md](architecture.md) §1 and §8, comments in `lib/plans.ts`, `lib/travel/*`, `optimizer/model.py` |
| **How do I set it up locally?** | `README.md`, and §4 below |
| **How do I deploy it?** Supabase, Vercel, env vars, smoke test, troubleshooting | [deployment.md](deployment.md) |
| **How do I know it works?** | [test.md](test.md) (checklist to sign off) + [test-results.md](test-results.md) (what is already verified, what is left) |
| **Where does the village data come from?** | [data/README.md](../data/README.md) |
| **How do I teach it?** Four one-hour sessions with agenda, files, questions and exercises, plus a reading order | [mentoring.md](mentoring.md) |

## 4. Quick setup (full details in the README)

1. Clone the repo; install Node 20+ (with npm), Python 3.11+.
2. `npm install`; create a Python virtual environment and `pip install -r requirements-dev.txt` (runtime + local server + tests).
3. Create a Supabase project. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (transaction pooler, port 6543), `DIRECT_URL` (**session pooler**, port 5432 — not the IPv6-only direct host), `JWT_SECRET`, `OPTIMIZER_URL` and `SEED_PASSWORD`.
4. Create the database: run each `prisma/migrations/*/migration.sql` in order in the Supabase SQL editor (or `npx prisma migrate deploy`), then `npm run seed:sql` and run `supabase/seed.sql`.
5. `npm run dev` (virtual environment activated) → open `http://localhost:3000` and sign in (accounts below).
6. Deploy: follow [deployment.md](deployment.md).

## 5. Accounts and credentials

| Role | Email |
|---|---|
| Manager | `manager@mfi.demo` |
| Field Officers | `sunita.pawar@mfi.demo`, `rahul.jadhav@mfi.demo`, `priya.shinde@mfi.demo` |

**No password is stored in the repository.** Seeded accounts start with the `SEED_PASSWORD` of whoever generated `supabase/seed.sql`; it is shared **privately**, separately from the code. After the first sign-in, reset every password from **Users → key icon** (there is no email flow; users ask the manager).

## 6. What is left for the mentor

1. **Deploy** with [deployment.md](deployment.md) and run its post-deploy smoke test (§7 there).
2. The open items at the end of [test-results.md](test-results.md): migrations on an empty Supabase project (R1), a clean clone following the README (P5), and a few quick manual checks (F7, D-14, N2, N3, N6, S4).
3. **Sign off** [test.md](test.md).
4. Walk the student through the project in four one-hour sessions: [mentoring.md](mentoring.md).

## 7. Things that arrive separately (not in the repository)

| Item | Why |
|---|---|
| The initial password (`SEED_PASSWORD`) | credentials are never committed |
| The reference UI design (`frontend/` folder, Next.js with mock data) | the design the pages were ported from; needed only for the UI-fidelity check N3 — otherwise the running app is the design |
| The Project Scope document | the original goals and deliverables that [test.md](test.md) §2 checks |
