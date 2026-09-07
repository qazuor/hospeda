---
title: The What's New entry is written by the sign-off and audited by the promotion
linear: HOS-1214
statusSource: linear
created: 2026-09-07
type: feature
areas:
  - devops
  - api
  - content
---

# The What's New entry is written by the sign-off and audited by the promotion

## 1. Summary

`apps/api/src/data/whats-new/whats-new.ts` was empty from the day the feature
shipped until 2026-09-07. It was not emptied by a bug. It was empty because **no
workflow ever asks anyone to write an entry**, and a step nobody is asked to take
is a step that does not happen.

This spec adds the missing step in two places with two different jobs:

- **The smoke sign-off WRITES.** It is the moment someone has already looked at
  the change with a user's eyes. It already writes a `<!-- smoke-signoff v1 -->`
  comment on the Linear issue; it now also asks whether the change is a novelty
  and, when it is, drafts the entry.
- **The staging → main promotion AUDITS.** It enumerates the PRs in the range and
  refuses to promote while any of them has never been evaluated. Sign-offs get
  skipped; the promotion is the last door everything passes through.

The audit checks **"was this PR evaluated?"**, never **"does this PR have an
entry?"** — most PRs are not a novelty for an end user, and a gate that demanded
an entry per PR would go red on every promotion and be trained away within a
month.

## 2. Problem

### 2.1 The catalog was empty because the process has no such step

The feature is complete: schema, endpoint, seen-state, baseline, role targeting,
modal, panel, badge, CSP allowlist for images, and a CI test on image origins. The
one thing missing was content, and the reason is stated plainly in HOS-1214: *"no
hay bug que arreglar ahí — hay un paso que ningún flujo de trabajo pide."*

### 2.2 The backfill already happened, and it proves the point rather than closing it

