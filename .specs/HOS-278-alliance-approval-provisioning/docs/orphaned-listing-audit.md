# Orphaned listing audit — pre-promotion gate

## Why this exists

The claim flow linked an anonymous applicant to their `alliance_leads` row but
never backfilled the listing that approval had already created. PR #2662 fixes
the flow going forward. **It does not repair rows the bug already produced**: the
claim burns its single-use token on redemption, so a listing stranded by the old
code can never be fixed by re-claiming — there is no token left to redeem.

That makes this a data problem, not a code problem, and it has to be measured
before `staging` is promoted to `main`.

## What "orphaned" means here

A listing whose lead **is** linked to an account while the listing itself is not:

- `host_trades.owner_user_id IS NULL` — the listing belongs to nobody, so the
  ownership filter (`/mi-cuenta`, `GET /host-trades/mine`) matches nothing and
  the provider cannot see or edit the ficha that exists in their name.
- `alliance_leads.applicant_user_id IS NOT NULL` — but the applicant DID claim
  the lead, so an account demonstrably exists and is demonstrably entitled to it.

Both conditions together are the signature of the bug. Either one alone is a
legitimate state: an unclaimed anonymous lead has neither, and a curated listing
created by hand in the admin has no lead at all.

## The count

Run against **staging first, then production**. Read-only.

```sql
SELECT
    count(*) FILTER (
        WHERE ht.owner_user_id IS NULL
          AND al.applicant_user_id IS NOT NULL
    ) AS orphaned,
    count(*) AS provisioned_total
FROM alliance_leads al
JOIN host_trades ht ON ht.id = al.provisioned_host_trade_id
WHERE ht.deleted_at IS NULL
  AND al.deleted_at IS NULL;
```

`provisioned_total` is reported alongside deliberately: `orphaned = 0` out of
`provisioned_total = 0` means the audit found nothing because nothing has been
provisioned yet, which is NOT the same finding as `0` out of `40`. A bare zero
would be indistinguishable between the two.

## If the count is greater than zero

Pull the affected rows before writing anything:

```sql
SELECT al.id AS lead_id,
       al.email,
       al.applicant_user_id,
       ht.id AS host_trade_id,
       ht.slug,
       ht.created_at
FROM alliance_leads al
JOIN host_trades ht ON ht.id = al.provisioned_host_trade_id
WHERE ht.owner_user_id IS NULL
  AND al.applicant_user_id IS NOT NULL
  AND ht.deleted_at IS NULL
  AND al.deleted_at IS NULL
ORDER BY ht.created_at;
```

The repair is a **seed data-migration** (`pnpm db:seed:make`, carril 3 — this is
row content in a live environment, not structure), setting each listing's
`owner_user_id` from its lead's `applicant_user_id`.

Two properties that migration must have:

- **Scoped by the same pair of conditions above, never by email.** Resolving a
  listing to a user by matching `alliance_leads.email` would reintroduce R-1: the
  lead's email is unverified, so an email match hands somebody else's business to
  whoever claimed the address. `applicant_user_id` is the only link that survived
  a verified claim.
- **Idempotent** — `WHERE owner_user_id IS NULL` in the UPDATE itself, so
  re-running never overwrites an owner set legitimately in between.

## Result — staging, after the migrations landed (2026-08-05)

Migrations were applied to staging later the same day (79 of 79 structural, 39
of 39 seed data-migrations, both sets matching the repository exactly). The
query now runs:

```text
 orphaned | provisioned_total
----------+-------------------
        0 |                 0
```

**Zero orphans, out of zero provisioned.** This is the vacuous case the count was
shaped to expose rather than hide: staging holds 0 `alliance_leads`, 20 curated
`host_trades`, and 6 partners, so nothing has been provisioned through this flow
and there was never anything to strand.

The difference from the pre-migration run below is not the number — it is that
the query **parses**. Zero is now a measurement of the data instead of an
artifact of a missing column.

Schema verified alongside it: all seven HOS-278 columns present and nullable,
`partners_ownerUserId_idx` created, both new foreign keys in place, and all 6
existing partners still carrying a `starts_at` (the `DROP NOT NULL` relaxed the
constraint without touching a single row). Extras-carril objects survived the
migrate — `search_index` matview present, 110 `set_updated_at` triggers, 6
promo-code CHECK constraints.

**Still to run against production**, which remains 9 migrations behind.

## Prior result — before the migrations, both environments (2026-08-05)

**Zero orphans on both environments. The promotion gate is clear — but not for
the reason the audit was written to check.**

Neither database has the columns the bug needs in order to produce an orphan.
The count query does not return `0`; it does not parse at all.

| | migrations applied | last applied | `alliance_leads.provisioned_host_trade_id` | `host_trades.owner_user_id` |
|---|---|---|---|---|
| **staging** | 75 of 79 | 2026-08-04 | absent | absent |
| **production** | 70 of 79 | 2026-07-28 | absent | absent |

Staging carries `alliance_leads.applicant_user_id` (the §6.2 claim work) and
nothing else from the provisioning line. Production carries none of the four
columns at all.

So no listing has ever been provisioned by this flow in a live environment, and
the claim has never had a listing to strand. The bug is real in the code that
shipped, but it has had no opportunity to fire.

**Re-run this audit after the pending migrations are applied**, before any real
partner or provider is provisioned. Zero today is a statement about the schema,
not about the data, and it stops being true the moment the columns land and the
first lead is approved. *(Done for staging — see the section above.)*

## The finding that actually matters

Both environments were **behind on migrations**, and by more than this spec:

- staging was 4 behind (0075–0078) — **resolved 2026-08-05**,
- production is 9 behind (0070–0078) — **still outstanding**.

Everything HOS-278 has merged — the typed provider/partner columns, the
provisioned links, `partners.owner_user_id`, the nullable `starts_at` — is
present only in the repository. None of it is live anywhere. Applying them is
`hops db-migrate --target=staging|prod`, followed by `db:apply-extras` and
`db:seed:migrate` in that order.

## Reproducing

`hops` lives at `~/.local/bin/hops` on the VPS and is NOT on the PATH of a
non-interactive SSH shell, so invoke it by absolute path. `--target` goes BEFORE
the subcommand, and `hops psql` takes the SQL as a single argument — it does not
forward psql flags like `-tAc`.

```bash
ssh -p 2222 qazuor@216.238.103.219 \
  '~/.local/bin/hops --target=staging psql "SELECT count(*) FROM alliance_leads;"'
```

The SQL above is also validated statically against the committed Drizzle schema —
`alliance_leads.provisioned_host_trade_id`, `alliance_leads.applicant_user_id`,
`host_trades.owner_user_id`, and `deleted_at` on both tables all exist as written
in the repo, which is what makes the environments' missing columns a deployment
gap rather than a query bug.
