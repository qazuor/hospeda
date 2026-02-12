---
name: markdown-formatter
description: Markdown formatting rules and automated fixes. Use when formatting documentation, applying linting rules, or ensuring consistent markdown standards.
---

# Markdown Formatter

## Purpose

Provide comprehensive markdown formatting rules and automated fixes to ensure consistent, clean, and standards-compliant markdown documentation across a project. This skill covers 12 core linting rules, context-aware fixes, configuration options, and integration patterns for CI/CD pipelines and editor workflows.

## When to Use

- When writing or editing markdown documentation
- When linting markdown files before commit
- When enforcing consistent formatting across a repository
- When integrating markdown quality checks into CI/CD
- When onboarding a team to documentation standards

## Formatting Rules

### Rule 1: MD007 -- Unordered List Indentation

Use consistent 2-space indentation for nested unordered lists.

**Incorrect:**

```markdown
- Item 1
    - Nested (4 spaces)
      - Deep nested (6 spaces)
```

**Correct:**

```markdown
- Item 1
  - Nested (2 spaces)
    - Deep nested (4 spaces)
```

### Rule 2: MD012 -- Multiple Consecutive Blank Lines

Never use more than one consecutive blank line. A single blank line provides readability; additional blank lines add no value.

**Incorrect:**

```markdown
## Section 1


## Section 2
```

**Correct:**

```markdown
## Section 1

## Section 2
```

### Rule 3: MD022 -- Headings Surrounded by Blank Lines

Always add a blank line before and after headings.

**Incorrect:**

```markdown
Some paragraph text.
## Heading
More text here.
```

**Correct:**

```markdown
Some paragraph text.

## Heading

More text here.
```

### Rule 4: MD024 -- Duplicate Heading Content

Avoid duplicate heading text within the same document. Add context to differentiate headings with the same name.

**Incorrect:**

```markdown
## Setup
... (for backend)

## Setup
... (for frontend)
```

**Correct:**

```markdown
## Backend Setup
...

## Frontend Setup
...
```

### Rule 5: MD026 -- Trailing Punctuation in Headings

Do not end headings with punctuation characters (period, exclamation, question mark, colon).

**Incorrect:**

```markdown
## Getting Started:

## What is this?
```

**Correct:**

```markdown
## Getting Started

## About This Project
```

### Rule 6: MD029 -- Ordered List Item Prefix

Use sequential numbering for ordered lists (1, 2, 3) or all-ones (1, 1, 1) consistently.

**Incorrect:**

```markdown
1. First
1. Second
3. Third
```

**Correct:**

```markdown
1. First
2. Second
3. Third
```

### Rule 7: MD031 -- Fenced Code Blocks Surrounded by Blank Lines

Always add a blank line before and after fenced code blocks.

**Incorrect:**

````markdown
Some text.
```javascript
const x = 1;
```
More text.
````

**Correct:**

````markdown
Some text.

```javascript
const x = 1;
```

More text.
````

### Rule 8: MD032 -- Lists Surrounded by Blank Lines

Always add a blank line before and after list blocks.

**Incorrect:**

```markdown
Some paragraph.
- Item 1
- Item 2
Another paragraph.
```

**Correct:**

```markdown
Some paragraph.

- Item 1
- Item 2

Another paragraph.
```

### Rule 9: MD036 -- Emphasis Used Instead of Heading

Do not use bold or italic text as a substitute for proper headings.

**Incorrect:**

```markdown
**This is a section title**

Content goes here.
```

**Correct:**

```markdown
## This is a section title

Content goes here.
```

### Rule 10: MD040 -- Fenced Code Blocks Language Specification

Always specify a language identifier on fenced code blocks for proper syntax highlighting. Use `text` for plain text blocks.

**Incorrect:**

````markdown
```
const x = 1;
```
````

**Correct:**

````markdown
```javascript
const x = 1;
```
````

### Rule 11: MD051 -- Valid Link Fragments

Internal anchor links must point to existing headings in the document.

**Incorrect:**

```markdown
See the [setup section](#set-up)  <!-- heading is "## Setup" -->
```

**Correct:**

```markdown
See the [setup section](#setup)
```

