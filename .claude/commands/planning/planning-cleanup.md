---
name: planning-cleanup
description: Archive completed planning sessions to keep workspace organized
model: inherit
---

# Planning Cleanup Command

Archive completed planning sessions to `.claude/sessions/planning/archived/{year}/{month}/` to keep the active workspace clean and organized.

## Purpose

This command helps maintain a clean workspace by:

- Identifying completed planning sessions
- Moving them to organized archives (by year/month)
- Updating the code registry
- Generating completion reports
- Preserving all session data for future reference

## Usage

### Interactive Mode (Default)

```bash
/planning-cleanup
```

**Flow:**

1. Scans for completed sessions
2. Shows list with completion dates
3. User selects which to archive
4. Confirms selection
5. Archives selected sessions
6. Updates registry
7. Shows summary report

### Auto Mode

```bash
/planning-cleanup --auto
```

**Flow:**

1. Scans for completed sessions
2. Archives ALL completed sessions automatically
3. Updates registry
4. Shows summary report

### Dry-Run Mode

```bash
/planning-cleanup --dry-run
```

**Flow:**

1. Shows what WOULD be archived
2. No actual changes made
3. Useful for preview

## Process

### 1. Detection

**Completed session criteria:**

- Status in `.code-registry.json` is "completed"
- OR all tasks in `TODOs.md` are marked as completed
- OR `.checkpoint.json` shows phase 4 completed

### 2. Selection (Interactive Mode)

```
Found 2 completed planning sessions:

[ ] P-001-business-model-system (completed: 2024-10-28)
    - 15 tasks completed
    - Duration: 45 hours

[ ] P-002-documentation-system (completed: 2024-10-29)
    - 8 tasks completed
    - Duration: 20 hours

Select sessions to archive (space to toggle, enter to confirm):
```

### 3. Archive

For each selected session:

1. **Create archive directory:**

   ```
   .claude/sessions/planning/archived/2024/10/P-001-business-model-system/
   ```

2. **Move all files:**

   ```
   P-001-business-model-system/
   ├── PDR.md
   ├── tech-analysis.md
   ├── TODOs.md
   ├── .checkpoint.json
   ├── CHANGELOG.md
   └── issues-sync.json
   ```

3. **Generate COMPLETION-REPORT.md:**

   ```markdown
   # Completion Report: P-001 Business Model System

   **Completed:** 2024-10-28
   **Duration:** 45 hours (estimated: 40h)
   **Tasks:** 15/15 completed

   ## Summary
   - Total commits: 23
   - Test coverage: 94%
   - All acceptance criteria met

   ## Deliverables
   - ✅ Database schema for accommodations
   - ✅ CRUD API endpoints
   - ✅ Admin dashboard UI
   - ✅ Documentation

   ## Lessons Learned
   - Task estimation was accurate
   - Parallel work on frontend/backend effective
   ```

4. **Update `.code-registry.json`:**

   ```json
   {
     "code": "P-001",
     "status": "archived",
     "archivedAt": "2024-10-31T15:00:00Z"
   }
   ```

### 4. Report

```
✅ Archive Complete

Archived Sessions: 2
- P-001-business-model-system → archived/2024/10/
- P-002-documentation-system → archived/2024/10/

Updated:
- .code-registry.json (2 sessions marked as archived)
- Active sessions: 2 remaining (P-003, P-004)

Location: .claude/sessions/planning/archived/2024/10/
```

## File Structure

**Before:**

```
.claude/sessions/planning/
├── .code-registry.json
├── P-001-business-model-system/
├── P-002-documentation-system/
├── P-003-planning-workflow-automation/
└── P-004-workflow-optimization/
```

**After:**

```
.claude/sessions/planning/
├── .code-registry.json (updated)
├── P-003-planning-workflow-automation/
├── P-004-workflow-optimization/
└── archived/
    └── 2024/
        └── 10/
            ├── P-001-business-model-system/
            │   ├── PDR.md
            │   ├── TODOs.md
            │   ├── .checkpoint.json
            │   └── COMPLETION-REPORT.md (✨ new)
            └── P-002-documentation-system/
                ├── PDR.md
                ├── TODOs.md
                ├── .checkpoint.json
                └── COMPLETION-REPORT.md (✨ new)
```

## Completion Report Template

