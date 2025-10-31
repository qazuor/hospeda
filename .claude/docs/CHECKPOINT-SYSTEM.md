# Checkpoint System Documentation

## Overview

The Checkpoint System enables resuming workflow execution across sessions and devices by tracking the current state of any active planning session. This allows for seamless collaboration and continuity when switching between workstations or resuming work after interruptions.

## Purpose

**Why Checkpoints?**

- **Resume Work**: Continue exactly where you left off after breaks or context switches
- **Cross-Device Workflow**: Start work on one device, continue on another
- **Progress Tracking**: Monitor completion status and estimate remaining work
- **Collaboration**: Multiple team members can see current workflow state
- **Git History**: Checkpoints in git provide audit trail of workflow progression

## File Location

Checkpoints are stored as `.checkpoint.json` files in planning session directories:

```
.claude/sessions/planning/{planning-code}/.checkpoint.json
```

**Examples:**

```
.claude/sessions/planning/P-004-workflow-optimization/.checkpoint.json
.claude/sessions/planning/P-001-business-model-system/.checkpoint.json
```

## Checkpoint Structure

### Minimal Valid Checkpoint

```json
{
  "workflow": "feature",
  "planningCode": "P-004",
  "currentPhase": 2,
  "currentStep": 15,
  "totalSteps": 37,
  "currentTask": "PF004-15"
}
```

### Complete Checkpoint with All Fields

```json
{
  "workflow": "feature",
  "planningCode": "P-004",
  "currentPhase": 2,
  "currentStep": 15,
  "totalSteps": 37,
  "currentTask": "PF004-15",
  "taskName": "Create 11 new specialized skills",
  "previousTaskCompleted": "PF004-14",
  "phaseStarted": "2025-10-30T12:00:00.000Z",
  "lastUpdated": "2025-10-30T14:30:00.000Z",
  "tasksCompleted": 15,
  "hoursSpent": 12.5,
  "blockers": [
    {
      "task": "PF004-12",
      "reason": "Waiting for user approval on approach",
      "since": "2025-10-30T11:00:00.000Z"
    }
  ],
  "notes": [
    {
      "timestamp": "2025-10-30T13:00:00.000Z",
      "note": "Refactored skills to use new pattern"
    }
  ]
}
```

## Field Definitions

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `workflow` | string (enum) | Type of workflow | `"feature"`, `"refactor"`, `"bugfix-small"`, `"quick-fix"` |
| `planningCode` | string | Planning session identifier | `"P-004"`, `"PF-004"` |
| `currentPhase` | integer (1-4) | Current phase | `2` (Implementation) |
| `currentStep` | integer | Current step number | `15` |
| `totalSteps` | integer | Total steps in workflow | `37` |
| `currentTask` | string | Current task code | `"PF004-15"` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `taskName` | string | Human-readable task name | `"Create new skills"` |
| `previousTaskCompleted` | string | Last completed task | `"PF004-14"` |
| `phaseStarted` | ISO 8601 | When phase started | `"2025-10-30T12:00:00.000Z"` |
| `lastUpdated` | ISO 8601 | Last update time | `"2025-10-30T14:30:00.000Z"` |
| `tasksCompleted` | integer | Number of completed tasks | `15` |
| `hoursSpent` | number | Total hours invested | `12.5` |
| `blockers` | array | Current blockers | See structure below |
| `notes` | array | Session notes | See structure below |

### Workflow Types

- **`feature`**: New feature implementation (Level 3, 4-phase workflow)
- **`refactor`**: Code refactoring (Level 3, 4-phase workflow)
- **`bugfix-small`**: Small bug fix (Level 2, simplified workflow)
- **`quick-fix`**: Quick fix (Level 1, minimal workflow)

### Workflow Phases

1. **Planning** - Requirements gathering, design
2. **Implementation** - Code development, TDD
3. **Validation** - Testing, code review
4. **Finalization** - Documentation, commits

## Usage Patterns

### Creating a Checkpoint

When starting a new task:

```bash
# Create checkpoint manually
cat > .claude/sessions/planning/P-004/.checkpoint.json << 'EOF'
{
  "workflow": "feature",
  "planningCode": "P-004",
  "currentPhase": 1,
  "currentStep": 1,
  "totalSteps": 37,
  "currentTask": "PF004-1",
  "taskName": "Create directory structure",
  "phaseStarted": "2025-10-30T10:00:00.000Z",
  "lastUpdated": "2025-10-30T10:00:00.000Z",
  "tasksCompleted": 0
}
EOF
```

