---
spec-id: SPEC-247
title: Claude Code ↔ OpenCode Configuration Parity (central qz-ai-environment repo + symlinks)
type: infrastructure
complexity: high
status: draft
created: 2026-06-18T09:19:58Z
tags: [tooling, opencode, claude-code, config, symlinks, dotfiles, plugins, mcp, task-master, engram, orchestration]
---

# SPEC-247 — Claude Code ↔ OpenCode Configuration Parity

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal.** Make OpenCode (the SST/anomalyco terminal AI agent) behave functionally
equivalent to the user's current Claude Code setup — same rules, agents, slash
commands, skills, MCP servers, permissions, hooks (as OpenCode plugins), persistent
memory (engram), spec-driven workflow (task-master), and multi-agent orchestration
(Workflow → subagents) — while keeping Claude Code fully working in parallel.

**Core architectural decision.** All AI tooling configuration is consolidated into a
single physical source of truth: a new git repo `~/qz-ai-environment`. Both tools
consume it through symlinks:

- `~/.claude/**` → symlinks into `~/qz-ai-environment/claude/**`
- `~/.config/opencode/**` → symlinks into `~/qz-ai-environment/opencode/**`
- Project-level `.claude/` and `.opencode/` (in the hospeda repo and others) → symlinks
  into the same central repo where it makes sense.

Where the two tools share a format (plain-text rules, skills, docs) a single shared
file is symlinked by both. Where the format diverges (agent/command frontmatter,
permissions schema, hooks-vs-plugins) two files coexist, **both inside the central
repo** — so editing is "double" in content but never scattered in location.

**Motivation.** The user drives two agents (Claude Code + OpenCode) and wants one
mental model, one place to edit, and no config drift between machines-of-the-mind.

**Success criteria.**

1. OpenCode launches and loads the central config (rules, agents, commands, skills,
   MCP, permissions) with zero manual per-session setup.
2. Every Claude Code agent / command / skill has a working OpenCode counterpart
   (parity check passes — see Testing).
3. The five Claude Code hooks have working OpenCode plugin equivalents
   (validate-bash, rtk-rewrite, session/tab titles, engram-autosave, remember).
4. The task-master SDD flow (`/spec`, `/task-master:*`) runs from OpenCode.
5. engram persistent memory works from OpenCode (MCP read/write + autosave).
6. A documented orchestration pattern replaces the Workflow tool using OpenCode subagents.
7. Claude Code keeps working unchanged until the final cutover phase, and after cutover
   continues working through symlinks (no regression).
8. All symlinks resolve; `opencode.json` validates; every plugin has unit tests; the
   parity check and symlink-integrity check run green in CI-style validation.

**Target user.** The repo owner (single developer, single Linux machine).

### 2. User Stories & Acceptance Criteria (BDD)

#### US-1 — Central repo is the single source of truth

**As** the owner, **I want** one git repo holding all AI tooling config **so that** I
edit in one place and have history.

- **AC-1.1** Given a fresh clone of `~/qz-ai-environment`, when I inspect it, then it
  contains `shared/`, `claude/`, `opencode/`, `scripts/`, and `README.md`.
- **AC-1.2** Given the repo, when I run `scripts/bootstrap-symlinks.sh`, then `~/.claude`
  and `~/.config/opencode` entries become symlinks pointing inside the repo, and the
  script is idempotent (re-running causes no change and no error).
- **AC-1.3** Given any pre-existing `~/.claude` content, when bootstrap runs, then a
  timestamped backup is created BEFORE any symlink replaces a real file, and the backup
  path is printed.
- **AC-1.4** Given a broken/missing symlink target, when `scripts/validate.sh` runs,
  then it exits non-zero and names each broken link.

#### US-2 — OpenCode loads rules equivalent to CLAUDE.md

**As** the owner, **I want** OpenCode to honor the same engineering rules **so that**
both agents behave the same.

