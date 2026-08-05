# Seed migration mechanics for M-A / M-B / M-C (T-001 research)

Research task for HOS-375. No production code changed. This answers the question
raised in spec §6.10.2/§6.10.3: given that `pnpm db:fresh-dev` baseline-stamps
pending data-migrations instead of running them, what actually happens to the
three planned data-migrations (M-A, M-B, M-C) on a fresh build, and what — if
anything — must change so AC-15 holds.

**Bottom line, stated up front**: the spec's caution was justified, but the
actual mechanics are worse than "may resolve differently for a catalog
fixture" suggests. **M-B and M-C do not merely lack a baseline fixture — their
target rows do not exist at all on a fresh `db:fresh-dev` build**, because the
migrations that create those rows (`0025`, `0027`, `0028`) are themselves
content-only migrations that get baseline-stamped away. AC-15 as currently
worded cannot pass against the `db:fresh-dev` script as it exists today,
regardless of how well M-A/M-B/M-C are written. See §6.

---

## 1. How baseline-stamping actually works

Baseline-stamping is a blunt, content-blind mechanism. It does not know what a
migration's `up()` does, does not distinguish `required` from `example`, and
does not distinguish "content lives in `data/**`" from "content lives only in
this file". It only knows two things: which `NNNN-*.ts` files exist on disk,
and which names are already in the `seed_migrations` ledger.

- `baselineStamp()` (`packages/seed/src/data-migrations/baselineStamp.ts:101-124`)
  calls `resolvePendingMigrations()` (`runner.ts:124-135`), which:
  1. `discoverMigrationFiles()` (`discover.ts:128-192`) — scans the
     `data-migrations/` directory for every file matching
     `^(\d{4})-.+\.(?:ts|js)$` (`discover.ts:53`) and dynamically `import()`s
     each one.
  2. `getAppliedMigrations()` (`ledger.ts:59-70`) — reads every row already in
     `seed_migrations`.
  3. `computePendingMigrations()` (`discover.ts:222-233`) — a pure set
     difference: discovered minus applied, optionally filtered by `group`.
- For every migration in that pending set, `baselineStamp` calls
  `recordApplied({ ..., durationMs: 0, result: 'baseline-stamp' })`
  (`baselineStamp.ts:111-118`) — an `INSERT` into `seed_migrations`. **It never
  imports or calls `migration.module.up()`.** Compare this to the real runner
  path, `runMigrations()` (`runner.ts:302-324`), which wraps `up(ctx)` in a
  transaction and only then records the ledger row.

**What decides stamp-vs-run**: purely *which script you invoke*, not anything
about the migration's content:

- `pnpm --filter @repo/seed seed --data-migrate --baseline-stamp` (the
  `--baseline-stamp` CLI flag) → `baselineStamp()` → never runs `up()`.
- `pnpm db:seed:migrate` (no flag) → `runMigrations()` → actually runs `up()`
  for every pending migration, in numeric order, each in its own transaction.

`meta.group` (`'required' | 'example'`) plays **no role at all** in the
stamp-vs-run decision. It is consulted elsewhere (the production gate refuses
`example`-group migrations in prod outright, `prodGate.ts:129-136`) but
`baselineStamp` stamps `required` and `example` migrations identically. There
is no field on `SeedMigrationMeta` (`types.ts:39-62`) that marks a migration as
"content-only" or "needs a baseline counterpart" — that distinction exists only
in prose (this doc, `docs/guides/seed-data-migrations.md`, and 0025's own
docstring), not in any code the runner reads.

- `pnpm db:fresh` and `pnpm db:fresh-dev` both chain the baseline-stamp variant
  automatically, confirmed directly in `package.json`:
  - `db:fresh-dev` (line 58): `... && pnpm --filter @repo/seed seed --reset
    --required --example --poi-catalog --allow-required-fallback && pnpm
    --filter @repo/seed seed --data-migrate --baseline-stamp && pnpm
    db:seed:test-users && ...`
  - `db:fresh` (line 57): same shape, `--baseline-stamp` right after the main
    seed.
- Neither script contains any step that deletes a ledger row or re-runs a
  specific migration "for real". The only place that recipe exists is prose,
  in `docs/deployment/first-time-setup.md` (§2 below) — it is a **manual
  operator step for the production day-1 bootstrap**, not something either
  `db:fresh` variant executes.

---

## 2. What a fresh `db:fresh-dev` DB actually contains

