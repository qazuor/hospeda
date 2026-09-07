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

### F-3c · The unresolved marker is already hidden for free — but the schema rejects it outright

D-1's marker raises one question: what happens if `on-promotion` escapes to
production unresolved? Measured, both halves:

**The read path handles it for free.** `new Date('on-promotion').getTime()` is
`NaN`, and **every** comparison against `NaN` is `false`:

```
NaN <= now  →  false     NaN > now  →  false
```

So `filterEntriesByPublishedAt`'s `publishedAt <= nowMs` excludes the marker
without a line of new code, and `computeSeen`'s `publishedAt <= baselineAt` never
auto-marks it seen. An unresolved marker is simply **invisible**. That is exactly
the recoverable failure we want.

**The schema does the opposite, and does it by accident.** `publishedAt` is
`z.string().datetime()` (`whats-new.schema.ts:101`), which rejects `on-promotion`.
The catalog runs `WhatsNewCatalogSchema.parse(...)` at module import, and the file's
own JSDoc states the consequence deliberately: *"A malformed entry … will throw
immediately and prevent the API process from serving traffic"* — SPEC-175's AC-16,
not this spec's.

**So today, writing a marker takes down the API at boot.** The brutal fail-safe is
not a path we could choose — it is the current default, arrived at by accident, and
it would be discovered in production. The safe path is not free; it costs one
deliberate schema widening (§7.1). Once widened, the filter's `NaN` behaviour
delivers the rest at no cost.

**Decision: the schema ACCEPTS the marker; the filter hides it.** An entry nobody
sees is a recoverable content defect. A dead API is not. This matters precisely
because OQ-5 establishes the gate can never be a *required* check on this repo's
plan — so "the gate did not run" is a reachable state, and it must degrade to a
missing entry, never to an outage.

### F-3d · The `NaN` safety is real but fragile — it inverts under an innocuous refactor

The marker is hidden because the filter is written as `publishedAt <= now`. Rewrite
it in the form that is *logically identical for every real date*:

```ts
entries.filter((entry) => !(new Date(entry.publishedAt).getTime() > nowMs))
```

`NaN > nowMs` is `false`, so `!false` is `true`, and **the unresolved marker becomes
visible to every user** — at the top of the list, unseen, and firing the modal if
`highlight` is set. The safety is a property of the comparison's *direction*, not of
the logic, and no type or test currently pins it.

This gets an explicit regression test (AC-15), because it is the kind of change a
reviewer would wave through as a no-op.

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

**Dating (owner decision, 2026-09-07 — OQ-2, resolved): the writer does not set the
date. The promotion sets it.**

The sign-off commits the entry with an **unresolved `publishedAt`** — the literal
marker `on-promotion`. The promotion gate replaces it with the real date on the day
the change actually reaches production.

Two candidate rules were considered and both rejected:

- **Date it to the expected promotion** — forces the writer to guess, and on the day
  someone guesses wrong the symptom is invisible (F-3b).
- **Date it to the day it is written** — every entry is then born already in the past
  relative to its own promotion, turning AC-9 from a safety net into the primary
  mechanism.

The chosen rule has nothing to guess and no date that can slip into the past. It
puts the one hard question — *when did this actually go live* — at the only moment
that knows the answer. Future dating stays legal and hidden until its date (F-3);
this design simply no longer asks a human to pick that date.

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

There is deliberately **no date question**. The writer never picks one (D-1).

**How the entry is composed.**

- `id` — `<merge-date-of-the-earliest-bound-PR>-<kebab-slug>`. The date component
  records **when the change was made**, deliberately distinct from `publishedAt`,
  which is the convention HOS-964 established and its comment tells us not to
  "fix". Checked against the retired-id ledger (F-4, AC-11).
- `publishedAt` — the literal marker `'on-promotion'`. Never a date, never guessed.
  The gate resolves it (§6.2). Until it does, the entry is invisible: `NaN <= now`
  is `false` (F-3c).
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

