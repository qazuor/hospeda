---
title: Fix seed dual-write guard's fail-open allowlist gap
linear: HOS-173
statusSource: linear
created: 2026-07-15
type: fix
areas:
  - devops
  - db
---

# Fix seed dual-write guard's fail-open allowlist gap

## 1. Summary

`scripts/check-seed-dual-write.sh` is the CI guard that enforces the project's seed
dual-write rule (HOS-25): editing seed data that already lives on a deployed
environment must ship a numbered data-migration in the same PR, or a fresh DB is
correct while staging/prod silently never receive the change. The guard is built as a
hardcoded **allowlist** of `required`-seeder paths and is **fail-open** by construction
— any seed source not on that list is invisible to it, regardless of whether the data
is deterministic or product-bound for a live environment. This let the `partners`
catalog (6 fixtures, added 2026-07-08, one day after the guard itself went live) ship
with zero CI signal; the table is still empty in production today (HOS-172). Four other
sources (`gastronomy`, `hostTrade`, `postSponsor`/`postSponsorship`, `experiences`) sit
in the exact same blind zone and are only safe today by chronological luck, not because
the guard caught them.

This spec redesigns the guard's detection model from an allowlist of `required` paths
to a fail-closed default covering the whole seed-data surface, with a narrow,
justification-gated opt-out for the (currently nonexistent) case of genuinely
non-deterministic content — and corrects the two docs (`scripts/check-seed-dual-write.sh`
design comment, `packages/seed/CLAUDE.md`) that currently document the false premise
the old design relied on.

## 2. Problem

### 2.1 The guard is an allowlist, not a denylist — verified mechanism

Reading `scripts/check-seed-dual-write.sh`:

- `compute_changed_files()` (lines 162–189) restricts the diff to exactly three roots
  (lines 185–188): `packages/seed/src/data`, `packages/billing/src/config`,
  `packages/seed/src/data-migrations`.
- `decide()` (lines 217–292) only flags a changed path as "guarded" if it matches one
  of three closed lists: `REQUIRED_DATA_DIR_PATTERNS` (lines 124–138, 13 directory
  prefixes — `amenity`, `attraction`, `destination`, `exchangeRate`,
  `exchangeRateConfig`, `feature`, `revalidationConfig`, `sponsorshipLevel`,
  `sponsorshipPackage`, `postTag`, `pointOfInterest`, `poiCategory`,
  `user/required`), `REQUIRED_TAG_FILE_PATTERN` (line 143), or `BILLING_CONFIG_FILES`
  (lines 147–153, 5 files).
- If a guarded path changed, an **added** file matching
  `packages/seed/src/data-migrations/[0-9]{4}-.+\.ts` is required (`MIGRATION_FILE_PATTERN`,
  line 156, checked at line 259), or the free-text `[skip-seed-migration]: <reason>`
  marker in the PR body/commit messages (line 270) waives it.

Anything outside those three lists — including every source registered under
`runExampleSeeds()` (`packages/seed/src/example/index.ts`, 22 registered seeders as of
this audit) and every seeder that bakes its fixtures into inline TS constants rather
than a `data/**/*.json` folder — is structurally invisible to `decide()`. It is not that
`example/` is denylisted; the allowlist simply never mentions it, so any new seed
source added anywhere is exempt by default unless someone remembers to add its path to
the list. **The exemption is a function of how a seeder is registered (which
orchestrator function calls it), not where its data lives or whether it is
deterministic.**

### 2.2 The premise behind the exemption is factually false for this package

The design comment (lines 54–64) justifies excluding everything outside the allowlist:

> `example/**/*.json` data is excluded entirely: it is regenerated non-deterministically
> on every full reseed (T-016/T-025 exceptions aside) and does not need a live-env
> backfill.

