---
spec-id: SPEC-032
title: "Interactive CLI Tool for Development Workflows"
type: feature
complexity: medium
status: completed
created: 2026-03-06T00:00:00.000Z
updated: 2026-03-09T00:00:00.000Z
approved: 2026-03-09T00:00:00.000Z
---

# SPEC-032: Interactive CLI Tool for Development Workflows

## Part 1 .. Functional Specification

### 1. Overview & Goals

#### Goal

Create a single interactive CLI tool (`pnpm cli`) that provides a searchable, menu-driven interface to discover and execute development commands across the monorepo. This replaces the need to memorize or look up 38+ pnpm scripts, 12+ utility scripts, and 150+ package-specific scripts.

#### Motivation

The Hospeda monorepo has accumulated a significant number of scripts and utilities spread across:

- **38 root package.json scripts** (dev, build, test, db, lint, format, env, docs, etc.)
- **12+ standalone scripts** in `scripts/` (dev.sh, dev-all.js, dev-admin.js, migrate-production.sh, check-links.ts, validate-examples.ts, setup-test-db.ts, create-docs-structure.ts, fix-markdown-non-code-errors.cjs, env/pull.ts, env/push.ts, env/check.ts)
- **150+ package-specific scripts** across 16 active packages (build, dev, test, lint, format, typecheck, clean, etc.)
- **43+ app-specific scripts** across 3 apps (API: 17, Admin: 16, Web: 10)

Developers must currently know the exact script name and which package.json it lives in. There is no discoverability mechanism, no categorization, and no search. The deleted `docs/guides/cli-utilities.md` attempted to document these but became outdated and inaccurate quickly because documentation and code drifted apart.

The solution: a living, self-documenting CLI tool that reads available scripts from the actual package.json files and presents them in a categorized, searchable interactive menu. However, NOT all 195+ scripts need to appear in the menu.. the CLI curates a useful subset of **high-value commands** while still allowing access to everything via search and direct mode.

#### Success Metrics

- All curated commands discoverable and executable through the CLI
- Any script from any package accessible via direct mode (`pnpm cli @repo/db:test`)
- Search/filter by keyword, category, or package name
- Clear descriptions for every curated command
- Execution with proper working directory and command construction
- CLI starts in under 500ms
- Low maintenance burden: curated registry + auto-discovery fallback

### 2. Scope

#### In Scope

- Interactive terminal menu with categories and search
- Execution of any registered command with real-time output streaming
- Curated command registry (~50-60 high-value commands with descriptions)
- Auto-discovery of ALL scripts from workspace package.json files (accessible via search/direct mode)
- Category system with two-level navigation (Category -> Commands)
- Fuzzy search across command names, descriptions, and package names
- Confirmation prompt for dangerous commands
- Command history (last 5 used commands for quick re-run)
- Non-interactive mode for direct execution (`pnpm cli db:start`)
- Help output listing all curated commands grouped by category
- Full listing mode showing all discovered commands (`pnpm cli --list --all`)
- Argument pass-through to executed commands (`pnpm cli dev:all -- --api-only`)

#### Out of Scope

- GUI or web-based interface
- Custom command creation/editing through the CLI itself
- Remote execution or CI/CD integration
- Plugin system for external commands
- Auto-updating the CLI tool itself

### 3. User Stories

1. **As a developer**, I want to type `pnpm cli` and see the most useful commands grouped by category, so I can discover what's available without reading docs.
2. **As a developer**, I want to search for "test" and see all test-related commands across all apps/packages, so I can quickly find the right one.
3. **As a developer**, I want to run `pnpm cli db:fresh` directly from the command line without going through the interactive menu, for scripting and quick access.
4. **As a new team member**, I want each command to show a brief description and which package it belongs to, so I understand what it does before running it.
5. **As a developer**, I want dangerous commands (db:reset, db:fresh) to require confirmation, so I don't accidentally destroy data.
6. **As a developer**, I want to see my recently used commands at the top of the menu, so I can quickly re-run frequent tasks.
7. **As a developer**, I want to pass extra arguments to commands (e.g., `pnpm cli dev:all -- --api-only`), so I can customize execution without leaving the CLI.
8. **As a developer**, I want long-running commands (dev servers, db:studio) to run in foreground without returning to the menu, so I can Ctrl+C to stop them naturally.

### 4. Command Categories

| Category | Description | Curated Commands (from registry) |
|----------|-------------|----------------------------------|
| **Development** | Start dev servers and related tools | dev, dev:all, dev:admin, pgadmin:start, pgadmin:stop |
| **Database** | Database management and migrations | db:start, db:stop, db:restart, db:reset, db:fresh, db:fresh-dev, db:logs, db:migrate, db:migrate:prod, db:generate, db:studio, db:seed, db:push |
| **Testing** | Run tests across all apps/packages | test, test:watch, test:coverage, api:test:e2e, api:test:e2e:watch |
| **Code Quality** | Linting, formatting, type checking | lint, format, check, typecheck, format:md, lint:md, lint:md:docs |
| **Build** | Build apps and packages | build, build:api, clean |
| **Environment** | Env var management (Vercel sync) | env:pull, env:push, env:check |
| **Documentation** | Doc tools and validation | docs:check-links, docs:validate-examples, create-docs-structure |
| **Infrastructure** | Docker, production scripts, setup | setup-test-db |
| **Package Tools** | Package-specific utilities | seed, seed:required, seed:example, i18n:generate-types |

> **Note**: `db:migrate:prod` covers production migration (previously also listed as `migrate-production` in Infrastructure.. consolidated to avoid duplication).

### 5. Functional Requirements

#### 5.1 Interactive Mode (`pnpm cli`)

1. Display the intro banner with version
2. If history exists, show "Recent" section (max 5 commands)
3. Show search input field with real-time fuzzy filtering
4. Below search, display curated commands grouped by category with visual separators
5. When the user types, filter ALL commands (curated + auto-discovered) using fuzzy search
6. Show command ID, description, and source package for each entry
7. On selection, show the actual shell command that will run
8. For dangerous commands, show confirmation prompt before execution
9. For non-dangerous commands, execute immediately on selection
10. Stream command output in real-time (inherit stdio)
11. After command completes, show exit code and duration
12. For one-shot commands: show "Press Enter to return to menu..."
13. For long-running commands (see section 5.6): do NOT return to menu.. exit CLI when the process ends

#### 5.2 Direct Mode (`pnpm cli <command>`)

