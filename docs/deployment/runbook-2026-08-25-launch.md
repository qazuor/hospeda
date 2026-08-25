# Launch Runbook — 2026-08-25

Execution sheet for the launch release. It does **not** replace
[`checklist.md`](./checklist.md), which holds the general procedure, the rollback
paths and the command reference. This file records what is specific to **this**
release: the exact pending sets, the numbers the rehearsal produced, the order the
steps must run in and why, and the one user-visible consequence that must be
announced rather than discovered.

Rehearsed on 2026-08-23 against a throwaway clone of production
(`hops db-migrate-test --target=prod --keep --pull`). Every number below is measured,
not estimated.

---

## What this release carries

| Rail | Pending | Notes |
| --- | --- | --- |
| 1. Schema | **7** (`0092` → `0098`) | six additive; `0098` drops a table — see [Order](#order-and-why-it-is-this-order) |
| 2. Extras | 36 applied in the rehearsal | idempotent, re-applied every run |
| 3. Seed data | **11** (`0058` → `0069`) | five are `destructive: true` |

Production before the release: **92** schema migrations applied, **57** seed
data-migrations applied (`0057-staff-email-domain-to-com-ar` is the last one).

### The 11 pending seed data-migrations

```
0058-purge-seed-example-data                          destructive
0059-purge-test-and-commerce-example                  destructive
0060-social-formats-feed-ratio-4x5
0061-hos-688-commerce-vertical-catalogue
0062-hos686-commerce-listing-moderation-permission
0064-hos-590-commerce-vertical-trial-30-days
0065-hos-692-purge-orphaned-commerce-fixtures         destructive
0066-hos-692-domain-rewrite-and-plan-cleanup          destructive
0067-hos-726-addon-purchase-permission
0068-hos-749-prod-billing-cleanup                     destructive
0069-hos-733-advanced-stats-premium-only
```

---

## ANNOUNCE THIS BEFORE YOU START

`0059` purges 23 test accounts and everything they own. Production's `experiences`
and `gastronomies` tables contain **only** rows owned by those accounts — the three
publicly visible experiences on the site are three of the seven it removes, and the
nine gastronomies are the entire table.

**Both verticals end at zero and the public experiences section ships empty.** That is
the declared purpose of the migration (start the first real customer from a clean
slate), decided by the owner on 2026-08-23. If it is not announced beforehand,
somebody will report it as a launch-day bug.

`0098` also drops `commerce_leads` with `CASCADE`, destroying the **3 rows** it holds
in production. Irreversible outside the backup.

---

## Order, and why it is this order

**Redeploy the apps FIRST, then run the migrations.**

`0098_graceful_tarantula.sql` is `DROP TABLE "commerce_leads" CASCADE`. The API image
running in production **today** still queries that table — verified by reading its live
bundle:

```js
await db.update(commerceLeads).set({ opsNotifi…
const rows = await db.select().from(commerceLeads).where(…
```

That is the `lead-intake-backstop` cron plus the commerce funnel. Dropping the table
while that container is still serving breaks it the instant the migration applies —
the same failure mode that caused the 8-minute `accommodations` outage on 2026-08-18
(HOS-601).

`main`'s code no longer defines or queries `commerce_leads`, so once the new image is
live the drop is a no-op for the application.

> The CI guard `check-drop-column-release-gap.sh` matches `DROP COLUMN` only, so a
> `DROP TABLE` passes it without a marker. That gap is why this had to be caught by
> hand; it is worth closing separately.

Deploy-first is not merely the lesser evil here — it is strictly better. Reviewed one
by one, by whom each pending migration can hurt:

| Migration | What it does | Hurts the OLD image | Hurts the NEW image if applied after it |
| --- | --- | --- | --- |
| `0092` | adds enum value `commerce.moderationChange` | no | no |
| `0093` | stricter unique index on polling jobs | marginally | no |
| `0094` | `DROP DEFAULT` on `product_domain` | **yes** | no |
| `0095` | creates `billing_orphan_payments` | no | narrowly |
| `0096` | adds enum value `billing.addon.purchase` | no | no |
| `0097` | unique index on refunds | no | no |
| `0098` | `DROP TABLE commerce_leads` | **yes, seriously** | no |

Redeploying first therefore avoids **three** hazards against the still-running old
image (`0093`, `0094`, `0098`) and pays exactly one narrow cost: between the deploy and
the migration, `billing_orphan_payments` does not exist yet, so a MercadoPago webhook
carrying an orphan payment in that window fails to enqueue. That is a backstop path,
and `billingOrphanPayments` is touched only inside `orphan-payment-queue.service.ts` in
a runtime `.insert()` — never at startup — so the container still passes its
healthcheck and comes up clean.

The two new `permission_enum` values are **not** an exposure, which is worth stating
because it looks like one. Nothing queries `role_permission` by a literal permission
value: the startup healthcheck is a bare `count(*)`, and permission checks compare
in memory against the actor's loaded list. Those values are first written by the seed
rail (`0062`, `0067`), which runs later in this same session.

---

## Steps

### 0 — Pre-flight (read-only)

- [ ] Confirm the two branches agree, so the branch of the `hops` checkout cannot
      matter (see [checklist.md](./checklist.md#promoting-to-production) and HOS-782)
      — run the check just below.
- [ ] `hops --target=prod db-seed-migrate --status` — read-only. Confirm it reports
      **57 applied, 11 pending** and that the pending names match the list above.
      Any extra name is a migration that never went through the rehearsal: stop.
- [ ] `pnpm db:generate` locally produces no new files (no uncommitted schema drift).

The branch-agreement check:

```bash
[ "$(git rev-parse origin/main^{tree})" = "$(git rev-parse origin/staging^{tree})" ] \
  && echo "identical — safe" || echo "DIVERGED — inspect before migrating"
```

> `--target` goes **before** the subcommand: `hops --target=prod db-seed-migrate`.
> `hops psql` is interactive and unusable over a non-interactive SSH session; use
> `--status` or `docker exec … psql` instead.

### 1 — Backup (mandatory, not optional)

- [ ] `hops db-backup-now --target=prod`

`hops db-migrate` takes its own `pg_dump` before the schema rail, but
**`hops db-seed-migrate` does not**, and `0058`, `0059` and `0065` hard-delete.
Combined with `0098`'s `CASCADE`, this backup is the only path back.

### 2 — Redeploy the apps

- [ ] `hops redeploy api`
- [ ] `hops redeploy web`
- [ ] `hops redeploy admin`

- [ ] Each app answers its healthcheck before continuing.

### 3 — Schema + extras (rails 1 and 2)

- [ ] `hops db-migrate --target=prod`

Expected: 7 schema migrations applied, then the extras rail reports
**"All 36 migrations applied successfully."** The rehearsal passed both rails with
exit 0.

### 4 — Seed data-migrations (rail 3)

- [ ] `hops --target=prod db-seed-migrate --allow-destructive`

Two flags decide whether this run means anything, and only one of them is optional:

- **`NODE_ENV=production` is mandatory.** Four of the eleven pending — `0058`,
  `0059`, `0065` and `0068` — are gated on it and otherwise return `Skipped`,
  **and a Skipped migration still gets ledgered**. Without the variable the run
  reports success having executed nothing, and the ledger then claims they are done.
  `hops db-seed-migrate` injects it; a hand-rolled `pnpm db:seed:migrate` does **not**.
  (`0023` and `0024` carry the same gate but were applied long ago.)
- **`--allow-destructive` is required.** Five of the eleven are `destructive: true`.
  Without it the gate **aborts the entire run** — it does not filter.

Expected output, matching the rehearsal exactly:

```
Running 11 pending data-migration(s)...
  0058 OK   -> Purged example data: 104 accommodations, 18 posts, 23 events,
               5 organizers, 5 locations, 37 users…
  0059 OK   -> Purged test data: 23 accounts, 9 gastronomies, 7 experiences,
               8 partners, 5 accommodations…
  0060 OK · 0061 OK · 0062 OK · 0064 OK · 0065 OK · 0066 OK · 0067 OK
  0068 OK · 0069 OK
Applied 11 data-migration(s) (57 already up to date).
```

**Read the exit code from the log, never from the process.** A background run on
2026-08-23 reported exit 0 while the log said `EXIT=1` — the trailing `tail` swallowed
it.

If `0059` reports different counts than the four above, stop and compare against the
rehearsal before continuing. The runner stops at the first failure and leaves the
ledger partway through the batch.

### 5 — Verify

- [ ] `hops --target=prod db-seed-migrate --status` shows **68 applied, 0 pending**
- [ ] `hops logs api --since 5m` — no errors from the `lead-intake-backstop` cron
- [ ] Smoke the public site: home, a destination, an accommodation detail
- [ ] The experiences section renders its empty state cleanly (it will be empty — see
      [above](#announce-this-before-you-start))
- [ ] Commerce: the catalogue exists and the free trial is offered

### 6 — Purge the edge cache

Deleted content stays cached at Cloudflare. The per-deploy purge
(`apps/web/src/lib/cache/purge-on-deploy.ts`) runs on redeploy — but that happened in
step 2, **before** the purge in step 4 removed the rows. Purge again after the
migrations, or the removed listings keep being served from the edge.

---

## Still outstanding at the time of writing

- **Browser smoke for the Cloudinary image changes** (#2999 Wave 1, #3002 Wave 2).
  Both are CI-green and merged, but #2999's own description records that the
  detail-page smoke was blocked by an unrelated dev-server failure. CI proves the code
  builds and passes its gates; it does not prove the images render.
- **HOS-782** — the `hops` checkout tracks `staging` for both targets. Not a risk while
  the two trees are identical (step 0 checks exactly that); to be resolved after launch.

---

## If something goes wrong

Follow [checklist.md → Rollback Procedures](./checklist.md#rollback-procedures).
The short version for this release:

- Soft-deletes are reversible by clearing `deleted_at`.
- `0058`, `0059`, `0065` and `0098` are **not** reversible. Restore the step-1 backup.
- The seed runner stops at the first failure with no ledger row for it, so a failed
  migration leaves the batch partway through — never partially applied *within* a
  migration.