**Finding, verified against `origin/staging` @ `479780dff`: the catalog is no
longer empty.** HOS-964 (PR #3267, merged 2026-09-07) loaded four entries. That
does not resolve this spec — it demonstrates it. Those four were written by one
person, in one sitting, describing work that had already shipped, *because someone
went looking for the gap*. Nothing in the repo will ask for the fifth.

The backfill also left behind the most useful artifact in this spec's baseline:
the comment at `whats-new.ts:103-117` recording why the four entries were re-dated
to the release day. See F-2.

### 2.3 A reminder is the current state with extra words

The failure mode is **forgetting**, not bad copy. Any design that proposes without
blocking is the status quo plus a notification, and it re-empties. Any design that
writes the entry unattended from a PR title produces copy written for a reviewer
and shown to a guest — a catalog full of entries nobody wants to read is worse than
an empty one, because it teaches users to dismiss the badge.

So the mechanism must **propose and block until answered**, and the answer must be
allowed to be "no".

## 3. Findings from the current code

These were verified against `origin/staging` @ `479780dff` and constrain the
design.

### F-1 · `/smoke` lives OUTSIDE this repo; the skill lives inside it

`.claude/commands/smoke.md` **does not exist in this repository**. The `/smoke`
command is a user-global file at `~/.claude/commands/smoke.md`. A PR to this repo
cannot change it.

But its first instruction is: *"Read `.claude/skills/smoke-tanda/SKILL.md` and
`.claude/skills/smoke-tanda/references/formatos.md` before doing anything. The
sign-off comment format, the subsumption rule and the four invariants live there
and are not repeated here."*

**Therefore the novelty step goes in the SKILL and in `references/formatos.md`,
both of which are in-repo, and it reaches `/smoke` and `smoke-tanda` alike through
that existing delegation.** No out-of-repo edit is required, and none is proposed.

### F-2 · Publishing early is a real, measured hazard — and it is why entries get future-dated

`getWhatsNew.ts` lazily writes `baselineAt = now` on a user's first read
(`initWhatsNewBaseline`), and `computeSeen` (`whats-new.helpers.ts:121`) treats any
entry with `publishedAt <= baselineAt` as **already seen**. The HOS-964 comment
records the consequence: the four entries were originally dated Sept 3-5, which
meant anyone who had never opened the dashboard before that batch shipped would
baseline past all four and lose them permanently. They were moved to the actual
release day for that reason.

Two consequences for this spec:

1. Dating an entry **in the future** is safe for the baseline (`publishedAt >
   baselineAt` ⇒ unseen), which is what makes decision D-1's deferred publication
   viable at all.
2. Dating an entry **in the past** silently destroys it for every new account. So
   a `publishedAt` that has slipped into the past while waiting for a promotion is
   a defect, and the promotion gate has to catch it (AC-9).

### F-3 · HOS-1216 is decided and implemented: a future-dated entry is HIDDEN, not rejected

HOS-1216 offered two mutually exclusive readings — hide the entry until its date,
or reject future dates with a `.refine()` at validation time. **The owner chose to
hide (2026-09-07), explicitly discarding the `.refine()`, for the reason this spec
depends on:** rejecting future dates would kill the write-early/publish-late
mechanism. Scheduling ahead of the release day is a deliberate capability already
in use, documented at `whats-new.ts:103-117`.

Implemented in commit `b36a4c52d` (`fix(api): hide what's-new entries scheduled for
the future`), which adds to `apps/api/src/utils/whats-new/whats-new.helpers.ts`:

```ts
export function filterEntriesByPublishedAt({
    entries,
    now = new Date().toISOString()
}: FilterEntriesByPublishedAtInput): WhatsNewEntry[] {
    const nowMs = new Date(now).getTime();
    return entries.filter((entry) => new Date(entry.publishedAt).getTime() <= nowMs);
}
```

RO-RO, `now` injectable, inclusive edge (an entry dated exactly `now` is already
visible). Applied at `getWhatsNew.ts:152` **before** `filterEntriesByRole` and
before the response `.map()`, so a not-yet-published entry never reaches `items`,
never counts toward `unseenCount`, and never trips the `highlight` auto-modal.

**No `.refine()` was added to the schema.** Future dating stays legal; only
visibility changed. D-1's dating rule therefore rests on shipped behaviour, not on
a pending decision.

### F-3b · The new filter gates the FUTURE and does nothing about the PAST

This is what keeps AC-9 alive. HOS-1216 sharpens it rather than covering it.

`filterEntriesByPublishedAt` keeps every entry with `publishedAt <= now`, so an
entry whose date has **slipped into the past** while waiting for a promotion sails
straight through it. It then meets `computeSeen`, which marks an entry seen when
`publishedAt <= baselineAt` — and for an account whose first-ever read happens
after that date, `baselineAt = now`.

The two comparisons use the same operator in the same direction against two
different reference points, which for a brand-new account are **the same instant**.
That makes them exactly complementary: an entry has either not published yet
(filtered out) or published at or before that user's baseline (auto-seen). A
brand-new account cannot see any entry it did not arrive in time for, and **no code
anywhere compares `publishedAt` against the promotion**.

Nothing in `b36a4c52d` addresses this, and nothing there should — it is not a
read-side defect. It is an authoring-time defect, and the promotion gate is the
only place that can catch it (AC-9).

### F-4 · The "never reuse a retired id" rule has no enforcement anywhere

Both `whats-new.ts:19` and `whats-new.schema.ts:96` state that a retired id must
never be reused, because a stale `seenIds` entry in user settings would silently
mark a new entry as already seen. `rg` over both directories finds the rule only in
prose. The archival policy removes entries older than ~6 months, at which point the
id leaves the repo entirely and nothing remembers it existed.

Automating entry creation raises the collision rate from "nobody writes entries" to
"an entry per novelty", so the rule needs a ledger before it needs anything else
(AC-11).

### F-5 · No label collision, and GitHub labels here are unmanaged

`gh label list --limit 300` returns 34 labels, none matching `whats-new-*`. The
repo's GitHub labels use a `type:`/`status:` colon convention inherited from an
older planning plugin; the smoke gate's `status-needs-smoke-*` labels are **Linear**
labels, not GitHub ones. `whats-new-none` / `whats-new-done` collide with nothing
and do not need to follow the colon convention (nothing consumes it).

### F-6 · A guard being in `pnpm check:guards` does NOT make it run in CI

`ci.yml`'s `guards` job says so twice in its own comments: each guard is an
explicit step. Anything this spec adds to `check:guards` must **also** be added as
a step in that job.

### F-7 · Every PR into `staging` produces a first-parent merge commit

CLAUDE.md's branch workflow step 5 mandates `gh pr merge --merge` (`--no-ff`).
Recent history confirms it (`Merge pull request #3263 from …`). So
`git log --first-parent origin/main..origin/staging` yields **exactly one commit per
merged PR**, which is what makes the audit's enumeration bounded and complete
(§6.2).

## 4. Decisions (taken by the owner, 2026-09-07 — not open)

### D-1 · Two moments, two jobs: the sign-off writes, the promotion audits

The sign-off is where someone has already looked at the change as a user, and it
already writes to Linear at that exact instant. The promotion is where the novelty
becomes true for the public, and — the owner's stated reason — *"los sign-offs a
veces no se hacen porque el agente se los saltea"*. One writes, the other catches
what the first missed. Neither replaces the other.

**Dating (derived decision — see OQ-2):** the entry is committed at sign-off time
but carries a `publishedAt` set to the **expected promotion date**, staying
invisible until then via HOS-1216's `filterEntriesByPublishedAt` (F-3, shipped in
`b36a4c52d`). This reconciles writing early (while the context is fresh and the
verifier is looking at the thing) with publishing late (when the public actually
has it).

