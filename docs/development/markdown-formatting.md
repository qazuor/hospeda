# Markdown Formatting Guide

This document explains how to maintain consistent markdown formatting across the Hospeda project.

## Overview

The project uses `markdownlint-cli2` to enforce markdown formatting standards across all documentation files.

## Quick Start

```bash
# Format all markdown files in the project
pnpm format:md

# Format only .claude documentation
pnpm format:md:claude

# Check markdown without fixing (linting only)
pnpm lint:md
```

## Configuration

Markdown formatting is configured via `.markdownlint-cli2.jsonc` at the project root.

### Enabled Rules

- **MD007**: Unordered list indentation (2 spaces)
- **MD012**: Multiple consecutive blank lines (max 1)
- **MD022**: Headings surrounded by blank lines
- **MD024**: Duplicate heading content (siblings only)
- **MD026**: Trailing punctuation in headings
- **MD031**: Fenced code blocks surrounded by blank lines
- **MD032**: Lists surrounded by blank lines
- **MD036**: Emphasis used instead of heading
- **MD058**: Tables surrounded by blank lines

### Disabled Rules

Some rules are disabled because they require manual review, context, or cause false positives:

- **MD001**: Heading increment (sometimes we need to skip levels)
- **MD029**: Ordered list item prefix (causes false positives with code blocks in lists)
- **MD040**: Code block language specification (requires context)
- **MD041**: First line heading (not always applicable)
- **MD051**: Valid link fragments (requires manual verification)

## Integration

### VS Code

Install the [markdownlint extension](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) for real-time linting in your editor.

### Pre-commit Hook

To automatically format markdown files before commits, add to your `.husky/pre-commit`:

```bash
pnpm lint:md
```

### CI/CD

The markdown linting is (or should be) integrated into the CI/CD pipeline to ensure all PRs maintain formatting standards.

## Common Issues

### Code Blocks Without Language

**Error:** `MD040/fenced-code-language`

**Fix:** Add language identifier to code blocks:

````markdown
<!-- Bad -->
```
const foo = 'bar'
```

<!-- Good -->
```javascript
const foo = 'bar'
```
````

### Duplicate Headings

**Error:** `MD024/no-duplicate-heading`

**Fix:** Make headings unique or use contextual prefixes:

```markdown
<!-- Bad -->
## Installation
## Installation

<!-- Good -->
## Installation
## Installation Steps
```

### Invalid Link Fragments

**Error:** `MD051/link-fragments`

**Fix:** Ensure anchor links match actual headings:

```markdown
<!-- Bad -->
[See Database](#database-setup)
## Database Configuration

<!-- Good -->
[See Database](#database-configuration)
## Database Configuration
```

## Best Practices

### When Writing Documentation

1. **Use proper heading hierarchy**: Start with h1 (`#`), then h2 (`##`), etc.
2. **Add language to code blocks**: Always specify the language (bash, typescript, json, etc.)
3. **Blank lines around blocks**: Add blank lines before/after headings, code blocks, lists, and tables
4. **Consistent list indentation**: Use 2 spaces for nested lists
5. **No trailing punctuation in headings**: Headings should not end with `.`, `!`, `?`, or `:`

### Before Committing

```bash
# 1. Format your markdown files
pnpm format:md

# 2. Check for any remaining issues
pnpm lint:md

# 3. Fix any reported issues manually
# 4. Commit your changes
```

## Troubleshooting

### Format command fails

If `pnpm format:md` fails:

1. Check that markdownlint-cli2 is installed: `npx markdownlint-cli2 --help`
2. Verify `.markdownlint-cli2.jsonc` exists in project root
3. Check for syntax errors in your markdown files
4. Try formatting a single file: `npx markdownlint-cli2 'path/to/file.md' --fix`

### Too many errors reported

Some errors require manual review:

1. Run `pnpm format:md` first to auto-fix what can be fixed
2. Review remaining errors one by one
3. Focus on high-priority rules (MD022, MD031, MD032)
4. Consider disabling less critical rules if needed

## Resources

- [Markdownlint Rules](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md)
- [Markdownlint-cli2 Documentation](https://github.com/DavidAnson/markdownlint-cli2)
- [Markdown Guide](https://www.markdownguide.org/)

## Maintenance

### Updating Configuration

To modify formatting rules, edit `.markdownlint-cli2.jsonc`:

```jsonc
{
  "config": {
    "MD013": false,  // Disable line length rule
    "MD007": {
      "indent": 4    // Change list indentation to 4 spaces
    }
  }
}
```

### Adding Ignored Files

To exclude files from linting, update the `ignores` array in `.markdownlint-cli2.jsonc`:

```jsonc
{
  "ignores": [
    "node_modules/**",
    "dist/**",
    "generated/**"
  ]
}
```

---

**Note**: This formatting system helps maintain documentation quality and consistency across the project. All team members should run `pnpm format:md` before committing markdown changes.
