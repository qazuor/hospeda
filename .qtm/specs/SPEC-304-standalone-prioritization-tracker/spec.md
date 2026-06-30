---
specId: SPEC-304
title: Standalone Spec-Prioritization Tracker & Viewer
type: chore
complexity: medium
status: draft
created: 2026-06-27
tags: [tooling, devx, specs, prioritization, infra]
---

# SPEC-304 — Standalone Spec-Prioritization Tracker & Viewer

> Extract the spec-prioritization board (`specs-prioritization.csv` + its viewer/editor
> script) to a location that survives git branch switches, so the viewer can run
> continuously regardless of which branch or worktree is currently active.

## 1. Summary

The spec-prioritization board — `specs-prioritization.csv` at the repo root and
`scripts/render-specs-prioritization.py` — lives inside the hospeda repo today. When
the owner switches branches or enters a different worktree, the `--serve` editor server
loses its file, potentially serves stale data, or the CSV itself changes under the
server. The owner wants the tracker to be **branch-agnostic**: launch it once, leave it
running, and have it reflect the authoritative state regardless of the current checkout.

This spec is **discovery-first**: the goal is clear but the implementation approach
(where the tool lives, how `estado` stays fresh, where edits persist) is open. The
first phase is research and a small design decision with the owner — before any code.

## 2. Problem — why it breaks on branch switches

The Python script resolves all paths at startup relative to its own location:

```python
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "specs-prioritization.csv")
OUT_PATH = os.path.join(ROOT, "specs-prioritization.html")
```

Both `CSV_PATH` and `OUT_PATH` resolve inside the repo working tree. Three failure
modes emerge:

1. **Disappearing or wrong file**: a branch that predates a spec addition lacks that row
   (or has a stale version). If `--serve` is already running, it keeps serving — but the
   next `save_cell()` call writes owner edits back to whatever checkout is now active,
   potentially to a different or older CSV.
2. **Stale editor after branch switch**: the server holds no open file handle; it
   re-reads the CSV on every request. After a checkout, the board instantly reflects the
   new branch's snapshot — which may be weeks behind `staging`.
3. **Silent edit loss**: owner edits written to one branch's CSV do not reach `staging`
   unless the owner notices and explicitly stages/commits that file from the right branch.

The static HTML output (`specs-prioritization.html`) has the same problem: it is written
to the repo root and overwritten by whichever branch last ran the static build.

### Key files (current state)

- Viewer/editor: `scripts/render-specs-prioritization.py` (server on `127.0.0.1:8765`)
- Board data: `specs-prioritization.csv` (pipe-delimited `|`, 16 columns)
- Derived-status source: `.qtm/specs/index.json` (branch-dependent; NOT read at runtime
  by the script — `estado` is kept in sync by agent workflow per CLAUDE.md, not
  auto-refreshed by the viewer)
- Static output: `specs-prioritization.html` (gitignored, written by the script)

### CSV column schema

`rank | spec | name | avance | prioridad | estado | estado_manual | estado_real |
descripcion | por_que_ahora | por_que_no_ahora | beneficio | peligros | estimado |
se_cruza_con | notes`

**Derived / read-only** (script `READONLY` set): `rank`, `spec`, `name`, `avance`,
`estado`, `estado_real`.

**Owner-managed / editable** (script `EDITABLE` set): `prioridad`, `estado_manual`,
`notes`, `descripcion`, `por_que_ahora`, `por_que_no_ahora`, `beneficio`, `peligros`,
`estimado`, `se_cruza_con`.

## 3. Central design tension

The **owner-edited columns** are pure owner data — they carry no branch-specific
meaning. Extracting them outside the repo is straightforward; they would survive any
checkout naturally.

But **`estado`** is derived from `.qtm/specs/index.json` — a file that IS in the repo,
IS branch-dependent, and IS the canonical source of truth per CLAUDE.md sync rules.
Crucially, the Python script does NOT re-derive `estado` from `index.json` at runtime:
it reads the value that is already in the CSV. The derivation happens through the
agent's standing sync duty (whenever a spec status changes in `index.json`, the agent
also updates the `estado` cell in the CSV in the same commit). If the CSV moves outside
the repo, this workflow breaks — `estado` updates no longer travel with the branch.