The *capability* this relies on is settled: future dating is legal and hidden until
its date. What remains unconfirmed is the **choice to use it this way** — the owner
approved the sign-off mechanism, but never literally confirmed "commit at sign-off,
date it to the expected promotion". That, and only that, is OQ-2.

### D-2 · The audit checks that a PR was EVALUATED, not that it has an entry

This is what makes the gate survivable. Most PRs are not a novelty for an end user.
A gate demanding an entry per PR blocks every promotion and gets ignored; a gate
demanding a *decision* per PR blocks only on PRs nobody thought about.

The decision is recorded as a **GitHub label on the PR**:

| Label | Meaning |
|---|---|
| `whats-new-none` | Evaluated. Not a novelty for an end user. |
| `whats-new-done` | Evaluated. Produced (or extended) a catalog entry. |

The promotion enumerates the PRs in the commit range from the deployed production
SHA — the same scoping mechanism the `smoke-tanda` skill already uses (I0) — and
fails if any of them carries neither label.

**It fails for lack of decision, never for lack of novelty.**

### D-3 · It proposes, and it blocks until answered

The flow asks *"is this a novelty for a user? if so, write it"* and does not close
until it has a yes or a no. It does **not** write the entry unattended from the PR
title: a PR title is written for a reviewer, not for a guest. And it does not
propose without blocking: that is today's state with a reminder on top, and it
re-empties. **Forgetting, not bad wording, is what emptied the catalog.**

### D-4 · `es` by hand; `en`/`pt` machine-translated, marked unreviewed, with a circuit that actually closes

The schema requires `es` and leaves `en`/`pt` optional with a silent fallback to
`es` (`resolveEntryLocale`, `whats-new.helpers.ts:182`). That fallback is precisely
what makes a missing translation invisible, and it is the exact shape of HOS-908.

So: `es` is authored by the operator, `en`/`pt` are machine-produced at the same
moment, **and both are marked as unreviewed until a human says otherwise**. The
marking is worthless without something that forces the review, so §6.3 gives it
one — and reuses the gate that already blocks rather than inventing a second.

## 5. Goals and non-goals

### Goals

- **G-1** — Every merged PR that reaches production carries a recorded
  novelty decision.
- **G-2** — Writing an entry happens at the moment of verification, with the
  operator in the loop, and cannot be silently skipped.
- **G-3** — An entry is invisible to users until the day its change is actually in
  production.
- **G-4** — No `en`/`pt` text reaches a user still marked as unreviewed.
- **G-5** — Fixing a red gate never requires more than one local command.

### Non-goals

- **NG-1** — Deciding *whether a given change is a novelty*. That is human
  judgment; the system only enforces that the judgment was made and recorded.
- **NG-2** — Generating entry copy unattended from PR titles, commit messages, or
  diffs (D-3).
- **NG-3** — Moving the catalog to the database, a seed, or an admin editor. It
  stays a committed TS file validated at boot.
- **NG-4** — Backfilling novelty labels onto PRs merged before this ships (see
  §6.2, cutoff).
