# Fresh-build ↔ migrated-DB parity verification (T-035, AC-15 + AC-18)

Executed 2026-08-02 against the HOS-375 worktree's Postgres instance
(`localhost:5436`). Both tracks were measured, and they agree on every fact.

> **Numbering note (added 2026-08-05, updated after the third renumber).** The command
> transcripts below are verbatim and still show the numeric prefixes these migrations
> carried when the runs happened. Three successive catch-up merges of `staging` each
> collided with this branch's prefixes, so the five HOS-375 migrations were renumbered
> three times to sit after staging's highest. The first merge brought in
> `0036-hos-369-w24-revalidation-config` and `0037-hos-390-content-media-to-relational`;
> the second brought in `0038-hos-374-cut-editor-panel-access`; the third brought in
> `0039-event-organizer-permissions`. Nothing about the migrations' content or relative
> order changed any of the three times. Cumulative mapping, from the prefixes in the
> transcripts below to the current ones:
> `0034-system-account-flag-staff` → `0038` → `0039` → `0040`,
> `0035-editorial-author-slug` → `0039` → `0040` → `0041`,
> `0036-reattribute-imported-events` → `0040` → `0041` → `0042`,
> `0037-editorial-author-avatar` → `0041` → `0042` → `0043`,
> `0038-transliterate-user-slugs` → `0042` → `0043` → `0044`.
>
> The third collision was found only by CI, and that is the durable lesson: GitHub's
> `pull_request` workflows test `refs/pull/<n>/merge`, not the branch, so a duplicate
> prefix contributed by `staging` is invisible to every local run. Check the merge ref,
> not the branch, before choosing prefixes.

## What is being proven

HOS-375's content-attribution work is split across a baseline half (seed fixtures and
`0025`'s own author creation) and a migration half (`0034`/`0035`/`0036`). A live
environment reaches the target state by running the migrations; a from-scratch build
reaches it a different way. **If the two disagree, production and a rebuilt production
render different author pages.** AC-15 is that they do not.

AC-18 is the ledger invariant that makes the fresh-build track possible at all
(G-10, T-037/T-038): a `contentOnly` migration must be recorded as `ok` (it really ran),
everything else as `baseline-stamp` (it was recorded without running because the fixtures
already produced its end state).

## Do NOT run `pnpm db:fresh-dev` for this

Every worktree database, plus `hospeda_dev` and `hospeda_template`, lives in the **same**
Postgres container. `db:fresh-dev` starts with `docker compose down -v`, which destroys
that container's volume — i.e. every worktree's database on the machine, not just this
one. The procedure below reproduces exactly what `db:fresh-dev` does to the *data*, on a
dedicated throwaway database, without touching the container.

## Track A — migrated database (what staging/production will do)

The worktree DB already held pre-HOS-375 content: the editorial account on its
per-environment auto-slug (`user-76eb2960`), 52 imported events attributed to the super
admin, and a `users` table with no `is_system_account` column.

```bash
# 1. Schema. (`pnpm db:migrate` fails on a worktree DB — see "Gotchas" below.)
pnpm --filter @repo/db db:push

# 2. Pending data-migrations, applied for real. No stamping.
pnpm db:seed:migrate
```

Output of interest:

```
Applying "0034-system-account-flag-staff"  -> Marked 2 staff account(s) as system accounts
Applying "0035-editorial-author-slug"      -> Renamed the editorial author slug "user-76eb2960" -> "equipo-hospeda"
Applying "0036-reattribute-imported-events"-> Re-attributed 52 imported event(s)
```

## Track B — fresh build (what a new environment does)

```bash
# A dedicated database, created via the same Postgres instance. Nothing else is touched.
#   CREATE DATABASE hos375_freshbuild;
# Then, with HOSPEDA_DATABASE_URL pointed at it:
pnpm db:migrate                       # schema from zero — works on an empty DB
pnpm db:apply-extras                  # 30/30
pnpm --filter @repo/seed seed --reset --required --example --poi-catalog --allow-required-fallback
pnpm --filter @repo/seed seed --data-migrate --baseline-stamp
```

The last command is the one under test:

```
Baseline-stamped 31 data-migration(s), deferring 5 content-only migration(s) to a real run.
Applying "0025-seed-real-blog-posts" ... ok
Applying "0027-add-confirmed-events-entre-rios-2026" ... ok
Applying "0028-add-estimated-events-entre-rios" ... ok
Applying "0035-editorial-author-slug" ... ok
Applying "0036-reattribute-imported-events" -> Re-attributed 52 imported event(s) ... ok
```

## Result — the two tracks agree

| Fact | Track A (migrated) | Track B (fresh) |
|---|---|---|
| Editorial account slug | `equipo-hospeda` | `equipo-hospeda` |
| Editorial `is_system_account` | `false` | `false` |
| `admin@hospeda.com` / `superadmin@hospeda.com` flagged | `true` / `true` | `true` / `true` |
| Events still on super-admin with `created_by_id IS NULL` | **0** | **0** |
| Events attributed to the editorial account | 52 | 52 |
| Posts attributed to the editorial account | 22 | 22 |

AC-18, checked on the fresh build's 36 ledger rows: the five `contentOnly` migrations
carry `result = 'ok'` and the other 31 carry `result = 'baseline-stamp'`. Zero violations.

## Which half actually did the work on a fresh build

Worth recording, because it is not the same answer for all three migrations and it is the
thing a future reader will get wrong:

- **`0034` (staff flag) — the FIXTURE did it.** `0034` was baseline-stamped, never ran, and
  both accounts are still correctly flagged, because `admin-user.json` /
  `super-admin-user.json` declare `isSystemAccount: true`. This is why `0034` is
  deliberately NOT `contentOnly`.
- **`0035` (editorial slug) — `0025` did it.** `0035` ran (it is `contentOnly`) but found
  nothing to do: `ensureEditorialAuthor` now sets `slug: 'equipo-hospeda'` at creation, so
  the rename was already unnecessary. It is a genuine no-op here, which is the correct
  outcome for a well-formed dual-write.
- **`0036` (event re-attribution) — the MIGRATION did it, and only it could.** It moved 52
  rows on the fresh build too, because `0027`/`0028` create those events attributed to the
  acting super admin and there is no fixture anywhere that could produce them
  pre-attributed. Had `0036` been baseline-stamped, a fresh build would ship 52 events
  under `/autores/super-admin-user/` while a migrated one shipped zero. This is the
  concrete case that justifies the `contentOnly` flag existing.

## Gotchas found while running this

- **`pnpm db:migrate` fails on an existing worktree DB.** `drizzle.__drizzle_migrations`
  is empty there (worktree databases are built with `db:push`, and cloned from
  `hospeda_template`), so `migrate` tries to apply every migration from `0000` onto a
  schema that already exists. Use `db:push` on a worktree DB; `db:migrate` only on an
  empty one.
- **drizzle-kit swallows its own errors** when stdout is not a TTY: both `push` and
  `migrate` exit `1` printing nothing but a spinner frame. To see the real message, run
  the migrator programmatically (`drizzle-orm/node-postgres/migrator`) and log
  `error.message` — that is how the two failures above were diagnosed (one was
  "already exists", the other a wrong password in a hand-built connection string).
- **`HOSPEDA_DATABASE_URL` set in the environment wins** over `apps/api/.env.local`:
  dotenv/dotenvx do not overwrite an existing value. That is what makes it possible to
  point the standard scripts at a throwaway database. The log line `injected env (94)`
  instead of `(95)` is the confirmation that the override took.
