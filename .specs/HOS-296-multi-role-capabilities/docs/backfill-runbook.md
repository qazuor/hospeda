# HOS-296 — role backfill runbook (staging / production)

Operator-facing companion to `spec.md` §6.6 and §7. Read this **before** running
`pnpm db:migrate` (or `hops db-migrate --target=staging|prod`) on any environment
that already holds data.

There are three steps and their order is not negotiable, because step 1 reads a
column that step 2 destroys.

| # | When | What | Reversible? |
|---|---|---|---|
| 1 | **BEFORE** `db:migrate` | Run the audit query below and SAVE its output | read-only |
| 2 | `db:migrate` | Migration `0069_mushy_captain_america` creates `user_role`, **backfills it from `users.role`**, then drops the column | no |
| 3 | AFTER `db:migrate` | Grant, by hand, any hat the audit said was missing | yes (delete the row) |

Step 2's backfill is a plain `INSERT ... SELECT` inside
`packages/db/src/migrations/0069_mushy_captain_america.sql`. It is **not** a
seed data-migration: `db:seed:migrate` runs third in the standard
`db:migrate` → `db:apply-extras` → `db:seed:migrate` order, i.e. after
`users.role` is already gone, so a backfill living there would find no source
column and leave every account with zero roles — and an account with zero roles
has zero permissions.

---

## Step 1 — pre-migration audit (§6.6)

### What it is looking for

The backfill is a straight copy, so it faithfully reproduces whatever
`users.role` says today. The problem is that the G-6 bug
(`_assignHostRoleIfNeeded` overwriting the scalar on accommodation activation)
may have already destroyed the truth for some accounts: a `COMMERCE_OWNER`,
`SPONSOR` or `EDITOR` who then activated an accommodation had their hat replaced
by `HOST`, permanently.

Seeded demo accounts are rebuilt by re-seeding and staff accounts copy across
correctly, so the only real exposure is the **third category**: accounts created
by hand during staging/production smoke runs (host and commerce test signups,
MercadoPago sandbox purchasers — the `SMOKE-DD-MM` workflow). This query turns
"probably nobody" into a number.

### The query

Run it against the target database with the schema still intact (before
`db:migrate`). It is a single read-only `SELECT`.

```sql
-- HOS-296 §6.6 — pre-migration role/ownership mismatch audit.
-- MUST run BEFORE db:migrate: it reads users.role, which the migration drops.
SELECT
    u.id,
    u.email,
    u.role                                      AS scalar_role,
    (u.deleted_at IS NOT NULL)                  AS soft_deleted,
    count(DISTINCT a.id)                        AS accommodations_owned,
    count(DISTINCT g.id)                        AS gastronomies_owned,
    count(DISTINCT e.id)                        AS experiences_owned
FROM users u
LEFT JOIN accommodations a ON a.owner_id = u.id AND a.deleted_at IS NULL
LEFT JOIN gastronomies   g ON g.owner_id = u.id AND g.deleted_at IS NULL
LEFT JOIN experiences    e ON e.owner_id = u.id AND e.deleted_at IS NULL
GROUP BY u.id, u.email, u.role, u.deleted_at
HAVING
       (count(DISTINCT a.id) > 0 AND u.role <> 'HOST')
    OR ((count(DISTINCT g.id) > 0 OR count(DISTINCT e.id) > 0)
        AND u.role <> 'COMMERCE_OWNER')
ORDER BY u.email;
```

**Save the output.** Once `db:migrate` has run, this query can never be
reproduced — `users.role` will not exist.

### Reading the result

Zero rows is the expected outcome and needs no action.

Any row means the account owns something its single scalar role does not
account for. Two shapes, both normal-looking and both real findings:

- `scalar_role = 'HOST'` with `gastronomies_owned > 0` or
  `experiences_owned > 0` → a commerce owner whose `COMMERCE_OWNER` hat was
  eaten by G-6. **Missing hat: `COMMERCE_OWNER`.**
