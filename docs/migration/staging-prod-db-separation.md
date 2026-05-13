# Staging / Prod Database Separation

> **Status**: SHIPPED (Phases 1-6 + hops targeting). Executed 2026-05-11 / 2026-05-12.
> **Owner**: ops (qazuor).
> **Related**: `docs/migration/vps-deployment-spec.md` (Phase 17.x), engrams `vps-migration/staging-prod-db-separation`, `vps-migration/hops-target-flag-shipped`, `vps-migration/staging-db-seed-timestamp`.
>
> **Remaining**: Beta → prod migration playbook (Section 10) executes at public launch, not now. Branch strategy (post-merge `chore/vps-migration` → `main`, create `staging` branch, retarget Coolify apps to their respective branches) is the next step.

---

## 1. Context

Until this change, Hospeda runs on a single PostgreSQL instance in Coolify (`hospeda-postgres`). Both `staging.hospeda.com.ar` and the prod domains (`api.hospeda.com.ar`, `admin.hospeda.com.ar`, eventually `hospeda.com.ar` itself) share that one DB. That arrangement was fine for the migration phase but breaks down once beta testers arrive:

- The 30-40 beta testers will populate staging with real accounts, real listings, real reviews — content we want to **keep** at the prod cutover.
- Beta testers also need a **populated staging** (the seed example: ~30 users, ~50 accommodations, posts, events, reviews) so the app is not a barren shell on first visit. Filters, pagination, search performance can only be tested with realistic volume.
- Prod must reach the public launch **clean**: no seed example rows, no test users, only required data (super-admin, system user, billing plans, exchange rates, etc.).

These three constraints conflict on a single DB. The accepted solution: **split staging and prod into two PostgreSQL services**, each with its own data lifecycle.

## 2. Architecture (before vs after)

### Before

```
hospeda-postgres (single DB)
├── consumed by: api (prod), staging-api, seed scripts
└── contents: required seed + 7 OAuth test users from the sprint
```

`staging.hospeda.com.ar`, `staging-admin.*`, `staging-api.*` and `admin.hospeda.com.ar`, `api.hospeda.com.ar` all read/write the same rows.

### After

```
hospeda-postgres                      hospeda-staging-postgres
├── consumed by: api (prod)           ├── consumed by: staging-api
├── consumed by: seed (one-time      ├── consumed by: seed (re-seedable
│   reset to fresh required-only)    │   anytime — pure demo data)
└── contents: required seed ONLY     └── contents: required seed +
    (clean slate for public           example seed (full content for
    launch)                           beta tester demo)

hospeda-redis                         hospeda-staging-redis
├── consumed by: api (prod)           └── consumed by: staging-api
└── isolated rate-limit / cache /
    queue namespace
```

- `staging.hospeda.com.ar` (web) → `HOSPEDA_API_URL=https://staging-api.hospeda.com.ar` → reaches `staging-api` → reads `hospeda-staging-postgres`.
- `staging-admin.hospeda.com.ar` (admin) → same `HOSPEDA_API_URL` → same path.
- `api.hospeda.com.ar` (prod) → reads `hospeda-postgres` (the original, after reset).
- `admin.hospeda.com.ar` (prod) → same.
- Web on `hospeda.com.ar` (currently coming-soon landing): not affected by the split. When the real web app replaces the landing, it points to `api.hospeda.com.ar` → `hospeda-postgres`.

**Why Redis also splits**: rate-limit counters, queue jobs (QStash replacement), session caching, anything Better Auth or Hono middleware stores in Redis is per-DB. If staging shared Redis with prod, abuse testing or accidental high-volume signups in staging would leak rate limits into prod. Cheap to isolate.

## 3. Env var changes (one app, three vars)

Only `staging-api` changes. `staging-web` and `staging-admin` read the API via HTTP and don't touch the DB directly. Confirmed by audit:

```bash
grep -rE "HOSPEDA_DATABASE_URL" packages/config/src/env-registry.hospeda.ts
# → apps: ['api', 'seed']
```

| Var | staging-api (new value) | prod-api (unchanged) |
|---|---|---|
| `HOSPEDA_DATABASE_URL` | `postgresql://USER:PASS@hospeda-staging-postgres:5432/hospeda_staging` | `postgresql://USER:PASS@hospeda-postgres:5432/hospeda` |
| `HOSPEDA_REDIS_URL` | `redis://hospeda-staging-redis:6379` | `redis://hospeda-redis:6379` |
| `HOSPEDA_BETTER_AUTH_SECRET` | NEW random 64-hex string (different from prod) | unchanged |

The `BETTER_AUTH_SECRET` split is non-obvious but important: if staging and prod share the secret, a session cookie issued by `staging-api` would validate against `api.hospeda.com.ar` and vice versa — beta testers could accidentally "leak" into prod auth. Independent secrets isolate the cookie domains.

