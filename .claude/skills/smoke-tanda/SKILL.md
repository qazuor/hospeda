---
name: smoke-tanda
description: >-
  Run a multi-issue smoke batch ("tanda") and keep Linear in sync automatically as
  each step is verified, so a smoked issue never stays stranded in In Review.
  Trigger when: evaluating what was merged and preparing a smoke pass over it;
  running a user-journey, whole-feature, or single-issue smoke; resuming a tanda
  opened on a previous day; signing off one issue with /smoke HOS-N; or asking why
  issues are stuck in In Review with a status-needs-smoke-* label. Hospeda-specific
  (Linear teams HOS/BETA, Coolify environments, hops CLI).
---

# Smoke tanda

A **tanda** is one smoke batch: a delimited set of PRs, the issues they close, and
ONE target environment, verified over one or more days.

## Why this skill exists

The analysis was never the missing piece. Past tandas already produced exactly the
right per-issue verdict rows — `issue / veredicto / entorno / fecha / cita` — and
**left them in an artifact instead of writing them to Linear**. 1009 such rows sit
across 43 artifacts while 220 issues sit in In Review carrying a
`status-needs-smoke-*` label, and the 25/08 checklists lost their sign-offs to
`localStorage` entirely.

The gate has automatic entry (`.github/workflows/smoke-gate-sync.yml` moves an
issue to In Review on merge) and manual exit. This skill makes the exit happen at
the moment of observation, never later, without weakening what the label means.

**The label keeps meaning "implemented but unverified."** Nothing here removes a
label without a nominal, recorded observation.

## Scope modes

The three modes differ ONLY in how the set is delimited. Contract, invariants,
in-the-act writing and closure report are identical across all three.

| Mode | How the set is delimited | What the contract binds |
|---|---|---|
| `camino` | commit range from the deployed SHA to HEAD. PRs need not relate to each other — the journey is what joins them | journey step → criterion → issue |
| `feature` | a root issue plus its children, or an explicit list of related issues; PRs resolved from those | test case → criterion → issue |
| `individual` | one issue or one PR | the degenerate tanda of 1, entered via `/smoke HOS-N` |

## The four invariants

These are refusals, not preferences. If one cannot be satisfied, stop and say so.

### I0 — Deployed, or it is not testable

Every PR in the tanda must be verified as an ancestor of the SHA actually running
on the target environment. A PR merged to `staging` but not to `main` **cannot be
smoked on prod**, and its issues stay out of the tanda.

Resolve the deployed SHA in this order:

1. **Sentry release** (preferred, read-only, needs no extra permission). Coolify
   injects `HOSPEDA_SENTRY_RELEASE=${SOURCE_COMMIT}`, so the latest Sentry release
   for the environment IS the deployed SHA.
2. `hops exec --target=<env> api -- printenv HOSPEDA_COMMIT_SHA` (may be blocked by
   the auto-mode classifier; if it is, ask rather than working around it).
3. Ask the owner for an explicit range.

Never assume "prod ≈ tip of `main`". Scope the range **by commits from the deployed
SHA**, never by label: a past sweep found 137 labelled issues with no commit in
range and 66 unlabelled ones that did touch the product.

For `local`, the deployed SHA is the worktree's `HEAD`, and I0 is satisfied by
`git merge-base --is-ancestor`.

### I1 — Binding before observation

An issue may only be closed by a step that was bound to it **in the approved
contract, before any testing started**. Never bind a step to an issue after seeing
the result — that is how "this probably also proves HOS-N" becomes a false close.

Binding something mid-tanda is allowed, but it requires an explicit OK from the
owner and is recorded in the contract as `vinculo_tardio: true`.

### I2 — Full coverage or no close

An issue closes only when **every** one of its criteria has a passing observation
in **every** environment its contract requires. Anything less is `PARCIAL`: the
comment is written, the label stays, the issue stays open.

The canonical example, from a real past row: *"HOS-286 pasa 2 de 3 — descripción
corta y mapeo de Dormitorios correctos, pero la preselección del destino falla."*
That issue **does not close**.

### I3 — Written in the act, and a failed write halts the tanda

After every executed step, immediately write the sign-off to each bound issue.
Not at end of day. Not at close. In the act.

If a Linear write fails, **stop the tanda** and resolve it before continuing. Do
not queue writes for later — queued writes are exactly what produced 309 orphaned
findings.

## Environments

An issue does not close per environment. It closes per **contract**.

