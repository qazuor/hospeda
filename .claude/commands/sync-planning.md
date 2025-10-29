# Sync Planning to Linear

**Purpose**: Synchronizes the current planning session to Linear, creating a parent issue and sub-issues for all tasks.

## When to Use

- After completing Phase 1: Planning and getting user approval
- When you want to sync planning progress to Linear for access from other devices
- To create trackable issues for the current feature planning

## Process

### Step 1: Identify Planning Session

Ask the user which planning session to sync if not obvious from context.

The session path should be: `.claude/sessions/planning/{feature-name}/`

### Step 2: Verify Required Files

Check that the following files exist:

- `PDR.md` - Product Requirements Document
- `TODOs.md` - Tasks breakdown

If files are missing, inform the user and stop.

### Step 3: Get Linear Configuration

You need the following environment variables:

- `LINEAR_API_KEY` - Linear API key
- `LINEAR_TEAM_ID` - Linear team ID

Check if these are available in the environment. If not, ask the user to provide them.

### Step 4: Execute Sync

Use the `@repo/planning-sync` package to synchronize:

```typescript
import { syncPlanningToLinear } from '@repo/planning-sync';

const result = await syncPlanningToLinear(
  sessionPath,
  {
    apiKey: process.env.LINEAR_API_KEY!,
    teamId: process.env.LINEAR_TEAM_ID!,
  }
);
```

### Step 5: Report Results

Present the results to the user in a clear format:

```
✅ Planning synced to Linear successfully!

📋 Parent Issue: {result.parentIssueUrl}
   ID: {result.parentIssueId}

📊 Statistics:
   • {result.tasksCreated} tasks created
   • {result.tasksUpdated} tasks updated
   • {result.tasksUnchanged} tasks unchanged

💡 You can now access this planning from any device via Linear.
   The sync data is saved in .linear-sync.json for future updates.
```

### Step 6: Suggest Next Steps

Remind the user:

1. Commit and push the planning files including `.linear-sync.json`
2. They can now view/update tasks in Linear
3. When completing tasks, confirm with you to sync status back

## Error Handling

### Missing Environment Variables

```
❌ Linear configuration missing.

Please set the following environment variables:
- LINEAR_API_KEY: Your Linear API key
- LINEAR_TEAM_ID: Your team ID

You can find these in Linear settings.
```

### File Not Found

```
❌ Planning files not found at {sessionPath}

Required files:
- PDR.md
- TODOs.md

Please ensure you've completed the planning phase first.
```

### API Errors

```
❌ Failed to sync with Linear: {error.message}

Please check:
1. Your Linear API key is valid
2. You have write access to the team
3. Your internet connection is working

Try again or sync manually later.
```

## Important Notes

- The sync is idempotent - you can run it multiple times safely
- Existing issues will be updated, not duplicated
- Task status in Linear will match TODOs.md
- The `.linear-sync.json` file stores the mapping between tasks and Linear issues
- Always commit this file to git so syncs work across machines

## Example Usage

```
User: "I just finished planning the user authentication feature, can you sync it to Linear?"