Everything else (`HOSPEDA_MERCADO_PAGO_*`, Brevo, Cloudinary, etc.) stays the same — staging keeps using prod credentials for those third-party services because we're not separating MP test users or Cloudinary buckets at this level. If we want full isolation later (separate MP sandbox in staging vs prod, separate Cloudinary folder), it's a separate change.

## 4. Phase 1 — Create Coolify services (UI work)

**Where**: Coolify dashboard at `https://coolify.hospeda.com.ar`.

### 4.1 Create `hospeda-staging-postgres`

1. → **Resources** → **+ New** → **Database** → **PostgreSQL** → **17 (alpine)**.
2. Settings:
   - **Name**: `hospeda-staging-postgres`
   - **Server**: same as `hospeda-postgres` (the only VPS we have).
   - **Project**: same project as the other services (`hospeda` or whatever it's called).
   - **Public**: OFF. We don't expose Postgres publicly.
   - **DB name**: `hospeda_staging`
   - **DB user**: `hospeda_staging_user`
   - **DB password**: generate fresh (Coolify "regenerate" button), copy to your password manager — you'll need it for the env var.
3. Click **Deploy**. Wait ~30s for the container to be healthy.
4. Note the **internal hostname** displayed by Coolify (probably `hospeda-staging-postgres-<uuid>` or similar). Coolify usually exposes a DNS alias that matches the service name; check the "Connection details" panel for the final internal URL.

### 4.2 Create `hospeda-staging-redis`

Same flow:

- **Resources** → **+ New** → **Database** → **Redis** → 7 (alpine).
- Name: `hospeda-staging-redis`.
- Same server, same project.
- Public OFF.
- Deploy. Note the internal hostname.

### 4.3 Capture the internal URLs

After both services are up, build the two connection strings:

```
HOSPEDA_DATABASE_URL=postgresql://hospeda_staging_user:<PASSWORD>@hospeda-staging-postgres:5432/hospeda_staging
HOSPEDA_REDIS_URL=redis://hospeda-staging-redis:6379
```

The hostname after `@` should match exactly what Coolify shows in the service's connection details panel — sometimes there's a UUID suffix Coolify uses internally. If `hops` env-list works fine on the existing prod containers, the same naming convention applies here.

## 5. Phase 2 — Update `staging-api` env vars

**Where**: Coolify dashboard → `staging-api` application → Environment Variables tab.

Update three vars:

1. `HOSPEDA_DATABASE_URL` → the new staging Postgres connection string.
2. `HOSPEDA_REDIS_URL` → the new staging Redis URL.
3. `HOSPEDA_BETTER_AUTH_SECRET` → generate a new 64-hex string:

   ```bash
   openssl rand -hex 32
   ```

   Paste the output as the value. Keep the old prod value untouched on `api` (prod).

Click **Save**. **Do NOT redeploy yet** — first we need to migrate and seed the new DB, otherwise the staging-api will boot, try to query an empty schema, and crash-loop.

## 6. Phase 3 — Migrate the staging schema

The staging DB is empty after creation. We need to push the Drizzle schema, apply postgres-extras (triggers + materialized views + JSONB CHECK constraints), and verify.

**Approach: temporary "Make Publicly Accessible" toggle in Coolify**. Validated path from the original Fase 12.1 migration (engram `vps-migration/db-schema-and-seeds-complete`). SSH tunnels had docker network bridge issues last time; the toggle worked clean.

### 6.1 Expose staging Postgres temporarily

1. Coolify → `hospeda-staging-postgres` → **Settings** → toggle **"Make Publicly Accessible"** ON.
2. Coolify reveals a public connection string with the VPS public IP and a random external port, something like `postgresql://hospeda_staging_user:<PASS>@216.238.103.219:<RANDOM_PORT>/hospeda_staging`.
3. Copy that public URL — it's the temporary `HOSPEDA_DATABASE_URL` for the migrate + seed steps from your laptop.

### 6.2 Push the schema

From the worktree root (`/home/qazuor/projects/WEBS/hospeda-vps`) on your laptop:

```bash
export HOSPEDA_DATABASE_URL='postgresql://hospeda_staging_user:<PASS>@216.238.103.219:<RANDOM_PORT>/hospeda_staging'
pnpm --filter @repo/db db:push
```

Expected output: drizzle-kit lists CREATE TABLE statements, applies them, exits 0. You should see all the tables (`users`, `accommodations`, `destinations`, `posts`, `events`, `billing_*`, etc.).

### 6.3 Apply postgres extras

Triggers, materialized views (`search_index`), and JSONB CHECK constraints on `billing_addon_purchases` are NOT covered by drizzle-kit push. Apply them manually:

```bash
# Still in the same shell, with HOSPEDA_DATABASE_URL set
bash packages/db/scripts/apply-postgres-extras.sh
```

Expected output: each of the 21 SQL files in `packages/db/src/migrations/manual/` is applied (NOTICEs about "trigger does not exist, skipping" on first run are expected — files use DROP IF EXISTS before CREATE for idempotency).

### 6.4 Smoke

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

Should return ~30+ tables. If 0, push didn't apply — debug before moving on.

### 6.5 Lesson from previous migration

The original Fase 12.1 migration discovered that **the API container boots "healthy" against an empty DB** because `/health` doesn't touch DB. Billing customer middleware fails silently. Don't rely on healthcheck status to validate migration — always smoke a DB-touching endpoint:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SELECT COUNT(*) FROM role_permission;"
# Expected: 595 rows (after required seed runs in Phase 4)

psql "$HOSPEDA_DATABASE_URL" -c "SELECT COUNT(*) FROM destinations;"
# Expected: 27+ rows (after required seed in Phase 4) or higher (after example seed adds more)
```

Open TODO from prior migration (still applies): add to `apps/api` startup an explicit healthcheck that touches `role_permission` and fails hard if 0 rows. Currently tracked as a follow-up, not blocking this split.

## 7. Phase 4 — Seed the staging DB

With `HOSPEDA_DATABASE_URL` still pointing to the public staging URL from Phase 3:

```bash
pnpm db:seed --reset --required --example
```

`--reset` is safe here — the DB is brand new, dropping its empty rows is a no-op. `--required` puts in super-admin, system user, billing plans, exchange rates. `--example` adds the 30+ demo users, ~50 accommodations, posts, events, reviews, etc.

Expected timing: ~3-5 min depending on Cloudinary cache state. The seed pre-uploads images to Cloudinary; if `HOSPEDA_CLOUDINARY_*` env vars are set in your local shell, it'll reuse the cache; otherwise it skips remote upload and uses URL placeholders.

### 7.1 Capture the seed-completion timestamp

**CRITICAL** for the future beta → prod migration. Run this immediately after seed succeeds:

```bash
psql "$HOSPEDA_DATABASE_URL" -c "SELECT MAX(created_at) AS seed_completed_at FROM users;"
```

**SEED_TIMESTAMP (captured 2026-05-11):** `2026-05-11 21:00:00.490193+00`

Any user in the staging DB with `created_at > '2026-05-11 21:00:00.490193+00'` is a real beta tester (or your own real OAuth signup). Anything with `created_at <= SEED_TIMESTAMP` is seed data. This is the filter the migration script in Section 10 uses. Also stored in engram `vps-migration/staging-db-seed-timestamp`.

### 7.2 Turn off public exposure

Critical: **before** redeploying staging-api, go back to Coolify → `hospeda-staging-postgres` → toggle **"Make Publicly Accessible"** **OFF**. From here on, only the staging-api container reaches the DB (via the internal docker network using the hostname `postgresql-database-qqwydyilhgifup0wsb2v27uq`).

Optional but recommended: **rotate the staging Postgres password** in Coolify after toggling off. The password was transmitted in a connection string over your local shell and may be in clipboard/scrollback. Generate a new one, update `HOSPEDA_DATABASE_URL` env var of staging-api with the new password, then redeploy.

### 7.3 Smoke from the app

```bash
# Trigger a redeploy now that the DB is populated and exposure is off:
hops redeploy staging-api
```

Then in the browser:

- Open `https://staging.hospeda.com.ar` → should show destinations + accommodations from the seed.
- Open `https://staging-admin.hospeda.com.ar/auth/signup` → signup with Google or Facebook → check the user is created in **staging** DB. Verify by re-enabling the public toggle briefly, running:

  ```bash
  psql "$HOSPEDA_DATABASE_URL_STAGING_PUBLIC" -c "SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 5;"
  ```

  Disable the public toggle again after verification.

## 8. Phase 5 — Reset the prod DB to fresh

This is the destructive step. **Triple-check the connection string before running.** Confirms:

- `psql "$HOSPEDA_DATABASE_URL" -c "SELECT current_database();"` returns `hospeda` (NOT `hospeda_staging`).
- The host portion is `hospeda-postgres` (NOT `hospeda-staging-postgres`).

### 8.1 Backup first (non-negotiable)

```bash
# On the VPS, not via tunnel:
ssh -p 2222 qazuor@216.238.103.219
hops db-backup-now
```

Note the resulting R2 path (`s3://hospeda-backups/manual/hospeda-postgres-<TS>.dump`). This is your rollback point.

### 8.2 Reset

Same "Make Publicly Accessible" approach as Phase 3, applied to the prod Postgres this time:

1. Coolify → `hospeda-postgres` → toggle **"Make Publicly Accessible"** ON.
2. Copy the public connection string (will be `postgresql://...@216.238.103.219:<PORT>/hospeda`).
3. From your laptop:

   ```bash
   export HOSPEDA_DATABASE_URL='postgresql://hospeda_user:<PROD_PASS>@216.238.103.219:<PROD_PORT>/hospeda'

   # Triple-check the connection points to prod (NOT staging):
   psql "$HOSPEDA_DATABASE_URL" -c "SELECT current_database();"
   # Expected: hospeda  (NOT hospeda_staging)

   # Drop and reseed:
   psql "$HOSPEDA_DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   pnpm --filter @repo/db db:push
   bash packages/db/scripts/apply-postgres-extras.sh
   pnpm db:seed --reset --required          # NOTE: no --example
   ```

4. Toggle **"Make Publicly Accessible"** OFF on `hospeda-postgres` in Coolify.
5. Recommended: rotate the prod Postgres password too (same logic — was in connection string in local shell). Update `HOSPEDA_DATABASE_URL` of `api` (prod) with the new password, then redeploy.

Prod ends up with required-only seed.

### 8.3 Redeploy prod-api

```bash
hops redeploy api
```

Boots fresh, picks up the now-required-only DB.

### 8.4 Smoke prod

- `https://api.hospeda.com.ar/api/v1/public/health` → 200.
- `https://admin.hospeda.com.ar/auth/signup` → signup with your real account → user is created in **prod** (not staging). Promote yourself to SUPER_ADMIN: `psql "$HOSPEDA_DATABASE_URL_PROD" -c "UPDATE users SET role='SUPER_ADMIN', email_verified=true WHERE email='<your-email>';"`

## 9. Phase 6 — Validation checklist

- [ ] `https://staging.hospeda.com.ar` shows seed accommodations.
- [ ] `https://staging-admin.hospeda.com.ar/auth/signup` creates user in staging DB only.
- [ ] `https://admin.hospeda.com.ar/auth/signup` creates user in prod DB only.
- [ ] `psql staging` and `psql prod` show different row counts for `users`, `accommodations`, etc.
- [ ] Newsletter form on `https://hospeda.com.ar` (landing) still submits to prod API (`api.hospeda.com.ar`) and lands in Brevo.
- [ ] OAuth signup with same Google account on staging and prod creates two **separate** user rows (one per DB) — auth secrets are different, so cookies don't cross over.

---

## 10. Beta → prod migration playbook (future)

This section is the **runbook to use at the public launch cutover**, probably 4-8 weeks after the staging DB is populated and beta testers have created content. It's documented now so the script is ready when needed.

### 10.1 What we migrate FROM staging TO prod

| Entity | Filter | Notes |
|---|---|---|
| `users` | `created_at > '2026-05-11 21:00:00.490193+00'` | Real beta tester accounts. SEED_TIMESTAMP captured Section 7.1. |
| `accounts` (Better Auth) | `user_id IN (selected users)` | OAuth provider identities. Without these, beta testers can't log in. |
| `accommodations` | `owner_id IN (selected users)` | Listings beta testers created. **See destination FK problem below.** |
| `accommodation_media` | via `accommodation_id` | Photos. |
| `accommodation_amenities` | via `accommodation_id` | Amenity links. |
| `accommodation_features` | via `accommodation_id` | Feature links. |
| `posts` | `author_id IN (selected users)` | Posts beta testers wrote. |
| `events` | `organizer_id IN (selected users)` OR `creator_id IN (selected users)` | Events. |
| Reviews of beta-tester entities | `accommodation_id IN (...)` | Reviews ON beta-tester accommodations, regardless of reviewer. |
| Reviews BY beta testers | `reviewer_id IN (selected users)` | Reviews beta testers wrote on seed entities — **see below**. |

### 10.2 What we do NOT migrate

- `users` with `created_at <= SEED_TIMESTAMP` → those are seed-fake users.
- `accounts` of seed users (auto-excluded by filter on `user_id`).
- All `destinations` from staging → prod has its own curated destinations (see 10.4).
- All `accommodations` whose `owner_id` is a seed user → fake listings.
- All `posts`/`events` of seed users → fake content.
- `sessions` (Better Auth) → beta testers re-login at cutover. Sessions in staging are local to staging-api anyway.
- `revalidation_logs`, `audit_logs`, internal queues → ephemeral, don't migrate.

### 10.3 Destination FK problem (the gotcha)

Beta testers create accommodations linked to `destination_id = <some UUID>`. If that destination is a **seed** destination (which most will be, since the seed populates Concepción del Uruguay, Concordia, Federación, etc.), the `destination_id` in staging will NOT exist in prod — prod doesn't have seed destinations.

**Strategy**: pre-populate prod with **real, curated destinations** that match the seed example destinations by **slug** before the cutover. The seed example uses real city slugs (`chajari`, `concordia`, `federacion`, `gualeguay`, etc.), so prod's real destinations should use the same slugs.

**Remap step in the migration script**:

```sql
-- In prod, after pre-populating real destinations:
-- 1. Build a slug → new_id map for prod destinations.
-- 2. For each beta-tester accommodation:
--    UPDATE accommodations SET destination_id = (
--      SELECT id FROM prod.destinations WHERE slug = (
--        SELECT slug FROM staging.destinations WHERE id = <old_id>
--      )
--    );
```

If a beta tester picked a seed destination that does NOT exist in prod (unlikely if we mirror the seed slugs), the accommodation gets dropped or flagged for manual review.

### 10.4 Pre-cutover prep for prod destinations

Before running the migration script, in prod:

1. Seed only the destinations from the same slugs the example seed uses, but with **real curated content** (real descriptions, real images, owner=system user, status=PUBLISHED).
2. Confirm slugs match: `SELECT slug FROM staging.destinations` and `SELECT slug FROM prod.destinations` should overlap 100% for slugs beta testers actually used.

Alternative: write a dedicated "prod destinations" seed in `packages/seed/src/data/destination/prod/` separate from `example/`, and a new CLI flag `--prod-destinations` that loads only that file set. Worth doing if the curated prod destinations diverge significantly from the example.

#### Curated prod destinations inventory (as of 2026-05-13)

Verified slug parity between staging and prod: **27 destinations on both sides, diff empty**.

Region: Entre Ríos province (Litoral argentino) and adjacent administrative areas. Curated for the launch market.

| # | Slug | Notes |
|---|---|---|
| 1 | `argentina` | Country-level anchor (parent scope) |
| 2 | `caseros` | |
| 3 | `ceibas` | |
| 4 | `chajari` | |
| 5 | `colon` | |
| 6 | `concepcion-del-uruguay` | Primary launch city |
| 7 | `concordia` | |
| 8 | `departamento-uruguay` | Administrative region containing Concepción del Uruguay |
| 9 | `entre-rios` | Province-level anchor |
| 10 | `federacion` | |
| 11 | `gualeguay` | |
| 12 | `gualeguaychu` | |
| 13 | `ibicuy` | |
| 14 | `larroque` | |
| 15 | `liebig` | |
| 16 | `litoral-argentino` | Region-level anchor |
| 17 | `rosario-del-tala` | |
| 18 | `san-jose` | |
| 19 | `san-justo` | |
| 20 | `san-salvador` | |
| 21 | `santa-ana` | |
| 22 | `ubajay` | |
| 23 | `urdinarrain` | |
| 24 | `victoria` | |
| 25 | `villa-elisa` | |
| 26 | `villa-paranacito` | |
| 27 | `villaguay` | |

#### Verification command (re-run periodically)

```bash
hops psql --target=prod -t 'SELECT slug FROM destinations WHERE deleted_at IS NULL ORDER BY slug;' > /tmp/prod-destinations.txt
hops psql --target=staging -t 'SELECT slug FROM destinations WHERE deleted_at IS NULL ORDER BY slug;' > /tmp/staging-destinations.txt
diff /tmp/prod-destinations.txt /tmp/staging-destinations.txt
```

Diff should be empty. If non-empty, the migration script (SPEC-104) will fail to remap `destination_id` for any accommodation whose destination slug only exists on one side. Run this check pre-cutover.

### 10.5 Reviews ON seed entities (data loss)

Reviews/bookmarks that beta testers create on **seed** accommodations (the demo content) cannot be preserved because:

- The seed accommodation doesn't exist in prod.
- We can't import the accommodation (it's fake content).
- We can't migrate the review without its parent FK target.

