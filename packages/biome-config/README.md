# @repo/biome-config

Centralized Biome linting and formatting configuration for the Hospeda monorepo. Provides consistent code quality standards, automatic formatting, and strict linting rules across all packages and applications.

## Features

- **Unified Configuration**: Single source of truth for code style
- **Automatic Formatting**: Consistent code formatting across the monorepo
- **Strict Linting**: Enforces best practices and catches common errors
- **Import Organization**: Automatically organizes and sorts imports
- **Git Integration**: Respects .gitignore and VCS settings
- **Smart Overrides**: Special rules for tests, seeds, and specific packages
- **Fast Performance**: Rust-based tooling for lightning-fast checks

## Installation

This package is internal to the Hospeda monorepo and automatically available to all packages and apps.

```bash
# Install dependencies (from project root)
pnpm install
```

## Configuration Overview

### Core Settings

#### VCS Integration

```json
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "defaultBranch": "main",
    "useIgnoreFile": true
  }
}
```

**Benefits:**

- Respects `.gitignore` patterns
- Integrates with Git workflows
- Ignores generated files automatically

#### File Ignoring

Automatically ignores:

- `**/node_modules/**` - Dependencies
- `**/.turbo/**` - Turborepo cache
- `**/dist/**` - Build output
- `**/build/**` - Build artifacts
- `**/coverage/**` - Test coverage reports
- `**/.output/**` - Build output (Astro/Nitro)
- `**/.vinxi/**` - Vinxi cache
- `**/routeTree.gen.ts` - Generated router files
- `**/*.astro` - Astro components (custom syntax)

### Linter Rules

#### Correctness

```json
{
  "correctness": {
    "noUnusedVariables": "error",
    "noUnusedImports": "error"
  }
}
```

**Enforces:**

- No unused variables (strict)
- No unused imports (automatic cleanup)

#### Style

```json
{
  "style": {
    "useConst": "error",
    "noVar": "error",
    "useTemplate": "error",
    "noNegationElse": "error",
    "noUselessElse": "error"
  }
}
```

**Enforces:**

- `const` for variables that are not reassigned
- No `var` declarations (use `let`/`const`)
- Template literals over string concatenation
- No unnecessary `else` after `return`
- No useless `else` clauses

#### Suspicious

```json
{
  "suspicious": {
    "noConsoleLog": "error",
    "noExplicitAny": "error"
  }
}
```

**Enforces:**

- No `console.log` in production code
- No `any` type in TypeScript (use `unknown` or specific types)

#### Nursery (Experimental)

```json
{
  "nursery": {
    "useSortedClasses": {
      "level": "error",
      "fix": "safe"
    }
  }
}
```

**Enforces:**

- Sorted Tailwind CSS classes (automatic)

### Formatter Settings

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "lineWidth": 100,
    "formatWithErrors": true,
    "attributePosition": "multiline",
    "indentWidth": 4,
    "lineEnding": "lf",
    "useEditorconfig": true
  }
}
```

**JavaScript/TypeScript:**

```json
{
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "none",
      "semicolons": "always"
    }
  }
}
```

**Code Style:**

- 4-space indentation
- 100 character line width
- Single quotes for strings
- No trailing commas
- Always use semicolons
- LF line endings (Unix/Mac)

### Special Overrides

#### Test Files

```json
{
  "include": ["tests/**", "__tests__/**", "test/**"],
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off"
      },
      "style": {
        "noNonNullAssertion": "off"
      },
      "a11y": {
        "useButtonType": "off"
      }
    }
  }
}
```

**Allows in tests:**

- `any` type for mocks and test data
- Non-null assertions (`!`) for test setup
- Buttons without explicit type

#### Seed Files

```json
{
  "include": ["./packages/db/src/seeds/**"],
  "linter": {
    "rules": {
      "suspicious": {
        "noConsoleLog": "off"
      }
    }
  }
}
```

**Allows in seeds:**

- `console.log` for debugging seed operations

#### GitHub Workflow Package

```json
{
  "include": ["**/github-workflow/**"],
  "linter": {
    "rules": {
      "suspicious": {
        "noAssignInExpressions": "off"
      }
    }
  }
}
```

**Allows:**

- Assignment in expressions (common in workflow scripts)

## Usage

### Command Line

```bash
# From project root (checks all packages)
pnpm lint              # Check for issues
pnpm format            # Format all files
pnpm check             # Check and auto-fix