- **AC-2.1** Given `AGENTS.md` in the central repo and `instructions` in `opencode.json`,
  when OpenCode starts in the hospeda project, then it loads global + project rules.
- **AC-2.2** Given the Gentleman output-style (Spanish voseo chat, English code), when
  OpenCode replies, then it follows the same persona rules captured in `AGENTS.md` or the
  default agent prompt.
- **AC-2.3** Given both tools, when the same rule changes in the shared source, then both
  Claude Code and OpenCode reflect it after the change (single edit for shared rules).

#### US-3 — Agents, commands, skills have OpenCode counterparts

- **AC-3.1** Given the 20 Claude agents, when migrated, then `~/.config/opencode`
  (project `.opencode/agent/`) exposes an equivalent agent for each, invokable by OpenCode.
- **AC-3.2** Given the 18 Claude commands, when migrated, then each is available as an
  OpenCode command (`.opencode/command/*.md`) with arguments mapped to `$ARGUMENTS`/`$1..$n`.
- **AC-3.3** Given the 34 Claude skills, when migrated, then OpenCode lists each as a skill
  with the configured permission (`allow`/`ask`/`deny`).
- **AC-3.4** Given the parity-check script, when run, then it reports 0 missing
  counterparts across agents, commands, and skills (or fails listing the gaps).

#### US-4 — MCP servers available in OpenCode

- **AC-4.1** Given the ~27 MCP servers configured in Claude Code, when translated into
  the `mcp` block of `opencode.json`, then OpenCode can start each enabled server.
- **AC-4.2** Given a server that needs auth (vercel, neon, mercadopago, socket), when
  OpenCode loads it, then it is declared but does not block startup if unauthenticated.
- **AC-4.3** Given per-agent tool scoping, when an agent restricts tools, then the
  `tools`/`agent` config in `opencode.json` reflects it.

#### US-5 — Permissions equivalent

- **AC-5.1** Given Claude's allow/deny/ask permission sets, when mapped to OpenCode's
  `permission` schema, then equivalent edit/bash/skill/webfetch rules apply.
- **AC-5.2** Given the project-level branch protection (deny push to `main`/`staging`),
  when expressed in OpenCode permissions/plugin, then push to those branches is blocked.

#### US-6 — Hooks reimplemented as OpenCode plugins

- **AC-6.1** Given a bash command containing a blocked path (e.g. `.env`, `node_modules`),
  when run in OpenCode, then a `tool.execute.before` plugin blocks it (mirrors validate-bash).
- **AC-6.2** Given an rtk-rewritable command, when run in OpenCode, then the rtk plugin
  rewrites it for token economy (and does NOT rewrite `git log`), mirroring current behavior.
- **AC-6.3** Given a new session, when OpenCode starts, then a plugin derives the session
  title from the git branch ("SPEC-NNN slug"), mirroring session/tab title hooks.
- **AC-6.4** Given engram ships first-class OpenCode support (`engram setup opencode`
  installs the official `plugin/opencode/engram.ts` + an MCP entry + statusline), when
  setup is run, then OpenCode shares the SAME engram server (`:7437`) and DB
  (`~/.engram/engram.db`) as Claude Code, the official plugin handles autosave on
  `session.compacting`, and we do NOT reimplement the autosave. engram's `engram.ts` is
  third-party-managed and is NOT centralized/symlinked. Verify: `mem_search` from
  OpenCode returns shared history; autosave fires on compaction; degrades gracefully if
  the server is down.
- **AC-6.5** Given a conversation, when messages occur, then a `remember`-equivalent
  plugin appends history to `.remember/` (or its OpenCode analogue).
- **AC-6.6** Given any plugin throws, when the triggering event fires, then the failure is
  caught and logged without aborting the user's tool call (fail-safe, except security
  blocks which fail-closed).