### Updating a Checkpoint

After completing a task:

```json
{
  "workflow": "feature",
  "planningCode": "P-004",
  "currentPhase": 2,
  "currentStep": 16,
  "totalSteps": 37,
  "currentTask": "PF004-16",
  "taskName": "Update skills README",
  "previousTaskCompleted": "PF004-15",
  "phaseStarted": "2025-10-30T12:00:00.000Z",
  "lastUpdated": "2025-10-30T15:00:00.000Z",
  "tasksCompleted": 16
}
```

**Key changes**:

- `currentStep` incremented (15 → 16)
- `currentTask` updated (PF004-15 → PF004-16)
- `previousTaskCompleted` set to previous task
- `lastUpdated` timestamp updated
- `tasksCompleted` incremented (15 → 16)

### Reading a Checkpoint

To resume work, read the checkpoint:

```bash
# Display checkpoint
jq . .claude/sessions/planning/P-004/.checkpoint.json

# Extract specific field
CURRENT_TASK=$(jq -r '.currentTask' .checkpoint.json)
PHASE=$(jq -r '.currentPhase' .checkpoint.json)
```

### Calculating Progress

```bash
# Get completion percentage
COMPLETED=$(jq -r '.tasksCompleted' .checkpoint.json)
TOTAL=$(jq -r '.totalSteps' .checkpoint.json)
PROGRESS=$(( (COMPLETED * 100) / TOTAL ))
echo "Progress: $PROGRESS%"
```

## Blockers and Notes

### Adding a Blocker

When a task is blocked:

```json
{
  "blockers": [
    {
      "task": "PF004-12",
      "reason": "Waiting for user approval on approach",
      "since": "2025-10-30T11:00:00.000Z"
    },
    {
      "task": "PF004-15",
      "reason": "External API documentation unavailable",
      "since": "2025-10-30T14:00:00.000Z"
    }
  ]
}
```

### Adding Notes

Document important decisions or observations:

```json
{
  "notes": [
    {
      "timestamp": "2025-10-30T13:00:00.000Z",
      "note": "Refactored skills to use new pattern - broke into smaller files"
    },
    {
      "timestamp": "2025-10-30T14:30:00.000Z",
      "note": "User requested pivot to different UI framework"
    }
  ]
}
```

## Git Integration

### Version Control

**Always commit checkpoints:**

```bash
# Stage checkpoint
git add .claude/sessions/planning/P-004/.checkpoint.json

# Commit with task reference
git commit -m "chore(planning): update checkpoint to PF004-16"
```

**Do NOT gitignore checkpoints:**

```gitignore
# ❌ DON'T DO THIS
.checkpoint.json

# ✅ Checkpoints should be tracked
```

### Cross-Device Workflow

1. **Device A** - Start work:

   ```bash
   # Make changes
   git add .
   git commit -m "feat: implement feature X"

   # Update checkpoint
   # ... update .checkpoint.json ...
   git add .checkpoint.json
   git commit -m "chore: update checkpoint to PF004-16"

   # Push to remote
   git push origin main
   ```

2. **Device B** - Continue work:

   ```bash
   # Pull latest changes
   git pull origin main

   # Read checkpoint
   jq . .claude/sessions/planning/P-004/.checkpoint.json

   # Resume from PF004-16
   # ... continue work ...
   ```

## Integration with Health Check

The health check system reads checkpoints:

```bash
# Run health check
pnpm health-check

# Output includes:
# 📋 Found 2 active planning sessions:
#    📋 P-004-workflow-optimization: PF004-16 (16/37 - 43%)
#    📋 P-001-business-model: PF001-25 (25/30 - 83%)
```

## Best Practices

### DO ✅

- **Update after every task**: Keep checkpoint current
- **Commit checkpoints**: Include in version control
- **Use ISO 8601 timestamps**: Ensures consistency across timezones
- **Document blockers**: Record why work is paused
- **Add meaningful notes**: Future you will thank you
- **Validate JSON**: Use `jq` to ensure valid format before committing

### DON'T ❌

- **Skip updates**: Don't let checkpoint get stale
- **Gitignore checkpoints**: Defeats cross-device purpose
- **Use relative times**: "2 hours ago" vs ISO timestamp
- **Leave incomplete data**: Fill in all required fields
- **Forget to push**: Checkpoint on local only doesn't help
- **Manually edit without validation**: Use `jq` to prevent syntax errors

## Schema Validation

The checkpoint schema is defined in `.claude/schemas/checkpoint.schema.json`.