**Editorial author + 22/9 real blog posts**: does not exist. Confirmed by
`0025-seed-real-blog-posts.ts`'s own docstring, section "Baseline-stamp gap
(content-only migration)" (lines 43-53):

> The 9 articles live ONLY here, not in the baseline seed (`src/data/**`)... a
> from-scratch build (prod day-1, local `db:fresh-dev`) baseline-stamps every
> pending migration WITHOUT running `up()`, so on a fresh DB this content is
> NOT created. It lands correctly on already-live environments... After a
> fresh/DR rebuild, this migration must be re-run for real.

This is not a hypothetical the migration author flagged defensively — it is
the author stating plainly that a bare `db:fresh-dev` does not create the
editorial account or the blog posts it authors. The account is created
exclusively inside `ensureEditorialAuthor()` (`0025-seed-real-blog-posts.ts:148-178`),
which only executes inside `up()`. Nothing under `packages/seed/src/data/**`
or `packages/seed/src/example/**` creates an "Equipo Hospeda" user or these
posts — they are demo-`example` posts only if in `data/post/`, which is a
separate, unrelated (and demo-only-exempt) fixture set.

**~52 Entre Ríos events**: same situation, but *undocumented*. `0027-add-confirmed-events-entre-rios-2026.ts`
(9 events) and `0028-add-estimated-events-entre-rios.ts` (43 events) are
structurally identical to 0025 in every way that matters here: `group:
'required'`, content that exists nowhere under `data/**` (real prod-bound event
rows, distinct from the demo/exempt `data/event/**` folder), created only
inside their own `up()`. Neither file's docstring mentions the baseline-stamp
gap — I read both header comments in full (`0027-add-confirmed-events-entre-rios-2026.ts:1-45`,
`0028-add-estimated-events-entre-rios.ts:1-46`) and neither has a section like
0025's. `docs/deployment/first-time-setup.md`'s "content-only migrations must
be re-run for real" list (lines 810-827) names only `0025-seed-real-blog-posts`
— **0027 and 0028 are missing from that list**, which means even an operator
following the documented prod day-1 procedure to the letter would end up with
zero Entre Ríos events on that production DB. This is a pre-existing
documentation gap, independent of HOS-375, worth flagging to whoever owns
0027/0028 — but it is out of this task's scope to fix.

**Consequence for HOS-375's measured baseline (spec §5.9)**: the worktree DB
the spec's author queried (`super-admin-user`: 52 events, `user-76eb2960`
"Equipo Hospeda": 22 posts) was **not** produced by a bare `db:fresh-dev`. It
must have gone through an explicit `pnpm db:seed:migrate` real-run at some
point (either directly, or via `hospeda_template`'s own build history
inheriting a DB where that had already happened) — the exact "delete ledger row
+ re-run" recipe documented only for prod day-1. A fresh `db:fresh-dev` run
executed from a clean slate today, with **no manual intervention**, produces a
DB with **zero** rows from 0025/0027/0028: no editorial account, no real blog
posts, no Entre Ríos events. This is `undetermined` only in the sense that I
did not execute `db:fresh-dev` myself in this session (see caveat below) — the
code path and the migration's own documentation are unambiguous about what it
does, which is nothing, for these three files.

*Caveat on verification method*: I did not spin up this worktree's own
Postgres container and run `db:fresh-dev` end-to-end to observe row counts
directly, per the "no production code, no heavy commands" scope of this
research task and the standing project guidance against running DB-mutating
commands against a shared instance without the worktree tooling. The
conclusion above rests on: (a) `baselineStamp`'s code, which unconditionally
skips `up()` for every pending migration with no exception; (b) 0025's own
docstring stating this in plain language as the documented, known behavior;
(c) `db:fresh-dev`'s exact script text in `package.json`, which contains no
re-run step. Anyone wanting empirical confirmation can run, on a disposable
worktree DB: `pnpm db:fresh-dev && pnpm db:seed:migrate:status` and check that
`0025-seed-real-blog-posts` / `0027-...` / `0028-...` show as `applied` (via
baseline-stamp) while `SELECT COUNT(*) FROM users WHERE email =
'editorial@hospeda.com.ar'` returns `0`.

---

## 3. Per-migration verdict