- **AC-6.7** Given the user's custom Claude `engram-autosave.sh` saves MORE frequently
  than compaction (PreCompact + SessionEnd), when replicated in OpenCode, then a SEPARATE
  owned plugin (not the third-party `engram.ts`) saves on throttled `session.idle` (after
  N new messages or X minutes) and on session end, by extracting learnings and POSTing to
  engram's `:7437/observations/passive`. It degrades silently if engram is down and has an
  anti-recursion guard so the extractor model call does not re-trigger the save.

#### US-7 — task-master SDD flow runs from OpenCode

- **AC-7.1** Given the task-master commands, when ported, then `/spec` and `/task-master:*`
  exist as OpenCode commands and invoke the same `scripts/*.sh` (resolve-paths, scan, etc.).
- **AC-7.2** Given a new spec created from OpenCode, when allocated, then it uses the same
  `.qtm/specs` + engram registry and produces the same artifacts as from Claude Code.
- **AC-7.3** Given the task-master subagents (spec-writer, task-planner, tech-analyzer),
  when ported, then OpenCode can delegate to equivalents.

#### US-8 — Orchestration runner (replicate Workflow)

**As** the owner, **I want** a scriptable multi-agent orchestration runner in OpenCode
**so that** Workflow-style tasks (fan-out, pipeline, loop-until, adversarial-verify) work
there too.

- **AC-8.1** Given a spike on OpenCode's plugin/tool API, when complete, then it is known
  whether a plugin/custom-tool can spawn AND coordinate subagents programmatically, and
  the runner design is chosen accordingly (full runner if possible; documented
  constrained fallback if not).
- **AC-8.2** Given the runner is implemented, when invoked, then it exposes deterministic
  primitives `agent()`, `parallel()`, and `pipeline()` over OpenCode subagents.
- **AC-8.3** Given advanced patterns, when invoked, then `loop-until`, adversarial-verify
  (multi-judge majority vote), and schema-validated structured output work.
- **AC-8.4** Given the runner, when tested, then unit/integration tests cover the
  primitives and at least one worked example runs end-to-end.
- **AC-8.5** The parity-gap doc explicitly states where the runner diverges from the
  Claude Code Workflow tool (e.g. token-budget caching, deterministic vs model-driven
  spawn).

#### US-9 — Safe cutover of Claude Code

- **AC-9.1** Given Claude Code works today, when phases F0–F4 complete, then Claude Code
  is still untouched and working.
- **AC-9.2** Given F5 (cutover), when Claude's `~/.claude` entries are converted to
  symlinks, then a backup exists and a post-cutover smoke confirms Claude Code still
  loads rules, runs a command, and a hook fires.
- **AC-9.3** Given any cutover step fails, when detected, then a documented rollback
  restores the backup.

#### US-10 — Hospeda multi-tool project config (F6, in the hospeda repo)

**As** the owner, **I want** hospeda's project config to live in the hospeda repo and serve
Claude Code, OpenCode, and future tools from one source **so that** project config stays
versioned/reproducible (CI + collaborators) without symlinking to a personal external repo.

- **AC-10.1** Given hospeda, when restructured, then a `.ai/` neutral single source holds
  rules, skills, agents, and commands; `.claude/` and `.opencode/` are GENERATED from it.
- **AC-10.2** Given the generator, when run, then it emits real committed files (NOT
  symlinks) so it works on any OS, in CI, and for collaborators.
- **AC-10.3** Given rules and skills (same format across tools), when configured, then they
  are shared via relative in-repo paths (no per-tool duplication of those).
- **AC-10.4** Given agents/commands (per-tool frontmatter differs), when generated, then
  each tool gets a correct file from the single `.ai/` source.
- **AC-10.5** Given the generator is re-run with no source change, then it produces no diff
  (idempotent), and a drift check fails if `.claude/`/`.opencode/` are edited by hand.
- **AC-10.6** Given a future tool, when added, then it is one new generator target — no
  re-authoring of `.ai/` sources.
- **AC-10.7** Given the central repo, then it holds ONLY user-global, non-hospeda config;
  hospeda items are NOT copied into the central repo.