- **NG-5** — Retro-writing entries for changes already in production. HOS-964 did
  that once, by hand.
- **NG-6** — Any change to who may promote `staging` → `main`, or to the branch
  workflow itself.

## 6. Proposed design

### 6.1 The write — inside the smoke sign-off

**Where.** A new phase in `.claude/skills/smoke-tanda/SKILL.md`, plus a block in
`references/formatos.md`. Per F-1, both `/smoke` (individual mode) and the
`smoke-tanda` batch reach it through the skill, with no out-of-repo edit.

**When.** After the sign-off comment is written and labels/state are applied (the
current step 6), and before the report. It runs **only** on `Resultado: PASO`, and
**only once per issue** — a second sign-off on the same issue (a second
environment) skips the question if every PR bound to it is already labelled.

A `FALLO`, `PARCIAL` or `PENDIENTE` never triggers it: nothing was verified to
announce.

**What is asked** — one question at a time, per the repo's interaction convention:

1. **Is this a novelty for an end user?** — yes / no. On *no*, the flow applies
   `whats-new-none` to every PR listed in the sign-off comment's `PR(s):` field and
   stops. That is a complete, recorded answer.
2. **Audience** — one or more values of `WhatsNewAudienceRoleSchema`, or "everyone"
   (which writes no `roles` key). The operator picks; the flow never infers it from
   the touched paths.
3. **Title and body, in `es`** — drafted by the agent from what the operator
   actually observed in the smoke (the `Observado` field of the sign-off is the
   raw material, and it is already phrased in user terms), then edited and approved
   by the operator. Body is Markdown. Never accepted verbatim from a PR title.
4. **Highlight?** — `true` auto-opens the modal once. Default `false`.
5. **Expected promotion date** — defaults to the next business day; the operator
   may override.

**How the entry is composed.**

- `id` — `<merge-date-of-the-earliest-bound-PR>-<kebab-slug>`. The date component
  records **when the change was made**, deliberately distinct from `publishedAt`,
  which is the convention HOS-964 established and its comment tells us not to
  "fix". Checked against the retired-id ledger (F-4, AC-11).
- `publishedAt` — the expected promotion date at `12:00Z`. When several entries are
  written for the same date, hours are spread descending so the declared
  newest-first ordering is preserved, exactly as HOS-964 did.
- `title` / `body` — `es` from step 3; `en`/`pt` per §6.3.
- `roles` — from step 2, omitted for a universal broadcast.
- `image` — out of scope for the automated path; an image-bearing entry is added by
  hand following the existing `APPROVED_IMAGE_ORIGINS` checklist.

**Where it lands.** The entry is prepended to `whatsNewEntries` in
`apps/api/src/data/whats-new/whats-new.ts` and committed on a branch off `staging`
with a `[HOS-N] docs(whats-new):` PR, following the normal 6-step branch workflow.
The PR is labelled `whats-new-done`, as are all PRs bound to the issue.

**Failure handling.** Mirrors I3 of the skill: if the label write fails, the flow
**stops and says so**. It never queues the labelling for later — queued writes are
the documented origin of 309 orphaned findings.

### 6.2 The audit — on the promotion PR

**Where.** A new workflow `.github/workflows/whats-new-gate.yml`, triggered on
`pull_request` (`opened`, `synchronize`, `reopened`, `labeled`, `unlabeled`) with
`branches: [main]`, plus `workflow_dispatch`. Precedent and shape:
`validate-pr-title.yml` (a blocking `pull_request` check on `main`) and
`smoke-gate-sync.yml` (a shell + API job with explicit degraded-response handling).

Permissions: `contents: read`, `pull-requests: read`.

**Two modes, decided by the PR's head ref:**

- **head is `staging`** (the promotion PR) — audit the whole range.
- **any other head targeting `main`** (a hotfix, a Dependabot security update) —
  audit that single PR's own labels.

**Enumeration.** Per F-7:

```
git log --first-parent --format=%H origin/main..origin/staging
```

one commit per merged PR. Each is resolved to its PR through
`GET /repos/{owner}/{repo}/commits/{sha}/pulls` — the authoritative association,
not a parse of the merge message. Merge-subject parsing (`Merge pull request
#NNNN`) is kept only as a cross-check, and a disagreement between the two is
reported rather than silently resolved.

