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

## Status

Not yet run. Requires DB access to staging/prod (`hops`/SSH, needs `ssh-add`
first). The local `hospeda_dev` database cannot stand in: its migration ledger is
empty and it predates the `provisioned_host_trade_id` column entirely, so the
query does not even parse there.

The SQL above is validated statically against the committed Drizzle schema —
`alliance_leads.provisioned_host_trade_id`, `alliance_leads.applicant_user_id`,
`host_trades.owner_user_id`, and `deleted_at` on both tables all exist as written.