Verified against the actual codebase: **`@repo/seed` has no `@faker-js/faker`
dependency and no `faker.*` call anywhere in `src/`** (confirmed via
`packages/seed/CLAUDE.md`'s own "Deterministic ids, not a Faker seed" correction
section, and via `package.json`). Every fixture — `required` and `example` alike — is
either static hand-curated JSON loaded via `createSeedFactory`, or an inline TS
constant, and gets a **deterministic UUIDv5 id** derived from a stable seed key (e.g.
`partner:001-partner-autoservice-litoral`) via
`packages/seed/src/utils/deterministicFixtureId.ts`. Re-running the full seed produces
byte-identical rows every time. There is no non-deterministic seed data in this
package to exempt.

More: this was already the project's own documented conclusion **before** the guard
was written. `docs/guides/seed-data-migrations.md` (§"Example migrations and
deterministic fixture ids", line 329) states, citing "the HOS-25 OQ-1 resolution", that
`example` fixtures **are** a valid data-migration target precisely because of their
deterministic ids — the opposite of what the guard's design comment assumes six lines
above its own guarded-path list (same doc, line 241). `packages/seed/CLAUDE.md`'s dual
write section (lines 65–67) independently describes the rule's intended scope as
covering "a `required` catalog fixture... or **a deterministic-id `example` fixture**"
— again explicitly including deterministic example data. **The guard's stated premise
contradicts two other places in the same codebase that had already reasoned through
this and landed on the opposite conclusion.** This is a design hole the guard shipped
with, not an unconsidered edge case discovered later.

### 2.3 Not theoretical — it already let one through, and four more sit in the same blind zone

Confirmed against production row counts (2026-07-15, via HOS-172/HOS-173 investigation):

| Source | Registered via | Rows in prod | Fixtures added | Relative to guard (2026-07-07) |
|---|---|---|---|---|
| `data/partner/*.json` (6 fixtures) | `runExampleSeeds()` | **0 — escaped (HOS-172)** | `24ce27a5f`, 2026-07-08 | **1 day after** — guard was live and missed it |
| `data/gastronomy/**` | `runExampleSeeds()` | 6 — present | `05dfba7dd`, 2026-06-17 | 3 weeks before |
| `data/hostTrade/*.json` | `runExampleSeeds()` | 20 — present | `9dd35a9be`, 2026-06-15 | 3 weeks before |
| `data/postSponsor/` + `postSponsorship/` | `runExampleSeeds()` | 5 + 5 — present | original data `77e72492f` et al., 2025-07 (pre-dates HOS-25 entirely — first migration file `494eeecb9` is 2026-07-07) | ~1 year before |
| `example/experiences.seed.ts` (inline constant, no `data/` folder) | `runExampleSeeds()` | 5 — present | `2ab6899d7`, 2026-06-18 (SPEC-240) | 3 weeks before |

Only `partners` is actually missing from prod. **This is not evidence the system
works** — it is chronological luck. Prod's last full `--example` reseed happened
sometime between 2026-06-18 and 2026-07-08 (the window that swept up gastronomy,
hostTrade, and experiences); postSponsor/postSponsorship predate the entire
versioned-migration system (HOS-25 itself only exists since 2026-07-07) and were part
of an original full baseline seed, not a tracked incremental addition. Partners simply
landed one day after both the guard and the migration ledger went live, and the guard's
allowlist never covered its path. **The next fixture added to any of these five
sources — or to any new `example/`-registered source — will escape identically and
silently**, because the guard's blind zone has nothing to do with when these five
happened to be safe; it is a standing structural gap.

Per HOS-172's resolution comment, the owner separately confirmed the `partners` scope
does **not** expand into a batched backfill of the other four — those are present and
stay as-is; HOS-172 owns only the partners backfill migration. This spec does not
duplicate that backfill; it owns making sure the *next* occurrence is caught by CI
instead of discovered by a user report.

### 2.4 The deeper problem: `required` vs `example` is the wrong axis entirely

The guard (and the rule it enforces) conflates three genuinely different categories of
seed data into two buckets:

1. **Bootstrap-critical** (`required`) — must exist for the app to function
   (roles, permission grants, system config, catalog enums).
2. **Curated real content meant for a live environment** — `partner`, `gastronomy`,
   `hostTrade`, `postSponsor`/`postSponsorship`, `experiences`. These are registered
   under `runExampleSeeds()` (so `--required`-only production day-1 bootstrap, per
   `docs/deployment/first-time-setup.md` Phase 4, does **not** load them) but they are
   genuine, deterministic, intentionally-curated rows that the product wants visible
   once seeded — indistinguishable from `required` data for dual-write purposes.
3. **Synthetic demo-only data that must never represent real content** — sample
   accommodations, fake events, fake posts, fake reviews, fake bookmarks, demo tag
   assignments, demo users. Also registered under `runExampleSeeds()`, but for the
   opposite reason: this content is fine to lose or never backfill, because it was
   never meant to be real.

A `partner` fixture sits in the same registration bucket (`runExampleSeeds()`) as a
fake accommodation, and the guard cannot tell them apart because it only looks at
*which function registered the seeder*, not *what the data represents*. This is the
root error, and no amount of adding more paths to an allowlist fixes it — a
path-based allowlist structurally cannot express product intent.

## 3. Goals

- G-1: Replace the allowlist mechanism with a fail-closed default: any change under the
  seed-data surface (`packages/seed/src/data/**`, `packages/seed/src/example/**`,
  `packages/billing/src/config/*.config.ts`) requires a data-migration or an explicit,
  justified opt-out — never silent exemption by omission.
- G-2: Close the five confirmed gap sources (`partner`, `gastronomy`, `hostTrade`,
  `postSponsor`, `postSponsorship`, `experiences`) so any *future* edit to them is
  caught by CI.
- G-3: Replace the false "non-deterministic" opt-out justification with the true one —
  content that must never exist in a real environment regardless of determinism — and
  make the justification a closed, reviewable set of reasons rather than free text.
- G-4: Correct the two docs (`scripts/check-seed-dual-write.sh` design comment,
  `packages/seed/CLAUDE.md`, `docs/guides/seed-data-migrations.md`) that currently
  state or imply the false non-determinism premise.
- G-5: Add a regression test that replays the exact partners-commit shape (a new
  `runExampleSeeds()`-registered JSON fixture folder, no migration, no marker) and
  asserts the guard now fails it.

## 4. Non-goals

- NG-1: The `partners` prod backfill itself (data-migration + `db:seed:migrate` run) —
  owned by HOS-172, already scoped there.
- NG-2: Auditing or backfilling any source beyond the five confirmed in §2.3 — the
  owner explicitly closed that question on HOS-172 (no batching beyond partners).
- NG-3: Introducing a first-class `seedGroup: 'required' | 'prod-content' |
  'demo-only'` taxonomy that replaces `required`/`example` at the seeder-registration
  level. This is a real product/architecture question (§11 OQ-1) but is a larger,
  cross-cutting change to the seed package's core abstraction (`createSeedFactory`,
  `runRequiredSeeds()`/`runExampleSeeds()`, every seeder registration site) — out of
  proportion for a CI-guard fix. This spec's design does not require it: the guard can
  become fail-closed today using only file-path patterns.
