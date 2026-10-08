# Mentoring plan — walking the student through the project

Four sessions of **one hour**, following the project scope: **Phase 1** (problem, data, travel times) in sessions 1–2, **Phase 2** (optimizer and backend) in session 3, **Phase 3** (frontend, deployment, handoff) in session 4. Each session has a goal, what to prepare, a timed agenda, the files to open, questions to ask and a small exercise for the student.

**Before session 1 (mentor):** the app runs locally (`npm run dev`, see [handoff.md](handoff.md) §4), you can sign in as the manager and a field officer, and you have skimmed [flow.md](flow.md), [architecture.md](architecture.md). Keep [architecture.md](architecture.md) open during every session — §1 lists the agreed decisions and §8 explains the optimizer.

**Teaching approach:** always **show it working first**, then open the code behind it. Let the student predict what the code does before you explain it.

---

## Session 1 — The problem and the data (Phase 1, part 1)

**Goal:** the student can explain the business problem, why it is a VRPTW, and where every piece of data comes from.

| Time | Activity | Open |
|---|---|---|
| 0–10 | **The problem.** An MFI branch, field officers on two-wheelers, JLG meetings with a weekday, time window, duration and priority. Ask: *"How would you plan tomorrow for 3 officers and 8 meetings by hand?"* | [flow.md](flow.md) §1–2 |
| 10–20 | **Live demo.** Sign in as the manager → Planner → Mon 28 Sep 2026 → Optimize → map, timeline, KPIs. Then sign in as a field officer → My Day on a phone-sized window. | the running app |
| 20–30 | **Why it is hard.** Name the constraints: windows, durations, shifts, lunch, max meetings, priorities, road travel. Introduce the term **VRPTW** and why an exact brute force is impossible (combinatorial explosion). | [flow.md](flow.md) §6.2, [architecture.md](architecture.md) §8 |
| 30–45 | **Real villages.** Why OSM alone was not enough (~20 places) and how Census 2011 + DataMeet boundaries + OSM became 117 villages; fuzzy matching with a distance check. | [data/README.md](../data/README.md), `scripts/data/join_census.py` (docstring) |
| 45–55 | **Synthetic data.** Real JLG data is private → a **seeded** generator: same seed ⇒ same data. Walk through `buildSyntheticGroups` (weighted by population, exact priority counts, windows on the half hour). | `lib/synthetic.ts`, `scripts/generate-seed.ts` |
| 55–60 | Recap + exercise. | |

**Questions to ask:** Why must the generator be reproducible? What goes wrong if two villages share a name ("Malegaon Bk / Kh")? Why do we never store real people's data in a demo?

**Exercise:** open `data/villages_baramati.csv`, pick three villages and check them on openstreetmap.org. Change the `seed` in the Generate Synthetic Data page, **Preview**, and describe what changed and what did not.

---

## Session 2 — Database and travel times (Phase 1, part 2)

**Goal:** the student can read the data model, explain how the database is protected, and explain why road travel time (not straight-line distance) drives the plan.

| Time | Activity | Open |
|---|---|---|
| 0–15 | **Data model.** Walk the tables: branches → officers → jlg_groups; plans → plan_routes → plan_stops; plan_unassigned; travel_cache; users; settings. Point out enums, `@map` (snake_case ↔ camelCase), times as `"HH:MM"`. | `prisma/schema.prisma`, [architecture.md](architecture.md) §5 |
| 15–25 | **Migrations and safety.** Read the end of the migration: hand-written **check constraints** (window end after start, Maharashtra bounds, field officer needs an officer) and **Row Level Security** with no policies. Why migrations are never edited once applied. | `prisma/migrations/*/migration.sql` |
| 25–35 | **Straight line vs road.** Run the notebook: road distance is 7–29 % longer and speeds differ by road. | `scripts/notebooks/travel_time_comparison.ipynb` |
| 35–55 | **The travel-time engine.** `osrm.ts` (Table API, chunking to 100 coordinates, 1 request/second, friendly errors) → `cache.ts` (keys rounded to 5 decimals, car values stored) → `matrix.ts` (speed factor applied *after* the cache, `null` = unreachable). | `lib/travel/*` |
| 55–60 | Recap + exercise. | |

**Questions to ask:** Why store *car* times and apply the two-wheeler factor later? Why is the matrix not symmetric? What happens on the second optimize of the same day, and why is that polite to the public OSRM server?

**Exercise:** in Settings change the speed factor to 1.2, optimize Monday again and compare total travel time and distance with the saved plan (travel rises ~20 %, distance does not). Then look at `travel_cache` in the Supabase table editor.

---

## Session 3 — The optimizer and the backend (Phase 2)

**Goal:** the student understands the OR-Tools model constraint by constraint, how the backend is secured, and how one optimize request flows through the system.

