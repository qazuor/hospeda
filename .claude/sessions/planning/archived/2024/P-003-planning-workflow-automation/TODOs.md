# TODOs - GitHub Workflow Automation

**Planning Code:** P-003
**Feature:** GitHub Workflow Automation System
**Status:** Implementation Phase (Phase 5: Integration)
**Created:** 2025-01-31
**Last Updated:** 2025-11-01

---

## Phase 1: Foundation (Week 1, Days 1-3)

### T-003-001: Project setup and package structure

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 4 hours
**Phase:** 1 - Foundation
**Completed:** 2025-11-01

**Description:**

Create the new `@repo/github-workflow` package with proper structure, dependencies, and configuration.

**Tasks:**

- [ ] Create `packages/github-workflow/` directory structure
- [ ] Initialize `package.json` with dependencies
- [ ] Setup TypeScript configuration
- [ ] Configure Vitest for testing
- [ ] Add package to workspace and Turbo config
- [ ] Create barrel files (`index.ts`)

**Acceptance Criteria:**

- Package builds successfully with `pnpm build`
- Tests run with `pnpm test`
- Package is properly integrated in monorepo
- All dependencies installed and typed

**Related Files:**

- `packages/github-workflow/package.json`
- `packages/github-workflow/tsconfig.json`
- `packages/github-workflow/vitest.config.ts`

---

### T-003-002: GitHub client implementation

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 8 hours
**Phase:** 1 - Foundation
**Completed:** 2025-11-01

**Description:**

Implement the GitHub client using Octokit with GraphQL API support for Projects v2, issues, and labels.

**Tasks:**

- [ ] Create `GitHubClient` class with Octokit integration
- [ ] Implement GraphQL mutations for Projects v2
- [ ] Implement issue CRUD operations
- [ ] Implement label management with caching
- [ ] Add rate limiting support
- [ ] Write unit tests (90%+ coverage)

**Acceptance Criteria:**

- Can create and manage GitHub Projects v2
- Can create, update, and link issues
- Can manage labels efficiently with cache
- Rate limiting prevents API throttling
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/core/github-client.ts`
- `packages/github-workflow/test/core/github-client.test.ts`

---

### T-003-003: Configuration system

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 4 hours
**Phase:** 1 - Foundation
**Completed:** 2025-11-01

**Description:**

Create configuration system using Zod schemas and cosmiconfig for flexible configuration loading.

**Tasks:**

- [ ] Define Zod schemas for all config sections
- [ ] Implement config loader with cosmiconfig
- [ ] Add environment variable support
- [ ] Create default configuration
- [ ] Add validation and error messages
- [ ] Write unit tests

**Acceptance Criteria:**

- Config loads from multiple sources (file, env vars)
- Validation catches invalid configurations
- Clear error messages for config issues
- Type-safe configuration object
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/config/config.ts`
- `packages/github-workflow/test/config/config.test.ts`
- `.github-workflow.config.js` (example)

---

## Phase 2: Core Parsers (Week 1, Days 3-5)

### T-003-004: Planning session parser (PDR/TODOs)

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 6 hours
**Phase:** 2 - Parsers
**Completed:** 2025-11-01

**Description:**

Migrate and enhance planning session parser from `planning-sync` package to parse PDR.md and TODOs.md files.

**Tasks:**

- [ ] Migrate parser code from `planning-sync/src/parser.ts`
- [ ] Enhance PDR parser for feature name and summary
- [ ] Enhance TODOs parser for all task statuses
- [ ] Add task code generation logic
- [ ] Add markdown update functions
- [ ] Write unit tests (90%+ coverage)

**Acceptance Criteria:**

- Parses PDR.md correctly (feature name, summary)
- Parses TODOs.md with all statuses (pending, in_progress, completed)
- Generates unique task codes (T-XXX-XXX)
- Can update TODOs.md with GitHub links
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/core/planning-parser.ts`
- `packages/github-workflow/test/core/planning-parser.test.ts`

---

### T-003-005: Code comment parser (TODO/HACK/DEBUG)

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 6 hours
**Phase:** 2 - Parsers
**Completed:** 2025-11-01

**Description:**

Migrate and enhance code comment parser from `tools-todo-linear` to parse TODO, HACK, and DEBUG comments.

**Tasks:**

- [ ] Migrate parser from `tools-todo-linear/src/core/parser.ts`
- [ ] Support TODO, HACK, DEBUG comment types
- [ ] Extract priority markers ([HIGH], [MEDIUM], [LOW])
- [ ] Extract labels (#bug, #feature, etc)
- [ ] Extract assignee (@username)
- [ ] Write unit tests (90%+ coverage)

**Acceptance Criteria:**

- Parses all comment types (TODO, HACK, DEBUG)
- Extracts metadata (priority, labels, assignee)
- Handles multi-line comments
- Works across file types (ts, tsx, js, etc)
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/core/todo-parser.ts`
- `packages/github-workflow/test/core/todo-parser.test.ts`