### 3. UX Considerations (operator flows)

- **Happy path**: clone/init central repo → run bootstrap → open OpenCode → it behaves
  like Claude Code.
- **Edit-a-shared-rule path**: edit one shared file → both tools updated.
- **Edit-a-divergent-thing path**: edit the Claude file AND the OpenCode file (both in
  central repo); parity check warns if only one changed and they fell out of sync.
- **Failure/degraded states**: engram offline (autosave warns, continues); MCP server
  auth missing (declared, skipped); broken symlink (validate.sh fails loudly); invalid
  `opencode.json` (documented fix).
- **Accessibility/clarity**: `README.md` documents the layout, the bootstrap, the
  validation, and the rollback so a future session (or machine) can reproduce it.

### 4. Out of Scope

- Multi-machine portability / installable dotfiles on other PCs (single-machine only).
- Migrating non-AI dotfiles (shell, git, editor).
- Replacing or deprecating Claude Code (it stays in parallel).
- Changing the *content/logic* of agents, skills, or commands — only format/location is
  migrated (semantic edits are separate work).
- Building a full bidirectional transpiler — generators are added only where repetition
  hurts (e.g. agents), per the "manual now, generator where it hurts" decision.

---

## Part 2 — Technical Analysis

### 1. Architecture

**Central repo layout** (`~/qz-ai-environment`):

```
qz-ai-environment/
├── shared/                 # plain-text, format-agnostic (symlinked by BOTH tools)
│   ├── rules/              # base engineering rules (the body of CLAUDE.md / AGENTS.md)
│   ├── skills/             # SKILL.md dirs (OpenCode + Claude both support skills)
│   └── docs/               # .claude/docs equivalents
├── claude/                 # Claude-format artifacts
│   ├── CLAUDE.md           # composed from shared/rules + claude-specifics
│   ├── agents/*.md
│   ├── commands/*.md
│   ├── output-styles/gentleman.md
│   ├── hooks/*.sh
│   └── settings.json
├── opencode/               # OpenCode-format artifacts
│   ├── AGENTS.md           # composed from shared/rules + opencode-specifics
│   ├── opencode.json       # mcp + permission + instructions + agent/tool scoping
│   ├── agent/*.md
│   ├── command/*.md
│   ├── skill/              # (symlinks to shared/skills or native)
│   └── plugin/*.ts         # validate-bash, rtk, titles, engram-autosave, remember
├── scripts/
│   ├── bootstrap-symlinks.sh   # idempotent, backs up before linking
│   ├── validate.sh             # symlink integrity + opencode.json schema + parity
│   ├── parity-check.sh         # every claude agent/cmd/skill has an opencode peer
│   └── gen-agents.sh           # generator (agents) — "where it hurts"
└── README.md
```

**Symlink strategy.** Granular (per-file or per-subdir) rather than linking the whole
`~/.claude` directory, so a single item can stay local if needed and backups are precise.

**Rules composition (OQ-3 resolved).** `shared/rules/` holds the tool-agnostic body ONCE.
`CLAUDE.md` and `AGENTS.md` are thin wrappers = tool-specific preamble + a NATIVE include
of the shared body: OpenCode via `instructions[]` globbing `shared/rules/*.md`, Claude via
`@shared/rules/...` imports. No generator and no duplication of the rule body.

**Hooks → plugins mapping** (OpenCode plugin events confirmed via opencode.ai/docs):

| Claude hook (event)              | OpenCode plugin event           |
|----------------------------------|---------------------------------|
| validate-bash (PreToolUse)       | `tool.execute.before`           |
| rtk-rewrite (PreToolUse)         | `tool.execute.before`           |
| session/tab title (SessionStart/UserPromptSubmit) | `session.created` + TUI events |
| engram-autosave (PreCompact/SessionEnd) | `session.compacted` / `session.idle` |
| remember (passive)               | `message.updated` / `session.idle` |

