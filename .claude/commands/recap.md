---
description: Read-only recap of work in flight — where you are, what's already done, what's left, and what you tripped over along the way. No arguments recaps the current worktree; `all` sweeps every worktree and lets you pick which ones to dig into.
argument-hint: "[all] [--full]"
---

You are producing a **recap**: an oriented report on work in flight, reconstructed from
durable artifacts rather than from this conversation. Arguments: $ARGUMENTS

## Non-negotiable rules

1. **READ-ONLY. This command never writes anything.** No commits, no pushes, no
   `mem_save`, no `save_issue`, no label changes, no file edits, no branch switching.
   Its whole value is that it is safe to run when you are lost. If you find yourself
   about to mutate state, stop — that is a different command's job (`/handoff`,
   `/smoke`, `/closeIssue`).
2. **Git is the truth; the tracker is a declaration.** When commits and the tracker
   disagree, report BOTH and flag the discrepancy. Never let the tracker's state
   override what the commits say, and never silently pick a winner. A tracker issue
   sitting in "In Progress" whose PR merged last week is a finding, not a detail.
3. **Never infer that something is missing from a single source.** An absent tracker
   comment does not mean nothing was decided; an absent memory entry does not mean
   nothing was learned. Say "no record found in X", not "this was not done".
4. **Reconstruct from artifacts, not from memory of the session.** The recap must be
   just as correct in a cold session as in a warm one.

## Mode A — `/recap` (no arguments): the current work

Anchor on where the user is standing right now and rebuild that thread's story.

Gather, in as few round-trips as possible:

- `git branch --show-current`, `git status --porcelain`, and the worktree path.
- The integration base this repo uses (`origin/staging` if it exists, else
  `origin/main` / `origin/master`).
- `git log <base>..HEAD --oneline` — what was actually built, in order.
- `git diff <base>...HEAD --stat` — the real surface of the change.
- Uncommitted work: `git status` plus `git diff --stat` for anything mid-flight.
- Unpushed work: `git rev-list --count @{upstream}..HEAD`, or note there is no upstream.
- The PR, if any: `GITHUB_TOKEN= gh pr list --head <branch> --state all --json number,state,title,url,statusCheckRollup`.
  A `MERGED`/`CLOSED` PR on the current branch is a headline finding — further commits
  there are orphans (see the repo's post-merge rule).
- The tracker issue, if the branch name carries an id (`HOS-N`, `BETA-N`, `SPEC-N`):
  fetch the issue AND its comments. Comments are where decisions and blockers live.
- The spec folder, if one exists (`.specs/<ID>-*/`): read `spec.md` acceptance criteria
  and any `tasks/` state to know what the plan said was in scope.
- Findings from the road: `mem_search` scoped to the issue id and to the branch's topic.

**"What you tripped over" comes from crossing three sources, never one**: tracker
comments (what was decided), commit messages and their bodies (what had to be fixed),
and engram (what was explicitly saved). Each holds a different slice; report the union
and say which source each item came from when it matters.

Then report, in this order:

1. **Where you are** — worktree, branch, issue title in one line. If the worktree
   directory name disagrees with the branch's issue id, say so: the worktree was
   recycled and the branch is the one telling the truth.
2. **What's done** — commits grouped by theme, not listed raw. Name the files/areas
   touched. Include the PR number and its CI state if there is one.
3. **What's left** — from acceptance criteria and task state, minus what the commits
   already cover. Verify against the commits; do not copy the plan's open items on
   faith. Mark items you could not verify either way as unverified.
4. **What you tripped over** — findings, gotchas, decisions taken so they are not
   relitigated, with their source.
5. **Uncommitted / unpushed** — anything at risk of being lost, explicitly.
6. **Next step** — ONE concrete action, with the command to run it.

If the branch carries no issue id and has no PR, say so plainly and recap from git
alone rather than guessing which issue it belongs to.

## Mode B — `/recap all`: the panorama, in three phases

### Phase 1 — sweep and offer (cheap)

Run the local sweep in one call:

```bash
bash .claude/commands/scripts/recap-scan.sh <repo-root>
```

It emits TSV: `idx, current, path, wt_issue, branch, issue, base, ahead, unpushed,
dirty, age, last_subject`. Purely local — no network.

Then make exactly ONE network call for open PRs and cross them onto the rows by branch:

```bash
GITHUB_TOKEN= gh pr list --author @me --state open --limit 100 --json number,headRefName,state,title,url,isDraft,statusCheckRollup
```

Present a compact table. **Default (`/recap all`): anomalies first**, then the rest,
collapsed to one line each. **With `--full`: the whole inventory**, ordered by last
activity, without prioritizing.

Flag these anomalies — each is a different problem and deserves its own label:

| Signal | What it means |
|---|---|
| `MISSING` path | prunable worktree, directory is gone |
| `wt_issue` ≠ `issue` | worktree recycled for other work |
| `unpushed = none` with `ahead > 0` | never pushed; exists only on this machine |
| `unpushed > 0` | local commits not on the remote |
| `dirty > 0` | uncommitted work at risk |
| `ahead > 0`, no open PR | work with no review surface |
| open PR, CI red | blocked |
| open PR, CI green | done, waiting on a merge |
| `ahead > 0` and `age` older than a week | stalled |

**Stop here and ask which ones to dig into.** Offer the numbered candidates and let the
user pick one, several, or all. Do not analyze anything before they answer — the whole
point of the split is that phase 3 is expensive and most rows do not need it.

### Phase 2 — the pick

Accept any reasonable form: `3`, `3,7,12`, `3 7 12`, a range, `todos`/`all`, or a
description ("los que tienen PR verde"). Confirm back which ones you understood before
proceeding if the answer is ambiguous.

### Phase 3 — deep dive on the chosen ones (expensive)

For EACH selected worktree, run Mode A's full gathering against that worktree's path
(use `git -C <path>` — never `cd`, and never check out anything). Report each one under
its own heading using Mode A's six-section shape, then close with a short cross-cutting
section:

- **Collisions** — worktrees touching the same files or packages.
- **Chains** — work blocked on another selected item.
- **Tracker vs git discrepancies** — issues whose declared state contradicts their
  commits or PR state, in both directions.

Keep each worktree's section tight. The user picked several precisely because they want
to compare them; a wall of prose defeats that.

## Output discipline

Tables for inventories, prose for stories. Never pad a section to look thorough: if
there is nothing left to do, say "nothing left" instead of inventing tasks. Every claim
about state must be traceable to something you actually read — name the commit, the PR
number, the comment, or the memory entry.