---

### T-003-006: Tracking system

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 6 hours
**Phase:** 2 - Parsers
**Completed:** 2025-11-01

**Description:**

Implement JSON-based tracking system to maintain state of synced items (planning sessions and TODOs).

**Tasks:**

- [ ] Create `TrackingManager` class
- [ ] Implement JSON persistence (`.github-workflow/tracking.json`)
- [ ] Add CRUD operations for tracked items
- [ ] Add state management (pending, synced, closed)
- [ ] Add retry logic for failed syncs
- [ ] Write unit tests (90%+ coverage)

**Acceptance Criteria:**

- Tracks planning sessions and TODOs
- Persists state to JSON file
- Supports state transitions
- Handles concurrent updates safely
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/core/tracking.ts`
- `packages/github-workflow/test/core/tracking.test.ts`
- `.github-workflow/tracking.json` (runtime)

---

## Phase 3: Synchronization (Week 2, Days 1-4)

### T-003-007: Planning sync implementation

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 8 hours
**Phase:** 3 - Synchronization
**Completed:** 2025-11-01

**Description:**

Implement planning session synchronization to create GitHub Projects and issues from PDR/TODOs.

**Tasks:**

- [ ] Create `PlanningSync` class
- [ ] Implement sync logic (parse → create → update → track)
- [ ] Create parent issue from PDR
- [ ] Create sub-issues from TODOs
- [ ] Link issues to parent
- [ ] Update TODOs.md with GitHub links
- [ ] Write integration tests

**Acceptance Criteria:**

- Creates GitHub Project for planning session
- Creates parent issue with PDR summary
- Creates sub-issues for each task
- Links issues correctly (parent-child)
- Updates TODOs.md with issue links
- Integration tests pass

**Related Files:**

- `packages/github-workflow/src/sync/planning-sync.ts`
- `packages/github-workflow/test/sync/planning-sync.integration.test.ts`

---

### T-003-008: TODO sync implementation

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 8 hours
**Phase:** 3 - Synchronization
**Completed:** 2025-11-01

**Description:**

Implement code comment synchronization to create and update GitHub issues from TODO/HACK/DEBUG comments.

**Tasks:**

- [ ] Create `TodoSync` class
- [ ] Implement file scanning integration
- [ ] Implement classification logic (create/update/close)
- [ ] Sync TODOs to GitHub issues
- [ ] Update comments with GitHub issue links
- [ ] Handle batch processing (max 5 concurrent)
- [ ] Write integration tests

**Acceptance Criteria:**

- Scans codebase for TODO comments
- Creates issues for new TODOs
- Updates existing issues when TODOs change
- Closes issues when TODOs removed
- Batch processes efficiently
- Integration tests pass

**Related Files:**

- `packages/github-workflow/src/sync/todo-sync.ts`
- `packages/github-workflow/test/sync/todo-sync.integration.test.ts`

---

### T-003-009: Completion detection system

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 6 hours
**Phase:** 3 - Synchronization
**Completed:** 2025-11-01

**Description:**

Implement task completion detection by parsing git commit messages for task codes.

**Tasks:**

- [ ] Create `CompletionDetector` class
- [ ] Parse commit messages for task codes
- [ ] Verify required files exist
- [ ] Update task status in TODOs.md
- [ ] Close corresponding GitHub issues
- [ ] Write unit and integration tests

**Acceptance Criteria:**

- Detects task codes in commit messages
- Validates task completion (required files exist)
- Updates TODOs.md automatically
- Closes GitHub issues automatically
- Tests cover edge cases

**Related Files:**

- `packages/github-workflow/src/sync/completion-detector.ts`
- `packages/github-workflow/test/sync/completion-detector.test.ts`

---

## Phase 4: Enrichment (Week 2, Days 4-5)

### T-003-010: Claude Code integration

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 6 hours
**Phase:** 4 - Enrichment
**Completed:** 2025-11-01

**Description:**

Integrate Claude Code agent for enriching TODOs with context analysis and implementation suggestions.

**Tasks:**

- [ ] Create `ClaudeAgent` class
- [ ] Implement Task tool invocation
- [ ] Build analysis prompts
- [ ] Parse Claude responses
- [ ] Add enrichment to GitHub issues
- [ ] Write unit tests

**Acceptance Criteria:**

- Invokes Claude Code agent successfully
- Generates meaningful analysis
- Adds enrichment to issue descriptions
- Handles errors gracefully
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/enrichment/claude-agent.ts`
- `packages/github-workflow/test/enrichment/claude-agent.test.ts`