**Resolving the markers (the gate's second job).** Auditing decides whether the
promotion may proceed. Resolving dates happens *because* it proceeds, so it is a
distinct step with distinct timing:

1. **Before the merge**, the gate reports how many entries carry `on-promotion` and
   fails on nothing — an unresolved marker is the expected state at this point, not
   a defect.
2. **After the promotion PR merges**, a `push`-triggered job on `main` rewrites
   every `'on-promotion'` in `whats-new.ts` to the merge timestamp, opens a PR to
   `staging` with the resolved dates, and stops. It never pushes to a protected
   branch directly.

Writing the date **after** the merge rather than before is what makes the rule
honest: a promotion that is opened and then abandoned leaves markers behind, which
are invisible, rather than dates for a release that never happened.

Multiple entries resolved in one promotion share the merge timestamp with hours
spread descending, preserving the declared newest-first ordering exactly as HOS-964
did.

The back-merge PR reuses `sync-main-to-staging.yml`'s pattern and inherits its
documented caveat: a PR opened by the default `GITHUB_TOKEN` starts without CI
checks unless `SYNC_PAT` is configured.

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

- **Widen `publishedAt` to admit the unresolved marker.** This is required, not
  cosmetic: `z.string().datetime()` rejects `on-promotion`, and the catalog parses
  at module import, so without this change the first entry written by the flow
  prevents the API from serving traffic (F-3c).

  ```ts
  publishedAt: z.union([z.string().datetime(), z.literal('on-promotion')]);
  ```

  The JSDoc must say why the union exists, that `on-promotion` is an
  **unresolved** value the promotion replaces, and that it renders the entry
  invisible rather than malformed. Without that note the next reader deletes the
  union as a typo-tolerance hole.

- **No other change.** `id`, `roles`, `highlight`, `title`, `body`, `image` keep
  their current shape and semantics.

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
| `.github/workflows/whats-new-resolve-dates.yml` | `push`-on-`main` job that resolves `on-promotion` markers and back-merges (§6.2, AC-14) |

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
  `whatsNewEntries` with `publishedAt` set to the literal `'on-promotion'`, every
  bound PR carries `whats-new-done`, and the sign-off comment records the entry id.
  The operator is never asked for a date.

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

- **AC-9 — SURVIVES, NARROWED to hand-written entries.** *Given* an entry in
  `staging` but not in `main` that carries a **real date** (not the marker) already
  in the past, *when* the gate runs, *then* it fails and asks for it to be re-dated
  or converted to `'on-promotion'`.

  **Why it is narrowed and not retired.** D-1 makes the failure impossible *for
  entries written through the flow* — a marker cannot be stale. But hand-written
  entries remain in scope and always will: image-bearing entries are added by hand
  (§6.1), HOS-964's four were written by hand, and nothing forbids editing the file
  directly. Retiring AC-9 would leave exactly the path that is not automated
  unguarded, which is backwards.

  **Why it still matters.** F-3b is unchanged: `filterEntriesByPublishedAt` hides
  the future and passes a past date straight through to `computeSeen`, which
  auto-marks it seen for every account whose baseline post-dates it. Such an entry
  is not late — it is **destroyed for every new account**, silently, with the API
  green and the entry present in the response. What changed is *who prevents it*:
  by construction for the automated path, by this gate for the manual one.

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

- **AC-14** — *Given* a promotion PR containing entries with `publishedAt:
  'on-promotion'`, *when* it merges to `main`, *then* every such marker is rewritten
  to the merge timestamp (hours spread descending to preserve declared order) and a
  back-merge PR to `staging` carries the resolved dates. *Given* the promotion PR is
  closed without merging, *then* no marker is resolved.

- **AC-15** — *Given* an entry with `publishedAt: 'on-promotion'`, *when*
  `filterEntriesByPublishedAt` runs, *then* the entry is **excluded**. This is a
  regression test against F-3d: rewriting the predicate as `!(publishedAt > now)` —
  logically identical for every real date — makes the marker **visible**, because
  `NaN > now` is also `false`. The test must fail under that rewrite.

- **AC-16** — *Given* a catalog containing an entry with `publishedAt:
  'on-promotion'`, *when* the API boots and runs `WhatsNewCatalogSchema.parse(...)`,
  *then* it parses successfully and the process serves traffic. An unresolved marker
  is an invisible entry, never an outage (F-3c). *Given* a `publishedAt` that is
  neither a valid ISO datetime nor the marker, parsing still throws — the union
  widens the schema by exactly one value and tolerates no other malformed date.

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

- **R-5 — RETIRED.** Was "entries pile up dated to a promotion that slips". D-1
  removes the class: a marker has no date to go stale, and a promotion that slips
  simply resolves it later. Kept as a numbered stub so the risk numbers stay stable.

- **R-6 — The marker escapes to production unresolved.** Happens whenever the
  resolution job does not run, which OQ-5 says cannot be prevented by a required
  check. Degrades to an **invisible entry**, never an outage, by F-3c — provided the
  schema widening in §7.1 lands with the marker and not after it. Shipping the
  marker before the widening is the one sequencing mistake that takes the API down
  (§12).

- **R-7 — Someone "simplifies" the filter predicate.** F-3d: rewriting
  `publishedAt <= now` as `!(publishedAt > now)` is a no-op for every real date and
  makes unresolved markers visible to everyone. Mitigated by AC-15, which is
  specifically written to fail under that rewrite.

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

- **OQ-2 — RESOLVED (2026-09-07).** Was: "is the derived dating rule what the owner
  meant?" Answered with a third option neither this spec nor the question had
  considered: **the writer does not set the date at all — the promotion sets it**,
  via an `on-promotion` marker resolved at merge. Both previously-stated candidates
  were rejected by name: dating to the expected promotion forces a guess whose
  failure is invisible, and dating to the writing day makes every entry born stale.
  See D-1, §6.2 and F-3c. Kept as a numbered stub so later question numbers stay
  stable.

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

- **Order — the first step is not negotiable.** (1) **the `publishedAt` union in
  the schema (§7.1) + AC-15/AC-16**; (2) labels + `RETIRED_WHATS_NEW_IDS` +
  `check-whats-new-catalog.sh`; (3) `hops whats-new audit`; (4) the audit workflow;
  (5) the date-resolution workflow (AC-14); (6) the skill phase — the first thing
  that can write a marker, and it must come after (1) and (5); (7) the
  `translations` field and AC-10.

  **Writing a marker before the schema accepts it takes the API down at boot**
  (F-3c). That is the single sequencing error in this spec with a production
  consequence.

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