```markdown
# Completion Report: {Planning Code} - {Title}

**Completed:** {completion-date}
**Duration:** {actual-hours} hours (estimated: {estimated-hours}h)
**Tasks:** {completed}/{total} completed
**Coverage:** {test-coverage}%

## Summary

Brief overview of what was delivered.

## Deliverables

- ✅ Deliverable 1
- ✅ Deliverable 2
- ✅ Deliverable 3

## Metrics

- Total commits: {commit-count}
- Files changed: {files-count}
- Test coverage: {coverage}%
- Performance: {performance-metrics}

## Lessons Learned

### What Went Well

- Point 1
- Point 2

### What Could Be Improved

- Point 1
- Point 2

## Related

- GitHub Issues: #123, #124
- PRs: #45, #46
- Documentation: [link]
```

## Safety

**Protections:**

- ❌ Cannot archive sessions with status "active" or "in-progress"
- ❌ Cannot archive if uncommitted changes exist
- ❌ Cannot overwrite existing archives (prevents data loss)
- ✅ All operations are logged
- ✅ Can be undone manually (files are moved, not deleted)

## Undo Archive

If you need to unarchive a session:

```bash
# Manual undo
mv .claude/sessions/planning/archived/2024/10/P-001-business-model-system \
   .claude/sessions/planning/

# Update registry manually
# Edit .code-registry.json: change status back to "completed"
```

## Integration

**Workflow Integration:**

- Run after completing Phase 4 (Finalization)
- Before starting new planning sessions
- Monthly cleanup recommended
- Automated in CI/CD (optional)

**Commands that use registry:**

- `/start-feature-plan` - checks for code conflicts
- `/sync-planning` - syncs to GitHub Issues

## Examples

### Example 1: Interactive Cleanup

```bash
/planning-cleanup

# Output:
Found 1 completed planning session:

[x] P-001-business-model-system (completed: 2024-10-28)
    - 15 tasks completed
    - Duration: 45 hours

Archive selected sessions? (y/n): y

✅ Archived P-001-business-model-system → archived/2024/10/
✅ Generated COMPLETION-REPORT.md
✅ Updated .code-registry.json

Active sessions: 3 remaining
```

### Example 2: Auto Cleanup

```bash
/planning-cleanup --auto

# Output:
🔍 Scanning for completed sessions...

Found 2 completed sessions:
- P-001-business-model-system (completed: 2024-10-28)
- P-002-documentation-system (completed: 2024-10-29)

📦 Archiving...
✅ P-001 → archived/2024/10/
✅ P-002 → archived/2024/10/

✅ Archive complete: 2 sessions archived
```

### Example 3: Dry Run

```bash
/planning-cleanup --dry-run

# Output:
🔍 Dry run - no changes will be made

Would archive:
- P-001-business-model-system
  → archived/2024/10/P-001-business-model-system/

Registry updates:
- P-001: status "completed" → "archived"
- archivedAt: 2024-10-31T15:00:00Z

No changes made (dry run mode)
```

## Best Practices

1. **Regular Cleanup:**
   - Weekly: Review completed sessions
   - Monthly: Archive old completed sessions
   - Quarterly: Review archived sessions

2. **Before Archiving:**
   - ✅ All acceptance criteria met
   - ✅ All commits pushed
   - ✅ Documentation updated
   - ✅ Tests passing

3. **Completion Reports:**
   - Include lessons learned
   - Document metrics
   - Link to related issues/PRs
   - Note performance insights

4. **Recovery:**
   - Archives are just moved files
   - Can be unarchived manually
   - Original data preserved
   - No data loss

## Troubleshooting

### "Session has uncommitted changes"

**Solution:** Commit or stash changes before archiving

```bash
git status
git add .
git commit -m "Complete P-001"
/planning-cleanup
```

### "Archive already exists"

**Solution:** Previous archive exists at target location

```bash
# Check existing archive
ls .claude/sessions/planning/archived/2024/10/

# Rename or remove old archive
mv archived/2024/10/P-001-business-model-system \
   archived/2024/10/P-001-business-model-system.backup
```

### "Registry out of sync"

**Solution:** Regenerate registry

```bash
pnpm claude:sync:registry
/planning-cleanup
```

---

**Related Commands:**

- `/start-feature-plan` - Create new planning session
- `/sync-planning` - Sync to GitHub Issues
- `/quality-check` - Validate before completion

**Related Docs:**

- [Workflow Phase 4](../../docs/workflows/phase-4-finalization.md)
- [Task Completion Protocol](../../docs/workflows/task-completion-protocol.md)
- [Code Registry System](../../docs/CODE-REGISTRY.md)

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2024-10-31 | Initial version with interactive, auto, and dry-run modes | @tech-lead | Cleanup system |