---

### T-003-011: Context extraction

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 4 hours
**Phase:** 4 - Enrichment
**Completed:** 2025-11-01

**Description:**

Implement context extraction to gather code context around TODOs for enrichment.

**Tasks:**

- [ ] Create `ContextExtractor` class
- [ ] Extract code snippets (configurable lines before/after)
- [ ] Extract imports and dependencies
- [ ] Find related files
- [ ] Format context for Claude agent
- [ ] Write unit tests

**Acceptance Criteria:**

- Extracts code snippets correctly
- Finds relevant imports
- Identifies related files
- Formats context readably
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/enrichment/context-extractor.ts`
- `packages/github-workflow/test/enrichment/context-extractor.test.ts`

---

## Phase 5: Integration & Commands (Week 3, Days 1-5)

### T-003-012: Claude Code commands

**Status:** [x] Completed
**Assignee:** tech-lead
**Estimate:** 8 hours
**Phase:** 5 - Integration
**Completed:** 2025-11-01

**Description:**

Create Claude Code commands for manual and automated workflow triggers.

**Tasks:**

- [x] Create `/sync-planning-github` command
- [x] Create `/sync-todos-github` command
- [x] Create `/check-completed-tasks` command
- [x] Create `/cleanup-issues` command
- [x] Add command documentation to README
- [x] Update .claude/commands/ structure

**Acceptance Criteria:**

- All commands work correctly
- Commands have proper error handling
- Commands provide clear feedback
- Documentation is complete
- E2E tests pass

**Related Files:**

- `.claude/commands/planning/sync-planning-github.md`
- `.claude/commands/planning/sync-todos-github.md`
- `.claude/commands/planning/check-completed-tasks.md`
- `.claude/commands/planning/cleanup-issues.md`
- `.claude/commands/README.md` (updated with new commands)

---

### T-003-013: Husky hooks

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 4 hours
**Phase:** 5 - Integration

**Description:**

Implement Husky git hooks for pre-commit TODO sync and post-commit completion detection.

**Tasks:**

- [ ] Create pre-commit hook script
- [ ] Create post-commit hook script
- [ ] Add hook installation to package setup
- [ ] Add configuration for enabling/disabling hooks
- [ ] Test hooks in real workflow

**Acceptance Criteria:**

- Pre-commit syncs TODOs automatically
- Post-commit detects completed tasks
- Hooks can be enabled/disabled via config
- Hooks don't block commits on errors
- Hooks work on team machines

**Related Files:**

- `packages/github-workflow/src/hooks/pre-commit.ts`
- `packages/github-workflow/src/hooks/post-commit.ts`
- `.husky/pre-commit`
- `.husky/post-commit`

---

### T-003-014: VSCode links integration

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 4 hours
**Phase:** 5 - Integration

**Description:**

Add VSCode protocol links to GitHub issues for direct file navigation.

**Tasks:**

- [ ] Implement VSCode URL generation
- [ ] Add links to issue descriptions
- [ ] Add links to TODO comments
- [ ] Support line number navigation
- [ ] Test links in VSCode

**Acceptance Criteria:**

- Links open files in VSCode correctly
- Links navigate to exact line numbers
- Links work from GitHub web interface
- Links work on different OS
- Documentation includes setup instructions

**Related Files:**

- `packages/github-workflow/src/sync/vscode-links.ts`
- `packages/github-workflow/test/sync/vscode-links.test.ts`

---

### T-003-015: Migration scripts

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 6 hours
**Phase:** 5 - Integration

**Description:**

Create migration scripts to migrate existing Linear data and old system tracking to GitHub.

**Tasks:**

- [ ] Create planning session migration script
- [ ] Create TODO tracking migration script
- [ ] Add Linear → GitHub issue migration
- [ ] Add backup/rollback functionality
- [ ] Write migration documentation

**Acceptance Criteria:**

- Migrates planning sessions from Linear to GitHub
- Migrates TODO tracking from old system
- Preserves all metadata and links
- Creates backups before migration
- Migration is idempotent
- Documentation is clear

**Related Files:**

- `packages/github-workflow/src/scripts/migrate-planning.ts`
- `packages/github-workflow/src/scripts/migrate-todos.ts`
- `packages/github-workflow/MIGRATION.md`

---

### T-003-016: Documentation

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 6 hours
**Phase:** 5 - Integration

**Description:**

Create comprehensive documentation for setup, usage, configuration, and troubleshooting.

**Tasks:**

- [ ] Write README.md with quick start
- [ ] Write SETUP.md with detailed setup guide
- [ ] Write CONFIGURATION.md with all options
- [ ] Write API.md with API reference
- [ ] Write TROUBLESHOOTING.md
- [ ] Add JSDoc to all public APIs

**Acceptance Criteria:**

- README has quick start guide
- Setup guide covers all scenarios
- Configuration guide documents all options
- API reference is complete
- Troubleshooting covers common issues
- All public APIs have JSDoc

**Related Files:**

- `packages/github-workflow/README.md`
- `packages/github-workflow/docs/SETUP.md`
- `packages/github-workflow/docs/CONFIGURATION.md`
- `packages/github-workflow/docs/API.md`
- `packages/github-workflow/docs/TROUBLESHOOTING.md`

---

### T-003-017: E2E testing and refinement

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 8 hours
**Phase:** 5 - Integration

**Description:**

Create end-to-end tests covering complete workflows and refine based on testing results.

**Tasks:**

- [ ] Create E2E test for planning sync workflow
- [ ] Create E2E test for TODO sync workflow
- [ ] Create E2E test for completion detection
- [ ] Create E2E test for migration scripts
- [ ] Run full quality checks
- [ ] Refine based on test results

**Acceptance Criteria:**

- E2E tests cover all major workflows
- Tests run in CI/CD
- Code coverage ≥ 90%
- All quality checks pass
- Performance benchmarks met
- No critical bugs

**Related Files:**

- `packages/github-workflow/test/e2e/planning-workflow.test.ts`
- `packages/github-workflow/test/e2e/todo-workflow.test.ts`
- `packages/github-workflow/test/e2e/completion-workflow.test.ts`

---

### T-003-018: Label management system

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 6 hours
**Phase:** 5 - Integration

**Description:**

Implement intelligent label management system that uses Claude Code to generate context-aware labels.

**Tasks:**

- [ ] Create `LabelManager` class
- [ ] Implement label generation using Claude Code
- [ ] Add label caching and warmup
- [ ] Add label color schemes
- [ ] Implement universal `from:claude-code` label
- [ ] Write unit tests

**Acceptance Criteria:**

- Labels are auto-generated based on context
- Claude Code suggests appropriate labels (type, priority, difficulty, impact)
- Universal `from:claude-code` label added to all issues
- Labels created if they don't exist
- Label colors follow scheme
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/core/label-manager.ts`
- `packages/github-workflow/test/core/label-manager.test.ts`