# From specific package
cd packages/db && pnpm run lint
cd packages/db && pnpm run format
cd packages/db && pnpm run check
```

### Package Scripts

All packages inherit these scripts from root:

```json
{
  "scripts": {
    "lint": "biome check .",
    "format": "biome format --write .",
    "check": "biome check --write ."
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/quality.yml
name: Quality Check

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm lint

      - name: Check formatting
        run: pnpm format --check
```

## Code Examples

### Linting Examples

#### ✅ Good Code

```typescript
// Use const for variables not reassigned
const apiUrl = 'https://api.hospeda.com';

// Use template literals
const message = `Welcome, ${user.name}!`;

// No console.log (use logger)
import { logger } from '@repo/logger';
logger.info('User logged in', { userId: user.id });

// No explicit any
function processUser(user: User): void {
  // Implementation
}

// Early return (no else after return)
function validateEmail(email: string): boolean {
  if (!email) {
    return false;
  }
  return email.includes('@');
}
```

#### ❌ Bad Code

```typescript
// Error: Use const instead of let
let apiUrl = 'https://api.hospeda.com';

// Error: Use template literals
const message = 'Welcome, ' + user.name + '!';

// Error: No console.log allowed
console.log('User logged in:', user.id);

// Error: No explicit any
function processUser(user: any): void {
  // Implementation
}

// Error: Unnecessary else
function validateEmail(email: string): boolean {
  if (!email) {
    return false;
  } else {
    return email.includes('@');
  }
}
```

### Formatting Examples

#### ✅ Correct Formatting

```typescript
// Single quotes
const greeting = 'Hello, world!';

// No trailing commas
const config = {
  host: 'localhost',
  port: 3000,
  debug: true
};

// 4-space indentation
function calculateTotal(items: Item[]): number {
    return items.reduce((sum, item) => {
        return sum + item.price;
    }, 0);
}

// Sorted Tailwind classes (automatic)
<div className="flex items-center justify-between gap-4 p-4">
```

#### ❌ Incorrect Formatting

```typescript
// Double quotes (will be auto-fixed)
const greeting = "Hello, world!";

// Trailing commas (will be auto-fixed)
const config = {
  host: 'localhost',
  port: 3000,
  debug: true,
};

// 2-space indentation (will be auto-fixed)
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => {
    return sum + item.price;
  }, 0);
}

// Unsorted classes (will be auto-fixed)
<div className="p-4 gap-4 justify-between items-center flex">
```

## Editor Integration

### VS Code

Install the Biome extension:

```json
{
  "recommendations": ["biomejs.biome"]
}
```

Configure auto-formatting:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

### Other Editors

- **Neovim**: Use `nvim-lspconfig` with Biome LSP
- **Sublime Text**: Install Biome package
- **IntelliJ**: Use Biome plugin

## Best Practices

### 1. Run Checks Before Committing

```bash
# Check code quality
pnpm lint

# Fix auto-fixable issues
pnpm check

# Verify formatting
pnpm format --check
```

### 2. Use Logger Instead of console.log

```typescript
// ❌ Bad
console.log('User created:', user);

// ✅ Good
import { logger } from '@repo/logger';
logger.info('User created', { userId: user.id });
```

### 3. Avoid Explicit any

```typescript
// ❌ Bad
function process(data: any) {
  return data;
}

// ✅ Good
function process<T>(data: T): T {
  return data;
}

// ✅ Good: Use unknown for truly unknown data
function process(data: unknown) {
  if (typeof data === 'string') {
    return data.toUpperCase();
  }
  return data;
}
```

### 4. Use const for Non-Reassigned Variables

```typescript
// ❌ Bad
let apiUrl = 'https://api.hospeda.com';
let maxRetries = 3;