**Communication to beta testers**: announce X days before cutover that:

- Their accounts will be preserved (re-login required).
- Their **own** listings/posts/events will be preserved.
- Reviews and bookmarks on **demo content** will be lost.
- Reviews and bookmarks on **other beta testers' content** will be preserved.

### 10.6 Migration script outline

The script is **not written yet** — write it ~1 week before the cutover when actual data exists in staging. Sketch:

```typescript
// scripts/migrate-staging-to-prod.ts
// Run with: pnpm tsx scripts/migrate-staging-to-prod.ts
//   --staging-db postgresql://...staging...
//   --prod-db postgresql://...prod...
//   --seed-timestamp '2026-05-12 15:30:00'
//   --dry-run   (default; pass --execute to actually write)
//
// Steps:
// 1. Connect to staging, identify beta_user_ids (WHERE created_at > seed_timestamp).
// 2. Build destination slug→id remap from prod.
// 3. For each table in dependency order:
//    - Read rows from staging.
//    - Apply transformations (destination_id remap, etc.).
//    - Insert into prod with same UUIDs (UUIDs are globally unique, no collision).
// 4. Print summary: N users, M accommodations, K reviews migrated; L dropped.
// 5. Verify: count rows in prod, spot-check a few FK chains.
```

UUID handling: since both DBs use UUIDs and beta-tester UUIDs were generated post-seed (different from any seed UUID in either DB), there are no collisions when importing into prod. The only conflict possible is if a prod row was created (e.g., a real prod user post-Phase-8) with the same UUID as something in staging — astronomically unlikely with UUIDv4.