This is the seam: **viewer independence conflicts with the `estado` derivation chain.**
Any solution must resolve how the standalone tool receives fresh `estado` values without
being tied to the active checkout. Similarly, `avance` (task-progress ratio like
`22/22`) is derived from `.qtm/tasks/index.json`, which is also branch-dependent.

## 4. Goals (provisional — subject to design decision)

- **G-1** The viewer/editor runs continuously without being affected by branch switches
  or worktree changes.
- **G-2** Owner-edited columns (`estado_manual`, `notes`, judgment columns) persist in
  a location independent of the repo's branch state.
- **G-3** `estado` (and optionally `avance`) can be refreshed from the repo's canonical
  branch without interrupting the running server — mechanism decided in Phase 1.
- **G-4** The agent's CLAUDE.md sync rules remain coherent (adapted, not removed).
- **G-5** Migration from the current in-repo CSV to the new storage loses no data.

## 5. Non-Goals

- Not building a hosted or remote server — single-user localhost only for v1.
- Not replacing the agent's `estado`-sync duty — only adapting where it writes.
- Not multi-project support (hospeda-specific for v1).
- Not rewriting the UI if the existing Python script can be minimally adapted.

## 6. Candidate approaches (for design discussion)

**Option A — Script and CSV extracted to `~/.local/share/hospeda-tracker/`.**
The Python script is copied to `~/bin/` or a sibling directory. CSV lives at a fixed
absolute path outside any git tree. Owner edits write there permanently. A new agent
hook or shell alias runs `git show origin/staging:.qtm/specs/index.json` and patches
`estado` into the external CSV on demand. The in-repo CSV is deprecated.
_Pro_: fully branch-agnostic. _Con_: in-repo CSV sync rules in CLAUDE.md must be
completely rewritten; the script is no longer under version control in the repo.

**Option B — Script gains a `--csv-path` flag; launched via a shell alias with an
external path.**
Minimal script change: the script stays in the repo but is invoked with a path pointing
to an out-of-tree CSV. A shell alias (`alias tracker="python3 .../render... --csv-path
~/.local/..."`) makes the invocation transparent. `estado` refresh is a separate
command or agent hook.
_Pro_: minimal code change; script stays versioned in the repo. _Con_: the alias must
always be used — muscle-memory risk of running the script directly without `--csv-path`.

**Option C — Owner-edited columns move to an external JSON/SQLite; `estado` re-derived
live from `origin/staging:index.json` on each server request.**
Cleanest separation of concerns: the server never depends on the active branch. Reads
the remote ref directly via `git show`. The in-repo CSV becomes read-only metadata.
_Pro_: no staleness risk for `estado`; server is truly branch-agnostic.
_Con_: `git show` on every request adds latency; requires network/git access; largest
change to the current data model.

## 7. Relationship to existing systems

Three sync artifacts currently live in the repo and must stay coherent:

| Artifact | Location | Branch-dependent? | Updated by |
|---|---|---|---|
| `specs/index.json` | `.qtm/specs/index.json` | Yes | Spec workflow / agents |
| `tasks/index.json` | `.qtm/tasks/index.json` | Yes | Task workflow / agents |
| `specs-prioritization.csv` | repo root | Yes (today) | Owner edits + agent `estado` sync |

The CLAUDE.md sync rules (section "Specs Prioritization Tracker") mandate that whenever
an agent changes a spec's status in `specs/index.json`, it MUST also update `estado` in
`specs-prioritization.csv` in the same commit. If the CSV moves out of the repo, this
rule must be adapted: the agent would instead write `estado` to an external file path or
invoke a refresh command. The `tasks/index.json` is agent-only and not affected.

## 8. First Steps / Discovery Plan

**Phase 1 — Research + design decision (before writing code):**

1. Owner reviews the three candidate approaches (Section 6) and selects one or proposes
   a hybrid, with particular attention to OQ-1 (`estado` refresh mechanism) and OQ-3
   (in-repo CSV fate). These two decisions gate everything else.
2. Nail down the external storage path (OQ-2) and whether it should be version-controlled
   independently.
3. Decide the invocation UX: shell alias, global install, or `--csv-path` flag (OQ-4).

**Phase 2 — Minimal implementation (after design decision):**

4. Adapt the Python script (or write a thin wrapper) to accept the external CSV path.
   Minimise changes to the existing server and HTML generation logic.