// ✅ Good
const apiUrl = 'https://api.hospeda.com';
const maxRetries = 3;
```

### 5. Organize Imports

Biome automatically organizes imports:

```typescript
// Before
import { z } from 'zod';
import type { User } from './types';
import { logger } from '@repo/logger';
import React from 'react';

// After (automatic)
import React from 'react';
import { z } from 'zod';
import { logger } from '@repo/logger';
import type { User } from './types';
```

## Troubleshooting

### Issue: "Biome not found"

**Solution:**

```bash
# Install dependencies
pnpm install

# Verify Biome is installed
pnpm biome --version
```

### Issue: "Configuration not loaded"

**Solution:**

Ensure `biome.json` exists in package root or extends from `@repo/biome-config`:

```json
{
  "extends": ["@repo/biome-config/biome.json"]
}
```

### Issue: "Console.log errors in seed files"

**Solution:**

Seed files are already excluded. Verify file path:

```
packages/db/src/seeds/  ✅ Allowed
packages/db/src/utils/  ❌ Not allowed
```

### Issue: "Formatting conflicts with Prettier"

**Solution:**

Biome replaces Prettier. Remove Prettier configuration:

```bash
# Remove Prettier
pnpm remove prettier

# Use Biome exclusively
pnpm format
```

### Issue: "any type errors in test files"

**Solution:**

Test files are already excluded. Verify file location:

```
test/           ✅ Allowed
tests/          ✅ Allowed
__tests__/      ✅ Allowed
src/something/  ❌ Not allowed
```

## Migration Guide

### From ESLint + Prettier

**Before:**

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

**After:**

```json
{
  "scripts": {
    "lint": "biome check .",
    "format": "biome format --write .",
    "check": "biome check --write ."
  }
}
```

**Steps:**

1. Remove ESLint and Prettier configs
2. Remove dependencies: `eslint`, `prettier`, related plugins
3. Update scripts to use Biome
4. Run `pnpm check` to auto-fix everything

### From Custom Formatting Rules

Biome uses opinionated defaults. To migrate:

1. Accept Biome's formatting standards
2. Run `pnpm format` on entire codebase
3. Commit formatted code
4. Update team documentation

## Performance

Biome is significantly faster than ESLint + Prettier:

- **10-20x faster** linting
- **30x faster** formatting
- **Instant** feedback in editor
- **Parallel** processing by default

**Benchmark (Hospeda codebase):**

| Tool | Time |
|------|------|
| ESLint + Prettier | ~12s |
| Biome | ~0.8s |

## Configuration Customization

### Override for Specific Package

Create `biome.json` in package root:

```json
{
  "extends": ["../../packages/biome-config/biome.json"],
  "linter": {
    "rules": {
      "suspicious": {
        "noConsoleLog": "warn"
      }
    }
  }
}
```

### Disable Rule Temporarily

```typescript
// biome-ignore lint/suspicious/noConsoleLog: Debugging production issue
console.log('Debug:', data);
```

### Add New Override

Edit `packages/biome-config/biome.json`:

```json
{
  "overrides": [
    {
      "include": ["**/scripts/**"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsoleLog": "off"
          }
        }
      }
    }
  ]
}
```

## Related Packages

- `@repo/typescript-config` - TypeScript configuration
- `@repo/tailwind-config` - Tailwind CSS configuration

## Resources

- [Biome Documentation](https://biomejs.dev)
- [Biome vs ESLint/Prettier](https://biomejs.dev/blog/biome-wins-prettier-challenge/)
- [Linter Rules Reference](https://biomejs.dev/linter/rules/)
- [Formatter Options](https://biomejs.dev/formatter/)

## Contributing

### Adding New Rules

1. Update `packages/biome-config/biome.json`
2. Document the change in this README
3. Run `pnpm check` across monorepo
4. Commit with breaking change note if needed

### Proposing Rule Changes

1. Open discussion with team
2. Test on sample codebases
3. Document rationale
4. Update configuration
5. Auto-fix existing code

## License

Private - Hospeda Project
