# Task Completion Protocol

**Purpose**: Defines how to handle task completion with automatic GitHub synchronization.

## When a Task is Completed

Whenever you finish a task during implementation, follow this protocol:

### Step 1: Verify Task Completion

Before marking complete, ensure:

- ✅ All code is written and tested
- ✅ Tests pass with 90%+ coverage
- ✅ Lint and typecheck pass
- ✅ Code follows project standards
- ✅ Task meets acceptance criteria

### Step 2: Review Changed Files

**CRITICAL**: Before marking complete, review what files changed.

Run git status to see changes:

```bash
git status --short
```

Analyze the output:

- `M` = Modified file
- `A` = Added file
- `D` = Deleted file
- `??` = Untracked file

**🔥 CRITICAL: Atomic Commits Rule**

**ONLY include files that were modified during THIS task.**

If `git status` shows OTHER modified files that are NOT related to this task:

- ❌ **DO NOT** include them in the commit
- ❌ **DO NOT** use `git add .` or `git add -A`
- ✅ **ONLY** use `git add <specific-file>` for task-related files
- ⚠️ **WARN** the user about unrelated changes

**Example:**

```bash
# git status shows:
M packages/db/src/models/user.model.ts      ← Task related
M packages/db/test/models/user.model.test.ts ← Task related
M packages/api/routes/booking.ts            ← NOT related (different task)
M .env.local                                 ← NOT related (local config)

# CORRECT approach:
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
# Do NOT add booking.ts or .env.local

# WRONG approach:
git add .  # ❌ This would include unrelated files!
```

**If unrelated files are present:**

```text
⚠️ Warning: I see modified files that are NOT part of this task:
- packages/api/routes/booking.ts
- .env.local

I will ONLY commit the files related to the current task:
- packages/db/src/models/user.model.ts
- packages/db/test/models/user.model.test.ts

The unrelated files will remain uncommitted. You can commit them separately
when their respective tasks are complete.

Do you want to proceed with committing only the task-related files? (yes/no)
```

**User can override:** If user explicitly asks to include other files, then do so.

Organize files into logical commits based on:

- Changes that belong together (e.g., model + tests)
- Separate concerns (e.g., schema vs service vs API)
- Follow atomic commit principle (one logical change per commit)
- **ONLY include files modified during this specific task**

### Step 3: Generate Commit Suggestions

Based on changed files, suggest commit(s) to user:

**Format:**

```
🎯 Task Completed: "{task_title}"

All tests pass and code is ready.

📝 Changed Files:
   M packages/db/src/models/user.model.ts
   M packages/db/test/models/user.model.test.ts
   A packages/schemas/src/entities/user.schema.ts
   M packages/db/src/models/index.ts

💾 Suggested Commits:

1. feat(schemas): add user validation schemas

   Files:
   - packages/schemas/src/entities/user.schema.ts

   git add packages/schemas/src/entities/user.schema.ts
   git commit -m "feat(schemas): add user validation schemas

   - Add User entity Zod schema
   - Include email, name, and role validation
   - Export from schemas index"

2. feat(db): implement User model with CRUD operations

   Files:
   - packages/db/src/models/user.model.ts
   - packages/db/src/models/index.ts
   - packages/db/test/models/user.model.test.ts

   git add packages/db/src/models/user.model.ts packages/db/src/models/index.ts packages/db/test/models/user.model.test.ts
   git commit -m "feat(db): implement User model with CRUD operations

   - Extend BaseModel for User entity
   - Add findByEmail custom method
   - Include comprehensive unit tests (95% coverage)
   - Export from models index"

Would you like me to:
1. Execute these commits and mark task as complete
2. Modify the commits first
3. Skip commits and just mark complete (NOT RECOMMENDED)
```

**Important Notes:**

- Group related files together
- Use conventional commit format
- Include bullet points in commit body
- Reference the task/feature context
- Keep commits atomic and logical

### Step 4: If User Confirms (Option 1)

Execute git commits then mark task complete:

```bash
# For each suggested commit:
1. git add {files}
2. git commit -m "{message}"

# Then mark as completed
```

**🔥 CRITICAL: State Update Process**

When marking a task complete, you MUST update ALL state tracking files:

```typescript
import { markTaskCompleted } from '@repo/planning-sync';

const sessionPath = '.claude/sessions/planning/{current-feature}/';
const session = await getPlanningSession(sessionPath);

if (session) {
  const result = await markTaskCompleted(
    sessionPath,
    taskId,
    {
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }
  );

  console.log(`✅ Task marked as completed!`);
  console.log(`📝 Updated: TODOs.md`);
  console.log(`📄 Updated: .checkpoint.json`);
  console.log(`📄 Updated: .github-workflow/tracking.json`);
  console.log(`🔗 GitHub: ${result.issueUrl}`);
  console.log(`\n💡 Don't forget to push: git push`);
}
```

**State Files Updated:**

1. **`TODOs.md`** - Mark task with `[x]`, add completion metadata
2. **`.checkpoint.json`** - Update progress tracking, task status
3. **`.github-workflow/tracking.json`** - Sync with GitHub, update issue state
4. **GitHub** - Update issue status via API

**Output to user:**

```
✅ Commits created:
   • abc1234 feat(schemas): add user validation schemas
   • def5678 feat(db): implement User model with CRUD operations

