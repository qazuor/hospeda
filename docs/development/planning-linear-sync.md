# Planning Linear Sync Guide

This guide explains how to sync planning sessions with Linear for cross-device access.

## Overview

The `@repo/planning-sync` package provides simple Linear synchronization for Claude Code planning sessions, allowing you to:

- ✅ Create parent planning issues in Linear
- ✅ Create sub-issues for each task
- ✅ Track progress from mobile/web/other PCs
- ✅ Auto-sync task completion
- ✅ Keep TODOs.md and Linear in sync

## Setup

### 1. Get Linear Credentials

1. Go to Linear Settings → API → Personal API Keys
2. Create a new API key
3. Copy your Team ID from Linear Settings → General

### 2. Add Environment Variables

Add to your `.env` file:

```bash
LINEAR_API_KEY=your_linear_api_key_here
LINEAR_TEAM_ID=your_team_id_here
```

### 3. Install Dependencies

```bash
pnpm install
```

The `@repo/planning-sync` package is already configured in the monorepo.

## Workflow

### Phase 1: Planning → Linear

#### Step 1: Complete Planning

Follow the normal planning workflow:

1. Run `/start-feature-plan`
2. Create PDR.md and tech-analysis.md
3. Break down into tasks in TODOs.md
4. Get user approval

#### Step 2: Sync to Linear

After user approves, Claude will ask:

```
Great! The plan is approved.

Would you like me to sync this planning to Linear?

This will:
✅ Create a parent issue: [Planning] User Authentication
✅ Create sub-issues for all 15 tasks
✅ Allow you to track progress from any device
✅ Update status automatically as you complete tasks

Sync to Linear? (yes/no)
```

If you answer **yes**, Claude will:

1. Create parent issue in Linear with "[Planning]" prefix
2. Create sub-issues for each task in TODOs.md
3. Save mapping in `.linear-sync.json`
4. Show you the URLs

**Output:**

```
✅ Planning synced to Linear successfully!

📋 Parent Issue: https://linear.app/hospeda/issue/HOSP-123
   ID: HOSP-123

📊 Statistics:
   • 15 tasks created
   • 0 tasks updated
   • 0 tasks unchanged

💡 Don't forget to commit .linear-sync.json!
```

#### Step 3: Commit and Push

```bash
git add .claude/sessions/planning/user-auth/
git commit -m "docs(planning): sync user-auth to Linear"
git push
```

**Important:** Always commit `.linear-sync.json` so syncs work across machines.

### Phase 2: Implementation → Task Completion

#### Automatic Confirmation

When you complete a task during implementation, Claude will **automatically ask**:

```
🎯 Task Completed: "Implement User model extending BaseModel"

All tests pass and code is ready.
Would you like me to mark this as completed in TODOs.md and Linear? (yes/no)
```

#### If You Answer Yes

Claude will:

1. Update TODOs.md: `- [ ]` → `- [x]`
2. Update Linear issue state to "Done"
3. Update `.linear-sync.json` timestamp

**Output:**

```
✅ Task marked as completed!

📝 Updated: TODOs.md
🔗 Linear: https://linear.app/hospeda/issue/HOSP-124
```

#### If You Answer No

Claude respects your decision and continues without marking complete.

### Phase 3: Working from Another Device

#### On Mobile (Linear App)

1. Open Linear app on your phone
2. Navigate to the parent issue (HOSP-123)
3. See all sub-tasks with current status
4. You can mark tasks as complete manually if needed

#### On Another PC

```bash
# Pull latest changes
git pull

# Claude will automatically detect .linear-sync.json
# and sync task status when you continue work
```

### Phase 4: Manual Sync (if needed)

#### Sync Planning

```bash
pnpm planning:sync .claude/sessions/planning/user-auth
```

#### Mark Task Complete

```bash
pnpm planning:complete .claude/sessions/planning/user-auth "Task title"
```

Or with task ID:

```bash
pnpm planning:complete .claude/sessions/planning/user-auth abc12345
```

## File Structure

### Planning Session

```
.claude/sessions/planning/user-auth/
├── PDR.md                  # Product requirements
├── tech-analysis.md        # Technical analysis
├── TODOs.md                # Tasks (source of truth locally)
└── .linear-sync.json       # Sync state (DO NOT edit manually)
```

### .linear-sync.json

```json
{
  "feature": "User Authentication",
  "parentIssueId": "HOSP-123",
  "linearTeamId": "abc-123",
  "syncedAt": "2025-01-15T10:30:00Z",
  "tasks": [
    {
      "id": "abc12345",
      "title": "Implement User model",
      "status": "completed",
      "linearIssueId": "HOSP-124"
    }
  ]
}
```

