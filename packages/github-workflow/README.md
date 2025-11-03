# GitHub Workflow Automation

> Automates GitHub workflow integration for planning sessions, TODO generation, and issue enrichment.

## Status

✅ **Production Ready** - Core functionality implemented and tested

## Features

### Core Features (✅ Complete)

- **Planning Sync** - Sync planning sessions to GitHub Issues
- **TODO Detection** - Parse TODO comments from codebase
- **Issue Enrichment** - Enrich issues with planning context
- **Task Completion Detection** - Auto-close issues from commit messages
- **Post-Commit Hook** - Husky integration for automatic task updates
- **Label Management** - Auto-create and manage GitHub labels
- **Project Mapping** - Map files to GitHub Projects
- **VSCode Integration** - Deep links to files in issues
- **Tracking System** - Track sync status across sessions

### Documentation (✅ Complete)

- **Setup Guide** - Complete setup instructions
- **Configuration Reference** - All config options documented
- **API Reference** - Full programmatic API
- **Troubleshooting** - Common issues and solutions

### Testing (✅ Complete)

- **462 Tests** - All passing
- **91%+ Coverage** - Exceeds minimum 90% requirement
- **30 Test Files** - Comprehensive test suite

### Future Enhancements (⏳ Pending)

- **Offline Resync** - Detect and sync changes when back online (T-003-021)
- **Enrichment Agent** - Specialized Claude Code agent (T-003-024)

## Quick Start

### Installation

```bash
# From monorepo root
pnpm install

# Build package
pnpm --filter=@repo/github-workflow build
```

### Configuration

Create `.github-workflow.config.ts` in your project root:

```typescript
export default {
  github: {
    token: process.env.GITHUB_TOKEN!,
    owner: 'your-org',
    repo: 'your-repo',
  },
  sync: {
    planning: {
      enabled: true,
      autoSync: false,
    },
  },
};
```

### Usage

```bash
# Sync planning session to GitHub
pnpm planning:sync .claude/sessions/planning/P-001-feature

# Generate TODOs from codebase
pnpm planning:generate-todos .claude/sessions/planning/P-001-feature

# Enrich issue with planning context
pnpm planning:enrich-issue 42 P-001
```

## Documentation

- **[Setup Guide](./docs/SETUP.md)** - Initial setup and configuration
- **[Configuration Reference](./docs/CONFIGURATION.md)** - All configuration options
- **[API Reference](./docs/API.md)** - Programmatic usage
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues

## Architecture

```
src/
├── core/          # GitHub client
├── sync/          # Planning & TODO sync
├── enrichment/    # Issue enrichment
├── detection/     # Task completion
├── hooks/         # Git hooks
├── config/        # Configuration
├── tracking/      # Sync tracking
├── parsers/       # File parsers
└── utils/         # Utilities
```

## Development

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build
pnpm build
```

## Git Hooks

The package includes Husky post-commit hook that automatically:

1. Scans commit messages for task references (T-XXX-XXX)
2. Updates TODOs.md with completion status
3. Closes corresponding GitHub issues
4. Updates tracking database

**Example:**

```bash
git commit -m "feat(api): implement authentication T-001-005"
# → Automatically marks T-001-005 as completed
# → Closes GitHub issue #42
# → Updates TODOs.md
```

## Configuration

### Environment Variables

```bash
# Required
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
GH_OWNER=your-org
GH_REPO=your-repo

# Optional
GITHUB_PROJECT_GENERAL=Project Name
TRACKING_PATH=.github-workflow/tracking.json
```

### Config File

See [CONFIGURATION.md](./docs/CONFIGURATION.md) for all options.

## API

### TypeScript

```typescript
import { syncPlanningToGitHub } from '@repo/github-workflow';

const result = await syncPlanningToGitHub({
  sessionPath: '.claude/sessions/planning/P-001-auth',
  githubConfig: {
    token: process.env.GITHUB_TOKEN!,
    owner: 'hospeda',
    repo: 'main',
  },
  dryRun: false,
});

console.log(`Synced ${result.statistics.created} issues`);
```

See [API.md](./docs/API.md) for complete reference.

## Testing

### Run Tests

```bash
# All tests
pnpm test

# Coverage report
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Test Statistics

- **30 test files**
- **462 tests** (all passing)
- **91%+ code coverage**

### Test Structure

```
test/
├── core/          # GitHub client tests
├── sync/          # Sync workflow tests
├── enrichment/    # Enrichment tests
├── detection/     # Completion detection tests
├── hooks/         # Git hook tests
├── config/        # Configuration tests
├── tracking/      # Tracking system tests
├── parsers/       # Parser tests
└── utils/         # Utility tests
```

## Troubleshooting

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for:

- Installation issues
- Configuration problems
- GitHub authentication
- Planning sync errors
- Git hook issues
- Performance optimization

## Contributing

This package follows the project's development workflow:

1. **Tests First** - TDD approach (Red → Green → Refactor)
2. **90% Coverage** - Minimum requirement
3. **Type Safety** - Strict TypeScript
4. **Documentation** - Update docs with changes

## License

Part of the Hospeda monorepo. Internal use only.

---

**Package Version:** 0.1.0
**Last Updated:** 2025-11-01