**Orchestration.** The `Workflow` tool has no OpenCode equivalent. F4 delivers a
documented subagent-based pattern (fan-out/pipeline/verify) plus one example, explicitly
labeled as approximate parity.

### 2. Data Model Changes

None (no database). The "data model" is the repo layout above and the symlink graph.
The spec/task artifacts continue to live in `.qtm/` (unchanged schema).

### 3. Interface Design (config + plugin contracts)

No HTTP API. The contracts are:

- **opencode.json**: `$schema`, `instructions[]`, `mcp{}`, `permission{}`,
  `agent{}`, `tools{}` — validated against `https://opencode.ai/config.json`.
- **Command file**: markdown + frontmatter (`description`, `agent`, `model`) + body with
  `$ARGUMENTS` / `$1..$n`.
- **Agent file**: markdown + frontmatter (OpenCode agent schema).
- **Plugin**: `export const X = async (ctx) => ({ "<event>": async (input, output) => {...} })`.
  Each plugin exports a typed handler and has a vitest/bun unit test.

### 4. Dependencies

- **External**: OpenCode CLI (installed), `bun` or node for plugins, `rtk` CLI, engram
  MCP server, jq. Docs verified: opencode.ai/docs (plugins/commands/agents/skills/mcp/
  permissions/rules) — 2026-06-18 via Context7.
- **Internal**: existing `.claude/` content, task-master plugin scripts, engram registry.

### 5. Risks & Mitigations

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| ~~engram autosave reimplementation~~ RESOLVED | — | — | engram ships first-class OpenCode support (`engram setup opencode` + official `engram.ts`); shared server/DB; no reimplementation needed |
| OpenCode can't spawn/coordinate subagents programmatically from a plugin → full Workflow runner infeasible | Med | High | F4 spike (T-026) FIRST; if infeasible, ship a documented constrained fallback instead of a full runner |
| Orchestration runner is a real subsystem (scope/time) | High | Med | Phased build (spike → core primitives → patterns → tests); each task ≤3; runner is the last integration phase |
| Converting working `~/.claude` to symlinks breaks Claude Code | Med | High | Backup-before-link, cutover LAST (F5), post-cutover smoke + rollback doc |
| rtk integrity (sha256) mechanism absent in OpenCode | Low | Low | Accept; rtk plugin is plain TS, integrity not required outside Claude's hook model |
| Manual double-edit drift between Claude/OpenCode files | Med | Med | parity-check.sh + generator for high-repetition agents |
| opencode.json invalid → OpenCode won't start | Low | High | validate.sh schema check in CI-style gate before commit |
| Plugin throws and blocks tool execution | Low | Med | Fail-safe wrapper (catch+log) for non-security plugins; security plugin fails closed |

### 6. Performance Considerations

Negligible runtime cost. The only hot path is `tool.execute.before` plugins (run per
bash call) — keep them synchronous-cheap (string checks, no network) as the current bash
hooks are. engram-autosave runs on compaction/idle (rare), can be async.

---

## Implementation Approach (phased)

- **F0 — Foundation**: create `~/qz-ai-environment` (git init), layout, `bootstrap-symlinks.sh`
  (with backup), `validate.sh`, compose `shared/rules` + `AGENTS.md`, `opencode.json` with
  MCP + permissions + instructions. OpenCode usable.
- **F1 — User-global Agents/Commands/Skills**: migrate ONLY the user-global, non-hospeda
  items (the 3 `jd-*` agents, the `handoff` command, any `~/.claude/skills`) to the central
  repo; build the reusable `gen-agents.sh`; `parity-check.sh`. (Two-tier scope decision:
  the central repo holds ONLY user-global, non-hospeda config. The 20 agents / 18 commands
  / 34 skills currently in `hospeda/.claude` are project config and are handled in F6,
  inside the hospeda repo — NOT here.)
- **F2 — Plugins**: validate-bash, rtk, session/tab titles, remember as TS plugins +
  unit tests. engram via `engram setup opencode` (official plugin, no reimplementation).