✅ Task marked as completed!
   📝 TODOs.md updated (task marked as [x])
   📄 .checkpoint.json updated (progress: 12/45 tasks)
   📄 .github-workflow/tracking.json updated (synced with GitHub)
   🔗 GitHub: https://github.com/hospeda/main/issues/124 (status: Done)

💡 Next steps:
   1. Review commits: git log -2
   2. Push changes: git push
   3. Continue to next task
```

**⚠️ IMPORTANT**: All three files (TODOs.md, .checkpoint.json, .github-workflow/tracking.json) MUST be updated together to maintain consistency across the system.

### Step 5: If User Chooses Option 2 (Modify Commits)

Ask user what they want to change:

```
Sure! What would you like to modify?

1. Change commit messages
2. Group files differently
3. Add/remove files from commits
4. Something else

Please tell me what you'd like to change.
```

Make the requested changes and present updated commit suggestions.

### Step 6: If User Chooses Option 3 (Skip Commits)

**WARN THE USER** about the consequences:

```
⚠️ Warning: Skipping commits is NOT RECOMMENDED

If you mark the task as complete without committing:
- Code changes will be lost when switching devices
- TODOs.md will show task complete but code won't exist
- GitHub will show task done but implementation won't be pushed
- Team members (or future you) won't see the actual work

This defeats the purpose of cross-device sync.

Are you sure you want to skip commits? (yes/no)
```

If user confirms:

- Mark task as completed in TODOs.md and GitHub
- Remind user to commit manually before pushing

If user reconsiders:

- Return to Step 3 (commit suggestions)

### Step 7: If User Declines Everything (No)

Respect the user's decision and continue without marking complete:

```
Understood. I won't mark the task as completed yet.
You can manually update it later or tell me when you're ready.

Your changes are still uncommitted. Remember to commit before switching tasks.
```

## When to Apply This Protocol

Apply this protocol in these situations:

### During Implementation (Phase 2)

After completing any task in `TODOs.md`:

```markdown
## Phase 2: Implementation

### After completing a task:

1. Run tests and verify everything passes
2. **Apply Task Completion Protocol** ⬅️ HERE
   - This includes git commits
   - This updates TODOs.md and GitHub
3. Move to next task
```

### During Validation (Phase 3)

After QA approves a task:

```markdown
## Phase 3: Validation

### After QA approval:

1. Address any feedback
2. Re-run validation
3. **Apply Task Completion Protocol** ⬅️ HERE
4. Document in changelog
```

### During Bug Fixes

After fixing a bug related to a task:

```markdown
## Bug Fix Workflow

1. Identify root cause
2. Implement fix
3. Add regression test
4. **Apply Task Completion Protocol** ⬅️ HERE
5. Update documentation
```

## Special Cases

### Multiple Tasks Completed at Once

If you complete multiple tasks in one session, ask about each one separately:

```
🎯 Multiple Tasks Completed:

I've finished working on 3 tasks:
1. "Create User model"
2. "Add user validation"
3. "Write user tests"

Would you like me to mark all 3 as completed? (yes/no/select)

If 'select', I'll ask about each one individually.
```

### Task Partially Complete

If a task is not fully done, do NOT apply this protocol:

```
⚠️ Task "{title}" is partially complete.

Remaining work:
- [ ] Integration tests
- [ ] Documentation

I'll continue working on this. Will ask for completion when fully done.
```

### Task Blocked

If a task is blocked, inform the user but don't mark complete:

```
🚧 Task "{title}" is blocked.

Blocker: {description}

I've completed my part, but the task can't be marked as done until the blocker is resolved.

Should I:
1. Mark my part as complete and note the blocker
2. Keep it as in-progress until fully unblocked
3. Move to another task and come back later

What would you prefer?
```

## Error Handling

### GitHub API Failure

```typescript
try {
  await markTaskCompleted(sessionPath, taskId, config);
} catch (error) {
  console.log(`❌ Failed to sync with GitHub: ${error.message}`);
  console.log(`✅ Task marked as completed in TODOs.md (local only)`);
  console.log(`💡 Run /sync-planning later to sync with GitHub`);
}
```

### Session Not Found

```
⚠️ Planning session not found.

The task has been completed locally in your working memory,
but I can't update TODOs.md without a valid planning session.

Would you like me to:
1. Continue without updating files (temporary completion)
2. Help you set up a planning session
3. Skip marking this task

What would you prefer?
```

## Integration with TodoWrite Tool

When marking tasks complete, also update the TodoWrite tool:

```typescript
// After confirming with user
await markTaskCompleted(...);

// Update TodoWrite to reflect completion
await TodoWrite({
  todos: [
    // ... other tasks
    {
      content: taskTitle,
      status: 'completed',
      activeForm: `Completed: ${taskTitle}`
    }
  ]
});
```

## Best Practices

1. **Always Ask First**: Never mark complete without user confirmation
2. **Be Specific**: Mention the exact task title in your confirmation
3. **Show Impact**: Explain what will be updated (local, GitHub, or both)
4. **Handle Errors Gracefully**: If sync fails, update locally and inform user
5. **Keep It Simple**: Don't ask for completion if it's obvious the task isn't done
6. **Batch Smartly**: Offer to batch multiple completions but allow selection
7. **Update Immediately**: Don't wait to mark complete - do it right after confirmation

## Example Conversation

```
Assistant: I've completed implementing the User model with all validations
and tests. All tests pass with 95% coverage.

🎯 Task Completed: "Implement User model extending BaseModel"

Would you like me to mark this as completed in TODOs.md and GitHub?

User: Yes
