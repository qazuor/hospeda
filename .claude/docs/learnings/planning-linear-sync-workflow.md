# Planning and Linear Sync Workflow

**Date:** 2024-10-28

**Category:** Planning / GitHub / Linear / Workflow

## Problem

Manual planning synchronization causes:
- Planning sessions not tracked in GitHub
- Lost context when switching devices
- No visibility into task progress
- Forgotten task completions

## Solution

**Workflow Best Practices:**

1. **Sync after planning approval** - Always offer to sync planning to Linear/GitHub

   ```bash
   pnpm planning:sync .claude/sessions/planning/P-XXX-feature-name/
   ```

2. **Commit before marking complete** - Code MUST be committed before task completion
   - Prevents lost work
   - Enables cross-device workflow
   - Creates audit trail

3. **Auto-generate commit suggestions** - Group files logically:
   - Schemas (validation layer)
   - Models + Tests (data layer)
   - Services (business logic)
   - API (routes and controllers)

4. **Use conventional commits** - `feat/refactor/fix` with proper scope

   ```bash
   feat(db): add booking model and schema
   refactor(api): consolidate error handlers
   fix(auth): correct JWT validation
   ```

5. **Cross-device workflow:**
   - Commit → Push → Access from anywhere
   - .checkpoint.json tracks progress
   - issues-sync.json maintains GitHub state

6. **Three sync options:**
   - **Execute**: Run suggested commits immediately
   - **Modify**: Edit commit messages/groupings
   - **Skip**: Skip with warning (not recommended)

## Impact

- **Severity:** High - Affects project tracking and collaboration
- **Frequency:** Every feature development
- **Scope:** All planning sessions (Level 3 workflows)
- **Prevention:** Always sync after planning approval, commit before completion

## Related

- **Full Documentation:** [.claude/docs/workflows/task-completion-protocol.md](../workflows/task-completion-protocol.md)
- **Planning Workflow:** [.claude/docs/workflows/phase-1-planning.md](../workflows/phase-1-planning.md)
- **Related Learnings:** None yet

---

*Last updated: 2024-10-28*