### 10.7 Rollback plan

Before the migration script runs, take a fresh `hops db-backup-now` on prod. If anything goes wrong, `hops db-restore` picks that backup. Beta testers see a "we hit a delay, retrying in 2h" landing page during the redo.

### 10.8 Open questions

- **MercadoPago customer migration**: if beta testers added payment methods in staging (against MP sandbox or prod), the `billing_customers` rows in staging point to MP customer IDs in MP's system. Those customer IDs are tied to the merchant + access token, so if staging and prod use the same MP credentials (Section 3 says they do today), the MP customers are valid in both. If we ever separate MP creds, the migration needs to re-create MP customers in the new credentials. **Decide before launch whether MP creds split**.
- **Cloudinary asset re-upload**: photos uploaded by beta testers are in `hospeda/staging/...` Cloudinary folder. Migration script should either (a) move them to `hospeda/prod/...` via Cloudinary Admin API, or (b) leave them in staging folder and update the URL prefix in the migrated rows. **Decide which approach**.
- **Search index rebuild**: prod's `search_index` materialized view needs `REFRESH MATERIALIZED VIEW CONCURRENTLY search_index;` after the migration. Document the step.

---

## 10.9 Post-launch: prod → staging data sync (continuous testing workflow)

Once prod is live and the initial beta → prod migration is done, the staging DB enters a **second lifecycle** as a pre-prod testing environment. Goal: validate features and migrations against realistic production-like data BEFORE shipping to prod.