A first-parent commit that resolves to **no** PR is a direct push to `staging`,
which the branch workflow forbids. It is reported by SHA and **blocks** — a change
that reached the range outside the reviewed path is the last thing that should
skip the novelty question.

**Exemption.** PRs authored by `dependabot[bot]` or `github-actions[bot]` are
exempt and reported as such. This mirrors `validate-pr-title.yml`'s author-keyed
bot exemption, and keys on the **PR author**, never `github.actor`, for the reason
that workflow documents: a human who touches a bot's PR must not become
responsible for a decision the bot cannot make.

**Cutoff.** Any PR whose merge commit predates the workflow's first commit on
`staging` is exempt and reported under a `pre-cutoff` count. Without this the first
promotion after this ships would name several hundred unlabelled PRs (NG-4).

**The failure message names the PRs.** It never says "something is missing":

```
Promotion blocked: 3 PRs in main..staging were never evaluated for What's New.

  #3271  [HOS-1102] feat(web): host trade benefit QR flow
  #3274  [NOSPEC:footer-copy] fix(web): typo in the footer
  #3280  [HOS-1188] feat(api): daily menu validity window

Decide each one, then re-run this check:
  hops whats-new audit --fix

Applying `whats-new-none` records "evaluated, not a novelty" and is a
complete answer.
```

**Re-running.** Labelling another PR does not re-trigger this PR's workflow, which
is why `labeled`/`unlabeled` are in the trigger list (they fire for the promotion
PR itself) and `workflow_dispatch` is present (for everything else). This is the
same class of gotcha `sync-main-to-staging.yml` documents about `SYNC_PAT` and is
noted in the workflow's header comment.

**Local mirror.** `hops whats-new` under `scripts/client-tools/src/commands/`,
alongside the existing `ci`, `merge` and `verify`:

