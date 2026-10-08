# Acceptance results — development run (2026-09-30)

Results of going through [test.md](test.md) at the end of the build (slice S13). The checkboxes and sign-off in test.md are left for the **technical mentor**; this file records what was already verified, how, and what is still open.

**Legend:** ✅ passed · ⚠️ passed with a note · ⏳ not run yet (reason given). "Sn" = the build slice (S1–S13) in which it was verified. "user" = verified by the project owner, "dev" = verified by the development chat (browser automation / HTTP / tests).

**Environment:** Windows 11, Node 22, pnpm 12, Python 3.11, Supabase (Tokyo pooler), local `pnpm dev` and a local production build (`pnpm build && pnpm start`). Not deployed (deployment is the mentor's step — [deployment.md](deployment.md)).

## Summary

| Section | Result |
|---|---|
| 2. Deliverables D1–D17 | ✅ all present (D13: deployment-ready; deploying is the mentor's step) |
| 3. Functional A1–F8 (62 tests) | ✅ 60 · ⚠️ 1 (D-14) · ⏳ 1 (F7 "Discard") |
| 4. Non-functional N1–N8 | ✅ 5 · ⚠️ 3 (N2, N3, N6 checked informally) |
| 5. Security S1–S7 | ✅ 6 · ⚠️ 1 (S4: anon-key read not tried) |
| 6. Database R1–R5 | ✅ 4 · ⏳ 1 (R1 needs an empty Supabase project) |
| 7. Handoff P1–P7 | ✅ 6 · ⏳ 1 (P5 needs a real clone after the code is committed) |

## 2. Deliverables

| # | Result | Evidence |
|---|---|---|
| D1 | ✅ | 117 villages, 116 with census data (S3, user) |
| D2 | ✅ | seeded generator; `pnpm seed:sql` twice → identical file (S4, user) |
| D3 | ✅ | `prisma/` + migration + `supabase/seed.sql` (S2, S4, user) |
| D4 | ✅ | `lib/travel/`, cache hits/misses verified (S5, user) |
| D5 | ✅ | notebook runs top to bottom (S5, user) |
| D6 | ✅ | speed factor, penalties, time limit, late arrival, balance (S8/S9/S12) |
| D7 | ✅ | `app/api/*`, documented in architecture.md §6 |
| D8 | ✅ | plans with KPIs saved and listed (S9–S11) |
| D9 | ✅ | 22 pytest tests pass (S8/S9) |
| D10 | ✅ | S6 + S12 (user + dev) |
| D11 | ✅ | S7 (user) |
| D12 | ✅ | S10, S11, S12 |
| D13 | ✅ | `pnpm build` passes; `vercel.json`; [deployment.md](deployment.md) (S13) |
| D14 | ✅ | `pnpm dev` runs Next.js + Python |
| D15 | ✅ | README + docs/ (S13) |
| D16 | ✅ | 4 seeded accounts; password from `SEED_PASSWORD`, shared privately (S13) |
| D17 | ✅ | [handoff.md](handoff.md), [mentoring.md](mentoring.md) + this file |

## 3. Functional

| # | Result | Evidence |
|---|---|---|
| A1 | ✅ | S6 (user, dev) |
| A2 | ✅ | S6 |
| A3 | ✅ | HttpOnly + SameSite=Lax (S6); **Secure** confirmed on the production build (S13) |
| A4 | ✅ | S6 |
| A5 | ✅ | S6 (`/jlg-groups`), S11 (`/plans`) → `/my-day` |
| A6 | ✅ | S6 `GET /api/groups` 403; S9 `POST /api/plans/optimize` 403 |
| A7 | ✅ | `proxy.ts` rule; S6 |
| A8 | ✅ | S6; S13 (`/` → 307 `/login`, `/api/groups` → 401) |
| A9 | ✅ | S6 (user), S12 (dev: next request 401, login 403) |
| A10 | ✅ | S6, S13 |
| A11 | ✅ | S6 |
| A12 | ✅ | tampered cookie → `/login` / 401 (S13, dev); 8 h expiry set in the JWT and cookie |
| B1–B14 | ✅ | S7 (user) |
| C1–C3 | ✅ | S5 (user); C3 again in S12 (182 → 221 min, distance unchanged) |
| C4 | ✅ | validation (S12); OSRM down → 503 "Travel-time service unavailable — try again" (S5) |
| C5 | ✅ | hundreds of geometry points per route (S9, S10) |
| D-1–D-3 | ✅ | S10 (dev, user) |
| D-4, D-5, D-7 | ✅ | enforced by the model and asserted in every pytest scenario (`assert_timeline_is_valid`) |
| D-6 | ✅ | S8 tests; timeline (S10); day sheet incl. lunch after the last meeting (S11) |
| D-8 | ✅ | one officer → 3 low dropped, reason shown (S8, S10) |
| D-9 | ✅ | pytest `test_balance_workload_spreads_meetings`; Monday 4/0/4 → 3/3/2 (S9) |
| D-10 | ✅ | solve ≈ the configured limit (GLS always uses the full limit) |
| D-11–D-13, D-15 | ✅ | S10 (dev) |
| D-14 | ⚠️ | infeasible case covered by pytest (`test_infeasible_input_drops_everything`) and the UI has `InfeasibleNotice`; the notice itself was not triggered in the browser |
| D-16 | ✅ | `pnpm test:py` 22 passed |
| E1–E8 | ✅ | S11 (user incl. CSV, Print, "No route planned yet"; dev) |
| F1–F6, F8 | ✅ | S12 (user steps 1–3, dev steps 4–6 and API checks) |
| F7 | ⏳ | save + persist verified (S12); the **Discard** button was not exercised |

## 4. Non-functional

| # | Result | Evidence / note |
|---|---|---|
| N1 | ✅ | planner sheet (S10), day sheet / My Day (S11, S13) at 375 px, no horizontal scroll |
| N2 | ⚠️ | dark and light seen during testing (S1, S10 screenshots); not a page-by-page review |
| N3 | ⚠️ | every page is the reference component with only the data layer changed; no side-by-side visual review |
| N4 | ✅ | production build: optimize ≈ 19 s including a 10 s solver limit; with the cache the time is dominated by the solver limit (lower it in Settings for faster runs) |
| N5 | ✅ | friendly messages for 400/401/403/503; no stack traces reach users |
| N6 | ⚠️ | labels and `aria-label`s on icon buttons come from the reference; no keyboard-only walkthrough |
| N7 | ✅ | typecheck, lint, build, pytest all pass (S13) |
| N8 | ✅ | attribution on every map; OSRM cached + 1 req/s throttle |

## 5. Security

| # | Result | Evidence |
|---|---|---|
| S1 | ✅ | bcrypt; `toUser` never includes the hash (code check, S13) |
| S2 | ✅ | cookie flags on the production build: `Secure; HttpOnly; SameSite=lax; Max-Age=28800` (S13) |
| S3 | ✅ | 20 of 22 API routes check the session/role (login/logout public by design) + `proxy.ts`; Python rejects missing/expired/non-manager tokens (pytest + S8) |
| S4 | ⚠️ | RLS enabled on all 10 tables, no policies (S2, user); reading with the anon REST key was not tried |
| S5 | ✅ | zod on every write; 26 check constraints |
| S6 | ✅ | DB password, JWT secret and SEED_PASSWORD in 0 of 120 committable files; `.env` ignored (S13) |
| S7 | ✅ | removed (S13) |

## 6. Database & reproducibility

| # | Result | Evidence |
|---|---|---|
| R1 | ⏳ | the migration ran cleanly on the current project (S2); on a **second, empty** project not yet done |
| R2 | ✅ | `prisma migrate diff` (via the session pooler) → empty migration (S13) |
| R3 | ✅ | S4 (user) |
| R4 | ✅ | S4 (user); unchanged when `SEED_PASSWORD` is unchanged |
| R5 | ✅ | S3, S5 (user) |

## 7. Handoff readiness

| # | Result | Evidence |
|---|---|---|
| P1 | ✅ | production build demo end to end incl. My Day at 375 px (S13, dev) |
| P2 | ✅ | `requirements.txt`, `vercel.json` (`maxDuration` 60), `/api/plans/optimize` `maxDuration` 60, `OPTIMIZER_URL` handling |
| P3 | ✅ | ≈ 197 MB unzipped (ortools 81, pandas 66, numpy 33) — recorded in deployment.md |
| P4 | ✅ | deployment.md has all 10 items of §8 |
| P5 | ⏳ | a copy of the 120 committable files installs, type-checks and lints from scratch; a real `git clone` needs the code committed first |
| P6 | ✅ | every variable in the guide is in `.env.example` |
| P7 | ✅ | login page shows "Demo environment — synthetic data" |

## Found and fixed during this run

* Supabase's **direct** host (`db.<ref>.supabase.co`) is IPv6-only on the free plan and unreachable from many networks; use the **session pooler** (port 5432 on the pooler host) for `DIRECT_URL`. Added to deployment.md.
* Re-running `seed.sql` never changes passwords of existing users; troubleshooting row added to deployment.md.

## Left for the mentor

1. R1 — run the migration + seed on a fresh, empty Supabase project (this is also step 2 of the deployment guide).
2. P5 — clone the committed repo and follow the README.
3. F7, D-14, N2, N3, N6, S4 — quick manual checks (a few minutes each).
4. Deploy with [deployment.md](deployment.md) and run its smoke test (§7), then sign off test.md.