### Workflow

```
prod DB ──[snapshot]──▶ staging DB ──[sanitize PII]──▶ tester runs feature ──[validate]──▶ merge to main ──▶ deploy prod
```

### Steps (manual or scheduled)

1. **Snapshot prod**: `hops db-backup-now --target prod` (or whatever the `hops` targeting flag becomes after Section 11.1). Produces `s3://hospeda-backups/manual/hospeda-postgres-<TS>.dump`.
2. **Restore to staging**: `hops db-restore --target staging --from s3://...`. Wipes staging DB and replaces with the prod snapshot.
3. **Sanitize PII** (CRITICAL): a script (TBD) iterates over privacy-sensitive tables and replaces real values with synthetic ones:
   - `users.email` → `user-<id>@staging.test`
   - `users.phone` → null or placeholder
   - `accounts.password` (Better Auth credential rows) → null, force re-signup in staging
   - `accounts.access_token` / `refresh_token` (OAuth) → null, beta testers can't actually OAuth in staging post-sync, only by signing up fresh
   - `billing_customers.mp_customer_id` → null or replaced with MP sandbox IDs
   - Reviews/posts content that may have PII (phone numbers, real names in body) → consider an LLM-based redaction or simpler regex sweep
4. **Smoke staging**: web/admin/api still respond, feature under test works.
5. **Tester (you) validates the feature against the sync'd data**.
6. **Merge feature to main → deploy to prod**.