- `scalar_role` is anything non-`HOST` with `accommodations_owned > 0` → the
  account owns an accommodation without the `HOST` hat. **Missing hat: `HOST`.**

Staff roles (`SUPER_ADMIN`, `ADMIN`, `CLIENT_MANAGER`, `EDITOR`) are deliberately
NOT filtered out: staff can legitimately own listings, and their rows are easy to
recognise by email. Filtering them in SQL would risk hiding a genuine
`EDITOR`-who-also-sells case, which is exactly the category this audit exists to
catch.

Soft-deleted accounts appear too (`soft_deleted = true`) — the backfill copies
them, so their hats matter the moment anyone restores the account.

---

## Step 2 — run the migration

Nothing special. The backfill statement is inside `0069` and runs in the same
transaction as the rest of the migration; there is no separate command and no
flag to pass.

```bash
pnpm db:migrate          # local
hops db-migrate --target=staging   # or --target=prod, from the VPS
```

Sanity check afterwards — every account must hold at least one hat:

```sql
SELECT count(*) AS users_with_no_roles
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_role r WHERE r.user_id = u.id);
-- expected: 0
```

```sql
SELECT role, count(*) FROM user_role
WHERE grant_reason = 'migrated_from_users_role'
GROUP BY role ORDER BY 2 DESC;
-- expected: the same per-role distribution the old `GROUP BY users.role` had
```

---

## Step 3 — repair what the audit found

**One `INSERT` per missing hat, by hand. Not a feature of the migration.**

`spec.md` §6.6 says "one `UPDATE` each". That wording predates the single cut:
after step 2 there is no `users.role` column to `UPDATE`, and — more to the
point — the repair is precisely the thing multi-role makes possible. An account
that owns both an accommodation and a gastronomy needs **both** hats, which no
scalar assignment could ever have expressed. So the repair is additive:

```sql
-- Give back a hat G-6 destroyed. One statement per (user, role) pair the
-- audit flagged. Idempotent via the (user_id, role) primary key.
INSERT INTO user_role (user_id, role, granted_by, grant_reason)
VALUES ('<user-id-from-the-audit>', 'COMMERCE_OWNER', NULL, 'hos296_g6_manual_repair')
ON CONFLICT (user_id, role) DO NOTHING;
```

Use a distinct `grant_reason` (`hos296_g6_manual_repair` above) rather than
`migrated_from_users_role`, so a later reader can tell an operator repair apart
from the mechanical copy.

Optionally record the repair in the audit trail — unlike the backfill (which
changes nobody's capabilities and therefore writes no audit rows), a manual
repair **does** change them, so an audit row here is accurate:

```sql
INSERT INTO user_role_audit (user_id, role, action, by, reason)
VALUES ('<user-id>', 'COMMERCE_OWNER', 'grant', '<operator-user-id>', 'HOS-296 G-6 manual repair');
```

---

## Notes

- **The backfill writes no `user_role_audit` rows.** That table records role
  state *changes* performed through `grantRole`/`revokeRole`. Copying an
  existing role into its new home changes nobody's capabilities; an audit row
  would assert a grant event that never happened, stamped `now()`, and would add
  one row per user of pure noise to an append-only table whose two indexes exist
  for forensics. Provenance is already permanent and per-row, in
  `user_role.grant_reason = 'migrated_from_users_role'`.
- **Already ran `0069` from an earlier build of this branch?** Drizzle tracks
  applied migrations by folder timestamp, not by file content, so an edited
  `0069` will NOT re-run on a database that already applied the original
  version. Such a database has the tables but an empty `user_role`. Either
  rebuild it (`pnpm db:fresh-dev` locally) or run the `INSERT ... SELECT` from
  `0069` by hand — except the source column is gone, so in practice: rebuild.
  No staging or production environment is in this state, because `0069` has
  never been merged.
- The seed baseline writes `user_role` rows directly (every user-creating seed
  goes through `grantRole`), so a **fresh** database never needs any of the
  above. This runbook is only for environments that already contain data.
