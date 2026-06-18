# SPEC-247: Claude Code ↔ OpenCode Configuration Parity

## Progress: 10/47 tasks (21%)

**Average Complexity:** 2.4/3 (max)
**Status:** in-progress
**Repo (central):** /proyects/TOOLS/qz-ai-environment, branch spec/SPEC-247-claude-opencode-config-parity

> Two-tier scope (OQ-4): central repo = user-global non-hospeda config; hospeda project
> config stays in the hospeda repo and is restructured for multi-tool in F6 (.ai/ + generator).

---

### Setup Phase (F0) — done

- [x] **T-001** (1) — Init repo + base layout
- [x] **T-002** (3) — bootstrap-symlinks.sh (backup + idempotent)
- [x] **T-003** (2) — validate.sh symlink-integrity

### Core Phase (F0 rules/config) — done

- [x] **T-004** (2) — shared/rules engineering rules
- [x] **T-005** (2) — AGENTS.md/CLAUDE.md wrappers (native include)
- [x] **T-006** (2) — Gentleman persona
- [x] **T-007** (3) — 34 MCP servers → opencode.json
- [x] **T-009** (3) — permissions → permission{}
- [x] **T-010** (2) — protected-branches template
- [x] **T-011** (2) — validate opencode.json (structure + schema)
- [ ] **T-008** (2) — per-agent tool scoping in opencode.json — by: T-007 (after agents exist)

### Core Phase (F1 user-global agents/commands/skills)

- [ ] **T-012** (3) — gen-agents.sh generator (reusable) — by: T-001
- [ ] **T-013** (2) — Migrate user-global agents (jd-*) to central — by: T-012
- [ ] **T-014** (2) — Migrate user-global command (handoff) to central — by: T-001
- [ ] **T-015** (2) — Wire user-global skills to central — by: T-009
- [ ] **T-016** (3) — parity-check.sh (central) — by: T-013,T-014,T-015

### Core Phase (F2 plugins)

- [ ] **T-017** (3) — Plugin scaffold + fail-safe wrapper + harness — by: T-001
- [ ] **T-018** (3) — validate-bash plugin (+ file-path guard, see PERMISSIONS-NOTES) — by: T-017
- [ ] **T-019** (3) — rtk rewrite plugin — by: T-017
- [ ] **T-020** (2) — Session/tab title plugin — by: T-017
- [ ] **T-021** (2) — remember plugin — by: T-017
- [ ] **T-022** (2) — engram: `engram setup opencode` + verify — by: T-007
- [ ] **T-038** (3) — engram extra-autosave plugin (frequent saves) — by: T-017,T-022

### Integration Phase (F3 task-master)

- [ ] **T-023** (3) — Port /spec + /task-master:* as OpenCode commands — by: T-014
- [ ] **T-024** (3) — Verify SDD flow from OpenCode — by: T-023
- [ ] **T-025** (2) — Port task-master subagents — by: T-013

### Integration Phase (F4 orchestration runner — replicate Workflow)

- [ ] **T-026** (3) — Spike: OpenCode programmatic subagent/tool API — by: T-017,T-025
- [ ] **T-027** (3) — Runner core (agent/parallel/pipeline) — by: T-026
- [ ] **T-028** (3) — Advanced patterns (loop-until, verify-vote, structured output) — by: T-027
- [ ] **T-029** (3) — Worked example + parity-gap doc — by: T-028

### Testing Phase

- [ ] **T-030** (2) — F0 smoke: OpenCode boots rules+MCP+permissions — by: T-005,T-007,T-009
- [ ] **T-031** (2) — validate.sh CI-style gate — by: T-011,T-016
- [ ] **T-032** (2) — Plugin unit-test suite green — by: T-018,T-019,T-020,T-021,T-038
- [ ] **T-033** (3) — Orchestration runner tests — by: T-028

### Docs Phase

- [ ] **T-034** (2) — README: layout, bootstrap, validation, edit flows — by: T-002,T-003
- [ ] **T-035** (2) — Rollback runbook + parity-gap notes — by: T-029

### Cleanup Phase (F5 — Claude cutover, LAST)

- [ ] **T-036** (3) — Cutover: backup ~/.claude → symlinks — by: T-034
- [ ] **T-037** (2) — Post-cutover smoke for Claude Code — by: T-036

### Hospeda multi-tool config (F6 — in the hospeda repo, own branch)

- [ ] **T-039** (3) — Scaffold .ai/ neutral source + generator skeleton
- [ ] **T-040** (3) — agents .ai/agents → generate .claude + .opencode — by: T-039
- [ ] **T-041** (3) — commands .ai/commands → generate both — by: T-039
- [ ] **T-042** (3) — skills .ai/skills shared by both tools — by: T-039
- [ ] **T-043** (3) — rules .ai/rules + per-tool wrappers — by: T-039
- [ ] **T-044** (2) — .opencode/opencode.json project config — by: T-042,T-043
- [ ] **T-045** (2) — generator idempotency + drift check — by: T-040,T-041
- [ ] **T-046** (2) — generator tests + parity check — by: T-044,T-045
- [ ] **T-047** (2) — AI-config README (.ai/ + generator + add-a-tool) — by: T-046

---

## Suggested next

T-012 (reusable generator) → T-013/T-014/T-015 (user-global agents/commands/skills). F6
(hospeda) is a separate workstream in the hospeda repo on its own branch.