### Why this matters

- Catches bugs that only show with realistic data volume / shape (the seed example is too "clean").
- Tests migrations against actual prod state before applying.
- Reproduces customer-reported issues in a safe environment.
- Lets you experiment with destructive ops (e.g. backfill scripts, mass updates) without risking prod.

### Cadence

- **On-demand**: trigger a sync before working on a risky feature (billing changes, schema migrations, etc.). Manual `hops` invocation.
- **Optional periodic**: weekly cron (e.g. `0 0 * * 0` — Sunday midnight UTC). Trade-off: staging DB always recent, but any data created in staging between syncs gets wiped. For solo-developer setup with low staging usage, on-demand is probably enough.

### Sanitization script — design notes (future work)

- Lives at `scripts/db/sanitize-staging.ts` or similar.
- Connects to staging DB ONLY (refuses to run against `current_database() = 'hospeda'`).
- Idempotent: running it twice on the same DB produces the same result.
- Logs every row modified, count per table, total elapsed.
- Dry-run mode (`--dry-run`) reports what WOULD change without writing.
- Run via `hops`: e.g. `hops db-sanitize --target staging --dry-run` first, then `--execute`.

### Gotchas to document when implementing

- **Better Auth sessions**: prod sessions migrated to staging are invalid (different `BETTER_AUTH_SECRET` per env). Beta testers would have to re-login in staging post-sync. That's expected — staging is for YOUR testing, not for beta testers to keep using.
- **Foreign keys with system / super-admin rows**: required-seed UUIDs are stable across envs (well-known UUIDs for system user, super-admin, etc.) — they map 1:1 between prod and staging. Sync doesn't need to remap these.
- **Cloudinary URLs**: photos uploaded by prod users live in `hospeda/prod/...` Cloudinary folder. Synced staging DB references those same URLs. Staging displays prod photos — that's typically fine, but if you want full isolation, the sync script could rewrite URLs to staging buckets (and copy assets) — defer until needed.

