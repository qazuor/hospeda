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
