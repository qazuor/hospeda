# @repo/tools-todo-linear

> Automated TODO/HACK/DEBUG synchronization with Linear Issues

A powerful tool that automatically scans your codebase for TODO, HACK, and DEBUG comments and synchronizes them with Linear issues. Keep your code comments and project management in perfect sync.

## ✨ Features

- 🔍 **Smart Code Scanning**: Automatically finds TODO, HACK, and DEBUG comments in your codebase
- 🔄 **Bidirectional Sync**: Creates, updates, and archives Linear issues based on code changes
- 🏷️ **Smart Labeling**: Automatically applies labels based on comment type and file location
- 👤 **User Assignment**: Supports `@username` syntax for issue assignment
- 🎯 **IDE Integration**: Configurable deep-links to open files directly in your preferred IDE
- 📁 **Intelligent Filtering**: Respects gitignore and supports custom include/exclude patterns
- 🔒 **Safe Operations**: Preserves user-added content in Linear issues
- 📊 **Detailed Reporting**: Comprehensive sync reports with operation summaries

## 🚀 Quick Start

### 1. Installation

```bash
# The package is already included in the hospeda monorepo
# No additional installation required
```

### 2. Initial Setup

Run the interactive setup to configure Linear integration:

```bash
pnpm todo:setup
```

This will prompt you for:

- **Linear API Key**: Get from Linear → Settings → API → Create new token
- **Linear Team ID**: Get from Linear → Team Settings → General → Team ID  
- **Default User Email**: Email for assigning TODOs when no @user specified
- **IDE Label Name** (optional): Custom label name (default: "From IDE")
- **IDE Link Template** (optional): Custom link format for your IDE

### 3. Start Syncing

```bash
# One-time sync
pnpm todo:sync

# Watch mode (auto-sync on file changes)
pnpm todo:watch

# Clean up orphaned issues
pnpm todo:clean
```

## 📝 Comment Syntax

### Basic TODO Comments

```typescript
// TODO: Implement user authentication
// HACK: Temporary fix for Safari bug
// DEBUG: Remove this console.log before production
```

### Advanced Syntax

```typescript
// TODO @john.doe: Review this implementation
// TODO #performance: Optimize database queries  
// HACK: Workaround for API rate limiting - needs proper solution
```

**Syntax Rules:**

- `@username`: Assigns issue to specific user (must match Linear user email)
- `#label`: Adds custom label to the issue
- `:` separates the directive from the description

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TODO_LINEAR_API_KEY` | ✅ | - | Linear API authentication key |
| `TODO_LINEAR_TEAM_ID` | ✅ | - | Linear team identifier |
| `TODO_LINEAR_DEFAULT_USER_EMAIL` | ✅ | - | Default assignee email |
| `TODO_LINEAR_IDE_LABEL_NAME` | ❌ | `"From IDE"` | Label name for IDE-generated issues |
| `TODO_LINEAR_IDE_LINK_TEMPLATE` | ❌ | `"vscode://file//{filePath}:{lineNumber}"` | IDE link template |

### IDE Link Templates

The `TODO_LINEAR_IDE_LINK_TEMPLATE` supports various IDEs:

**Visual Studio Code:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="vscode://file//{filePath}:{lineNumber}"
```

**JetBrains IDEs (IntelliJ, WebStorm, etc.):**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="jetbrains://idea/navigate/reference?project=hospeda&path={filePath}:{lineNumber}"
```

**Sublime Text:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="subl://{filePath}:{lineNumber}"
```

**Vim/Neovim:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="nvim://{filePath}:{lineNumber}"
```

**Custom Protocol:**

```bash
TODO_LINEAR_IDE_LINK_TEMPLATE="myeditor://open?file={filePath}&line={lineNumber}"
```

**Placeholders:**

- `{filePath}`: Absolute file path
- `{lineNumber}`: Line number where comment is found

## 🛠️ Commands

### `pnpm todo:setup`

Interactive setup wizard for initial configuration.

```bash
pnpm todo:setup
```

### `pnpm todo:sync`

Performs a one-time synchronization of all TODO comments.

```bash
pnpm todo:sync

# Options:
pnpm todo:sync --verbose    # Detailed logging
pnpm todo:sync --dry-run    # Preview changes without applying
```

### `pnpm todo:watch`

Continuous monitoring mode that syncs changes in real-time.

```bash
pnpm todo:watch

