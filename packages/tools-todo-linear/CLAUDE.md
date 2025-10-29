# CLAUDE.md - Tools Todo Linear Package

This file provides guidance for working with the Tools Todo Linear package (`@repo/tools-todo-linear`).

## Overview

CLI tool for synchronizing TODO comments in the codebase with Linear issues. Automatically creates, updates, and tracks Linear issues based on TODO comments in code.

## Key Commands

```bash
# Setup
pnpm todo:setup         # Initialize Linear integration

# Synchronization
pnpm todo:sync          # Sync TODO comments with Linear
pnpm todo:sync:verbose  # Sync with detailed output

# Watching
pnpm todo:watch         # Watch for changes and auto-sync

# Maintenance
pnpm todo:clean         # Remove tracking data
```

## How It Works

1. **Scans codebase** for TODO comments
2. **Creates Linear issues** for new TODOs
3. **Updates existing issues** when TODO changes
4. **Tracks relationships** in `.todoLinear/tracking.json`
5. **Maintains sync state** between code and Linear

## TODO Comment Format

### Basic TODO

```ts
// TODO: Fix this bug
// Creates a Linear issue with title "Fix this bug"
```

### TODO with Details

```ts
// TODO: Implement user authentication
// Need to add Clerk integration and protect routes
// Also need to update middleware
// Creates issue with description from additional lines
```

### TODO with Priority

```ts
// TODO [HIGH]: Critical security fix
// TODO [MEDIUM]: Refactor this function
// TODO [LOW]: Improve error messages
```

### TODO with Labels

```ts
// TODO #bug: Fix validation error
// TODO #feature: Add search functionality
// TODO #refactor: Simplify this logic
```

### TODO with Assignment

```ts
// TODO @username: Review this implementation
```

## Configuration

### Setup Linear Integration

```bash
pnpm todo:setup
```

This creates `.env.local` with required variables:

```env
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=...
LINEAR_PROJECT_ID=...
```

### Configuration File

```json
// .todoLinear/config.json
{
  "teamId": "TEAM_ID",
  "projectId": "PROJECT_ID",
  "defaultPriority": 3,
  "excludePaths": [
    "node_modules",
    "dist",
    ".git",
    "coverage"
  ],
  "includePaths": [
    "src/**/*.ts",
    "src/**/*.tsx"
  ]
}
```

## Tracking File

The tool maintains a tracking file at `.todoLinear/tracking.json`:

```json
{
  "todos": [
    {
      "id": "generated-uuid",
      "file": "src/services/user.service.ts",
      "line": 45,
      "title": "Add email validation",
      "description": "Need to validate email format before saving",
      "linearIssueId": "HOSP-123",
      "linearIssueUrl": "https://linear.app/hospeda/issue/HOSP-123",
      "priority": 2,
      "labels": ["bug"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Usage Examples

### Adding New TODO

1. Add TODO comment in code:

```ts
// TODO: Add pagination to user list
// Need to implement cursor-based pagination
// for better performance with large datasets
export function getUserList() {
  // ...
}
```

2. Run sync:

```bash
pnpm todo:sync
```

3. Linear issue created automatically with:
   - Title: "Add pagination to user list"
   - Description: Full TODO text
   - Team: Configured team
   - Project: Configured project

### Updating TODO

1. Modify TODO in code:

```ts
// TODO: Add pagination to user list
// UPDATED: Use offset-based pagination instead
// Simpler for our use case
export function getUserList() {
  // ...
}
```

2. Run sync:

```bash
pnpm todo:sync
```

3. Linear issue updated with new description

### Completing TODO

When you complete a TODO:

1. Remove the comment from code
2. Run sync
3. Linear issue automatically closed

Or mark in Linear:

1. Close issue in Linear
2. TODO comment remains as reference

## File Watching

For continuous synchronization during development:

```bash
pnpm todo:watch
```

This:

- Watches for file changes
- Auto-syncs on save
- Provides real-time feedback
- Useful during active development

## Best Practices

1. **Use descriptive TODO messages** - helps create meaningful issues
2. **Add context in additional lines** - becomes issue description
3. **Use priority markers** - [HIGH], [MEDIUM], [LOW]
4. **Tag with labels** - #bug, #feature, #refactor
5. **Keep TODOs focused** - one task per TODO
6. **Remove completed TODOs** - don't leave stale comments
7. **Run sync regularly** - keep Linear up to date
8. **Review before committing** - ensure TODOs are intentional

## Common Workflows

### Development Workflow

```bash
# 1. Start watching for changes
pnpm todo:watch

# 2. Write code and add TODOs as you go
# 3. Issues created/updated automatically
# 4. Review issues in Linear
# 5. Complete TODOs and commit
```

### Sprint Planning

```bash
# 1. Sync all current TODOs
pnpm todo:sync

# 2. Review Linear issues
# 3. Prioritize in Linear
# 4. Assign to team members
# 5. Track progress
```

### Maintenance

```bash
# Clean up old tracking data
pnpm todo:clean

# Re-sync from scratch
pnpm todo:sync
```

## Ignored Paths

By default, these paths are ignored:

- `node_modules/`
- `dist/`, `build/`, `.output/`
- `.git/`
- `coverage/`
- `*.test.ts`, `*.spec.ts`
- `.turbo/`, `.next/`

## Linear Integration Features

- **Auto-create issues** from TODO comments
- **Update issue descriptions** when TODO changes
- **Close issues** when TODO removed
- **Link to code** - issues link back to file/line
- **Preserve manual edits** - doesn't overwrite manual changes in Linear
- **Respect Linear state** - closed issues stay closed

## Troubleshooting

### Issues Not Syncing

```bash
# Check Linear credentials
echo $LINEAR_API_KEY

# Verify team/project IDs
cat .todoLinear/config.json

# Run with verbose output
pnpm todo:sync:verbose
```

### Duplicate Issues

```bash
# Clean tracking file and re-sync
pnpm todo:clean
pnpm todo:sync
```

### Watch Not Working

```bash
# Restart watch process
pnpm todo:watch

# Check for file system limits (Linux)
cat /proc/sys/fs/inotify/max_user_watches
```

## Key Dependencies

- `@linear/sdk` - Linear API client
- `chokidar` - File watching
- `glob` - File pattern matching
- `@repo/schemas` - Validation

## Notes

- Tracking file should be committed to git
- API key should be in `.env.local` (not committed)
- Works best with team/project setup in Linear
- Issues created in configured project only
- Respects Linear's rate limits
- Safe to run multiple times - idempotent