### Validate with jq

```bash
# Check if valid JSON
jq empty .checkpoint.json

# Extract and validate required fields
jq 'has("workflow") and has("planningCode") and has("currentPhase")' .checkpoint.json
```

### Validate with schema validators

```bash
# Using ajv-cli (if installed)
ajv validate -s .claude/schemas/checkpoint.schema.json -d .checkpoint.json
```

## Examples

### Example 1: Starting New Feature

```json
{
  "workflow": "feature",
  "planningCode": "P-005",
  "currentPhase": 1,
  "currentStep": 1,
  "totalSteps": 42,
  "currentTask": "PF005-1",
  "taskName": "Analyze requirements",
  "phaseStarted": "2025-11-01T09:00:00.000Z",
  "lastUpdated": "2025-11-01T09:00:00.000Z",
  "tasksCompleted": 0
}
```

### Example 2: Mid-Implementation

```json
{
  "workflow": "feature",
  "planningCode": "P-005",
  "currentPhase": 2,
  "currentStep": 18,
  "totalSteps": 42,
  "currentTask": "PF005-18",
  "taskName": "Implement user service",
  "previousTaskCompleted": "PF005-17",
  "phaseStarted": "2025-11-01T10:00:00.000Z",
  "lastUpdated": "2025-11-02T14:30:00.000Z",
  "tasksCompleted": 18,
  "hoursSpent": 8.5,
  "notes": [
    {
      "timestamp": "2025-11-02T11:00:00.000Z",
      "note": "Switched from REST to GraphQL after user feedback"
    }
  ]
}
```

### Example 3: Blocked Task

```json
{
  "workflow": "feature",
  "planningCode": "P-005",
  "currentPhase": 2,
  "currentStep": 22,
  "totalSteps": 42,
  "currentTask": "PF005-22",
  "taskName": "Integrate payment gateway",
  "previousTaskCompleted": "PF005-21",
  "phaseStarted": "2025-11-01T10:00:00.000Z",
  "lastUpdated": "2025-11-03T09:00:00.000Z",
  "tasksCompleted": 22,
  "hoursSpent": 12.0,
  "blockers": [
    {
      "task": "PF005-22",
      "reason": "Waiting for Mercado Pago API credentials from client",
      "since": "2025-11-03T09:00:00.000Z"
    }
  ]
}
```

### Example 4: Quick Fix (Level 1)

```json
{
  "workflow": "quick-fix",
  "planningCode": "QF-042",
  "currentPhase": 1,
  "currentStep": 1,
  "totalSteps": 1,
  "currentTask": "QF042-1",
  "taskName": "Fix typo in README",
  "lastUpdated": "2025-11-04T15:30:00.000Z",
  "tasksCompleted": 0
}
```

## Troubleshooting

### Invalid JSON

**Problem**: Checkpoint won't parse

**Solution**:

```bash
# Validate JSON syntax
jq empty .checkpoint.json

# If error, use jq to fix
jq '.' .checkpoint.json > .checkpoint.json.fixed
mv .checkpoint.json.fixed .checkpoint.json
```

### Missing Required Fields

**Problem**: Schema validation fails

**Solution**:

```bash
# Check which required fields are missing
jq 'keys' .checkpoint.json

# Add missing fields
jq '. + {"workflow": "feature"}' .checkpoint.json > temp.json
mv temp.json .checkpoint.json
```

### Checkpoint Out of Sync

**Problem**: Checkpoint shows wrong task after pull

**Solution**:

```bash
# Check git log for checkpoint changes
git log -p -- .checkpoint.json

# Reset to correct state
git checkout HEAD~1 -- .checkpoint.json

# Or update manually to current state
# ... edit .checkpoint.json ...
git add .checkpoint.json
git commit -m "fix: sync checkpoint with actual progress"
```

## Related Documentation

- **Schemas**: `.claude/schemas/checkpoint.schema.json`
- **Health Check**: `.claude/docs/RECOMMENDED-HOOKS.md`
- **Workflows**: `.claude/docs/workflows/`
- **Planning**: `.claude/sessions/planning/`

## Summary

The Checkpoint System is a critical component for managing workflow state across sessions and devices. By maintaining accurate checkpoints in version control, teams can:

- Resume work seamlessly
- Track progress transparently
- Collaborate effectively
- Maintain workflow continuity

**Remember**: Always update and commit checkpoints after completing tasks!

---

**Last updated**: 2025-10-31
**Version**: 1.0.0
**Maintained by**: DevOps team