---

### T-003-019: GitHub issue templates

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 4 hours
**Phase:** 5 - Integration

**Description:**

Create GitHub issue templates for planning tasks, TODOs, and HACKs with consistent formatting.

**Tasks:**

- [ ] Create planning task template
- [ ] Create TODO template
- [ ] Create HACK template
- [ ] Implement template renderer
- [ ] Test all templates
- [ ] Add template documentation

**Acceptance Criteria:**

- Templates follow GitHub standards
- All sections properly formatted
- VSCode links included
- Claude Code enrichment section
- Templates work in GitHub UI
- Documentation complete

**Related Files:**

- `.github/ISSUE_TEMPLATE/planning-task.md`
- `.github/ISSUE_TEMPLATE/code-todo.md`
- `.github/ISSUE_TEMPLATE/code-hack.md`
- `packages/github-workflow/src/core/template-renderer.ts`

---

### T-003-020: Linear TODO cleanup tool

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 6 hours
**Phase:** 5 - Integration

**Description:**

Create tool to clean Linear IDs from TODO comments and add GitHub issue tracking persistence.

**Tasks:**

- [ ] Scan codebase for Linear IDs in TODOs
- [ ] Remove Linear IDs from comments
- [ ] Add GitHub issue numbers to comments
- [ ] Update comment updater for persistence
- [ ] Create cleanup command `/cleanup-linear-todos`
- [ ] Write tests

**Acceptance Criteria:**