# Features:
# - Watches for file changes
# - Automatically syncs new/modified/deleted TODOs
# - Respects debouncing to avoid excessive API calls
```

### `pnpm todo:clean`

Cleans up orphaned Linear issues (issues that no longer have corresponding code comments).

```bash
pnpm todo:clean              # Interactive cleanup
pnpm todo:clean --all        # Clean all orphaned issues
pnpm todo:clean --issue-id ISSUE_ID  # Clean specific issue
```

## 📊 Sync Process

### What Gets Synced

1. **New Comments** → Creates Linear issues
2. **Modified Comments** → Updates existing Linear issues  
3. **Deleted Comments** → Archives Linear issues
4. **Moved Comments** → Updates file location in Linear

### Issue Content Structure

Each Linear issue created contains:

```markdown
Found in: [src/components/Button.tsx:42](vscode://file//project/src/components/Button.tsx:42)

Implement proper error handling for API calls

Auto-generated by todo-linear-sync

---

<!-- User content below this line is preserved -->
Additional notes added in Linear...
```

**Sections:**

- **File Link**: Clickable link to open file in your IDE
- **Description**: Comment content from code
- **Separator**: Divides tool-managed content from user content
- **User Content**: Any additional notes added in Linear (preserved during updates)

## 🏷️ Automatic Labels

The tool automatically applies labels based on:

### Comment Type

- `TODO` → Red label
- `HACK` → Orange label  
- `DEBUG` → Green label

### File Location

- `apps/api/**` → "Apps: API"
- `apps/web/**` → "Apps: Web"
- `apps/admin/**` → "Apps: Admin"
- `packages/**` → "Packages: [package-name]"

### IDE Source

- All issues get the configured IDE label (default: "From IDE")

### Custom Labels

- Use `#label-name` syntax in comments for custom labels

## 📁 File Scanning

### Included by Default

- TypeScript/JavaScript files (`*.ts`, `*.tsx`, `*.js`, `*.jsx`)
- JSON configuration files (`*.json`)
- Markdown documentation (`*.md`)
- Configuration files (`*.config.*`)

### Excluded by Default

- `node_modules/`
- `.git/`
- `dist/`, `build/`, `out/`
- `.turbo/`, `.next/`
- Binary files
- Generated files

### Custom Patterns

Configure scanning in your project root:

```typescript
// todo-linear.config.ts
export default {
  includePatterns: [
    'src/**/*.{ts,tsx,js,jsx}',
    'docs/**/*.md',
    '*.config.{js,ts}'
  ],
  excludePatterns: [
    'src/generated/**',
    '**/*.test.{ts,js}',
    'src/legacy/**'
  ]
};
```

## 🔄 Sync States

### Issue States in Linear

- **Todo**: Active TODO comment in code
- **In Progress**: User manually changed state
- **Done**: User marked as completed
- **Canceled**: Comment removed from code (archived)

### Sync Operations

| Code Change | Linear Action | Issue State |
|-------------|---------------|-------------|
| Add TODO | Create issue | Todo |
| Modify TODO | Update issue | Unchanged |
| Move TODO | Update location | Unchanged |
| Delete TODO | Archive issue | Canceled |
| Restore TODO | Reactivate issue | Todo |

## 🚨 Troubleshooting

### Common Issues

**"Missing required configuration" Error:**

```bash
# Run setup again
pnpm todo:setup

# Check environment variables
cat .env | grep TODO_LINEAR
```

**"Failed to create issue" Error:**

- Verify Linear API key has correct permissions
- Check team ID is correct
- Ensure default user email exists in Linear workspace

**No TODOs Found:**

- Check file patterns are correct
- Verify files aren't in excluded directories
- Use `--verbose` flag to see scanning details

**IDE Links Not Working:**

- Verify your IDE supports custom URL schemes
- Check the link template syntax
- Test with a simple `vscode://` link first

### Debug Mode

Enable verbose logging for detailed information:

```bash
DEBUG=1 pnpm todo:sync --verbose
```

### Log Files

Sync logs are stored in:

```text
.todo-linear/
├── tracking.json     # Tracked comments database
├── sync.log         # Operation history
└── errors.log       # Error details
```

## 🔐 Security

### API Key Safety

- Store API keys in `.env.local` (gitignored)
- Never commit API keys to version control
- Use environment-specific keys for different deployments

### Permissions Required

The Linear API key needs:

- `Read` access to issues and teams
- `Write` access to create and update issues
- `Admin` access to create labels (optional)

## 🤝 Contributing

### Development Setup

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build --filter=@repo/tools-todo-linear

# Run in development
pnpm dev --filter=@repo/tools-todo-linear
```

### Testing

```bash
# Run tests
pnpm test --filter=@repo/tools-todo-linear

# Test with sample project
pnpm todo:sync --dry-run --verbose
```

## 📚 Examples

### Example Project Structure

```text
src/
├── components/
│   ├── Button.tsx        # TODO: Add loading state
│   └── Modal.tsx         # HACK @sarah: Fix z-index issue
├── services/
│   └── api.ts           # DEBUG: Remove console.logs
└── utils/
    └── helpers.ts       # TODO #performance: Optimize sorting
```

### Generated Linear Issues

Each comment becomes a Linear issue with:

- **Title**: Comment description
- **Labels**: Type + Location + IDE + Custom
- **Assignee**: Specified user or default
- **Description**: File location with clickable link
- **Project**: Auto-assigned to team project

## 📄 License

Part of the hospeda monorepo. See root LICENSE file.

## 🆘 Support

For issues and questions:

1. Check this README first
2. Search existing issues in the hospeda repository
3. Create a new issue with detailed reproduction steps
4. Use `--verbose` flag and include log output

---

Made with ❤️ for the hospeda team