1. Accept a command ID as first argument (e.g., `pnpm cli db:start`)
2. If exact match found in curated registry, execute immediately
3. If exact match found in auto-discovered scripts, execute immediately
4. If no exact match, run fuzzy search and show top 5 matches for user to pick
5. Support `--yes` / `-y` flag to skip confirmation on dangerous commands
6. Support `--help` / `-h` to show all curated commands grouped by category
7. Support `--list` / `-l` to output curated commands as plain text (for piping)
8. Support `--list --all` / `-la` to output ALL discovered commands as plain text
9. Everything after `--` is passed as additional arguments to the target command

#### 5.3 Command Registry

##### CliCommand Interface

```typescript
/** Categories for grouping commands in the interactive menu */
type CommandCategory =
  | "development"
  | "database"
  | "testing"
  | "code-quality"
  | "build"
  | "environment"
  | "documentation"
  | "infrastructure"
  | "package-tools";

/** How the command behaves when running */
type CommandMode =
  | "one-shot"    // Runs and exits (build, test, lint, etc.)
  | "long-running" // Runs until Ctrl+C (dev servers, db:studio, db:logs)
  | "interactive"; // Has its own interactive UI (seed, db:studio)

/** How the command should be executed */
type CommandExecution =
  | { readonly type: "pnpm-root"; readonly script: string }
  | { readonly type: "pnpm-filter"; readonly filter: string; readonly script: string }
  | { readonly type: "shell"; readonly command: string };

interface CliCommand {
  /** Unique identifier shown in the menu (e.g., "db:start", "api:test:e2e") */
  readonly id: string;
  /** Human-readable description (max 60 chars for alignment) */
  readonly description: string;
  /** Category for grouping in menu */
  readonly category: CommandCategory;
  /** How to execute this command */
  readonly execution: CommandExecution;
  /** Whether to show confirmation prompt before running */
  readonly dangerous?: boolean;
  /** Danger message shown in confirmation (required if dangerous=true) */
  readonly dangerMessage?: string;
  /** Source package name (e.g., "root", "@repo/db", "hospeda-api") */
  readonly source: string;
  /** How the command behaves when running */
  readonly mode: CommandMode;
  /** Whether this appears in the curated interactive menu (vs only in search/direct) */
  readonly curated: boolean;
}
```

##### Execution Type Details

Each execution type maps to a concrete shell command:

| Type | Construction | Example |
|------|-------------|---------|
| `pnpm-root` | `pnpm run <script> [-- extraArgs]` | `pnpm run db:start` |
| `pnpm-filter` | `pnpm --filter <filter> <script> [-- extraArgs]` | `pnpm --filter @repo/db db:push` |
| `shell` | `<command> [extraArgs]` | `bash scripts/migrate-production.sh` |

#### 5.4 Auto-Discovery

Auto-discovery runs at CLI startup and supplements the curated registry:

**Step 1: Resolve workspaces**
- Read `pnpm-workspace.yaml` to get workspace glob patterns
- Glob for all matching `package.json` files
- Parse each package.json and extract the `name` and `scripts` fields

**Step 2: Generate command IDs for auto-discovered scripts**
- Root scripts: use script name as-is (e.g., `db:start`)
- App scripts: prefix with app short name (e.g., `api:test:e2e`, `admin:dev`, `web:build`)
- Package scripts: prefix with package short name without `@repo/` (e.g., `db:push` for `@repo/db`, `schemas:test` for `@repo/schemas`)

**Step 3: Merge with curated registry**
- Curated commands take precedence (they have better descriptions and correct metadata)
- Auto-discovered commands that match a curated command ID are skipped
- Remaining auto-discovered commands get `curated: false` and default category assignment

**Step 4: Default category assignment for auto-discovered scripts**
- Scripts matching `build*` -> `build`
- Scripts matching `dev*` -> `development`
- Scripts matching `test*` -> `testing`
- Scripts matching `lint*` / `format*` / `check*` / `typecheck*` -> `code-quality`
- Scripts matching `db:*` / `seed*` / `migrate*` -> `database`
- Scripts matching `clean*` -> `build`
- Everything else -> `package-tools`

**Step 5: Filter noise**
The following auto-discovered scripts are excluded from results (they are internal/infrastructure):
- `prepare` (husky install)
- `preinstall`, `postinstall`
- Scripts that match turbo pipeline task names from `turbo.json` (avoid showing both `pnpm test` root and `pnpm --filter X test` for every package). Specifically, exclude auto-discovered scripts named: `build`, `dev`, `lint`, `format`, `test`, `test:watch`, `test:coverage`, `typecheck`, `clean` when the same script name already exists as a root curated command. These are turbo-orchestrated and should only appear as root commands.

**Performance**: Auto-discovery reads ~20 package.json files using `fs.readFile` (async, parallel). Expected time: < 30ms.

#### 5.5 Dangerous Command Protection

The following commands require confirmation before execution:

| Command | Danger Message |
|---------|---------------|
| `db:reset` | "This will DROP all database volumes, recreate containers, and run migrations. All data will be lost." |
| `db:fresh` | "This will DROP all database volumes, recreate containers, run migrations, and seed. All data will be lost." |
| `db:fresh-dev` | "This will DROP all database volumes, recreate containers, push schema, and seed. All data will be lost." |
| `db:migrate:prod` | "This will run migrations against the PRODUCTION database. Make sure you have a backup." |
| `clean` | "This will remove all build artifacts (dist/, .output/, node_modules/.cache/) across the monorepo." |

Confirmation prompt format:
```
  ⚠ Dangerous command: db:fresh
  This will DROP all database volumes, recreate containers, run migrations, and seed. All data will be lost.

  Are you sure? (y/N) _
```

The `--yes` / `-y` flag in direct mode skips this confirmation.

#### 5.6 Long-Running Command Handling

Commands with `mode: "long-running"` or `mode: "interactive"` behave differently:

- **Do NOT show** "Press Enter to return to menu..." after completion
- **Do NOT catch** Ctrl+C.. propagate SIGINT to the child process
- **Exit the CLI** when the child process exits (with the child's exit code)
- After the process ends, just show the exit code and duration, then exit

Long-running commands in the curated registry:
- `dev`, `dev:all`, `dev:admin` (dev servers)
- `db:studio` (Drizzle Studio)
- `db:logs` (Docker log streaming)
- `test:watch` (vitest watch mode)
- `api:test:e2e:watch` (E2E tests in watch mode)

Interactive commands:
- `seed` (has its own interactive CLI)
- `env:pull`, `env:push` (prompt for app/environment selection)
- `db:migrate:prod` (has confirmation and backup prompts)

#### 5.7 Argument Pass-Through

Users can pass additional arguments to commands:

```bash
# Direct mode: everything after -- is passed to the target command
pnpm cli dev:all -- --api-only
# Executes: ./scripts/dev.sh --api-only

pnpm cli seed -- --required --exclude=posts
# Executes: pnpm --filter @repo/seed seed -- --required --exclude=posts
```

In interactive mode, after selecting a command, if the command accepts known arguments (defined in the registry), show a hint:
```
  Running: dev:all
  Command: ./scripts/dev.sh
  Tip: supports --api-only, --admin-only, --web-only, --no-api, --no-admin, --no-web
```

The argument hints are optional metadata in the curated registry:
```typescript
interface CliCommand {
  // ... existing fields ...
  /** Optional hint about accepted arguments */
  readonly argHint?: string;
}
```

#### 5.8 Command History

**Storage**: `.cli-history.json` in repo root (gitignored).

**Schema**:
```typescript
interface CliHistory {
  /** Schema version for future compatibility */
  readonly version: 1;
  /** Ordered list of recent command IDs (most recent first, max 20 stored) */
  readonly entries: readonly CliHistoryEntry[];
}

interface CliHistoryEntry {
  /** Command ID */
  readonly id: string;
  /** ISO 8601 timestamp of last execution */
  readonly lastRun: string;
  /** Number of times this command has been run */
  readonly runCount: number;
}
```

**Behavior**:
- On command execution, upsert the entry: update `lastRun`, increment `runCount`
- Store max 20 entries (to have enough data for ranking)
- Display max 5 "Recent" entries in the interactive menu (sorted by `lastRun` descending)
- If the history file is missing or corrupt, silently create a new one
- Write history atomically (write to temp file, then rename)

### 6. Technical Requirements

#### 6.1 Technology

- **Language**: TypeScript (strict mode, no `any`)
- **Runtime**: Node.js via tsx
- **Interactive UI**: `@inquirer/prompts` (already installed in the project as `@inquirer/prompts@^8.3.0`)
- **Fuzzy search**: `fuse.js` (lightweight fuzzy search, zero dependencies, ~5KB gzipped)
- **Execution**: `node:child_process` (spawn with `stdio: 'inherit'`)
- **File system**: `node:fs/promises`
- **Path resolution**: `node:path` + `node:url` (for `import.meta.url`)
- **Location**: `scripts/cli/` (all modules) + `scripts/cli.ts` (thin entry point)

**Why `@inquirer/prompts` over `@clack/prompts`**:
- Already installed as a devDependency (`@inquirer/prompts@^8.3.0`)
- Already used by `scripts/env/utils/prompts.ts` in this project
- Has `search` prompt with custom filter function support (ideal for fuzzy search)
- Has `select` prompt with separator support for category grouping
- `@clack/prompts` lacks a grouped single-select component (`groupMultiselect` exists but not `groupSelect`)
- Zero new dependencies to add (only `fuse.js` is new)

**Why `node:child_process` over `execa`**:
- `spawn` with `stdio: 'inherit'` covers 100% of our needs
- Avoids adding another dependency
- Signal propagation (SIGINT, SIGTERM) works natively with `inherit`

#### 6.2 File Structure

```
scripts/
  cli.ts                       # Thin entry point: imports and runs main()
  cli/
    main.ts                    # Main function: parse args, route to interactive/direct
    types.ts                   # TypeScript interfaces (CliCommand, CliHistory, etc.)
    registry.ts                # Curated command registry (~50-60 commands with descriptions)
    discovery.ts               # Auto-discovery: reads workspace package.json files
    categories.ts              # Category definitions and display order
    interactive.ts             # Interactive menu: search prompt + command select
    direct.ts                  # Direct mode: argument parsing, command lookup, execution
    runner.ts                  # Command execution: spawn child process, handle signals
    search.ts                  # Fuse.js setup and search wrapper
    history.ts                 # Read/write .cli-history.json
    format.ts                  # Terminal output formatting (colors, tables, banners)
```

#### 6.3 Package.json Entry

```json
{
  "scripts": {
    "cli": "tsx scripts/cli.ts"
  }
}
```

#### 6.4 Performance Budget

| Metric | Budget | How to achieve |
|--------|--------|----------------|
| CLI startup to first render | < 500ms | Parallel package.json reads, lazy Fuse.js init |
| Search filtering per keystroke | < 50ms | Fuse.js on ~200 items is sub-millisecond |
| History read/write | < 10ms | Small JSON file, atomic write |

#### 6.5 Fuse.js Configuration

> **Note**: Fuse.js uses a default export (`export default class Fuse`). This is an exception to the project's "named exports only" policy. Use `import Fuse from 'fuse.js'` and add a `// fuse.js uses default export` comment at the import site.

```typescript
// fuse.js uses default export - documented exception to named-exports-only policy
import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";

const fuseOptions: IFuseOptions<CliCommand> = {
  keys: [
    { name: "id", weight: 0.5 },
    { name: "description", weight: 0.3 },
    { name: "source", weight: 0.2 },
  ],
  threshold: 0.3,           // Stricter than default 0.6. Values: 0.0 = exact match, 1.0 = match everything
  distance: 200,            // Allow matches further into longer descriptions (default: 100)
  ignoreLocation: true,     // Search entire string, not just near position 0
  ignoreDiacritics: true,   // CRITICAL for Spanish: "migracion" matches "migración"
  includeScore: true,       // Score 0 = perfect match, ~1 = poor match
  minMatchCharLength: 2,    // Ignore single-character matches
};
```

#### 6.6 Error Handling

| Scenario | Behavior |
|----------|----------|
| Command not found (direct mode) | Show "Command 'X' not found." + top 5 fuzzy matches, let user pick or exit |
| Child process exits with non-zero | Show exit code in red, log duration, continue to menu (one-shot) or exit (long-running) |
| Child process killed by signal | Show signal name (e.g., "Killed by SIGTERM"), exit with code 130 (SIGINT) or 143 (SIGTERM) |
| Ctrl+C during menu navigation | Catch `ExitPromptError` from `@inquirer/prompts`, exit CLI with code 0 (see section 4.6) |
| Ctrl+C during command execution | Propagate SIGINT to child (stdio: inherit handles this automatically) |
| History file corrupt/missing | Log warning, recreate empty history, continue normally |
| Package.json read fails | Log warning for that package, continue with remaining packages |
| pnpm-workspace.yaml missing | Fatal error: "Cannot find pnpm-workspace.yaml. Run from monorepo root." |

### 7. UX Design

#### 7.1 Interactive Menu Flow

The interactive mode uses a two-step flow:

**Step 1: Command Selection (search + select)**

Uses `@inquirer/search` prompt which combines a text input with a filterable list:

```
  ╭──────────────────────────────╮
  │  Hospeda CLI v1.0.0          │
  ╰──────────────────────────────╯

? Select a command (type to search):
  ── Recent ──────────────────────────────────────────
  db:start           Start PostgreSQL + Redis containers          [root]
  dev:all            Start all dev servers (API + Admin + Web)    [root]
  ── Development ─────────────────────────────────────
  dev                Start all apps via turbo                     [root]
  dev:all            Start all dev servers with Docker check      [root]
  dev:admin          Start admin with Vite cache clearing         [root]
  pgadmin:start      Start pgAdmin container                     [root]
  pgadmin:stop       Stop pgAdmin container                      [root]
  ── Database ────────────────────────────────────────
  db:start           Start PostgreSQL + Redis containers          [root]
  db:stop            Stop database containers                     [root]
  db:fresh           ⚠ Reset + migrate + seed database           [root]
  db:migrate         Apply pending migrations                     [root]
  db:studio          Open Drizzle Studio (interactive)            [root]
  db:seed            Reset + seed required + example data         [root]
  db:generate        Generate migration from schema changes       [root]
  ── Testing ─────────────────────────────────────────
  test               Run all tests (turbo, 4 concurrent)          [root]
  test:watch         Run tests in watch mode                      [root]
  test:coverage      Run tests with coverage report               [root]
  api:test:e2e       Run API E2E tests (Vitest E2E config)         [api]
  api:test:e2e:watch Run API E2E tests in watch mode              [api]
  ── Code Quality ────────────────────────────────────
  lint               Run Biome linting                            [root]
  format             Run Biome formatting                         [root]
  check              Biome check + auto-fix                       [root]
  typecheck          TypeScript validation (all packages)         [root]
  ── Build ───────────────────────────────────────────
  build              Build all packages (turbo)                   [root]
  build:api          Build API for production                     [root]
  clean              ⚠ Remove all build artifacts                 [root]
  ── Environment ─────────────────────────────────────
  env:pull           Pull env vars from Vercel                    [root]
  env:push           Push env vars to Vercel                      [root]
  env:check          Validate env vars against registry           [root]
  ...
(Use arrow keys to navigate, type to filter)
```

Notes on the layout:
- The `[root]`, `[api]`, `[@repo/db]` tags show the source package
- Dangerous commands show a ⚠ prefix in the description
- Categories are `@inquirer/prompts` Separator objects
- Recent section only appears if history has entries
- When the user types, Fuse.js filters ALL commands (curated + auto-discovered) and the list updates in real-time

**Step 2: Execution**

After selecting a command:

```
  ▶ Running: db:start
  ▶ Command: pnpm run db:start
  ▶ Directory: /home/user/projects/hospeda

  [command output streams here in real-time]

  ✓ Completed in 3.2s (exit code: 0)
  Press Enter to return to menu...
```

For failed commands:
```
  ▶ Running: typecheck
  ▶ Command: turbo run typecheck

  [command output with errors]

  ✗ Failed in 12.1s (exit code: 1)
  Press Enter to return to menu...
```

For dangerous commands, Step 1.5 is inserted:
```
  ⚠ Dangerous command: db:fresh
  This will DROP all database volumes, recreate containers, run migrations, and seed.
  All data will be lost.
  Are you sure? (y/N) _
```

#### 7.2 Direct Mode Output

```bash
$ pnpm cli --help

  Hospeda CLI v1.0.0

  Usage: pnpm cli [command] [options] [-- extra-args]

  Options:
    -h, --help       Show this help message
    -l, --list       List all curated commands
    -la, --list-all  List all discovered commands
    -y, --yes        Skip confirmation for dangerous commands

  Development:
    dev              Start all apps via turbo
    dev:all          Start all dev servers with Docker check
    dev:admin        Start admin with Vite cache clearing
    pgadmin:start    Start pgAdmin container
    pgadmin:stop     Stop pgAdmin container

  Database:
    db:start         Start PostgreSQL + Redis containers
    db:stop          Stop database containers
    ...

  Run 'pnpm cli <command>' to execute directly.
  Run 'pnpm cli' with no arguments for interactive mode.
```

#### 7.3 List Mode Output

```bash
$ pnpm cli --list
dev              Start all apps via turbo
dev:all          Start all dev servers with Docker check
db:start         Start PostgreSQL + Redis containers
...

$ pnpm cli --list --all
# Shows ALL discovered commands including per-package ones
dev              Start all apps via turbo                         [root]
dev:all          Start all dev servers with Docker check          [root]
api:dev          Start API dev server                             [api]
admin:dev        Start admin dev server                           [admin]
web:dev          Start web dev server                             [web]
db:build         Build @repo/db package                           [@repo/db]
schemas:build    Build @repo/schemas package                      [@repo/schemas]
...
```

### 8. Testing Strategy

#### 8.1 Unit Tests

| Module | What to test |
|--------|-------------|
| `registry.ts` | All curated commands have required fields; no duplicate IDs; all dangerous commands have dangerMessage |
| `discovery.ts` | Correctly reads mock package.json files; generates correct command IDs with prefixes; excludes noise scripts; merges with curated without duplicates |
| `search.ts` | Fuzzy search returns expected results for common queries ("test", "db", "lint"); ranking is sensible; empty query returns all curated commands |
| `categories.ts` | All categories have display names; auto-categorization rules work correctly |
| `history.ts` | Read/write roundtrip; corrupt file handling; max entries enforcement; upsert logic; sorting by lastRun |
| `format.ts` | Help output format; list output format; banner format |
| `direct.ts` | Argument parsing (--help, --list, --yes, --); command lookup (exact, fuzzy fallback) |
| `runner.ts` | Command construction for each execution type (pnpm-root, pnpm-filter, shell); extra args appended correctly |

#### 8.2 Integration Tests

| Test | Description |
|------|-------------|
| Command execution | Mock `child_process.spawn`, verify correct command/args/cwd are passed for each execution type |
| Auto-discovery integration | Create temp directory with mock package.json files, verify full discovery pipeline |
| History persistence | Write history to temp file, read back, verify consistency |

#### 8.3 Test Location

```
scripts/cli/__tests__/
  registry.test.ts
  discovery.test.ts
  search.test.ts
  categories.test.ts
  history.test.ts
  format.test.ts
  direct.test.ts
  runner.test.ts
```

Vitest config: Create a dedicated `scripts/cli/vitest.config.ts` that includes `scripts/cli/__tests__/**` in its test patterns. The root vitest.config.ts does not include `scripts/` in its test paths.

```typescript
// scripts/cli/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    coverage: {
      include: ["*.ts"],
      exclude: ["__tests__/**", "vitest.config.ts"],
    },
  },
});
```

Add a script to root package.json for running CLI tests:
```json
{
  "scripts": {
    "test:cli": "vitest run --config scripts/cli/vitest.config.ts"
  }
}
```

#### 8.4 Coverage Target

Minimum 90% line coverage for all modules except `interactive.ts` (which depends on TTY input and is tested manually).

### 9. Dependencies

| Dependency | Purpose | Status | Justification |
|------------|---------|--------|---------------|
| `@inquirer/prompts` | Interactive terminal UI (search, select, confirm) | **Already installed** (`^8.3.0` in root devDependencies) | Used by env scripts; supports search prompt with custom filter function and separators for category grouping |
| `fuse.js` | Fuzzy search | **New devDependency** | Standard fuzzy search library (8.3M weekly downloads), zero dependencies, ~5KB gzipped, Apache-2.0 license. Ships with TypeScript types (`dist/fuse.d.ts`), no `@types/fuse.js` needed. **Uses default export** (exception to named-exports-only policy). Current version: 7.1.0 |

No other new dependencies required. `node:child_process`, `node:fs/promises`, `node:path`, `node:url` are Node.js built-ins. The `glob` package (already installed as root devDependency `^11.1.0`) is used for auto-discovery.

### 10. Migration & Rollout

1. Install `fuse.js` as devDependency in root package.json (`pnpm add -Dw fuse.js`)
2. Add biome override for `scripts/cli/` to allow `console.log` (see section 10.1)
3. Create `scripts/cli/` directory with all modules
4. Create `scripts/cli.ts` entry point
5. Create `scripts/cli/vitest.config.ts` for CLI tests
6. Add `"cli": "tsx scripts/cli.ts"` and `"test:cli": "vitest run --config scripts/cli/vitest.config.ts"` to root package.json scripts
7. Add `.cli-history.json` to root `.gitignore`
8. Update CLAUDE.md "Key Commands" section to mention `pnpm cli`
9. No breaking changes.. all existing `pnpm <script>` commands continue working unchanged

#### 10.1 Biome Override for CLI Scripts

The project has `"noConsoleLog": "error"` globally. CLI tools need `console.log` for user-facing output. Add this override to `packages/biome-config/biome.json` in the `overrides` array (following the same pattern used for seed files):

```json
{
  "include": ["./scripts/cli/**"],
  "linter": {
    "rules": {
      "suspicious": {
        "noConsoleLog": "off"
      }
    }
  }
}
```

This is consistent with the existing override for `./packages/db/src/seeds/**`.

### 11. Gitignore Updates

Add to root `.gitignore`:
```
# CLI tool history
.cli-history.json
```

## Part 2 .. Curated Command Registry

This section defines the complete curated registry. These commands appear in the interactive menu. Auto-discovered commands that don't match any of these IDs are accessible via search and direct mode but don't appear in the main menu.

### Development (5 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `dev` | Start all apps via turbo | `pnpm-root: dev` | long-running | No |
| `dev:all` | Start all dev servers with Docker check | `shell: ./scripts/dev.sh` | long-running | No |
| `dev:admin` | Start admin with Vite cache clearing | `shell: node scripts/dev-admin.js` | long-running | No |
| `pgadmin:start` | Start pgAdmin container | `pnpm-root: pgadmin:start` | one-shot | No |
| `pgadmin:stop` | Stop pgAdmin container | `pnpm-root: pgadmin:stop` | one-shot | No |

### Database (13 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `db:start` | Start PostgreSQL + Redis containers | `pnpm-root: db:start` | one-shot | No |
| `db:stop` | Stop database containers | `pnpm-root: db:stop` | one-shot | No |
| `db:restart` | Restart database containers | `pnpm-root: db:restart` | one-shot | No |
| `db:reset` | Drop volumes + recreate + migrate | `pnpm-root: db:reset` | one-shot | **Yes**: "DROP all database volumes, recreate containers, and run migrations. All data will be lost." |
| `db:fresh` | Drop + recreate + migrate + seed | `pnpm-root: db:fresh` | one-shot | **Yes**: "DROP all database volumes, recreate containers, run migrations, and seed. All data will be lost." |
| `db:fresh-dev` | Drop + recreate + push schema + seed | `pnpm-root: db:fresh-dev` | one-shot | **Yes**: "DROP all database volumes, recreate containers, push schema, and seed. All data will be lost." |
| `db:logs` | Stream PostgreSQL container logs | `pnpm-root: db:logs` | long-running | No |
| `db:migrate` | Apply pending Drizzle migrations | `pnpm-root: db:migrate` | one-shot | No |
| `db:migrate:prod` | Run production migration with backup | `pnpm-root: db:migrate:prod` | interactive | **Yes**: "Run migrations against the PRODUCTION database. Make sure you have a backup." |
| `db:generate` | Generate migration from schema changes | `pnpm-root: db:generate` | one-shot | No |
| `db:studio` | Open Drizzle Studio | `pnpm-root: db:studio` | long-running | No |
| `db:seed` | Reset + seed required + example data | `pnpm-root: db:seed` | one-shot | No |
| `db:push` | Push schema directly (no migration) | `pnpm-filter: @repo/db db:push` | one-shot | No |

### Testing (5 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `test` | Run all tests (turbo, 4 concurrent) | `pnpm-root: test` | one-shot | No |
| `test:watch` | Run tests in watch mode | `pnpm-root: test:watch` | long-running | No |
| `test:coverage` | Run tests with coverage report | `pnpm-root: test:coverage` | one-shot | No |
| `api:test:e2e` | Run API E2E tests (Vitest E2E config) | `pnpm-filter: hospeda-api test:e2e` | one-shot | No |
| `api:test:e2e:watch` | Run API E2E tests in watch mode | `pnpm-filter: hospeda-api test:e2e:watch` | long-running | No |

### Code Quality (7 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `lint` | Run Biome linting (turbo) | `pnpm-root: lint` | one-shot | No |
| `format` | Run Biome formatting (turbo) | `pnpm-root: format` | one-shot | No |
| `check` | Biome check + auto-fix | `pnpm-root: check` | one-shot | No |
| `typecheck` | TypeScript validation (all packages) | `pnpm-root: typecheck` | one-shot | No |
| `format:md` | Format all markdown files | `pnpm-root: format:md` | one-shot | No |
| `lint:md` | Lint all markdown files | `pnpm-root: lint:md` | one-shot | No |
| `lint:md:docs` | Lint only docs/ markdown files | `pnpm-root: lint:md:docs` | one-shot | No |

### Build (3 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `build` | Build all packages (turbo) | `pnpm-root: build` | one-shot | No |
| `build:api` | Build API for production | `pnpm-root: build:api` | one-shot | No |
| `clean` | Remove all build artifacts | `pnpm-root: clean` | one-shot | **Yes**: "Remove all build artifacts (dist/, .output/, node_modules/.cache/) across the monorepo." |

### Environment (3 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `env:pull` | Pull env vars from Vercel to local | `pnpm-root: env:pull` | interactive | No |
| `env:push` | Push local env vars to Vercel | `pnpm-root: env:push` | interactive | No |
| `env:check` | Validate env vars against registry | `pnpm-root: env:check` | one-shot | No |

### Documentation (3 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `docs:check-links` | Validate internal links in markdown docs | `pnpm-root: docs:check-links` | one-shot | No |
| `docs:validate-examples` | Validate TypeScript code blocks in docs | `pnpm-root: docs:validate-examples` | one-shot | No |
| `create-docs-structure` | Generate documentation folder structure | `shell: tsx scripts/create-docs-structure.ts` | one-shot | No |

### Infrastructure (1 command)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `setup-test-db` | Initialize test database on port 5433 | `shell: tsx scripts/setup-test-db.ts` | one-shot | No |

> **Note**: Production migration is covered by `db:migrate:prod` in the Database category (which runs `bash scripts/migrate-production.sh` via the root `db:migrate:prod` script). No separate `migrate-production` entry is needed to avoid duplication.

### Package Tools (5 commands)

| ID | Description | Execution | Mode | Dangerous |
|----|-------------|-----------|------|-----------|
| `seed` | Interactive seeding CLI | `pnpm-filter: @repo/seed seed` | interactive | No |
| `seed:required` | Seed only system/required data | `pnpm-filter: @repo/seed seed:required` | one-shot | No |
| `seed:example` | Seed example/demo data | `pnpm-filter: @repo/seed seed:example` | one-shot | No |
| `i18n:generate-types` | Generate TS types from locale files | `pnpm-filter: @repo/i18n generate-types` | one-shot | No |
| `telemetry:report` | Generate Claude Code telemetry report | `pnpm-root: telemetry:report` | one-shot | No |

**Total curated commands: 45** (5 Development + 13 Database + 5 Testing + 7 Code Quality + 3 Build + 3 Environment + 3 Documentation + 1 Infrastructure + 5 Package Tools)

## Part 3 .. Complete Script Inventory (as of 2026-03-09)

This section documents the actual state of all scripts in the monorepo for reference and validation.

### Root Scripts (38)

| Script | Command | Category |
|--------|---------|----------|
| `build` | `turbo run build` | build |
| `dev` | `turbo run dev` | development |
| `dev:all` | `./scripts/dev.sh` | development |
| `dev:admin` | `node scripts/dev-admin.js` | development |
| `lint` | `turbo run lint` | code-quality |
| `format` | `turbo run format` | code-quality |
| `clean` | `turbo run clean` | build |
| `test` | `turbo run test --concurrency=4` | testing |
| `test:watch` | `turbo run test:watch --concurrency=4` | testing |
| `test:coverage` | `turbo run test:coverage --concurrency=4` | testing |
| `check` | `biome check --write .` | code-quality |
| `typecheck` | `turbo run typecheck` | code-quality |
| `format:md` | `markdownlint-cli2 '**/*.md' --fix` | code-quality |
| `format:md:claude` | `markdownlint-cli2 '.claude/**/*.md' --fix` | code-quality |
| `lint:md` | `markdownlint-cli2 '**/*.md'` | code-quality |
| `lint:md:docs` | `markdownlint-cli2 "docs/**/*.md" "apps/**/docs/**/*.md" "packages/**/docs/**/*.md"` | code-quality |
| `prepare` | `husky install` | (excluded) |
| `build:api` | `pnpm --filter hospeda-api build` | build |
| `db:start` | `docker compose --env-file docker/.env up -d postgres redis` | database |
| `db:stop` | `docker compose --env-file docker/.env stop postgres redis` | database |
| `db:restart` | `pnpm db:stop && pnpm db:start` | database |
| `db:reset` | `docker compose ... down -v && ... up -d && sleep 10 && pnpm db:migrate` | database |
| `db:fresh` | `docker compose ... down -v && ... up -d && sleep 10 && pnpm db:generate && pnpm db:migrate && pnpm db:seed` | database |
| `db:fresh-dev` | `docker compose ... down -v && ... up -d && sleep 10 && pnpm --filter @repo/db db:push && pnpm db:seed` | database |
| `db:logs` | `docker compose --env-file docker/.env logs -f postgres` | database |
| `db:migrate` | `pnpm --filter @repo/db db:migrate` | database |
| `db:migrate:prod` | `bash scripts/migrate-production.sh` | database |
| `db:generate` | `pnpm --filter @repo/db db:generate` | database |
| `db:studio` | `pnpm --filter @repo/db db:studio` | database |
| `db:seed` | `pnpm --filter @repo/seed seed --reset --required --example` | database |
| `pgadmin:start` | `docker compose --env-file docker/.env up -d pgadmin` | infrastructure |
| `pgadmin:stop` | `docker compose --env-file docker/.env stop pgadmin` | infrastructure |
| `telemetry:report` | `tsx .claude/scripts/telemetry-report.ts` | package-tools |
| `docs:check-links` | `tsx scripts/check-links.ts` | documentation |
| `docs:validate-examples` | `tsx scripts/validate-examples.ts` | documentation |
| `env:pull` | `tsx scripts/env/pull.ts` | environment |
| `env:push` | `tsx scripts/env/push.ts` | environment |
| `env:check` | `tsx scripts/env/check.ts` | environment |

### Standalone Scripts (12)

| File | Type | Description | Invoked via |
|------|------|-------------|-------------|
| `scripts/dev.sh` | Bash | Dev startup with Docker verification and port checks | `pnpm dev:all` (root script) |
| `scripts/dev-all.js` | Node.js ESM | Multi-server runner with per-app flags and color output | Called by `dev.sh` |
| `scripts/dev-admin.js` | Node.js ESM | Admin dev with Vite cache auto-clearing | `pnpm dev:admin` (root script) |
| `scripts/migrate-production.sh` | Bash | Production migration with backup, dry-run support | `pnpm db:migrate:prod` (root script) |
| `scripts/check-links.ts` | TypeScript | Validates internal links across all markdown docs | `pnpm docs:check-links` (root script) |
| `scripts/validate-examples.ts` | TypeScript | Validates TypeScript code blocks in markdown docs | `pnpm docs:validate-examples` (root script) |
| `scripts/setup-test-db.ts` | TypeScript | Initializes test database on port 5433 | Direct: `tsx scripts/setup-test-db.ts` |
| `scripts/create-docs-structure.ts` | TypeScript | Generates documentation folder structure with templates | Direct: `tsx scripts/create-docs-structure.ts` |
| `scripts/fix-markdown-non-code-errors.cjs` | CommonJS | Fixes common markdownlint errors outside code blocks | Direct: `node scripts/fix-markdown-non-code-errors.cjs` |
| `scripts/env/pull.ts` | TypeScript | Pull env vars from Vercel to local .env.local | `pnpm env:pull` (root script) |
| `scripts/env/push.ts` | TypeScript | Push local env vars to Vercel | `pnpm env:push` (root script) |
| `scripts/env/check.ts` | TypeScript | Audit env vars against registry and Vercel | `pnpm env:check` (root script) |

### App-Specific Scripts

#### apps/api - hospeda-api (17 scripts)

| Script | Command | Notes |
|--------|---------|-------|
| `dev` | `tsx watch src/index.ts` | Dev server with file watching |
| `build` | `tsup` | Production build via tsup |
| `start` | `node dist/index.js` | Production start |
| `clean` | `rm -rf dist` | Remove build artifacts |
| `lint` | `biome check .` | Linting |
| `format` | `biome format --write .` | Formatting |
| `typecheck` | `tsc --noEmit` | Type checking |
| `test` | `vitest run --passWithNoTests` | Unit tests |
| `test:watch` | `vitest` | Watch mode |
| `test:file` | `vitest run` | Run specific test file |
| `test:coverage` | `vitest run --coverage` | Coverage report |
| `test:cache` | `node test-cache.js` | Cache testing utility |
| `test:e2e` | `pnpm run build:deps && vitest run --config vitest.config.e2e.ts` | E2E tests (Vitest E2E config) |
| `test:e2e:watch` | `vitest --config vitest.config.e2e.ts` | E2E watch mode |
| `test:sandbox` | `vitest run --config test/e2e/sandbox/vitest.config.sandbox.ts` | Sandbox tests |
| `test:sandbox:watch` | `vitest --config test/e2e/sandbox/vitest.config.sandbox.ts` | Sandbox watch |
| `build:deps` | (builds dependency packages) | Pre-build step for E2E |

#### apps/admin - admin (16 scripts)

> **Note**: The admin package name is `"admin"` (not `"hospeda-admin"`). The `getPackagePrefix` function handles this correctly by returning the name as-is.

| Script | Command | Notes |
|--------|---------|-------|
| `dev` | `vite dev --port 3000` | Vite dev server on port 3000 |
| `dev:clean` | `rm -rf node_modules/.vite && pnpm dev` | Clear Vite cache + dev |
| `dev:watch` | `nodemon --watch '../../packages' ... & pnpm dev` | Watch packages for changes |
| `start` | `node .output/server/index.mjs` | Production server |
| `build` | `vite build` | Vite production build |
| `serve` | `vite preview` | Preview built app |
| `test` | `vitest run --passWithNoTests` | Unit tests |
| `test:watch` | `vitest` | Watch mode |
| `test:coverage` | `vitest run --coverage` | Coverage report |
| `test:ui` | `vitest --ui` | Vitest UI |
| `check` | `biome check` | Biome check |
| `clean` | `rm -rf node_modules dist` | Remove build artifacts |
| `clean:cache` | `rm -rf node_modules/.vite` | Clear Vite cache only |
| `lint` | `biome check .` | Linting |
| `format` | `biome format --write .` | Formatting |
| `typecheck` | `tsc --noEmit --project ./tsconfig.json` | Type checking |

#### apps/web - hospeda-web (10 scripts)

| Script | Command | Notes |
|--------|---------|-------|
| `dev` | `astro dev --port 4321` | Astro dev server on port 4321 |
| `build` | `astro build` | Astro SSR build |
| `preview` | `astro preview --port 4321` | Preview built site |
| `test` | `vitest run --passWithNoTests` | Unit tests |
| `test:watch` | `vitest` | Watch mode |
| `test:coverage` | `vitest run --coverage` | Coverage report |
| `lint` | `biome check .` | Linting |
| `format` | `biome format --write .` | Formatting |
| `typecheck` | `tsc --noEmit --project ./tsconfig.json` | Type checking |
| `clean` | `rm -rf node_modules dist .astro` | Remove build artifacts |

### Package Scripts (16 active packages)

Most packages share a common set of scripts. Rather than listing each individually, here are the patterns:

| Package | Unique/Notable Scripts |
|---------|----------------------|
| `@repo/db` | `db:migrate`, `db:push`, `db:drop`, `db:studio`, `db:generate`, `db:check` |
| `@repo/seed` | `seed`, `seed:required`, `seed:example` |
| `@repo/i18n` | `generate-types` |
| `@repo/schemas` | `test:coverage` |
| `@repo/auth-ui` | `test:coverage` |

Common scripts present in most packages (auto-discovered but NOT curated):
- `build` (tsc)
- `dev` (tsc --watch)
- `test` (vitest run)
- `test:watch` (vitest watch)
- `typecheck` (tsc --noEmit)
- `lint` (biome check .)
- `format` (biome format --write .)
- `check` (biome check --write .)
- `clean` (rm -rf node_modules && rm -rf dist)

These are auto-discovered with IDs like `db:build`, `schemas:test`, `logger:lint`, etc. They don't appear in the curated menu but are accessible via search and direct mode.

## Part 4 .. Implementation Notes

### 4.1 @inquirer/search Prompt Usage

The interactive menu uses `@inquirer/search` which provides a text input that filters a list of choices. Here's the conceptual approach:

```typescript
import { search, confirm } from "@inquirer/prompts";
import { Separator } from "@inquirer/prompts";

// Build choices array with category separators
const choices = [
  new Separator("── Recent ──"),
  ...recentCommands.map(cmd => ({
    name: formatCommandLine(cmd), // "db:start         Start PostgreSQL + Redis containers  [root]"
    value: cmd.id,
    description: cmd.description,
  })),
  new Separator("── Development ──"),
  ...developmentCommands.map(cmd => ({ ... })),
  // ... more categories
];

// Use search prompt with custom Fuse.js filter
// source signature: (term: string | void, { signal: AbortSignal }) => Promise<Choice[]>
// - term is undefined when search field is empty
// - signal can be used to cancel in-flight async operations (not needed here since Fuse.js is sync)
const selectedId = await search({
  message: "Select a command (type to search):",
  source: async (input, { signal: _signal }) => {
    if (!input) return choices; // Show all curated when no input
    const results = fuse.search(input);
    return results.map(r => ({
      name: formatCommandLine(r.item),
      value: r.item.id,
    }));
  },
});
```

### 4.2 Signal Handling

```typescript
import { spawn } from "node:child_process";

function runCommand(cmd: CliCommand, extraArgs: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const { command, args, cwd } = buildSpawnArgs(cmd, extraArgs);

    const child = spawn(command, args, {
      stdio: "inherit",
      cwd,
      shell: true, // Required for pnpm scripts and bash scripts
    });

    // Forward signals to child
    const handleSignal = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };
    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);

    child.on("close", (code, signal) => {
      process.off("SIGINT", handleSignal);
      process.off("SIGTERM", handleSignal);

      if (signal === "SIGINT") resolve(130);
      else if (signal === "SIGTERM") resolve(143);
      else resolve(code ?? 1);
    });
  });
}
```

### 4.3 Command Construction

```typescript
function buildSpawnArgs(
  cmd: CliCommand,
  extraArgs: readonly string[]
): { command: string; args: string[]; cwd: string } {
  const root = findMonorepoRoot(); // Uses import.meta.url to find repo root

  switch (cmd.execution.type) {
    case "pnpm-root":
      return {
        command: "pnpm",
        args: ["run", cmd.execution.script, ...(extraArgs.length ? ["--", ...extraArgs] : [])],
        cwd: root,
      };
    case "pnpm-filter":
      return {
        command: "pnpm",
        args: [
          "--filter", cmd.execution.filter,
          cmd.execution.script,
          ...(extraArgs.length ? ["--", ...extraArgs] : []),
        ],
        cwd: root,
      };
    case "shell":
      return {
        command: cmd.execution.command,
        args: [...extraArgs],
        cwd: root,
      };
  }
}
```

### 4.4 Auto-Discovery Implementation

```typescript
import { readFile } from "node:fs/promises";
import { glob } from "glob"; // Already installed in root devDeps

async function discoverCommands(): Promise<CliCommand[]> {
  // 1. Read workspace config
  // pnpm-workspace.yaml is simple enough to parse without a YAML library.
  // Format is always: `packages:\n  - "pattern1"\n  - "pattern2"`
  const workspaceYaml = await readFile("pnpm-workspace.yaml", "utf-8");
  const patterns = parseWorkspacePatterns(workspaceYaml);

  // 2. Find all package.json files
  const packageJsonPaths = await glob(
    patterns.map(p => `${p}/package.json`),
    { ignore: ["**/node_modules/**"] }
  );

  // 3. Read all in parallel
  const packages = await Promise.all(
    packageJsonPaths.map(async (path) => {
      const content = await readFile(path, "utf-8");
      const pkg = JSON.parse(content);
      return { path, name: pkg.name, scripts: pkg.scripts ?? {} };
    })
  );

  // 4. Generate CliCommand for each script
  const commands: CliCommand[] = [];
  for (const pkg of packages) {
    const prefix = getPackagePrefix(pkg.name); // "api", "admin", "web", "db", "schemas", etc.
    for (const [script, _command] of Object.entries(pkg.scripts)) {
      if (isExcludedScript(script)) continue;
      const id = `${prefix}:${script}`;
      commands.push({
        id,
        description: "(auto-discovered)",
        category: inferCategory(script),
        execution: { type: "pnpm-filter", filter: pkg.name, script },
        source: pkg.name,
        mode: inferMode(script),
        curated: false,
      });
    }
  }

  return commands;
}

function getPackagePrefix(name: string): string {
  // "@repo/db" -> "db", "@repo/schemas" -> "schemas"
  // "hospeda-api" -> "api", "hospeda-web" -> "web"
  // "admin" -> "admin" (note: admin package name has no "hospeda-" prefix)
  if (name.startsWith("@repo/")) return name.replace("@repo/", "");
  if (name.startsWith("hospeda-")) return name.replace("hospeda-", "");
  return name; // Handles "admin" and any other unprefixed package names
}

/**
 * Parse workspace glob patterns from pnpm-workspace.yaml content.
 * Uses simple regex instead of a YAML parser since the file format is trivial.
 * Expected format: `packages:\n  - "apps/*"\n  - "packages/*"`
 */
function parseWorkspacePatterns(content: string): string[] {
  const matches = content.match(/-\s+["']([^"']+)["']/g);
  if (!matches) return [];
  return matches.map(m => {
    const match = m.match(/-\s+["']([^"']+)["']/);
    return match?.[1] ?? "";
  }).filter(Boolean);
}

const EXCLUDED_SCRIPTS = new Set(["prepare", "preinstall", "postinstall"]);

function isExcludedScript(script: string): boolean {
  return EXCLUDED_SCRIPTS.has(script);
}
```

### 4.5 History File Operations

```typescript
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";

const HISTORY_PATH = join(findMonorepoRoot(), ".cli-history.json");
const MAX_ENTRIES = 20;

async function readHistory(): Promise<CliHistory> {
  try {
    const content = await readFile(HISTORY_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed.version !== 1) throw new Error("Unknown version");
    return parsed;
  } catch {
    return { version: 1, entries: [] };
  }
}

async function recordCommand(id: string): Promise<void> {
  const history = await readHistory();
  const existing = history.entries.find(e => e.id === id);

  const updated: CliHistoryEntry = existing
    ? { id, lastRun: new Date().toISOString(), runCount: existing.runCount + 1 }
    : { id, lastRun: new Date().toISOString(), runCount: 1 };

  const entries = [
    updated,
    ...history.entries.filter(e => e.id !== id),
  ].slice(0, MAX_ENTRIES);

  // Atomic write: write to temp file, then rename
  const tmpPath = `${HISTORY_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify({ version: 1, entries }, null, 2));
  await rename(tmpPath, HISTORY_PATH);
}
```

### 4.6 Ctrl+C / ExitPromptError Handling

When the user presses Ctrl+C during any `@inquirer/prompts` prompt (search, select, confirm), the library throws an `ExitPromptError`. Without handling this, the CLI would print a stack trace. The main loop must catch this error and exit cleanly:

```typescript
import { ExitPromptError } from "@inquirer/prompts";

async function main(): Promise<void> {
  try {
    // ... arg parsing, interactive/direct routing ...
    await runInteractiveLoop(commands, history);
  } catch (error: unknown) {
    if (error instanceof ExitPromptError) {
      // User pressed Ctrl+C during a prompt. Exit cleanly.
      process.exit(0);
    }
    // Re-throw unexpected errors
    throw error;
  }
}
```

This pattern should wrap ALL prompt calls (search, confirm for dangerous commands, etc.). The simplest approach is to have a single try/catch at the top level in `main.ts`.

### 4.7 Argument Pass-Through Details

When the user runs `pnpm cli dev:all -- --api-only`, pnpm consumes the first `--` separator and passes `['--api-only']` as `process.argv` to the CLI script. The CLI then constructs the target command:

- **`pnpm-root` type**: `pnpm run dev:all -- --api-only` (pnpm passes everything after `--` to the underlying script)
- **`pnpm-filter` type**: `pnpm --filter @repo/seed seed -- --required` (same pnpm behavior)
- **`shell` type**: `./scripts/dev.sh --api-only` (args appended directly, no `--` separator needed)

The double-`--` handling is automatic because pnpm itself strips the first `--` before our CLI receives the args. The runner code in section 4.3 handles this correctly.