Two distinct reasons an issue carries more than one `status-needs-smoke-*` label,
and only one admits subsumption:

- **`escalacion`** — the same behaviour verified progressively. Here
  **prod ⊇ staging ⊇ local** holds: one prod sign-off retires all three labels.
  This is the established repo rule and it is the **default** when the contract
  says nothing.
- **`concerns_distintos`** — each environment proves something that only exists
  there. Local: migration from scratch, seed fixtures. Staging: MercadoPago
  sandbox. Prod: Cloudflare cache, cron timing, real MP. Here **there is no
  subsumption**: each environment needs its own sign-off and the issue stays open
  until all of them are signed.

The contract declares which, per issue, with the reason written out. The inverse
direction is never valid under either mode: staging never satisfies
`status-needs-smoke-prod`.

When an issue is fully signed on some but not all required environments, it stays
**In Review**, keeps the outstanding labels, and the comment states which
environments are still missing and why.

## Phase 1 — Open the tanda (the owner approves ONCE)

1. **Pick the mode and the target environment.**
2. **Delimit the set** per the mode table. In `camino` mode this means resolving
   the deployed SHA (I0) and taking the commit range from there to HEAD.
3. **Resolve PRs → issues, hierarchically.** A child inherits its parent's
   implementation; a parent is judged by its children's coverage. Guard against the
   five false-positive forms of the magic word: docs-only PRs
   (`^\[...\]\s*docs[(:]`), loose prose, meta-reference, **negation** ("does NOT
   close HOS-N", 26 known PRs), and a magic word placed in error by the author.
   Some PRs close an issue by citing an internal finding code `H-NN` instead of the
   `HOS-NNN` — check for those too.
4. **Verify deployment per PR** (I0). Not deployed on the target environment ⇒ out
   of the tanda, listed as such.
5. **Write the contract.** For every issue in the set: its acceptance criteria, the
   step that covers each criterion, the environments it requires and why. Issues no
   step reaches go into a declared `no_cubierto` list. Format:
   `references/formatos.md`.
6. **Show the contract to the owner and get the OK.** That single OK is the batch
   approval for the whole tanda. From that point on, write to Linear without asking
   again.

Before opening: if an earlier tanda still has unsigned members, **refuse to open a
new one** and show the outstanding list.

## Phase 2 — Run the tanda (act without asking)

For each executed step, immediately, for every issue bound to it:

| Observed | Comment | Label | State |
|---|---|---|---|
| all criteria covered and passing, all required environments signed | sign-off `PASO` | retire the environment's label (plus lower ones if `escalacion`) | **Done** |
| all criteria covered and passing, environments still missing | sign-off `PASO` naming the missing environments | retire only the signed environment's label | In Review |
| any criterion fails | sign-off `FALLO` quoting what was seen | **retire nothing** | In Progress, and file the finding |
| only some criteria observed so far | sign-off `PARCIAL` | **retire nothing** | unchanged |
| the step could not be run | sign-off `PENDIENTE` with the reason | **retire nothing** | unchanged |

Every `FALLO` also produces a finding. If it maps to no existing issue, create one
in the right Linear team (`HOS` for product work, `BETA` for user/QA-reported
items), link it to the tanda, and label it per CLAUDE.md's table.

The `cita` is **what was actually observed**, in words — never "step 12 passed".
An observation must be a terminal, settled state, not an intermediate render.

## Phase 2b — Write the What's New entry (no question asked)

A `PASO` is the one moment somebody has just looked at the change **as a user**.
That is the only moment anyone is in a position to describe it in a user's words,
which is why the writing lives here.

**It does not ask anything.** It writes the entry, applies the label, amends the
comment, and moves on. The owner's instruction, 2026-09-08:

> *"me gustaría que se haga siempre escritura automática y luego revisión mía
> manual. No quiero tener que escribirlo yo o taggear yo o lo que sea, yo solo
> quiero revisar y borrar lo que no quiero."*

**Why writing unattended is safe here, and was not before.** Every entry is born
with `publishedAt: 'on-promotion'` — **invisible** until the promotion resolves
it (`new Date('on-promotion')` is `NaN`, so the visibility filter excludes it).
So an entry nobody wanted costs exactly nothing until the owner lets it through,
and the review is one gesture — deleting — instead of four answers. That inverts
the burden: writing is cheap and reversible, and the only irreversible act
(publishing) still happens behind a human. The earlier design refused to write
unattended for a real reason, and that reason no longer applies: it was writing
**from the PR title** and **publishing**. This writes from an observation, and
publishes nothing.

**The review happens at the promotion, over all the entries at once** — not here.
`.github/workflows/whats-new-gate.yml` prints every pending entry in full (id,
audience, title, body) on the promotion PR, and `hops whats-new drop <id>...`
withdraws the ones the owner does not want, PR and labels included.

**When.** Immediately after the sign-off comment and the Phase 2 label/state
writes for that step, and before the report. In `/smoke` this is between its
step 6 and its step 7. In a tanda it runs **per step**, in the act — never
batched into Phase 3.

**Only on `Resultado: PASO`.** A `FALLO`, `PARCIAL` or `PENDIENTE` never triggers
it: nothing was verified, so there is nothing to announce. This has not changed
and does not change.

**Only one entry per issue.** A second sign-off on the same issue (a second
environment) does not write a second entry. It reads the `Novedad:` line of the
earlier sign-off and applies that decision to any bound PR still unlabelled: an
entry id means `whats-new-done`, and a literal `no` — only ever written by
sign-offs from before 2026-09-08, when this phase still asked — means
`whats-new-none`, which stands. Only an issue whose sign-offs carry no `Novedad:`
line at all gets an entry written.

**The scope is the `PR(s):` field** of the sign-off comment just written — those
PRs, and no others. If that field is empty, stop and ask the operator which PRs
the issue shipped in. The labels *are* the record; a decision with nowhere to
land is not recorded.

### Composing the entry

Everything below is derived. Nothing is asked.

- **`title` / `body` (`es`)** — written from the **`Observado` field** of the
  sign-off you just wrote. That field is already a description of what a person
  saw, in user terms, which is exactly the raw material an entry needs. Title is
  a short user-facing sentence; body is one or two sentences of Markdown saying
  what the reader can now do. **Never take a PR title verbatim, and never write
  from the diff**: a PR title is written for a reviewer, not for a guest — the
  one thing the earlier design was right to forbid outright.
- **`en` / `pt`** — you translate the `es` you just wrote, at this same moment.
  No translation API, no new credential.
- **`translations`** — `{ en: 'machine', pt: 'machine' }`. `'machine'` means
  "nobody has decided yet", and the promotion gate demands that decision exactly
  when the text becomes user-visible. Write `'reviewed'` only if someone who
  reads the language checked it right there, and `'declared'` only if the
  operator deliberately accepts the machine output on the record. Never write
  either on your own.
- **`roles` (the audience)** — **INFERRED.** Read the issue's own subject, the
  role whose journey the step exercised, and the `Observado` text. Omit the key
  entirely for something every account can see; an empty array is not how you
  say "everyone".

  | What was observed | `roles` |
  |---|---|
  | Something in a host's own panel or listing | `['HOST']` |
  | A restaurant/menu owner surface | `['GASTRONOMY_OWNER']` |
  | An experience owner surface | `['EXPERIENCE_OWNER']` |
  | A sponsor/partner surface | `['SPONSOR']` |
  | The admin panel | `['ADMIN', 'SUPER_ADMIN']`, or `['EDITOR']` for content work |
  | A public page any visitor reaches | omit the key |
  | A logged-in traveller's own account | `['USER']` |

  **Inferring it is now acceptable, and it was forbidden before for a reason
  that has expired.** The old rule ("the operator picks it; never infer") held
  because the flow was already stopping to ask, so asking one more thing was
  free and a guess was pure downside. Now nothing stops, and the guess is
  reviewed by the owner before anyone sees it. The residual risk is real and
  worth stating plainly: **an entry aimed at the wrong audience that nobody
  reviews goes out aimed at the wrong audience.** The listing on the promotion
  PR prints the audience of every pending entry precisely so that stays cheap to
  catch. Never infer the audience from the **paths the PR touched** — a file
  tree says who wrote the change, not who it is for.
- **`highlight`** — always `false`. `true` auto-opens a modal for everyone who
  has not seen the entry, and a flow that writes on every `PASO` must not also
  interrupt on every `PASO`. The owner raises it at review if an entry deserves
  it.
- **`id`** — `<YYYY-MM-DD>-<kebab-slug>`, where the date is the **merge date of
  the earliest bound PR** (`gh pr view <n> --json mergedAt`). That date records
  *when the change was made*, deliberately distinct from when it is published;
  the catalog file says in as many words not to "fix" that mismatch. Check the
  id against `RETIRED_WHATS_NEW_IDS` **and** against every live entry's `id` —
  `scripts/check-whats-new-catalog.sh` fails on either. On a collision, change
  the **slug**, never the date: the id is the per-user `seenIds` key, so a reused
  id silently marks a brand-new entry as already seen.
- **`publishedAt`** — the literal string `'on-promotion'`. Never a date. There is
  no date question and there never was one: dating to the expected promotion
  forces a guess whose failure is invisible (a date that lands in the past
  silently destroys the entry for every new account), and dating to the writing
  day makes every entry born already in the past relative to its own promotion.
  Do not ask for a date, and do not accept one if it is offered.
- **`// origin:` comment** — the line above the entry, naming every PR in the
  `PR(s):` field: `// origin: #3271, #3274`. This is the ONLY link from an entry
  back to the PRs whose decision it records, and it is what `hops whats-new drop`
  reads to flip those PRs to `whats-new-none` when the entry is withdrawn. An
  entry without it can still be withdrawn; its PRs just cannot be corrected
  automatically, and the tool says so instead of guessing.
- **`image`** — out of scope for this flow. An image-bearing entry is added by
  hand, against `APPROVED_IMAGE_ORIGINS` and the CSP `img-src` checklist.

```ts
// origin: #3271, #3274
{
    id: '2026-09-05-commerce-publish-free-trial',
    publishedAt: 'on-promotion',
    highlight: false,
    roles: ['GASTRONOMY_OWNER'],
    title: { es: '…', en: '…', pt: '…' },
    body: { es: '…', en: '…', pt: '…' },
    translations: { en: 'machine', pt: 'machine' }
}
```

### Where the entry lands

Prepend it to `whatsNewEntries` in `apps/api/src/data/whats-new/whats-new.ts`
(the array is declared newest-first; `check-whats-new-catalog.sh` skips
marker-carrying entries when it verifies that order, so a marker on top is
correct and must not be "fixed"), then follow the normal 6-step branch
workflow: branch off a freshly-fetched `origin/staging`, commit the one file, PR
into `staging` titled `[HOS-N] docs(whats-new): <the es title>`. Never push to
`staging` directly.

**No magic word in the body** (`Closes`/`Fixes`/`Resolves`/`Implements`) — this
PR does not complete the issue, the smoke did. And because a bare `HOS-N` in a PR
**title** is enough for Linear's merge automation to move the issue to Done on
its own — it did exactly that to HOS-36 and HOS-54, with zero real work — check
the issue's state after this PR merges whenever the sign-off left it **In
Review** with environments outstanding, and put it back if the automation moved
it.

Label the new PR `whats-new-done` too. It will itself appear in a later promotion
range, and an unlabelled PR there blocks the promotion.

### Recording the decision

In this order, because each step supplies what the next one writes:

1. Open the What's New PR — the entry `id` is only real once it is committed.
2. Apply `whats-new-done` to **every** PR in the `PR(s):` field, plus the What's
   New PR itself: `GITHUB_TOKEN= gh pr edit <n> --add-label whats-new-done`.
   Exactly one decision label per PR, never both and never a third.
   `whats-new-none` is not written here any more — nothing in this phase decides
   "not a novelty". It is written by `hops whats-new drop` when the owner
   withdraws an entry at review, and by `hops whats-new audit --fix` for a PR
   that never reached a sign-off at all.
3. Update the sign-off comment you just wrote, adding its `Novedad:` line: the
   entry id. Edit that same comment by id; never post a second one.

The comment is written first and amended here, rather than writing the entry
before it, for the same reason as I3: the observation must reach Linear in the
act.

**A failed write halts the flow.** If any label write or the comment update
fails, stop and say exactly which of the three steps landed and which did not.
**Never queue the labelling for later** — queued writes are the documented origin
of 309 orphaned findings, and here the queue is invisible in a second way: an
unlabelled PR is indistinguishable from one nobody ever evaluated, so the next
promotion blocks on a decision that was in fact made.

### If the owner edits the catalog by hand

Nothing overwrites him, and that is deliberate. Four things worth knowing:

- The date-resolution workflow replaces the literal `publishedAt: 'on-promotion'`
  and **nothing else** — formatting, comments, wording and every other field are
  copied through byte for byte.
- Writing a **real date** by hand takes that entry out of the marker's
  protection: from then on it is an ordinary dated entry, and a date already in
  the past is silently destroyed for every new account (that is what AC-9
  guards).
- Changing an `id` is harmless while the entry is unpublished — nobody can have
  it in `seenIds` — and the guard still catches a collision with a live or
  retired id.
- **Deleting an entry by hand works, but leaves the labels lying**: its PRs keep
  saying `whats-new-done` for an entry that no longer exists. `hops whats-new
  drop <id>` is the supported gesture precisely because it does the relabel too.

## Phase 3 — Close the tanda

1. No issue in the tanda may be left without a row. Verify against the contract.
2. Emit the closure report: closed, partial, broken, and **how many the run never
   reached**. Those keep their labels and are the next tanda's input.
3. Only then may a new tanda open.
4. Save the closure summary to engram under `smoke/tanda-<slug>`.

## Never

- Never close anything because "the tanda passed". Only a nominal citation on a
  bound step closes an issue, one issue at a time.
- Never bind a step to an issue after observing its result (I1).
- Never close an issue with an unobserved criterion (I2).
- Never queue Linear writes for later (I3).
- Never smoke a PR that is not deployed on the target environment (I0).
- Never let staging evidence satisfy `status-needs-smoke-prod`.
- Never remove a label without writing the comment that justifies it.
- Never write a What's New entry on anything but a `PASO` (Phase 2b).
- Never ask whether the change is a novelty — write the entry; the owner reviews
  it at the promotion and deletes what he does not want.
- Never pick a `publishedAt` date for an entry — the promotion sets it.
- Never write an entry's text from a PR title or a diff, and never infer its
  audience from the paths a PR touched (infer it from what was observed).
- Never set `highlight: true` from this flow.
- Never queue a novelty label for later, for the same reason as I3.

## Smoke debt

Invoked on its own ("mostrame la deuda de smoke", "qué queda sin firmar"), without
opening a tanda. Read the open issues carrying any `status-needs-smoke-*` label and
report:

- **By environment** — how many `local` / `staging` / `prod`, and how many issues
  carry more than one.
- **By age** — how long each issue has held the label, bucketed
  (< 7d / 7-30d / 30-90d / > 90d). Age comes from the label's addition, not the
  issue's creation.
- **By tanda** — group by the `Tanda:` field of the issue's sign-off comments.
  Issues with no sign-off comment at all are the worst bucket: gated, never
  touched.
- **The liars** — issues carrying a smoke label whose state or evidence says the
  work is NOT implemented, broken, or only partially done. That label makes a false
  claim ("implemented, pending verification") and is retired by fixing the issue's
  state, not by signing a smoke. A 2026-08 sweep found **43 of 220** in this
  bucket.

Legacy ad-hoc batch labels (`SMOKE-19-07`, `SMOKE-13-07`, `SMOKE-15-08`) predate
this skill. Do not create more: the tanda lives in the comment, not in a label.
Report them under "By tanda" and propose retiring them once their members are
signed.

Baseline measured 2026-08-26 (`.cleanup-2026-08/salida/todos.jsonl`): 220 issues
labelled, 216 of them in In Review; 188 `staging`, 32 `local`, 21 `prod`; 21 issues
with two environment labels; 43 liars.

## Durability

A tanda spans days and survives session restarts and compaction. Three layers:

1. **Linear comments — the canonical record.** Every sign-off carries its
   `Tanda: <slug>`, so the entire state is reconstructible by searching the issues'
   comments even if everything else is lost.
2. **Ledger** at `.smoke/tanda-<slug>.json` (gitignored working state).
3. **engram**, `topic_key: smoke/tanda-<slug>`, updated at each session boundary.

To resume: read the ledger, then reconcile against the Linear comments — the
comments win.

## Inherited gotchas

- `Closes HOS-N` does **not** close on merge to `staging`, only to `main`.
- A Linear issue's state can lag a merged PR; verify against commits, not state.
- `list_comments` called in parallel does **not** return in invocation order —
  verify by content (PR number, cited AC), never by position.
- `list_issues` with `query` is semantic, not literal, and `fields` truncates the
  description to 500 chars.
- In a merge commit the diff goes against `^1`; use `--diff-filter=AM`.
- No course change in this repo has ever been total. Before applying one to an
  issue, ask **which app, and how far it got**.
- Never trust an artifact's prose about its own data, and never assign an artifact
  by URL without checking its real `<title>`.