| # | Migration | Baseline edit needed? | What the "baseline" actually is | Data-migration needed? |
|---|---|---|---|---|
| M-A | Flip `is_system_account = true` on the two staff accounts | **Yes** — edit `packages/seed/src/data/user/required/admin-user.json` and `super-admin-user.json` to add `"isSystemAccount": true` (T-004). These are ordinary `required` JSON fixtures, loaded on every `db:seed`/`db:fresh-dev` run regardless of the data-migration carril. | A real `data/**` JSON fixture. Ordinary case, no gap. | Yes (T-005), for already-seeded staging/prod. This is the textbook dual-write case — identical in shape to the 0001-0003 billing-plan precedent in the guide. |
| M-B | Set the editorial account's slug to `equipo-hospeda` | **No JSON fixture exists to edit** — the editorial account is not a `data/**` fixture, it is created by `ensureEditorialAuthor()` inside `0025-seed-real-blog-posts.ts`, itself a content-only migration. The closest thing to "the baseline" is that function's own code. | Editing `ensureEditorialAuthor` to set `slug: 'equipo-hospeda'` at creation time (T-006) is correct **for any environment where 0025 actually runs `up()` for real** — i.e. staging/prod on their first real migration pass, or a from-scratch build that someone has manually re-run 0025 on. It does **nothing** for a bare `db:fresh-dev`, because 0025 itself never creates the row there (§2). | Yes (T-006 as scaffolded), for already-seeded staging/prod where the account already exists with the auto-generated slug. Resolve by `EDITORIAL_EMAIL`, per spec §6.10.2. |
| M-C | Re-attribute imported events (`author_id = super-admin`, `created_by_id IS NULL`) to the editorial account | **No baseline edit is possible** — there is no `data/event/**` fixture for these rows (that folder is demo/exempt, per `check-seed-dual-write.sh`'s `EXEMPT_DATA_DIR_PATTERNS`); the real rows are created only by `0027`/`0028`'s own `up()`. | None. The "correct end state" is produced automatically **only if** `0027`/`0028` are written to attribute events to the editorial account from the start going forward — but that is not this spec's job to retrofit into already-shipped migrations, and doing so would not fix already-applied ledger rows anyway. | Yes (T-007, scoped `author_id = <super-admin>` AND `created_by_id IS NULL`), for already-seeded staging/prod. On a bare fresh build there are no event rows at all for it to act on (§2) — see §6 for why this makes M-C a no-op on `db:fresh-dev` today, not because it is well-designed for that case but because there is nothing there to touch. |

None of M-A/M-B/M-C is "wrong" as scaffolded per the task descriptions in
`state.json` — M-A is a clean, ordinary dual-write. M-B and M-C are correctly
recognized by the spec as content-only migrations with no fixture counterpart,
and T-006/T-007 do the only thing possible at the data-migration level (resolve
by email, idempotent). **The actual gap is upstream of all three**: it is that
`0025`/`0027`/`0028` themselves never run on a fresh build, so M-B and M-C have
no row to act on there. This is not something T-005/T-006/T-007 can fix by
being written differently — it is a property of the `db:fresh-dev` script's
current wiring. See §6.

---

## 4. The concrete recipe for M-B

**Is editing `ensureEditorialAuthor` sufficient for fresh builds?** No, and it
cannot be, by construction: `ensureEditorialAuthor` only executes when 0025's
`up()` runs, and `up()` never runs on a fresh `db:fresh-dev` build (§1, §2).
Setting the slug inside `ensureEditorialAuthor` is still worth doing (T-006
already scopes it this way) because it fixes the **new-environment-that-
actually-runs-0025-for-real** case: any staging/prod database that has not yet
received 0025 (or a from-scratch/DR rebuild where an operator manually
re-runs it per `first-time-setup.md`) will get the correct slug on creation,
with no separate migration needed for *that* environment. It does not, and
cannot, make a bare `db:fresh-dev` produce the account with the right slug —
because it does not make `db:fresh-dev` produce the account *at all*.

**Does this edit trip `scripts/check-seed-dual-write.sh`?** No, for two
independent reasons, verified against the script's logic
(`scripts/check-seed-dual-write.sh:171,232,271-276,305-336`):

1. `is_guarded_path()` only treats a changed path as "guarded baseline data"
   if it falls under `packages/seed/src/data/` (`GUARDED_DATA_ROOT_PATTERN`,
   line 171) or is one of the explicit `BILLING_CONFIG_FILES`/
   `INLINE_CONSTANT_FILES` (lines 205-229). `packages/seed/src/data-migrations/`
   is **not** under `data/` — a `git diff` path of
   `packages/seed/src/data-migrations/0025-seed-real-blog-posts.ts` never
   matches `GUARDED_DATA_ROOT_PATTERN`, so `is_guarded_path` returns 1 (not
   guarded) for it. Editing 0025 in place therefore never sets
   `baseline_changed=1` on its own.
2. The `data-migrations/` diff root is included in `compute_changed_files()`
   (line 276) **only** to detect the "fix" side — whether a brand-new file
   matching `MIGRATION_FILE_PATTERN` (`^packages/seed/src/data-migrations/[0-9]{4}-.+\.ts$`,
   line 232) was `A`(dded) — never as a trigger.

So a PR that (a) edits `ensureEditorialAuthor` inside the existing
`0025-seed-real-blog-posts.ts` and (b) adds the new `NNNN-editorial-author-slug.ts`
migration file changes nothing the guard treats as "guarded baseline data" —
`baseline_changed` stays `0` for this specific pair of edits, and the guard
passes trivially (`decide()`, line 357-360), independent of whether the new
migration file is even present. This is expected and correct: there genuinely
is no `data/**` fixture for this content, so there is nothing for the guard to
demand a migration *for* — the migration itself is the entire delta, exactly
as `docs/guides/seed-data-migrations.md`'s "extras/ vs data-migrations/
boundary" section describes for row-level content changes.

---

## 5. How to verify AC-15

AC-15: *"A fresh `pnpm db:fresh-dev` produces the same editorial slug and the
same event attribution as a migrated production database."*

Given §2's finding, this cannot be verified by running a bare `db:fresh-dev`
today — there is no editorial account and no imported events to inspect.
Verifying it requires **also** performing the manual re-run step
`first-time-setup.md` documents for prod day-1, extended to cover 0027/0028 and
the new M-A/M-B/M-C migrations, since none of that is automated:

```bash
# 1. Fresh build (chains the baseline-stamp step, which no-ops 0025/0027/0028
#    and, once they exist, M-A/M-B/M-C — none of their rows exist yet).
pnpm db:fresh-dev

# 2. Confirm the content-only migrations are stamped-but-not-run (sanity check
#    that the gap is real on this build, before "fixing" it below).
pnpm db:seed:migrate:status
psql "$HOSPEDA_DATABASE_URL" -c \
  "SELECT COUNT(*) FROM users WHERE email = 'editorial@hospeda.com.ar';"
# expect: 0

# 3. Force the content-only migrations (and the three new ones, once T-005/
#    T-006/T-007 exist) to run for real, mirroring first-time-setup.md's
#    documented recipe — extended here to cover every migration this content
#    chain depends on, in ascending numeric order:
psql "$HOSPEDA_DATABASE_URL" -c "DELETE FROM seed_migrations WHERE name IN (
  '0025-seed-real-blog-posts',
  '0027-add-confirmed-events-entre-rios-2026',
  '0028-add-estimated-events-entre-rios',
  '<NNNN>-system-account-flag-staff',
  '<NNNN>-editorial-author-slug',
  '<NNNN>-reattribute-imported-events'
);"
pnpm db:seed:migrate

# 4. Assert the three facts (T-035's job):
psql "$HOSPEDA_DATABASE_URL" -c \
  "SELECT slug FROM users WHERE email = 'editorial@hospeda.com.ar';"
# expect exactly: equipo-hospeda

psql "$HOSPEDA_DATABASE_URL" -c \
  "SELECT email, is_system_account FROM users WHERE email IN ('superadmin@hospeda.com', 'admin@hospeda.com');"
# expect: both rows show is_system_account = true

psql "$HOSPEDA_DATABASE_URL" -c \
  "SELECT COUNT(*) FROM events e JOIN users u ON u.id = e.author_id
   WHERE u.email = 'superadmin@hospeda.com' AND e.created_by_id IS NULL;"
# expect: 0
```

Step 3 is the load-bearing addition this task surfaces: without it, step 4's
three assertions fail not because M-A/M-B/M-C are wrong, but because the rows
they act on were never created. This whole step-3 sequence is exactly what
should be automated (see §6) rather than run by hand every time someone needs
fresh/prod parity.

---

## 6. Contradiction with the spec's assumptions

The spec (§6.10.3) instructs: *"Verify before writing them... Confirm the
exact mechanics against `docs/guides/seed-data-migrations.md` and
`baselineStamp.ts` before authoring, and make sure a fresh `pnpm db:fresh-dev`
ends up with the same attribution and slug as a migrated production DB. Do not
assume."* — this framing, and T-035's instruction ("If they diverge, the
baseline half of the dual-write rule is incomplete — **fix the fixtures**, do
not adjust the assertion"), both implicitly assume the eventual fix is a
**fixture edit**: some JSON under `data/**` that is currently missing or
wrong, the same shape as the ordinary dual-write case (M-A).

That assumption is wrong for M-B and M-C, and the reason is worth stating
plainly: **there is no fixture to fix.** The gap is not "the baseline fixture
doesn't yet reflect the post-migration state" — it is "the row the migration
would act on does not exist on a fresh build at all, because the migration
that creates it (0025/0027/0028) is content-only and gets its own `up()`
skipped by the exact same baseline-stamp mechanism." No edit to any file under
`packages/seed/src/data/**` can make `db:fresh-dev` produce an editorial
account or Entre Ríos events, because that content was deliberately designed
(0025's own docstring, "keep this production content cleanly separate from the
demo `example` posts") to live *only* inside its migration file. Chasing a
"fixture" here would mean either (a) inventing one anyway, undoing that
deliberate separation, or (b) endlessly re-checking a assertion that structurally
cannot pass against the unmodified `db:fresh-dev` script.

**What must actually change** (a scope decision for the spec owner, not
something this research task resolves unilaterally): `db:fresh-dev` needs an
explicit step — after its existing baseline-stamp call — that re-runs the
known content-only migrations for real, the same way §5's step 3 does by hand.
Concretely, one of:

1. **Extend the `db:fresh-dev` npm script** to delete the ledger rows for a
   known list of content-only migrations (0025, 0027, 0028, plus the new
   M-B/M-C once they exist — M-A does not need this, its fixture already
   covers it) and re-run `db:seed:migrate` before the test-users step. This
   keeps `db:fresh-dev` a single command that actually produces prod parity,
   at the cost of a hardcoded list that must be kept current (the exact list
   `first-time-setup.md` already fails to keep current for 0027/0028 today —
   whatever mechanism is chosen should not repeat that drift).
2. **Add a `meta.contentOnly` (or similar) flag** to `SeedMigrationMeta`
   (`types.ts:39-62`) that `baselineStamp` checks and skips stamping for,
   letting those specific migrations fall through to a real run even during a
   `--baseline-stamp` invocation. This is a real code change to the shared
   data-migration infrastructure (not just this spec's three migrations) and
   is a bigger lift than option 1, but removes the hardcoded-list drift risk
   permanently.
3. **Redefine AC-15's verification method** to explicitly include the manual
   re-run recipe (§5) as a documented, required step of "building a fresh dev
   DB that matches prod for this content" — i.e. accept that `db:fresh-dev`
   alone does not (and, given 0025's deliberate design, should not
   automatically) reproduce this specific slice of prod content, and stop
   treating that as a bug to fix in the fixtures.

This is a decision for the spec owner, flagged here rather than picked
unilaterally, per this task's research-only scope. Whichever direction is
chosen, T-035 (fresh vs. migrated DB parity) should not proceed on the current
assumption that a fixture edit will make the gap disappear — it will not.

**Secondary, smaller finding**: `docs/deployment/first-time-setup.md`'s
content-only re-run list (lines 810-827) is already stale — it lists only
`0025-seed-real-blog-posts` even though `0027` and `0028` are structurally
identical content-only migrations that predate this spec. Worth a follow-up
independent of HOS-375, since it means the *documented* production day-1
bootstrap procedure already ships zero Entre Ríos events today, silently.

---

## References

- `packages/seed/src/data-migrations/baselineStamp.ts`
- `packages/seed/src/data-migrations/runner.ts`
- `packages/seed/src/data-migrations/discover.ts`
- `packages/seed/src/data-migrations/ledger.ts`
- `packages/seed/src/data-migrations/types.ts`
- `packages/seed/src/data-migrations/prodGate.ts`
- `packages/seed/src/data-migrations/0025-seed-real-blog-posts.ts` (lines 43-53
  for the baseline-stamp-gap docstring; 148-178 for `ensureEditorialAuthor`)
- `packages/seed/src/data-migrations/0027-add-confirmed-events-entre-rios-2026.ts` (header, lines 1-45)
- `packages/seed/src/data-migrations/0028-add-estimated-events-entre-rios.ts` (header, lines 1-46)
- `scripts/check-seed-dual-write.sh` (lines 171, 205-232, 271-276, 305-336)
- `docs/guides/seed-data-migrations.md`
- `docs/deployment/first-time-setup.md` (lines 760-827, Phase 4)
- `package.json` (lines 57-58, `db:fresh`/`db:fresh-dev` scripts)