- **F3 — task-master/specs**: port `/spec` and `/task-master:*` as OpenCode commands;
  verify allocation + index-sync + artifacts from OpenCode.
- **F4 — Orchestration runner (replicate Workflow)**: spike OpenCode's programmatic
  subagent API → implement runner core (`agent`/`parallel`/`pipeline`) → advanced
  patterns (loop-until, adversarial-verify, structured output) → tests + worked example +
  parity-gap doc.
- **F5 — Claude cutover**: convert `~/.claude` to symlinks (backup), post-cutover smoke,
  rollback doc.
- **F6 — Hospeda multi-tool project config** (work in the HOSPEDA repo, own branch): give
  the hospeda repo a `.ai/` neutral single source + a committed generator that produces
  real `.claude/` and `.opencode/` files (NOT symlinks — CI/collaborator/OS-safe). Rules
  and skills shared via relative in-repo paths; agents/commands generated per tool. Adding
  a future tool = adding a generator target. This keeps hospeda project config IN hospeda
  (versioned, reproducible) while serving Claude + OpenCode (+ future tools).

### Suggested tasks (preliminary — expanded in task generation)

- Setup: init repo, layout, bootstrap script, validate script, backup logic.
- Core/F0: shared rules, AGENTS.md, opencode.json (mcp, permission, instructions).
- Core/F1: agent generator, migrate agents/commands/skills, parity check.
- Core/F2: each plugin + its test, engram spike.
- Integration/F3: port task-master commands, verify SDD flow from OpenCode.
- Integration/F4: orchestration doc + example.
- Testing: symlink integrity, opencode schema validation, plugin unit tests, parity
  check, F0–F5 smokes.
- Docs: README, rollback runbook, parity-gap notes.
- Cleanup/F5: Claude cutover + post-cutover smoke.

---

## Internal Review Notes

#### Strengthened during review

- Added explicit backup-before-symlink and rollback ACs (US-1, US-9) so a working
  Claude Code setup is never put at risk without recovery.
- Made every plugin fail-safe except security (fail-closed) to avoid a plugin crash
  aborting tool execution.
- Added a parity-check script as the concrete guard against manual double-edit drift.

#### Open questions — RESOLVED 2026-06-18

- OQ-1 (engram): RESOLVED — engram has first-class OpenCode support (`engram setup
  opencode` installs the official `plugin/opencode/engram.ts` + MCP entry + statusline;
  same `:7437` server + `~/.engram/engram.db` shared with Claude Code). No autosave
  reimplementation. engram's `engram.ts` stays third-party-managed (NOT centralized).
- OQ-2 (orchestration): RESOLVED — owner chose to REPLICATE the Workflow tool (advanced).
  F4 builds a runner (spike → primitives → patterns → tests), not just a doc. Parity is
  best-effort; spike de-risks the programmatic-spawn unknown.
- OQ-3 (rules): RESOLVED — neither generate nor duplicate. Both tools include external
  files natively (OpenCode `instructions[]` globs; Claude `@path` imports). The rule body
  lives once in `shared/rules/`; `CLAUDE.md`/`AGENTS.md` are thin wrappers that include it.
  No rules generator. (`gen-agents.sh` for agents remains, since per-agent frontmatter
  genuinely differs.)
- OQ-4 (scope, two-tier): RESOLVED 2026-06-18 — central repo holds ONLY user-global,
  non-hospeda config. Hospeda's project config (the 20 agents / 18 commands / 34 skills)
  stays IN the hospeda repo and is restructured for multi-tool in a new phase F6 using a
  `.ai/` neutral source + committed generator (real files, not symlinks → CI/OS/collaborator
  safe). F1 re-scoped to user-global items only (jd-* agents, handoff, ~/.claude skills).

#### External docs verified

- OpenCode plugins/events, commands, agents, skills, MCP, permissions, rules —
  <https://opencode.ai/docs> — verified 2026-06-18 (Context7).