- `hops whats-new audit` — the same computation, same exit codes, run against
  `origin/main..origin/staging`. Exit `0` clean, `1` blocked, `3` could not
  determine (matching the `hops ci` / `hops merge` convention that `3` means "I do
  not know", which is not a failure).
- `hops whats-new audit --fix` — walks the unlabelled PRs and asks D-3's question
  for each, then applies the label. This is G-5: the CI red always has a
  one-command remedy that does not require pushing anything.

### 6.3 Translation, and the circuit that closes it

This is the weakest point of any "mark it for review" design, so it is specified
rather than gestured at.

**The translator** is the agent already running the sign-off. It has the `es` text
and the operator in front of it. No translation API, no new dependency, no new
credential, no new cron — introducing any of those would be a second thing to keep
alive for a feature that produces a handful of strings per month.

**The mark is structural, not a comment.** A new optional field on
`WhatsNewEntrySchema`:

```ts
/**
 * Per-language review state for the machine-produced translations.
 * A language absent from this map is either absent from the entry or
 * human-authored. `'machine'` means produced by translation and NOT yet
 * accepted by a person.
 */
translations: z
    .object({
        en: z.enum(['machine', 'reviewed', 'declared']).optional(),
        pt: z.enum(['machine', 'reviewed', 'declared']).optional()
    })
    .optional();
```

A comment would be invisible to every guard in the repo, and the i18n guards this
codebase already has *see structure, never content*. A field is greppable, typed,
and validated at API boot along with everything else.

**The circuit is the gate that already exists.** No timer, no second workflow, no
new deadline. The promotion audit (§6.2) additionally fails when any entry whose
`publishedAt` falls on or before the promotion date still carries a `'machine'`
mark. So:

- the review is demanded **exactly when the text becomes user-visible**, never on
  an arbitrary schedule that would go red for everyone and grow an escape hatch;
- it is demanded of the person **already standing at that door**, doing the
  promotion;
- it is **bounded** — the entries written since the last promotion, two languages
  each — not an open-ended backlog that accumulates.

An entry dated further in the future is simply not yet due, and does not block.

**What "reviewed" honestly means.** The person promoting may not read Portuguese.
Pretending otherwise would produce a rubber stamp, which is a worse lie than a
visible mark. So the field admits three values and the gate demands a *recorded
decision*, not a claim of correctness — the same principle as D-2, and the same
shape as the smoke format's `Grado: declarado-de-memoria`:

- `reviewed` — a person who reads the language checked it.
- `declared` — nobody who reads the language checked it; the machine output is
  accepted deliberately and that fact is on the record.
- `machine` — nobody has decided yet. **This is the only value that blocks.**

`declared` unblocks the gate. That is not a loophole: the alternative is a gate
that cannot be satisfied honestly, and a gate that cannot be satisfied honestly is
satisfied dishonestly. Whether `declared` should remain permanently acceptable for
`pt` is OQ-3.

The `es` → `en`/`pt` fallback in `resolveEntryLocale` is **left exactly as is**.
Removing it would make an unreviewed entry render empty rather than in Spanish,
which is worse for the user and would turn a content-review question into an
availability bug.

## 7. Data model / contracts

### 7.1 Schema (`packages/schemas/src/entities/whats-new/whats-new.schema.ts`)

- **Add** the optional `translations` field of §6.3. Optional, so every existing
  entry (including HOS-964's four, which were human-written in all three languages)
  stays valid with no migration.
- **No other change.** `id`, `publishedAt`, `roles`, `highlight`, `title`, `body`,
  `image` keep their current shape and semantics.

### 7.2 Catalog file (`apps/api/src/data/whats-new/whats-new.ts`)

- **Add** an exported append-only `RETIRED_WHATS_NEW_IDS: ReadonlySet<string>`.
  When an entry is removed under the ~6-month archival policy, its id moves here.
  This is the ledger F-4 shows does not exist.

### 7.3 GitHub labels (created once, manually or via the implementing PR)

| Name | Colour | Description |
|---|---|---|
| `whats-new-none` | `#cfd3d7` | Evaluated for What's New — not a novelty for an end user |
| `whats-new-done` | `#0e8a16` | Evaluated for What's New — entry written |

The two are mutually exclusive; carrying both is reported as a conflict and blocks.

### 7.4 New files

| Path | What |
|---|---|
| `.github/workflows/whats-new-gate.yml` | The promotion audit (§6.2) |
| `scripts/check-whats-new-catalog.sh` | Guard: id uniqueness, retired-id collisions, ordering (F-6: must also be added as a step in `ci.yml`'s `guards` job) |
| `scripts/client-tools/src/commands/whats-new/` | `hops whats-new audit [--fix]` |

### 7.5 Modified files

| Path | What |
|---|---|
| `.claude/skills/smoke-tanda/SKILL.md` | The novelty phase (§6.1) |
| `.claude/skills/smoke-tanda/references/formatos.md` | A `Novedad:` line in the sign-off comment format |
| `CLAUDE.md` | The gate, the two labels, and the promotion's new requirement |

The sign-off comment gains one line, so a later sweep can reconstruct the decision
from Linear alone exactly as the rest of the format allows:

```markdown
- **Novedad**: no | 2026-09-10-daily-menu-window   (id, or `no`)
```

## 8. Acceptance criteria

- **AC-1** — *Given* a `/smoke` sign-off with `Resultado: PASO` on an issue whose
  bound PRs carry no novelty label, *when* the sign-off comment has been written,
  *then* the flow asks whether the change is a novelty and does not report
  completion until answered.

- **AC-2** — *Given* the operator answers "not a novelty", *when* the flow
  finishes, *then* every PR listed in the sign-off's `PR(s):` field carries
  `whats-new-none`, no entry is written, and the sign-off comment records
  `Novedad: no`.

- **AC-3** — *Given* the operator answers "novelty" and approves a drafted `es`
  title and body, *when* the flow finishes, *then* a new entry exists at the top of
  `whatsNewEntries` with `publishedAt` set to the expected promotion date, every
  bound PR carries `whats-new-done`, and the sign-off comment records the entry id.

- **AC-4** — *Given* a sign-off with `Resultado: FALLO`, `PARCIAL` or `PENDIENTE`,
  *when* it completes, *then* no novelty question is asked and no label is applied.

- **AC-5** — *Given* a `staging` → `main` PR whose range contains a PR carrying
  neither novelty label, *when* the gate runs, *then* it fails and its message
  names that PR by number and title.

- **AC-6** — *Given* the same range where every PR carries exactly one of the two
  labels, *when* the gate runs, *then* it passes.

- **AC-7** — *Given* a range containing a PR authored by `dependabot[bot]` with no
  novelty label, *when* the gate runs, *then* it passes and reports that PR as
  bot-exempt.

- **AC-8** — *Given* a range whose first-parent enumeration yields a commit that
  resolves to no pull request, *when* the gate runs, *then* it fails and reports
  that commit by SHA as a direct push.

- **AC-9** — *Given* an entry in `staging` but not in `main` whose `publishedAt` is
  already in the past, *when* the gate runs, *then* it fails and asks for the entry
  to be re-dated — because promoting it would auto-mark it seen for every account
  whose baseline post-dates it (F-2).

  **This is the criterion most at risk of being assumed away, so it is stated
  twice.** HOS-1216 does not cover it and cannot: `filterEntriesByPublishedAt`
  hides the future, while this is a past-dated entry, which the filter passes
  through untouched on its way to `computeSeen` (F-3b). An entry that misses its
  promotion is not late — it is **destroyed for every new account**, silently, with
  the API green and the entry present in the response. The gate is the only
  observer of the gap between the date on the entry and the day it actually
  reaches production.

- **AC-10** — *Given* an entry whose `publishedAt` is on or before the promotion
  date and whose `translations.pt` is `'machine'`, *when* the gate runs, *then* it
  fails naming that entry id and that language. *Given* the same entry with `pt`
  set to `'reviewed'` or `'declared'`, it passes. *Given* an entry dated after the
  promotion date, it passes regardless of its marks.

- **AC-11** — *Given* a catalog entry whose `id` appears in
  `RETIRED_WHATS_NEW_IDS`, or that duplicates another live entry's `id`, *when*
  `scripts/check-whats-new-catalog.sh` runs, *then* it fails naming the id.

- **AC-12** — *Given* a red gate, *when* `hops whats-new audit --fix` is run
  locally, *then* it walks each unlabelled PR, asks the novelty question, applies
  the chosen label, and exits `0` once none remain.

- **AC-13** — *Given* the gate cannot determine the range or reach the GitHub API,
  *when* it runs, *then* it exits `3` (not `1`) and says it could not determine the
  answer, so an outage is never reported as an unevaluated PR.

## 9. Risks

- **R-1 — RETIRED.** This was "HOS-1216 chooses to reject future dates", the one
  risk that would have changed the design rather than degrading it. It is closed:
  the owner chose to hide, and `b36a4c52d` shipped it (F-3). Kept as a numbered
  stub so the other risk numbers stay stable.

- **R-2 — The gate gets trained away.** Mitigated by D-2 (it blocks on missing
  decisions, not missing entries), by the bot exemption, and by G-5 (a one-command
  remedy). Watch the first three promotions: if any of them names more than a
  couple of PRs, the exemption set is wrong, not the operators.

- **R-3 — Sign-offs are skipped, so the audit becomes the real author.** The
  audit's `--fix` path then asks the novelty question far from the moment of
  observation, where the answer is worse. Acceptable — a worse entry beats no entry
  — but if most entries end up authored through `--fix`, the sign-off step is not
  running and that is the finding, not the copy quality.

- **R-4 — Label drift.** A label removed by hand after the gate passed is not
  re-checked. Accepted: labels are advisory records of a human decision, and the
  gate re-runs on every promotion regardless.

- **R-5 — Entries pile up dated to a promotion that slips.** Caught by AC-9, but
  the remedy (re-dating) is manual and lands on `staging` mid-promotion. Noted as a
  real cost, not designed away.

## 10. Out of scope

Beyond the non-goals in §5:

- Any change to the What's New **endpoint, modal, panel, badge or seen-state**.
  This spec writes content; HOS-1216 owns read-side date semantics.
- Any change to how `staging` → `main` is merged. The gate is one more required
  check on an existing PR.
- Automatic **translation review**. The gate demands a recorded decision; it never
  claims the text is correct (§6.3).
- Image-bearing entries through the automated path (§6.1).
- Retiring or rewriting the four entries HOS-964 loaded.

## 11. Open questions

- **OQ-1 — RESOLVED (2026-09-07).** Was: "does HOS-1216 hide future-dated entries
  or reject them?" The owner chose to **hide**, explicitly discarding the
  `.refine()`, and `b36a4c52d` shipped it. See F-3. Kept as a numbered stub so the
  remaining question numbers stay stable.

- **OQ-2 — Is the derived dating rule what the owner meant? (THE open question.)**
  With OQ-1 closed, this is the only unconfirmed part of the design. The
  *capability* is settled — future dating is legal and stays invisible until its
  date. What is **not** confirmed is the decision to use it this way: "commit the
  entry at sign-off, with `publishedAt` set to the expected promotion date". The
  owner approved the sign-off mechanism and nothing more; this rule is derived from
  it. If it is rejected, the alternative is to date the entry to the day it is
  written and accept that it goes live on the next promotion whenever that is —
  which re-opens F-2's baseline hazard and is exactly what AC-9 then has to catch
  on every entry rather than on the occasional slipped one.

- **OQ-3 — Who can meaningfully review Portuguese?** §6.3 answers the *mechanism*
  honestly (`declared` is a recorded, valid answer) but not the *staffing*. If
  `declared` becomes the permanent answer for `pt`, then `pt` is a machine-translated
  surface and the honest options are to say so, to drop `pt` from the catalog, or to
  find a reviewer. Worth revisiting after ~10 entries, with the actual ratio in hand.

- **OQ-4 — Should a `[NOSPEC:…]` PR that never gets smoked have a cheaper path?**
  Today it can only be labelled through `--fix` at promotion time, which is exactly
  where R-3 says the answer is worst. A pre-merge nudge would be earlier but would
  put a novelty question on every PR, which D-2 deliberately avoids. Left open;
  `--fix` is the ship-it answer.

- **OQ-5 — Does the gate become a *required* check on `main`?** GitHub-side branch
  protection is unavailable on this repo's plan (CLAUDE.md, SPEC-103 T-002/T-003),
  so "required" is agent-side convention like every other protection here. Nothing
  to configure; worth stating so nobody assumes enforcement that does not exist.

## 12. Implementation notes

- **Dependency: HOS-1216 — SATISFIED, not pending.** `filterEntriesByPublishedAt`
  (commit `b36a4c52d`) is what makes a future-dated entry invisible until its date,
  and it is implemented. The only remaining constraint is ordering: that commit must
  reach `staging` before the first entry is written with a future `publishedAt`, or
  that entry is visible the moment it merges. Nothing else here waits on it.

- **Order.** (1) labels + `RETIRED_WHATS_NEW_IDS` + `check-whats-new-catalog.sh`;
  (2) `hops whats-new audit`; (3) the workflow, reusing the same computation;
  (4) the skill phase; (5) the `translations` field and AC-10.

- **AC-9 is not covered by HOS-1216 and must not be dropped as redundant.** The
  shipped filter hides the future; AC-9 is about the past (F-3b). The two look like
  the same comparison and are not.

- **Cutoff.** Record the workflow's first commit SHA on `staging` in the workflow
  itself. Every PR merged before it is exempt (§6.2). Without it the first
  promotion names hundreds of PRs and the gate is disabled the same day.

- **Guard wiring.** F-6: adding `check-whats-new-catalog.sh` to `pnpm check:guards`
  does **not** make it run in CI. It needs its own step in `ci.yml`'s `guards` job.

- **Follow the `smoke-gate-sync.yml` shell conventions.** Read PR bodies and titles
  through `env:`, never inline interpolation; validate that an API response is JSON
  before feeding it to `jq` under `set -euo pipefail`; accumulate failures and
  report them all at the end rather than aborting mid-loop.

- **Exit codes.** `hops whats-new audit` follows the house convention documented in
  CLAUDE.md for `hops ci` / `hops merge`: `0` clean, `1` blocked, `3` could not
  determine. `3` is not a failure, and AC-13 exists so an API outage never
  masquerades as an unevaluated PR.

## 13. Linear

Canonical tracking:
HOS-1214

Related: HOS-964 (parent — built the feature and loaded the first four entries),
HOS-1216 (dependency, **satisfied** — future-dated entries are hidden until their
date, commit `b36a4c52d`), HOS-908 (the missing-translation failure mode D-4 exists
to avoid).
