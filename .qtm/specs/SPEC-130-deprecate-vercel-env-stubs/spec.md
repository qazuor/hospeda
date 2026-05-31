---
spec-id: SPEC-130
title: Deprecate or remove pnpm env:pull/push/sync/check Vercel stubs
type: cleanup
complexity: low
status: draft
created: 2026-05-15T17:50:00Z
effort_estimate_hours: 1-2
tags: [cleanup, scripts, env, vercel, deprecation, monorepo]
extracted_from: SPEC-111 worktree setup (2026-05-15)
priority: low (cosmetic / DX)
---

# SPEC-130: Deprecate or remove pnpm env:* Vercel stubs

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Decide whether to keep, refactor, or delete the four deprecated `pnpm env:*` script entries that previously targeted the Vercel API and now exist only as guidance stubs.

The scripts in question:

| Entry point | File | Current behavior |
|---|---|---|
| `pnpm env:pull` | `scripts/env/pull.ts` | Prints deprecation message + exit 1 |
| `pnpm env:push` | `scripts/env/push.ts` | Prints deprecation message + exit 1 |
| `pnpm env:sync` | `scripts/env/sync.ts` | Prints deprecation message + exit 1 |
| `pnpm env:check` | `scripts/env/check.ts` | Prints deprecation message + exit 1 |

Each stub redirects callers to `hops env-pull <kind>` on the VPS (see `docs/guides/env-management.md`).

**Why now:** Phase 16.4 (Vercel teardown) shipped a while ago; the stubs have been doing their job since but they add clutter to `package.json` script listing, the `scripts/env/` directory, and IDE autocomplete. Surfaced today (2026-05-15) during SPEC-111 worktree setup when an agent reached for `pnpm env:pull` and got the dead-end.

**Audience:** Anyone reading the monorepo for the first time, IDE autocomplete users, future agents.

### 2. Out of Scope

- The replacement workflow (`hops env-pull`) is well-documented and NOT changing here.
- `pnpm env:check:registry` is a DIFFERENT, working script (drift check between registry and Zod schemas). It STAYS untouched.
- The local `scripts/copy-env-to-worktree.sh` is unrelated and STAYS.

### 3. Decision matrix

Three candidate paths — evaluate, pick one.

#### Option A: Delete entirely

- Remove `scripts/env/pull.ts`, `push.ts`, `sync.ts`, `check.ts`.
- Remove the corresponding `env:pull`, `env:push`, `env:sync`, `env:check` entries from root `package.json`.
- Update `docs/guides/env-management.md` to drop the "Deprecated commands" table (or rewrite as a note: "Previously these existed; they're gone now").
- Update CLAUDE.md root reference.

**Pros:** Cleanest. Smaller surface area. No false leads in autocomplete.
**Cons:** Anyone with muscle memory typing `pnpm env:pull` gets `Unknown command` from pnpm — generic error, no pointer to the replacement.

#### Option B: Keep as informative stubs (status quo)

- Leave everything as-is.
- The stubs already redirect to `hops env-pull` on the VPS.

**Pros:** Helpful for users with muscle memory. Discoverable via `pnpm run`.
**Cons:** Clutter. Adds 4 lines to the script listing. Risk of someone running the stub on autopilot and confusing the exit code.

#### Option C: Hybrid — collapse into a single `pnpm env` wrapper

- Replace the 4 stubs with ONE `scripts/env/help.ts` that prints the full deprecation table + replacement guide.
- Add a single entry `"env": "tsx scripts/env/help.ts"` in `package.json`.
- Remove `env:pull`, `env:push`, `env:sync`, `env:check`.

**Pros:** Single helpful entry point. Cleaner `package.json`. Still catches muscle memory IF the user types `pnpm env`.
**Cons:** Doesn't catch the explicit `pnpm env:pull` muscle memory — that would still fail.

### 4. Recommendation (to be confirmed during planning)

Lean toward **Option A** (delete). Rationale:

- 6 months have passed since Phase 16.4. Muscle memory should have faded.
- `docs/guides/env-management.md` is the canonical reference and is already linked from CLAUDE.md.
- Any agent looking for env management will hit the doc, not the script. The stub only catches the (rare) case of running it from shell history.
- For the "shell history" case, pnpm's "command not found" output is informative enough — the user knows to RTFM.

If user prefers safety net, fall back to Option C.

### 5. Tasks (expand during planning)

| Task | Title | Status |
|---|---|---|
| T-130-01 | Confirm option (A/B/C) with user | pending |
| T-130-02 | If A: delete files + package.json entries + update env-management.md | pending, blocked by T-130-01 |
| T-130-03 | If C: write the consolidated help script + update package.json + update env-management.md | pending, blocked by T-130-01 |
| T-130-04 | Grep all docs/CLAUDE.md/scripts for references to the deprecated entries, update each | pending, blocked by T-130-02 or T-130-03 |
| T-130-05 | PR to staging | pending |

### 6. Risks

| Risk | Mitigation |
|---|---|
| Some agent script or CI uses `pnpm env:pull` and breaks silently | Grep the entire repo + CI configs before deletion |
| Documentation links rot | Search & replace any URL fragments that mention the stubs |

### 7. Acceptance Criteria

- [ ] Selected option implemented end-to-end
- [ ] `pnpm env:check:registry` still works (untouched)
- [ ] `docs/guides/env-management.md` reflects the final state
- [ ] No grep hits for `env:pull`, `env:push`, `env:sync`, `env:check` in `scripts/`, `docs/`, `apps/`, `packages/`, `.github/` after the change (other than historical references in archived spec dirs)
- [ ] PR merged to staging

---

## Part 2 — Implementation Notes

### Source

Surfaced during SPEC-111 worktree setup. The new worktree didn't have `.env.local` files; the agent reached for `pnpm env:pull` (per muscle memory and old docs), got the deprecation stub, and the user noted "we should review these stubs — keep or delete".

### Cross-spec dependencies

- Phase 16.4 (Vercel teardown) — the change that made these stubs deprecated. Closed.
- SPEC-111 (Astro server islands fix) — the active spec where this was discovered. SPEC-130 is independent.

### Where the stubs are referenced

- `package.json` (root) — script entries
- `scripts/env/*.ts` — the stub files themselves
- `docs/guides/env-management.md` — the "Deprecated commands" table
- `CLAUDE.md` (root) — implicit reference via the env workflow section

Should also grep `.github/workflows/`, `docs/migration/`, and any older spec dirs for stale references.
