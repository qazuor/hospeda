# Backfill Runbook: billing_addons (SPEC-192)

**Purpose**: Populate `billing_addons` with the 5 catalog add-on definitions
before the FR-2 cutover that switches the read path from the in-memory
`ALL_ADDONS` array to DB-backed rows.

**Type**: Data-only backfill. No DDL required. The `billing_addons` table
already exists (created in the SPEC-192 T-001 migration). This runbook only
runs the idempotent seed against each environment.

---

## Pre-conditions

- The SPEC-192 migration (`billing_addons` table creation) is already applied
  to the target environment.
- The `billingAddons.seed.ts` seeder is deployed (part of the same SPEC-192
  release package).
- **This backfill MUST complete before the FR-2 cutover deploys.** The
  DB-backed read path (`addonCatalogRepository.getAllAddons()`) will return
  an empty result if the rows are absent, breaking the add-on catalog for
  all users.

---

## Step 1 — Backfill staging

SSH to the VPS and run:

```bash
hops db-seed --target=staging
```

The seed runner is idempotent. Each add-on is checked by `name` before
inserting. Re-running is safe and a no-op when rows already exist.

Expected terminal output (abbreviated):

```
✅  Created add-on: "Visibility Boost (7 days)" (visibility-boost-7d) - one-time, ARS $5.000
✅  Created add-on: "Visibility Boost (30 days)" (visibility-boost-30d) - one-time, ARS $15.000
✅  Created add-on: "Extra Photos Pack (+20 photos)" (extra-photos-20) - recurring, ARS $5.000
✅  Created add-on: "Extra Accommodations Pack (+5)" (extra-accommodations-5) - recurring, ARS $10.000
✅  Created add-on: "Extra Properties Pack (+5)" (extra-properties-5) - recurring, ARS $20.000
ℹ  Summary: 5 created, 0 skipped, 5 total
```

If the seed was already run previously, all lines will show "Skipping" and
the summary will read `0 created, 5 skipped, 5 total`. Both outcomes are correct.

---

## Step 2 — Verify staging

Run a read-only count query against the staging database. From the VPS:

```bash
hops exec api --target=staging -- psql "$HOSPEDA_DATABASE_URL" \
  -c "SELECT count(*) FROM billing_addons;"
```

Expected result: **5**.

If the count is less than 5, re-run Step 1. The seeder is idempotent so
re-running is always safe.

---

## Step 3 — Backfill production

After staging soak time and before the FR-2 cutover deploy, run:

```bash
hops db-seed --target=prod
```

Same idempotency guarantees apply. Expected: 5 rows created (or 0 if already
run), summary confirms `5 total`.

---

## Step 4 — Verify production

```bash
hops exec api --target=prod -- psql "$HOSPEDA_DATABASE_URL" \
  -c "SELECT count(*) FROM billing_addons;"
```

Expected result: **5**. This count MUST equal `ALL_ADDONS.length` (5) before
the FR-2 cutover is deployed.

---

## Deploy ordering (critical)

```
1. Apply SPEC-192 migration (billing_addons table)  ← already done at release
2. Run backfill (this runbook)                      ← BEFORE step 3
3. Deploy FR-2 cutover (DB-backed read path active)
```

Reversing steps 2 and 3 causes the catalog to return empty rows until the
seed is manually applied, producing visible breakage in add-on purchase flows.

---

## Local verification note

If your local dev database lacks rows (e.g. after a fresh local setup without
seeding), run:

```bash
pnpm db:seed
```

Do NOT use `pnpm db:fresh`, `pnpm db:fresh-dev`, or `pnpm db:push`. Those
commands reset the database. `pnpm db:seed` runs the required seeds
(including `billingAddons.seed.ts`) against the existing schema without a
reset. It is idempotent and safe to run multiple times.

To verify locally (read-only):

```bash
# Requires local DB running: pnpm db:start
psql "$HOSPEDA_DATABASE_URL" -c "SELECT count(*) FROM billing_addons;"
```

Expected: **5**.

---

## Rollback

No rollback required for a data-only backfill. If the FR-2 cutover is
reverted (code rollback), the `billing_addons` rows remain in the table but
are unused by the reverted code path, causing no harm. Rows can be cleaned
with `DELETE FROM billing_addons;` if needed, but this is optional.