### Implementation timeline

- **NOT for this sprint** — beta hasn't even started. The first time we need this workflow is when there's enough real prod data to make synthetic seed feel insufficient, AND we're about to ship a risky feature.
- Estimated effort: ~6-10h for the initial implementation (sync command in hops, sanitization script, doc updates, test runs).

---

## 11. Maintenance after the split

- **Backups**: both DBs need daily backups. Coolify's built-in scheduled backup applies per-service, so `hospeda-postgres` and `hospeda-staging-postgres` each need their own backup config.
- **`hops` commands** (Section 11.1 below): `findContainer()` in `scripts/server-tools/src/lib/container-lookup.ts` does NOT distinguish prod vs staging today. With two Postgres / Redis / api / web / admin containers in Coolify post-split, several commands will likely fail loud (multiple matches per kind) or match the wrong container. Targeting work needed before hops is fully usable against both environments.

### 11.1 `hops` targeting plan (prod vs staging)

**Goal**: a single hops install handles both environments via flag/env-var, defaulting to prod.

**Design**:

- New env var `HOPS_TARGET=prod|staging` in `.env.local`, default `prod`.
- New global flag `--target=prod|staging` parsed before sub-command dispatch, overrides env var per invocation.
- `findContainer(kind)` resolves the actual `coolify.resourceName` from a small lookup:
  - `kind=postgres`, `target=prod` → `hospeda-postgres`
  - `kind=postgres`, `target=staging` → `hospeda-staging-postgres`
  - `kind=api`, `target=prod` → `api`
  - `kind=api`, `target=staging` → `staging-api`
  - etc.
- Hardcode the mapping table OR expose it via env vars (`HOPS_PROD_POSTGRES_RESOURCE_NAME`, `HOPS_STAGING_POSTGRES_RESOURCE_NAME`, etc.) for flexibility. Probably hardcoded with overrides is the cleanest.
- Update all commands that resolve containers: `psql`, `db-counts`, `db-backup-now`, `db-restore`, `app-restart`, `prune`, `redeploy`, `exec`, `logs`, `find`, `env-list`, `env-set`, `env-delete`, `env-pull`, `health`, `cron-list`, `cron-trigger`. Most will work transparently if `findContainer` is the bottleneck; some (like `redeploy`) may need additional plumbing for the Coolify API call.
- `.env.local.example` documents the var.
- README documents the flag.
- Smoke against prod (default) and staging targets after deploy.

**Effort**: ~1-2h code + ~30 min smoke. Best done in a dedicated branch (`feat/hops-target-flag`) post-merge to main.

**Until this lands**: staging-side DB ops (migrate, seed, query, backup, restore) go via the temporary "Make Publicly Accessible" toggle + laptop with public connection string, as documented in Phases 3-4 and 8 of this doc.

- **Schema migrations**: when schema changes ship, BOTH DBs need the migration. Routine: drizzle-kit push to staging first (via tunnel), validate, then to prod. The order matters because we want bugs to show up in staging first.
- **Re-seeding staging**: at any time during beta, if seed content gets corrupted, `pnpm db:seed --reset --required --example` against staging is safe — it does NOT touch prod and does NOT touch beta-tester data. **Wait**: it DOES `--reset` which drops the schema. Beta-tester data IS lost on re-seed. Document this clearly in any team runbook.

  **Better runbook for re-seeding staging mid-beta**: instead of `--reset`, write a "refresh-example-only" command that DELETEs only rows with `created_at <= SEED_TIMESTAMP` and re-inserts the example seed without touching post-seed-timestamp data. Spec it if mid-beta re-seed becomes a real need.

## 12. Acceptance criteria for "DB split is done"