| Time | Activity | Open |
|---|---|---|
| 0–25 | **The OR-Tools model.** Read the contract first (inputs/outputs in minutes from midnight), then the model top to bottom: vehicles = officers, nodes = meetings; **Time dimension** (windows, waiting, shifts); **Count dimension** (max meetings); **disjunctions** (skipping costs a priority penalty × 100); pinned officer; lunch break; **finalizers** (earliest times); balance workload; search strategy + time limit. | `optimizer/schemas.py`, `optimizer/model.py`, [architecture.md](architecture.md) §8 |
| 25–35 | **Tests as documentation.** Each test is one scenario in plain words (windows force the order, low priority dropped first, max meetings, lunch inside the day, infeasible input…). Run `npm run test:py`. | `optimizer/tests/test_model.py` |
| 35–45 | **Security.** Login (bcrypt, JWT in an httpOnly cookie) → `proxy.ts` (who may open what) → `requireRole` at the top of every API route (re-checks the user is active) → the Python function verifies the same JWT. | `lib/auth/*`, `proxy.ts`, `app/api/*/route.ts`, `api/optimize.py` |
| 45–55 | **The glue.** Follow one optimize request: database → travel matrix → Python solver → road geometry → reasons for dropped meetings → KPIs → saved as a draft. Why the Python function never touches the database. | `lib/plans.ts`, [flow.md](flow.md) §6.2 |
| 55–60 | Recap + exercise. | |

**Questions to ask:** Why make meetings *optional* with a penalty instead of mandatory? Why does a node without a disjunction make the whole model infeasible? Why validate input twice (zod in the API, check constraints in the database)?

**Exercise:** add a new pytest scenario (e.g. "a pinned meeting that only its officer can reach in time is still scheduled") and make it pass. Bonus: find the comments in `optimizer/model.py` that explain why impossible meetings get a zero-penalty disjunction, and why "balance workload" uses the Count dimension instead of the Time dimension.

---

## Session 4 — The frontend, deployment and handoff (Phase 3)

**Goal:** the student can find their way around the UI code, deploy the app, and knows how the project was verified.

| Time | Activity | Open |
|---|---|---|
| 0–15 | **Frontend structure.** Pages in `app/`, the shell and auth context, the typed API client, the ported reference components (only the data layer changed). Walk the Planner: state, the loading stages, map data, timeline. | `app/`, `components/app-shell.tsx`, `lib/auth.tsx`, `lib/api-client.ts`, `components/planner/*` |
| 15–25 | **Role-aware UI.** The day sheet works for both roles through one dedicated API route; why field officers cannot use the manager's lists. Users and Settings: self-protection, password reset, defaults that pre-fill forms. | `components/day-sheet.tsx`, `app/api/plans/[id]/day-sheet/…`, `app/users/page.tsx`, `app/settings/page.tsx` |
| 25–45 | **Deployment.** Go through the guide together (or deploy live if time allows): Supabase project, connection strings (session pooler for `DIRECT_URL`), secrets, Vercel import, environment variables, the Python function and its size, smoke test, free-tier notes. | [deployment.md](deployment.md), `vercel.json` |
| 45–55 | **How we know it works.** The acceptance checklist and its results; the slice-by-slice build with a test gate after each slice; no secrets in the repo. | [test.md](test.md), [test-results.md](test-results.md) |
| 55–60 | Wrap-up: what the student would build next. | |

**Questions to ask:** Why is the session cookie httpOnly and Secure? Why are credentials never in the repo, and how are they shared instead? What would you change for a real MFI (paid hosting, self-hosted OSRM, real data, audit log)?

**Exercise (take-home):** deploy the app to your own Vercel + Supabase free accounts by following [deployment.md](deployment.md) and run its smoke test. Then pick one improvement (e.g. "must change password on first login", or showing the travel-cache hit rate in the Planner) and write a short plan for it as one "slice": what to build, the database change if any, and 4–6 manual tests (the tables in [test.md](test.md) show the style of a good test).

---

## Reading order (for the student, between sessions)

1. [flow.md](flow.md) → [architecture.md](architecture.md)
2. `prisma/schema.prisma` + migration → `scripts/data/` + [data/README.md](../data/README.md) → `lib/synthetic.ts`
3. `lib/travel/osrm.ts` → `cache.ts` → `matrix.ts`
4. `lib/auth/*` → `proxy.ts` → any `app/api/*/route.ts`
5. `optimizer/schemas.py` → `optimizer/model.py` → `optimizer/tests/test_model.py`
6. `lib/plans.ts`
7. `components/planner/*`, `components/day-sheet.tsx`, `components/data-workspace.tsx`

Throughout: [architecture.md](architecture.md) explains the decisions; the comments at the top of each file explain the code.