- NG-4: A general mechanical migration ↔ baseline reconciliation script (diffing every
  migration's `up()` end-state against current baseline fixtures) — flagged as a
  residual risk (§10 R-3), not built here.
- NG-5: Building automated verification of the "genuinely non-deterministic" opt-out
  reason (e.g. grepping the file for `faker`/`Math.random`/`crypto.randomUUID()` calls)
  — flagged as a possible future tightening (§11 OQ-2), not required for v1 since no
  such case currently exists in the codebase to verify against.

## 5. Current baseline

- `scripts/check-seed-dual-write.sh` — the guard script. Key line ranges verified
  during this audit: `compute_changed_files()` 162–189 (diff roots 185–188); `decide()`
  217–292; `REQUIRED_DATA_DIR_PATTERNS` 124–138 (13 patterns); `REQUIRED_TAG_FILE_PATTERN`
  143; `BILLING_CONFIG_FILES` 147–153 (5 files); `MIGRATION_FILE_PATTERN` 156 (checked
  259); skip-marker check 270; false-premise design comment 61–64; scoped-out
  inline-constant seeders comment 54–64 (`rolePermissions.seed.ts`, `aiPrompts.seed.ts`,
  `aiSettings.seed.ts`, `socialAutomation.seed.ts`, `contentModeration.seed.ts`,
  `systemUser.seed.ts` — all under `packages/seed/src/required/`).
- `scripts/__tests__/check-seed-dual-write.test.ts` — existing test suite, drives
  `decide()` via `CHANGED_FILES_OVERRIDE`/`MARKER_TEXT_OVERRIDE` env injection points
  (already built for exactly this kind of test — no new test harness needed).
- `packages/seed/src/example/index.ts` — `runExampleSeeds()` orchestrator, 22
  registered seeders as of this audit (imports at lines 5–30). Six of them
  (`seedExperiences`, `seedGastronomies`, `seedHostTrades`, `seedPartners`,
  `seedPostSponsors`, `seedPostSponsorships`) are confirmed prod-bound curated content;
  the remaining ~16 (accommodations, events, posts, reviews, bookmarks, tags, users,
  and their join tables) are confirmed demo-only.
- `packages/seed/src/example/experiences.seed.ts` — the one confirmed case of a
  `runExampleSeeds()` source with **no `data/**/*.json` folder at all**: its fixtures
  are an inline `ExperienceInsertInputDraft[]` TS array (line 142), still id'd via
  `deterministicFixtureId` (line 41). A pure path-glob guard over `data/**` cannot see
  this file at all; it must be named explicitly.
- `packages/seed/src/required/{rolePermissions,aiPrompts,aiSettings,socialAutomation,
  contentModeration,systemUser}.seed.ts` — the pre-existing, already-documented
  "scoped out" inline-constant `required` seeders (design comment lines 54–64). Same
  structural problem as `experiences.seed.ts` but on the `required` side: no `data/`
  folder to path-match, would need the whole file flagged on any diff.
- `packages/seed/CLAUDE.md` lines 65–67 ("dual-write rule (MANDATORY)") already states
  the rule covers "a deterministic-id `example` fixture" — contradicting the guard's
  own narrower implementation.
- `docs/guides/seed-data-migrations.md` line 241 repeats the false non-determinism
  premise in its own guarded-paths description (and is separately stale: missing
  `pointOfInterest`/`poiCategory`, added to the script after this doc was last
  updated); line 329 ("Example migrations and deterministic fixture ids") states the
  opposite conclusion in the same file.
- `docs/deployment/first-time-setup.md` Phase 4 — documents the real production
  bootstrap command, `pnpm --filter @repo/seed seed --required --exclude=users`.
  `--example` is not part of the documented prod path; per the owner's HOS-172
  resolution comment, prod today nonetheless carries a full `--example` seed because
  it has been used as the de-facto test environment while MercadoPago is broken in
  staging, and this is planned to be cleaned up once staging MP works and HOS-171
  ships. Until that cleanup, prod is affected by every `runExampleSeeds()` source, not
  just `required` ones — reinforcing that the current `required`-only guard scope is
  wrong even under the guard's own stated goal.

## 6. Proposed design

### 6.1 Invert the guard from allowlist to fail-closed default

Replace `REQUIRED_DATA_DIR_PATTERNS` (a list of what to catch) with a broader default
scope plus a short, explicit exemption list (a list of what NOT to catch), inverting
the trust direction:

- **Default-guarded surface**: any changed path under `packages/seed/src/data/**` or
  `packages/seed/src/example/**` (plus the existing `packages/billing/src/config/
  {plans,limits,entitlements,addons,promo-codes}.config.ts` files, unchanged), EXCEPT
  paths matching the exemption list below.
- **Exemption list**: an explicit, small, reviewed set of paths/files carrying a
  one-line reason each, replacing free-floating trust in "example = safe". Initial
  population = the ~16 confirmed demo-only sources from §5 (accommodations, events,
  posts, reviews, bookmarks, tags, users, and their join tables), each tagged with
  reason `"demo-only: synthetic content, must never represent a real environment
  regardless of reseed determinism"`.
- This means **zero new false positives on day one** (every currently-safe demo-only
  source gets an explicit, reviewed exemption instead of an implicit blanket one) while
  **every currently-ungoverned source becomes guarded by default**, including any
  seeder added after this spec ships — closing the "someone must remember to update
  the allowlist" failure mode that let partners through.
- `packages/seed/src/example/experiences.seed.ts` and the six `required/*.seed.ts`
  inline-constant files (§5) cannot be matched by a `data/**` glob at all (no JSON
  folder to diff). They are added to the default-guarded surface as **named files**,
  guarded on *any* diff to the whole file (coarse-grained — see §6.2 for why this is
  the recommended v1 approach over alternatives).

### 6.2 Inline-constant seeders — coarse whole-file guard (recommended) vs. alternatives

A path-based guard, fail-open or fail-closed, cannot see a change to *part of* a file
(e.g. one entry added to `ExperienceInsertInputDraft[]`) without treating the *whole
file* as the unit of change. Three options, presented for approval before
implementation (this is a real design tradeoff, not a mechanical fix):

1. **Coarse whole-file guard (recommended for v1)**: add
   `packages/seed/src/example/experiences.seed.ts` and the six `required/*.seed.ts`
   inline-constant files to the default-guarded surface as literal filenames. ANY diff
   to these 7 files (data or logic) requires a migration or opt-out marker.
   - Pros: zero new tooling, ships with this spec, closes the practical gap for known
     files immediately, matches this spec's "proportionate" scope constraint.
   - Cons: false positives — a pure refactor of `experiences.seed.ts`'s orchestration
     logic (no data change) trips the guard and needs a `[skip-seed-migration]` marker
     even though nothing data-relevant changed. Given how rarely these 7 files change
     (verified: no more than a handful of commits each since creation), the false-positive
     cost is low relative to the risk closed.
2. **Extract inline constants into their own data files**, mirroring the `data/**/*.json`
   pattern used everywhere else (e.g. `experiences.data.ts` holding only the array,
   imported by `experiences.seed.ts`'s orchestration). Then the existing path-glob
   mechanism covers it precisely, no coarse-graining needed.
   - Pros: precise, consistent with the rest of the package's conventions, no
     false-positive risk from unrelated logic changes.
   - Cons: a real refactor across 7 files (not a CI-config change), touches
     `required/*.seed.ts` files with real behavioral risk if the extraction is sloppy;
     proportionally larger than the rest of this spec. Candidate as a fast-follow, not
     v1.
3. **A `// seed-data:` pragma the guard scans for inside the file**, matching only the
   annotated block on diff.
   - Pros: precise without a refactor.
   - Cons: new parsing logic in a bash script (todya string/regex diffing only), higher
     implementation and maintenance cost than either option above, a genuinely new
     mechanism for a project that otherwise has none of this kind. Not recommended.

**Recommendation: ship Option 1 in this spec**, note Option 2 as a candidate
low-priority follow-up (tracked as an open question, §11 OQ-3) rather than blocking
this fix on a larger refactor.

### 6.3 Opt-out: replace the false justification with the true one

Today's `[skip-seed-migration]: <reason>` marker accepts any free text — including,
historically, "it's example data" (the false premise this spec is fixing). Since the
whole guarded surface is now default-on, the opt-out becomes load-bearing for the ~16
demo-only exemptions and any future genuinely-new demo fixture. Two changes:

- The exemption list (§6.1) is the primary mechanism for **known, reviewed** demo-only
  sources — no PR-time opt-out needed for files already on that list.
- For a **new** demo-only source not yet on the list, the PR-time
  `[skip-seed-migration]: <reason>` marker remains available, but the reason is
  constrained by review (not tooling — see NG-5) to one of two true justifications:
  1. `"demo-only: synthetic content, must never represent a real environment"` (the
     only category that currently exists in this codebase).
  2. `"non-deterministic: <describe the actual regeneration mechanism, e.g. faker call
     or timestamp-based id>"` — kept available for a future fixture that genuinely
     re-randomizes, even though no such case exists today. A PR using this reason with
     no verifiable randomness mechanism in the diff is a reviewer red flag, same trust
     boundary as every other magic-word convention in this repo (per the script's own
     existing false-positive/false-negative note, lines 80–89).
  The literal string `"non-deterministic"` alone, without a described mechanism, is no
  longer an acceptable reason on its own — this is the concrete fix for the false
  premise from §2.2.

### 6.4 What is explicitly NOT changed

- The `MIGRATION_FILE_PATTERN` / "new migration added" detection (line 156, 259) is
  unchanged — still requires an *added* `NNNN-*.ts` file.
- The `BILLING_CONFIG_FILES` list and its detection logic are unchanged.
- `compute_changed_files()`'s three diff roots (line 185–188) are unchanged — the fix
  is entirely inside `decide()`'s pattern matching, not the diff scope.
- The test-injection points (`CHANGED_FILES_OVERRIDE`, `MARKER_TEXT_OVERRIDE`) are
  unchanged and are exactly what the new regression test (§9 AC-1) uses.

## 7. Data model / contracts

No database schema or API contract changes. This is a CI script + two documentation
files.

- `scripts/check-seed-dual-write.sh`: `REQUIRED_DATA_DIR_PATTERNS` renamed/reworked
  into a default-guarded-surface pattern plus an `EXEMPT_PATTERNS` (or equivalently
  named) array; `decide()`'s matching logic inverted per §6.1.
- `scripts/__tests__/check-seed-dual-write.test.ts`: new test cases per §9.
- `packages/seed/CLAUDE.md` (lines 63–78, "The dual-write rule (MANDATORY)" section):
  correct the guarded-path description to match the new fail-closed model; the
  existing line 65–67 wording ("a deterministic-id `example` fixture") already matches
  the new intended behavior and does not need to change in substance, only the
  guarded-path list below it.
- `docs/guides/seed-data-migrations.md` (lines 235–259, "CI guard" section): same
  correction, plus reconcile the stale guarded-path list (add `pointOfInterest`,
  `poiCategory` if not already fixed independently) while touching this section.
- Root `CLAUDE.md` bullet "Seed dual-write rule (MANDATORY, HOS-25)" (line ~492):
  spot-check for the same false premise; update only if it repeats it (not confirmed
  during this audit — the bullet was read at a summary level, not verified line-by-line
  against the false-premise wording specifically).

## 8. UX / UI behavior

Not applicable — CI-only change, no user-facing surface.

## 9. Acceptance criteria

- **AC-1 (regression test — the core of this spec)**: Given a change that replays the
  exact shape of commit `24ce27a5f` (a brand-new `packages/seed/src/data/partner/
  *.json` folder with 6 new fixture files, registered via `runExampleSeeds()`, no
  accompanying `data-migrations/NNNN-*.ts` file, no `[skip-seed-migration]` marker),
  when the guard runs against that diff, then it exits 1 and reports the changed
  partner paths as guarded-but-unmigrated. This must be a concrete test case in
  `scripts/__tests__/check-seed-dual-write.test.ts` using `CHANGED_FILES_OVERRIDE`,
  not a manual replay.
- **AC-2 (fail-closed default)**: Given a diff that adds a new file under
  `packages/seed/src/example/<any-new-seeder>/*.json` that is NOT on the exemption
  list and is not one of the 7 named inline-constant files, when the guard runs with
  no accompanying migration and no marker, then it exits 1. (This is the general case
  AC-1 is a specific instance of — verifies the default really is closed, not just
  patched for partners specifically.)
- **AC-3 (existing demo-only sources stay green)**: Given a diff that only touches one
  of the ~16 confirmed demo-only sources on the exemption list (e.g.
  `packages/seed/src/example/accommodations.seed.ts`'s JSON fixtures) with no
  migration and no marker, when the guard runs, then it exits 0 — the exemption list
  entry is sufficient, no PR-time marker required. This proves the inversion did not
  introduce a wave of new required markers on unrelated, already-safe PRs.
- **AC-4 (the four other confirmed gap sources are now guarded)**: Given a diff that
  touches `packages/seed/src/data/gastronomy/**`, `packages/seed/src/data/hostTrade/
  **`, `packages/seed/src/data/postSponsor/**`, `packages/seed/src/data/
  postSponsorship/**`, or `packages/seed/src/example/experiences.seed.ts`, with no
  migration and no marker, when the guard runs, then it exits 1 for each, individually
  tested.
- **AC-5 (inline-constant `required` seeders — the pre-existing scoped-out set)**:
  Given a diff to any of `rolePermissions.seed.ts`, `aiPrompts.seed.ts`,
  `aiSettings.seed.ts`, `socialAutomation.seed.ts`, `contentModeration.seed.ts`,
  `systemUser.seed.ts` with no migration and no marker, when the guard runs, then it
  exits 1 (closing the design comment's own previously-acknowledged v1 gap, per §6.2
  Option 1).
- **AC-6 (marker reason no longer accepts the bare false premise)**: This AC is a
  review-process/documentation criterion, not a script-enforced one (per NG-5) — the
  updated `packages/seed/CLAUDE.md` / script header must state the two valid opt-out
  reason categories from §6.3 and must NOT restate "regenerated non-deterministically"
  as a blanket justification for `example/` as a whole.
- **AC-7 (docs corrected)**: `scripts/check-seed-dual-write.sh` design comment (current
  lines 54–64), `packages/seed/CLAUDE.md` dual-write section, and
  `docs/guides/seed-data-migrations.md` "CI guard" section no longer state or imply
  that `example/` data is exempt because it is non-deterministic. All three describe
  the same fail-closed-plus-exemption-list model.
- **AC-8 (existing tests stay green)**: The full existing `scripts/__tests__/
  check-seed-dual-write.test.ts` suite passes unmodified in its existing assertions
  (only additions, no behavior-changing edits to pre-existing test cases that covered
  the old `REQUIRED_DATA_DIR_PATTERNS` list, since those directories remain guarded
  under the new model too).

## 10. Risks

- R-1: **False positives on the 7 coarse-grained inline-constant files** (§6.2 Option
  1) — a non-data refactor to any of them now requires an opt-out marker. Mitigated by
  low change frequency (verified: infrequent commits to these files) and by the
  marker mechanism being cheap (one line in the PR body).
- R-2: **Exemption list drift** — the ~16-entry demo-only exemption list needs upkeep
  as new demo seeders are added; a demo seeder NOT added to the list will (correctly,
  per the fail-closed design) block CI until someone either adds it to the list or
  confirms with a marker that it is demo-only. This is the intended behavior (visible
  friction beats silent escape) but does add a small one-time step to adding a new
  demo fixture type, whereas today it is invisible.
- R-3 (residual, out of scope per NG-4): this audit did not mechanically diff every
  existing migration's `up()` end-state against the current baseline fixtures across
  `0001`–`0014` — only commit-log inspection found no inverse gap (a migration
  referencing a fixture that no longer matches the baseline). A dedicated
  reconciliation script would catch this class of drift mechanically; until built,
  the mitigation is the existing PR-review process plus this spec's regression test
  preventing new instances of the *forward* gap (baseline changed, no migration) —
  it does not detect the inverse.
- R-4: The exemption-list-vs-`seedGroup` question (NG-3/OQ-1) means this fix is layered
  on top of the existing `required`/`example` registration split rather than replacing
  it. If the owner later adopts a `seedGroup` taxonomy, the exemption list becomes
  redundant with it and should be collapsed — not a regression, but worth flagging so
  the exemption list isn't treated as a second permanent source of truth.

## 11. Open questions

- **OQ-1 (owner decision needed)**: Should `packages/seed` grow a first-class
  `seedGroup: 'required' | 'prod-content' | 'demo-only'` (or equivalent) concept at
  the seeder-registration level, replacing today's `required`/`example` split as the
  thing the guard (and possibly the CLI `--required`/`--example` flags, and
  `docs/deployment/first-time-setup.md`) reason about? This would make the distinction
  in §2.4 structural instead of guard-side-only. Recommended as a good direction but
  explicitly NOT required for this spec (NG-3) — it is a larger cross-cutting change
  the owner should scope separately if wanted.
- **OQ-2**: Should the "non-deterministic" opt-out reason (§6.3, category 2) be
  mechanically verified (grep the diff for `faker`/`crypto.randomUUID()`/similar) in a
  later iteration, given no current case needs it? Flagged, not built (NG-5).
- **OQ-3**: Should the 7 coarse-grained inline-constant files (§6.2) be refactored to
  extract their data into dedicated files (§6.2 Option 2) as a fast-follow, to remove
  the false-positive risk from R-1? Not blocking this spec.
- **OQ-4**: Should R-3's residual inverse-gap risk be closed with a dedicated
  mechanical reconciliation script as a separate follow-up spec, given it was flagged
  but not built here?

## 12. Implementation notes

- Prefer editing `scripts/check-seed-dual-write.sh`'s existing pattern-array structure
  (bash arrays of regex prefixes, matched via `=~` in a loop) rather than introducing a
  new matching mechanism — the exemption list should be the same shape
  (`EXEMPT_DATA_DIR_PATTERNS` array) so the diff to the script stays minimal and
  reviewable.
- The seven inline-constant files (§6.2) are exact filenames, not prefixes — match them
  with `==` equality the same way `BILLING_CONFIG_FILES` is already matched (lines
  239–244), not the `=~` prefix pattern used for directories.
- Keep `compute_changed_files()`'s diff roots as-is (§6.4) — no need to widen them,
  since `packages/seed/src/example/**` already falls under the existing
  `packages/seed/src/data` root only if example fixtures live under `data/`; verify
  during implementation whether `packages/seed/src/example/**` itself needs to be
  added as a fourth diff root (it currently is NOT covered by any of the three
  existing roots at lines 185–188, since `example/*.seed.ts` files live outside
  `packages/seed/src/data/`). **This is a likely required change to
  `compute_changed_files()`, not just `decide()`** — flag during implementation and
  confirm before assuming §6.4's "no diff-root change needed" claim; the audit found
  conflicting signals (fixture JSON lives under `data/`, but the seven inline-constant
  orchestration files live under `example/`/`required/` and need their own root or
  explicit inclusion).
- When implementing AC-1 through AC-5, add cases incrementally to the existing test
  file rather than restructuring it — the override-injection design already supports
  everything needed.

## 13. Linear

Canonical tracking:
HOS-173

Related: HOS-172 (the partners backfill this gap allowed; scope of that spec is
confirmed limited to partners only, per its own resolution comment), HOS-25 (the
dual-write rule and migration system this guard enforces), HOS-166 (the investigation
that surfaced both HOS-172 and HOS-173).