- Detects all TODO comments with Linear IDs
- Removes Linear IDs cleanly
- Adds GitHub issue numbers when synced
- Comments persist through file moves/renames
- Cleanup report generated
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/commands/cleanup-linear-todos.ts`
- `packages/github-workflow/src/core/comment-updater.ts`
- `packages/github-workflow/test/commands/cleanup-linear-todos.test.ts`

---

### T-003-021: Offline resync functionality

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 6 hours
**Phase:** 5 - Integration

**Description:**

Implement offline resync functionality to sync all changes when back online.

**Tasks:**

- [ ] Detect changes since last sync
- [ ] Generate sync summary
- [ ] Implement conflict detection
- [ ] Create `/resync-all` command
- [ ] Add progress reporting
- [ ] Write integration tests

**Acceptance Criteria:**

- Detects all local changes since last sync
- Shows summary before syncing
- Asks for confirmation
- Handles conflicts gracefully
- Progress reported in real-time
- Integration tests pass

**Related Files:**

- `packages/github-workflow/src/commands/resync-all.ts`
- `packages/github-workflow/src/sync/offline-sync.ts`
- `packages/github-workflow/test/commands/resync-all.test.ts`

---

### T-003-022: Project assignment system

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 4 hours
**Phase:** 5 - Integration

**Description:**

Implement system to assign issues to pre-created GitHub Projects based on file paths.

**Tasks:**

- [ ] Implement project mapping logic
- [ ] Add project detection from file paths
- [ ] Integrate with issue creation
- [ ] Add project configuration
- [ ] Write unit tests

**Acceptance Criteria:**

- Issues assigned to correct project
- Path mapping works for all apps/packages
- Falls back to general project if ambiguous
- Configuration flexible
- 90%+ test coverage

**Related Files:**

- `packages/github-workflow/src/core/project-mapper.ts`
- `packages/github-workflow/test/core/project-mapper.test.ts`

---

### T-003-023: Sub-sub-task hierarchy support

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 6 hours
**Phase:** 5 - Integration

**Description:**

Implement 3-level task hierarchy (parent → sub → sub-sub) with GitHub issue relationships.

**Tasks:**

- [ ] Update parser to detect 3-level indentation
- [ ] Create hierarchical issue linking
- [ ] Add level indicators to issue titles
- [ ] Update TODOs.md formatter
- [ ] Write integration tests

**Acceptance Criteria:**

- Parser detects 3 levels of nesting
- Issues linked correctly (parent ← sub ← sub-sub)
- Level indicators in titles ([PARENT], [SUB], [SUB-SUB])
- TODOs.md updated with hierarchy
- Integration tests pass

**Related Files:**

- `packages/github-workflow/src/core/planning-parser.ts`
- `packages/github-workflow/src/sync/hierarchy-manager.ts`
- `packages/github-workflow/test/sync/hierarchy-manager.test.ts`

---

### T-003-024: Enrichment agent

**Status:** [ ] Pending
**Assignee:** TBD
**Estimate:** 4 hours
**Phase:** 5 - Integration

**Description:**

Create specialized Claude Code agent/skill for enriching GitHub issues with context and analysis.

**Tasks:**

- [ ] Create enrichment agent specification
- [ ] Define enrichment prompts
- [ ] Implement result parsing
- [ ] Add to .claude/agents/ or .claude/skills/
- [ ] Write documentation

**Acceptance Criteria:**

- Agent provides meaningful analysis
- Suggestions are actionable
- Works for both planning and TODOs
- Can be invoked independently
- Documentation complete

**Related Files:**

- `.claude/agents/specialized/github-issue-enricher.md` OR
- `.claude/skills/enrichment/github-issue-enricher.md`

---

## Summary

**Total Tasks:** 24
**Total Estimate:** 138 hours (~4 weeks)
**Phases:** 5

### By Phase

- **Phase 1 - Foundation:** 3 tasks, 16 hours
- **Phase 2 - Parsers:** 3 tasks, 18 hours
- **Phase 3 - Synchronization:** 3 tasks, 22 hours
- **Phase 4 - Enrichment:** 2 tasks, 10 hours
- **Phase 5 - Integration:** 13 tasks, 72 hours

### By Status

- **Pending:** 12 tasks
- **In Progress:** 0 tasks
- **Completed:** 12 tasks

### Completed Tasks

- **T-003-001:** Project setup and package structure ✅
- **T-003-002:** GitHub client implementation ✅
- **T-003-003:** Configuration system ✅
- **T-003-004:** Planning session parser ✅
- **T-003-005:** Code comment parser ✅
- **T-003-006:** Tracking system ✅
- **T-003-007:** Planning sync implementation ✅
- **T-003-008:** TODO sync implementation ✅
- **T-003-009:** Completion detection system ✅
- **T-003-010:** Claude Code integration ✅
- **T-003-011:** Context extraction ✅
- **T-003-012:** Claude Code commands ✅

---

*Last updated: 2025-11-01*
