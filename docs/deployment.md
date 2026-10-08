# Deploying the MFI Route Optimizer

A step-by-step guide for the person deploying the app. It needs no knowledge beyond this repository. For what the app is and how it is built, see [flow.md](flow.md) and [architecture.md](architecture.md).

**Result:** one public HTTPS URL on **Vercel** (Next.js pages + TypeScript API routes + one Python function for the optimizer), backed by a **Supabase** PostgreSQL database. Everything runs on free tiers.

---

## 1. Prerequisites

| Account | Used for | Plan |
|---|---|---|
| **GitHub** | holds the repository; Vercel deploys from it | free |
| **Supabase** (supabase.com) | the PostgreSQL database (only the database — no Supabase Auth or client) | Free |
| **Vercel** (vercel.com), signed in with GitHub | hosts the app and the Python function | Hobby (non-commercial) |

On your computer (only to prepare the database and the seed): Node.js 20+ (with npm), and a clone of the repository with `npm install` done.

---

## 2. Database (Supabase)

### 2.1 Create the project
1. Supabase dashboard → **New project**. Name it (e.g. `mfi-route-optimizer`), set a strong **database password** (save it in your password manager), and pick the region closest to the users — for India, **Mumbai (ap-south-1)**.
2. Wait until the project is ready (1–2 minutes).

### 2.2 Create the tables
Either way gives the same schema:

* **SQL editor (no tools needed):** SQL Editor → New query → paste the whole of each `prisma/migrations/<timestamp>_<name>/migration.sql`, **oldest first**, and click **Run** after each. Expected: "Success. No rows returned".
* **Prisma CLI:** put `DATABASE_URL` and `DIRECT_URL` (step 2.3) in a local `.env`, then run `npx prisma migrate deploy`.

### 2.3 Connection strings
Supabase dashboard → **Connect** (top bar):

| Variable | Which string | Looks like |
|---|---|---|
| `DATABASE_URL` | **Transaction pooler**, port **6543** — add `?pgbouncer=true&connection_limit=1` | `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | **Session pooler** (or direct connection), port **5432** | `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres` |

The app uses the pooled one (serverless functions open many short connections); the Prisma CLI uses the direct one.

> **Use the session pooler for `DIRECT_URL`, not the "Direct connection" (`db.<ref>.supabase.co:5432`).** On the free plan that host is IPv6-only and fails with `P1001 Can't reach database server` from IPv4 networks. The session pooler (same pooler host as `DATABASE_URL`, port 5432, no query string) works everywhere.

### 2.4 Demo data
1. In your local `.env`, set `SEED_PASSWORD` to a long random password (12+ characters) — this becomes the **initial password of every seeded account**.
2. Run `npm run seed:sql` → writes `supabase/seed.sql` (it contains only bcrypt hashes, never the password).
3. SQL editor → run `supabase/seed.sql`. It creates the Baramati branch and settings, 3 officers, 48 JLG groups and 4 users: `manager@mfi.demo`, `sunita.pawar@mfi.demo`, `rahul.jadhav@mfi.demo`, `priya.shinde@mfi.demo`. It is safe to run twice.
4. Share `SEED_PASSWORD` **privately** (never in the repo or an issue). After the first sign-in, the manager resets every password from **Users → key icon**.

### 2.5 Confirm Row Level Security
SQL editor:
```sql
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1;
```
Every app table must show `true`. (Also visible in Table Editor: no "RLS disabled" warnings.) RLS with no policies means Supabase's public REST API can read nothing; only the app (through Prisma, as the table owner) can.

---

## 3. Secrets

`JWT_SECRET` signs the login session. Generate a long random value:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

The **same value** is read by Next.js (signing the cookie) and by the Python optimizer (checking the token it receives). In Vercel both read the same project variable, so set it once. Changing it later signs everyone out.

---

## 4. Vercel project

1. Push the repository to GitHub (if not already there).
2. Vercel dashboard → **Add New… → Project** → import the GitHub repository.
3. **Framework preset:** Next.js (auto-detected). **Root directory:** the repository root (`./`). Build/install commands: leave the defaults (Vercel sees `package-lock.json` and uses npm; `postinstall` runs `prisma generate`).
4. **Python function:** nothing to configure. Vercel detects `api/optimize.py` + `requirements.txt` and builds it as a Python serverless function next to Next.js. `vercel.json` sets its time limit (`maxDuration: 60`), routes `/api/optimize/*` (e.g. `/health`) to it, and excludes the non-Python folders from its bundle.
5. **Python version:** Vercel's default Python 3 runtime (3.12 at the time of writing). The code is tested on 3.11 and uses nothing version-specific.

### Function size (checked)
OR-Tools depends on numpy and pandas. Installed size of the Python runtime dependencies: **about 200 MB unzipped** (measured: ortools 81 MB, pandas 66 MB, numpy 33 MB, the rest ~20 MB). This is under Vercel's Python function bundle limit (250 MB uncompressed when this was written — confirm on [vercel.com/docs/functions/limitations](https://vercel.com/docs/functions/limitations)). `excludeFiles` in `vercel.json` keeps the app's own files out of it. If a future OR-Tools release pushes it over, see Troubleshooting.

---

## 5. Environment variables

Vercel → Project → **Settings → Environment Variables**:

| Variable | Example | Production | Preview | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | pooled string from 2.3 (port 6543, `?pgbouncer=true&connection_limit=1`) | ✔ | ✔ | runtime database access |
| `DIRECT_URL` | direct string from 2.3 (port 5432) | ✔ | ✔ | Prisma needs it declared; used by CLI commands |
| `JWT_SECRET` | 128 hex characters from step 3 | ✔ | ✔ | same value for Next.js and Python |
| `OPTIMIZER_URL` | `https://<your-project>.vercel.app/api/optimize` | ✔ | — | how the Next.js server calls the Python function. If unset, the app uses Vercel's production domain automatically. Preview deployments are protected by Vercel Authentication by default, which blocks this internal call — test optimizing on Production. |

`OSRM_URL_DEFAULT` and `SEED_PASSWORD` are only used locally by `npm run seed:sql`; do not add them to Vercel. The OSRM server the app uses is stored in the database (**Settings** page).

---

## 6. Deploy

Click **Deploy** (or push to the main branch). In the deployment's **Build Logs** you should see, in order: `npm install` (with `prisma generate`), `next build`, and a separate step building the Python function (installing `requirements.txt`). The Python function then appears under the deployment's **Functions** tab as `api/optimize.py`.

A build that fails in `next build` is almost always a missing environment variable or a type error; a failure in the Python step is almost always the bundle size (see Troubleshooting).

---

## 7. Post-deploy smoke test (on the live URL)

| # | Check | Expected |
|---|---|---|
| 1 | Open `https://<url>/api/optimize/health` | `{"status":"ok","ortools":"9.…"}` |
| 2 | `curl -X POST https://<url>/api/optimize -H "Content-Type: application/json" -d "{}"` | **401** — the optimizer rejects requests without a token |
| 3 | Sign in as `manager@mfi.demo` | lands on the Planner; sidebar shows Planner, Plans, Data, Users, Settings |
| 4 | Pick **Monday 28 Sep 2026**, press **Optimize Routes** | results in ~15–30 s (first call is slower: cold start + travel times). Road-shaped routes, 8/8 meetings |
| 5 | **Save plan**, open **Plans**, open the plan, open a day sheet | plan listed; detail, map, timeline and day sheet shown |
| 6 | Sign in as a field officer on a phone | **My Day** shows their route; Navigate opens Google Maps |
| 7 | Users → reset every seeded account's password | old password stops working |

---

## 8. Updating

* **Code:** every push to the production branch redeploys automatically; pull requests get preview deployments.
* **Database changes:** never edit an applied migration. Change `prisma/schema.prisma`, generate the SQL with `npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script` (it only reads the database), save it as a new `prisma/migrations/<timestamp>_<name>/migration.sql` (add any RLS / check constraints by hand), then run it in the Supabase SQL editor **before** deploying the code that needs it (or run `npx prisma migrate deploy` with the production `DIRECT_URL`).
* **Secrets:** after changing a variable in Vercel, redeploy (Deployments → … → Redeploy) for it to take effect.

---

## 9. Free-tier notes

* **Supabase pauses a free project after ~7 days without activity.** The app then fails to load data. Resume it: Supabase dashboard → the project → **Restore/Resume**; it is back in a few minutes with all data.
* **Vercel Hobby is for non-commercial use** — fine for this student/demo project; a real MFI deployment needs a paid plan.
* **The public OSRM server has no uptime guarantee** and asks for light use (the app throttles to 1 request/second). If it is down, days whose travel times are already cached still optimize; new points fail with "Travel-time service unavailable — try again". The OSRM URL is a setting, so a self-hosted OSRM can replace it.
* **Cold starts:** the first optimize after a quiet period loads OR-Tools (a few seconds extra). The solver itself uses the time limit from Settings (default 10 s).

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Pages fail to load data; logs show `Can't reach database server` or `prepared statement … already exists` | wrong `DATABASE_URL`, project paused, or the pooled URL without `?pgbouncer=true` | use the port **6543** string with `?pgbouncer=true&connection_limit=1`; resume a paused Supabase project; redeploy after fixing variables |
| Prisma CLI (`migrate deploy/diff`) hangs or fails | using the pooled URL for the CLI | set `DIRECT_URL` to the port **5432** string |
| Everyone is signed out, or optimize fails with "Route optimizer unavailable" and the function logs show **401** | `JWT_SECRET` missing or different between environments | set one `JWT_SECRET` for Production (and Preview), redeploy |
| Optimize fails on a preview URL only | Vercel Authentication protects preview deployments, blocking the server-to-server call | test on Production, or disable protection for previews |
| Python build fails with a size error, or the function times out | OR-Tools bundle over the limit / solver longer than `maxDuration` | keep `excludeFiles` in `vercel.json`; pin `ortools` to the tested 9.15 in `requirements.txt`; keep the solver time limit (Settings) well under 60 s |
| "Travel-time service unavailable — try again" | public OSRM server down or rate-limited | wait and retry; cached days still work; or point **Settings → OSRM URL** at another OSRM server |
| API errors like `relation "…" does not exist` or a missing column | a migration was not applied | run the missing `prisma/migrations/*/migration.sql` in the SQL editor (in order) |
| Seeded accounts cannot sign in | `seed.sql` generated with a different `SEED_PASSWORD`, or not run. Note: the seed only **inserts** (`on conflict do nothing`), so re-running it never changes the password of users that already exist | on an empty database, regenerate with `npm run seed:sql` and run it; on an already-seeded database, reset the passwords from **Users → key icon** (or update `users.password_hash` with the hashes from the new `seed.sql`) |