**Important:** Always commit this file. It contains the mapping between local tasks and Linear issues.

## TODOs.md Format

### Task Statuses

```markdown
- [ ] Pending task
  > Optional description

- [~] In progress task
  > Optional description

- [x] Completed task
  > Optional description
```

### Status Symbols

- `[ ]` = pending (Linear: Todo/Backlog)
- `[~]` = in_progress (Linear: In Progress)
- `[x]` = completed (Linear: Done/Completed)

## Commands

### `/sync-planning`

Syncs current planning session to Linear.

**When to use:**

- After completing planning and getting approval
- When you want to enable cross-device tracking
- To update Linear with latest TODOs.md changes

**What it does:**

1. Reads PDR.md and TODOs.md
2. Creates/updates parent issue
3. Creates/updates sub-issues
4. Saves sync state

**See:** `.claude/commands/sync-planning.md` for full details

### Task Completion (Automatic)

No command needed! Claude automatically asks when you complete a task.

**See:** `.claude/docs/workflows/task-completion-protocol.md` for full protocol

## Troubleshooting

### "Missing environment variables"

**Problem:** LINEAR_API_KEY or LINEAR_TEAM_ID not set

**Solution:**

1. Add variables to `.env` file
2. Or set in your shell: `export LINEAR_API_KEY=...`

### "Planning files not found"

**Problem:** Trying to sync a session that doesn't exist

**Solution:**

1. Verify the session path exists
2. Ensure PDR.md and TODOs.md are present
3. Complete planning phase first

### "Failed to sync with Linear"

**Problem:** API error or network issue

**Solution:**

1. Check your API key is valid
2. Check you have write access to the team
3. Check internet connection
4. Try again later - Linear might be down

### "Task already completed in Linear but not locally"

**Problem:** Status out of sync between Linear and TODOs.md

**Solution:**

1. Run `/sync-planning` to re-sync
2. Or manually update TODOs.md to match Linear
3. Claude will sync on next update

## Best Practices

### 1. Always Commit .linear-sync.json

```bash
git add .claude/sessions/planning/*/. linear-sync.json
git commit -m "docs(planning): update sync state"
```

Without this file, syncs won't work across machines.

### 2. Sync Early, Sync Often

- Sync right after planning approval
- Don't wait until tasks are done
- Makes cross-device work seamless

### 3. Let Claude Ask

- Don't manually mark tasks complete
- Let Claude ask after each task
- Ensures consistent sync

### 4. Use Linear for Quick Checks

- Mobile: Check progress on the go
- Web: See team progress (if you add team later)
- Desktop: Full Linear UI for detailed views

### 5. Keep TODOs.md as Source of Truth

- Edit tasks in TODOs.md, not Linear
- Let sync handle the rest
- Linear is for visibility, not editing

## Comparison with tools-todo-linear

| Feature | planning-sync | tools-todo-linear |
|---------|---------------|-------------------|
| **Purpose** | Planning sessions | Code TODOs |
| **Scope** | Single feature planning | Entire codebase |
| **Sync Source** | TODOs.md | Code comments |
| **Complexity** | Low (~200 lines) | High (~2000+ lines) |
| **AI Integration** | No | Yes (5 providers) |
| **File Watching** | No | Yes |
| **Use Case** | Feature planning | TODO tracking |

**When to use which:**

- **planning-sync**: Feature planning, cross-device work, Linear tracking
- **tools-todo-linear**: Code TODO comments, automatic issue creation from code

They can coexist and serve different purposes.

## FAQ

### Can I edit tasks in Linear?

**Yes**, but changes won't sync back to TODOs.md automatically. Best practice:

- Edit in TODOs.md
- Run `/sync-planning` to update Linear

### Can I use this without Linear?

**Yes!** Just don't sync. TODOs.md works standalone. Sync is optional.

### What happens if I delete .linear-sync.json?

Next sync will create new issues instead of updating existing ones. **Don't delete it.**

### Can I sync multiple planning sessions?

**Yes!** Each session has its own `.linear-sync.json`. They're independent.

### Can I share planning with team members?

**Yes!** Linear issues are visible to your team. They can view and comment.

### Does this replace git commits?

**No!** Always commit planning files to git. Linear is for tracking, git is for history.

## Support

For issues or questions:

1. Check this guide
2. Check `.claude/commands/sync-planning.md`
3. Check `.claude/docs/workflows/task-completion-protocol.md`
4. Check package README: `packages/planning-sync/README.md`

## Next Steps

1. ✅ Set up Linear credentials
2. ✅ Complete a planning session
3. ✅ Sync to Linear
4. ✅ Try completing a task and confirming
5. ✅ Check Linear on mobile
6. ✅ Pull from another machine and continue work

Happy planning! 🚀