### Rule 12: MD058 -- Tables Surrounded by Blank Lines

Always add a blank line before and after tables.

**Incorrect:**

```markdown
Some text.
| Column | Column |
|--------|--------|
| Value  | Value  |
More text.
```

**Correct:**

```markdown
Some text.

| Column | Column |
|--------|--------|
| Value  | Value  |

More text.
```

## Configuration

### Rule Selection

```yaml
rules:
  enabled:
    - MD007  # List indentation
    - MD012  # Multiple blank lines
    - MD022  # Heading blank lines
    - MD024  # Duplicate headings
    - MD026  # Heading punctuation
    - MD029  # Ordered list prefix
    - MD031  # Code block blank lines
    - MD032  # List blank lines
    - MD036  # Emphasis as heading
    - MD040  # Code block language
    - MD051  # Link fragments
    - MD058  # Table blank lines
```

### Formatting Preferences

```yaml
formatting:
  indentation: 2           # Spaces for list indentation
  line_length: 100         # Max line length (soft wrap)
  blank_lines_max: 1       # Max consecutive blank lines
  code_language_default: 'text'  # Default code block language
  heading_style: 'atx'    # Use # style headings
  ordered_list_style: 'sequential'  # 1, 2, 3 (not 1, 1, 1)
```

### File Patterns

```yaml
files:
  include: ['**/*.md', '**/*.markdown']
  exclude: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
  respect_gitignore: true
```

## Process

### Step 1: Parse

Read and tokenize markdown content into an AST (Abstract Syntax Tree).

### Step 2: Analyze

Detect rule violations using AST analysis. Identify:

- Structural issues (blank lines, indentation)
- Semantic issues (duplicate headings, emphasis-as-heading)
- Content issues (missing language specs, broken links)

### Step 3: Fix

Apply corrections while preserving content integrity:

- Add or remove blank lines
- Normalize indentation
- Add language identifiers to code blocks
- Resolve duplicate headings with context

### Step 4: Validate

After fixes, re-analyze to confirm:

- No new violations introduced
- Content semantics preserved
- Links still resolve correctly

## Context-Aware Fixes

### Code Block Language Detection

When adding language identifiers to unlabeled code blocks:

1. Analyze surrounding text for technology references
2. Examine code syntax patterns (imports, keywords, brackets)
3. Check for file extension hints in nearby text
4. Default to `text` for ambiguous blocks

### Heading Deduplication

When resolving duplicate headings:

1. Analyze the section context
2. Add descriptive prefixes or suffixes
3. Preserve semantic meaning
4. Flag complex cases for manual review

### List Indentation Normalization

When fixing list indentation:

1. Detect existing indentation pattern
2. Normalize to 2-space standard
3. Preserve nested relationships
4. Handle mixed ordered/unordered lists correctly

## Integration

### Pre-Commit Hook

```bash
# .husky/pre-commit or similar
npx markdownlint-cli2 "**/*.md"
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Lint Markdown
  run: npx markdownlint-cli2 "**/*.md" "#node_modules"
```

### Editor Integration

- VS Code: markdownlint extension
- Format on save with configured rules
- Inline error highlighting
- Quick fix suggestions

## Best Practices

1. **Run on clean git state** -- easy rollback if fixes cause issues
2. **Review changes before committing** -- automated fixes may need adjustment
3. **Configure rules per project** -- not all rules suit every project
4. **Use validation mode first** -- check before fixing on new codebases
5. **Integrate into CI** -- catch violations before merge
6. **Document exceptions** -- if a rule is disabled, note why
7. **Keep rules consistent** -- same rules across all project documentation
8. **Separate formatting commits** -- do not mix content changes with formatting fixes
9. **Use a linting tool** -- markdownlint, remark-lint, or similar
10. **Train contributors** -- share formatting guidelines in CONTRIBUTING.md

## Error Handling

- Continue processing on individual rule failures
- Provide detailed error reporting with file and line numbers
- Skip binary files automatically
- Handle large files without performance degradation
- Support Unicode and various text encodings

## Reporting

After formatting, produce:

- Number of files processed
- Violations found per rule
- Fixes applied per rule
- Files requiring manual attention
- Before/after summary