5. Write a one-shot migration script that copies the current in-repo CSV to the new
   external path, preserving all owner-edited values.
6. Implement the `estado` refresh mechanism decided in Phase 1 (hook, command, or
   live re-derivation).
7. Update CLAUDE.md's sync rules to describe the new `estado`-update flow for agents.
8. Verify that the running server is unaffected by a `git checkout` in another terminal.

## 9. Risks

- **R-1 — `estado` staleness.** If refresh is manual or hook-based, the owner may see
  stale values for hours after a spec closes. Acceptable only if a cheap refresh command
  exists. Silent divergence is not acceptable.
- **R-2 — Agent sync-rule drift.** If agents keep writing `estado` to the old in-repo
  CSV (old rule) while the external CSV is the canonical one, the board silently
  diverges. CLAUDE.md must be updated atomically with the migration.
- **R-3 — Migration data loss.** Owner-edited columns must survive the move intact.
  Requires a verified one-shot migration before the in-repo CSV is deprecated.
- **R-4 — Muscle-memory invocation.** If the standalone tool requires a non-obvious
  flag or path, the owner may keep launching the old in-repo version by habit. A shell
  alias or renamed command reduces this risk significantly.

## 10. Open Questions

- **OQ-1 (load-bearing) — `estado` refresh mechanism:** how does the standalone viewer
  get current `estado` values without reading the active checkout? Options: (a) `git
  show origin/staging:.qtm/specs/index.json` on each server GET or on a poll interval;
  (b) agent writes the `estado` update to the external CSV path as part of its existing
  sync-rule duty; (c) `estado` becomes manually-refreshed (owner runs `tracker refresh`
  explicitly); (d) a file-watcher on a fixed main worktree's `index.json` that always
  tracks `staging`. **Owner decision needed.**
- **OQ-2 — Where does the external CSV live?** Candidates: `~/.local/share/hospeda/`,
  a `~/dotfiles/` repo, a `~/projects/hospeda-tracker/` sibling directory. Should it be
  version-controlled independently? If so, in a separate git repo or a dotfiles monorepo?
- **OQ-3 — In-repo CSV: keep as mirror, deprecate, or remove?** If it stays, agents
  must dual-write (external + in-repo). If deprecated, the CLAUDE.md sync rules change.
  If removed, every current agent rule in CLAUDE.md that references the CSV needs
  rewriting in a single coordinated update.
- **OQ-4 — Python script: adapt in-place with a flag, or install globally outside the
  repo?** (a) Keep script in repo, always invoke with `--csv-path <external>` (shell
  alias). (b) Copy script to `~/bin/` and maintain separately from the repo. (c) A pipx-
  installable package (probably overkill for v1 but cleanest long-term).
- **OQ-5 — Persistence format: keep CSV or switch to SQLite/JSON?** CSV is human-
  readable and already parsed by the viewer. SQLite simplifies concurrent writes but is
  moot for single-user localhost. JSON is easier for agent patching. Changing format
  requires a migration and viewer update — likely not worth it unless Option C is chosen.
- **OQ-6 — Does `avance` (task progress) also need live refresh?** `avance` (e.g.
  `14/15`) comes from `.qtm/tasks/index.json`, also branch-dependent. If the standalone
  viewer should show live progress alongside `estado`, the same refresh mechanism applies.
  If slightly stale progress is acceptable, no extra work is needed.
- **OQ-7 — Fate of `specs-prioritization.html`.** Today written to the repo root
  (gitignored). In standalone mode it should land outside the repo, or become unnecessary
  if `--serve` mode is the primary workflow going forward.
- **OQ-8 — Agent instruction update scope.** CLAUDE.md's "Specs Prioritization Tracker"
  section is detailed and enforced by agent behavior. If the CSV moves, the section must
  be rewritten to describe the new path, the new `estado`-update mechanism, and where
  owner edits are stored. This is significant documentation work and must ship
  atomically with the migration to prevent agent rule drift.

## 11. Revision History

- 2026-06-27 — Initial discovery-first draft (SPEC-304). Problem and central design
  tension documented. Three candidate approaches outlined (Options A/B/C). Eight open
  questions deferred to Phase 1 owner decision; OQ-1 (`estado` refresh mechanism) is
  the load-bearing decision that gates Phase 2 implementation.