- [x] `hospeda-staging-postgres` and `hospeda-staging-redis` running in Coolify.
- [x] `hospeda-api-staging`, `hospeda-admin-staging`, `hospeda-web-staging` created and serving the `staging-*` hosts (separate from the prod apps).
- [x] `hospeda-api-prod` reverted to prod DB and `staging-api.hospeda.com.ar` host removed from its labels.
- [x] Staging DB has full seed: `users=41`, `accommodations=104`, `destinations=27`, `posts=18`, `events=24` (verified 2026-05-11 21:00 UTC).
- [x] Prod DB has required-only seed: `accommodations=0`, `posts=0`, `destinations=23` (required cities only, no example bumps).
- [x] OAuth signup flow CORS verified — `staging-api` returns `access-control-allow-origin: https://staging.hospeda.com.ar` for `/api/v1/public/auth/me`; prod-api correctly rejects same origin (no leak).
- [x] Cookies between the two are independent (separate `HOSPEDA_BETTER_AUTH_SECRET`, sha256 hashes `8a65856048d4aaa1` staging vs `0b86c54a6a2cbccb` prod).
- [x] Section 10 (migration playbook) drafted and reviewed.
- [x] SEED_TIMESTAMP captured: `2026-05-11 21:00:00.490193+00`. Stored in engram `vps-migration/staging-db-seed-timestamp`.
- [x] `hops --target=prod|staging` flag shipped (Section 11.1) with target-aware DB credentials.
- [ ] Backups configured for `hospeda-staging-postgres` (deferred — set up Coolify scheduled backup for the new service before the beta opens).
- [ ] OAuth provider consoles (Google + Facebook) updated with staging redirect URIs (in-progress — see Section 14).

---

## 13. Effort accounting

- Phase 1-2 (Coolify UI): ~30 min
- Phase 3-4 (migrate + seed staging): ~30 min including troubleshooting tunnels
- Phase 5 (reset prod): ~20 min
- Phase 6 (validation): ~30 min
- Hops targeting (Section 11.1): ~2h code + smoke + 3 follow-up commits to fix compiled-binary dotenv loader and target-aware DB credentials.
- Phase 10 setup work (curated prod destinations + script): deferred to ~1 week before cutover.

**Total today**: ~5h end-to-end. Migration script + cutover prep: ~5-8h done close to launch.

## 14. OAuth provider console updates (Google + Facebook)

Better Auth resolves callback URLs as `<HOSPEDA_BETTER_AUTH_URL>/callback/<provider>`. With prod + staging running, BOTH sets of URLs must be allow-listed in the corresponding OAuth provider consoles, or staging signups fail with `redirect_uri_mismatch`.

The OAuth client IDs / secrets themselves are SHARED between prod and staging (same `HOSPEDA_GOOGLE_CLIENT_ID` etc. in both api containers' env vars). The provider consoles simply need to know about both redirect URIs.

### 14.1 Google Cloud Console

URL: `https://console.cloud.google.com/apis/credentials` → project where the Hospeda OAuth client lives → click the OAuth 2.0 Client ID matching `HOSPEDA_GOOGLE_CLIENT_ID`.

**Authorized JavaScript origins** — add staging hosts alongside existing prod entries:

```
https://hospeda.com.ar
https://admin.hospeda.com.ar
https://staging.hospeda.com.ar          <-- new
https://staging-admin.hospeda.com.ar    <-- new
```

**Authorized redirect URIs** — add staging api callback alongside prod:

```
https://api.hospeda.com.ar/api/auth/callback/google
https://staging-api.hospeda.com.ar/api/auth/callback/google    <-- new
```

Save. Google takes ~1 minute to propagate.

### 14.2 Facebook Developers Console

URL: `https://developers.facebook.com/apps/` → the Hospeda app → **Facebook Login → Settings**.

**Valid OAuth Redirect URIs** — add staging alongside prod:

```
https://api.hospeda.com.ar/api/auth/callback/facebook
https://staging-api.hospeda.com.ar/api/auth/callback/facebook    <-- new
```

Then in **App Settings → Basic → App Domains**, add:

```
hospeda.com.ar
admin.hospeda.com.ar
staging.hospeda.com.ar          <-- new
staging-admin.hospeda.com.ar    <-- new
```

**Site URL** in App Settings → Basic stays `https://hospeda.com.ar` (single canonical site, the rest are aliases).

Save. Facebook can take 2-5 minutes to propagate.

### 14.3 Smoke

After both consoles propagate:

```bash
# Prod OAuth still works (unchanged behaviour)
# Open https://admin.hospeda.com.ar/auth/signin → click Google → complete flow → land back

# Staging OAuth now works
# Open https://staging-admin.hospeda.com.ar/auth/signin → click Google → complete flow → land back
# Repeat with Facebook
```

If `redirect_uri_mismatch` fires:

1. Re-check the URI added in the console matches **exactly** (trailing slash, scheme, casing).
2. Re-check `HOSPEDA_BETTER_AUTH_URL` in `hospeda-api-staging` env is `https://staging-api.hospeda.com.ar/api/auth`.
3. Wait another 1-2 minutes for propagation.

### 14.4 Future: separate OAuth apps per env

For full isolation between prod and staging, the long-term play is **two separate OAuth apps** (one per env). Pros: revoking staging client_id doesn't impact prod, dashboards / metrics separated, can ship staging-specific consent screens. Cons: more setup, two sets of secrets to rotate. Defer until the current setup proves limiting.
