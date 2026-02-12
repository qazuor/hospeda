---
name: format-markdown
description: Automated markdown formatting and linting with 12 rules, 4-phase processing (Analysis, Planning, Execution, Validation), and context-aware corrections for documentation files
---

# Format Markdown Command

## Purpose

Automatically detect and fix all markdown formatting violations in project
documentation files using comprehensive linting rules and intelligent
context-aware corrections. Fills the gap that code formatters like Biome and
Prettier do not handle well for markdown content.

## Overview

This command provides automated markdown formatting and linting capabilities
across all documentation in the project. It systematically addresses all major
markdown rule violations while preserving content integrity and semantic meaning.

## Command Usage

```bash
# Format all markdown files in the project
/format-markdown

# Format specific file
/format-markdown --file path/to/file.md

# Format with validation only (no changes)
/format-markdown --validate-only

# Format with specific rules only
/format-markdown --rules MD040,MD031,MD022

# Show detailed report
/format-markdown --report
```

## Supported Rules

### **MD007** - Unordered List Indentation

- **Fix**: Normalizes nested list indentation to 2-space increments
- **Detection**: Identifies inconsistent spacing patterns
- **Preservation**: Maintains list hierarchy and relationships

### **MD012** - Multiple Consecutive Blank Lines

- **Fix**: Reduces multiple blank lines to single blank line
- **Detection**: Scans for 2+ consecutive empty lines
- **Preservation**: Maintains document structure and readability

### **MD022** - Headings Surrounded by Blank Lines

- **Fix**: Adds blank lines before and after headings
- **Detection**: Identifies headings without proper spacing
- **Preservation**: Maintains heading hierarchy and document flow

### **MD024** - Duplicate Heading Content

- **Fix**: Adds contextual suffixes to duplicate headings
- **Detection**: Identifies identical heading text within document
- **Preservation**: Maintains semantic meaning and navigation

### **MD026** - Trailing Punctuation in Headings

- **Fix**: Removes trailing punctuation (., !, ?, :) from headings
- **Detection**: Scans heading text for ending punctuation
- **Preservation**: Maintains heading clarity and consistency

### **MD029** - Ordered List Item Prefix

- **Fix**: Corrects ordered list numbering sequence
- **Detection**: Identifies incorrect or inconsistent numbering
- **Preservation**: Maintains list logic and progression

### **MD031** - Fenced Code Blocks Surrounded by Blank Lines

- **Fix**: Adds blank lines before and after code blocks
- **Detection**: Identifies code blocks without proper isolation
- **Preservation**: Improves code readability and parsing

### **MD032** - Lists Surrounded by Blank Lines

- **Fix**: Adds blank lines before and after list blocks
- **Detection**: Identifies lists without proper separation
- **Preservation**: Maintains document structure and list visibility

### **MD036** - Emphasis Used Instead of Heading

- **Fix**: Converts bold/italic emphasis to proper headings
- **Detection**: Identifies emphasized text that should be headings
- **Preservation**: Maintains document hierarchy and accessibility

### **MD040** - Fenced Code Blocks Language Specification

- **Fix**: Adds appropriate language identifiers to code blocks
- **Detection**: Identifies bare code fences without language
- **Context-Aware**: Analyzes surrounding content for language hints

### **MD051** - Valid Link Fragments

- **Fix**: Corrects internal anchor link references
- **Detection**: Validates fragment links within document
- **Preservation**: Ensures navigation functionality

### **MD058** - Tables Surrounded by Blank Lines

- **Fix**: Adds blank lines before and after table blocks
- **Detection**: Identifies tables without proper spacing
- **Preservation**: Improves table visibility and structure

## Implementation Details

### Four-Phase Processing

#### **Phase 1: Analysis**

```text
Scan all target files:
  - Find all markdown files in scope
  - Parse markdown AST for each file
  - Apply rule checkers
  - Collect violation reports
  - Generate fix recommendations
```

#### **Phase 2: Planning**

```text
Plan fixes with conflict resolution:
  - Determine fix strategy for each violation
  - Check for conflicts with other fixes
  - Prioritize by severity and impact
  - Generate atomic fix operations
```

#### **Phase 3: Execution**

```text
Apply fixes systematically:
  - Create backup (.bak) for each file
  - Apply fixes in dependency order
  - Validate fix success
  - Verify no regressions introduced
```

#### **Phase 4: Validation**

```text
Verify all fixes applied correctly:
  - Re-scan for violations
  - Confirm semantic preservation
  - Generate success report
  - Clean up temporary files
```

### Context-Aware Language Detection

For **MD040** (code block language specification), the command uses intelligent
context analysis:

#### Language Inference

```text
Analyze preceding content for language clues:

1. Check previous lines for language hints
   - "TypeScript", "JavaScript", "Python", etc.
   - File extensions mentioned (.ts, .js, .py, etc.)

2. Analyze code block content patterns
   - import/export statements -> typescript/javascript
   - def/class with indentation -> python
   - func/package -> go
   - fn/let/mut -> rust
   - SELECT/INSERT -> sql

3. Apply file extension mapping
   *.ts -> typescript
   *.js -> javascript
   *.py -> python
   *.sql -> sql
   *.yml, *.yaml -> yaml
   *.json -> json
   *.css -> css
   *.html -> html

4. Default to "text" if unable to determine
```

### Duplicate Heading Resolution

For **MD024** (duplicate headings), the command uses these strategies:

1. **Contextual Prefixes**: Add section-based prefixes
2. **Numbered Suffixes**: Append incremental numbers
3. **Semantic Alternatives**: Suggest meaning-preserving alternatives
4. **Manual Review Flags**: Mark complex cases for human review

#### Example Transformation

```markdown
<!-- Before -->
## Installation
...
## Installation

<!-- After -->
## Installation
...
## Installation Steps
```

### Safe Processing Guarantees

#### Content Preservation

- **Backup Creation**: Automatic `.bak` file generation
- **Atomic Operations**: All-or-nothing fix application
- **Rollback Support**: Easy restoration from backups
- **Encoding Safety**: Proper Unicode and UTF-8 handling

#### Validation Checks

- **Semantic Verification**: Content meaning unchanged
- **Link Integrity**: Internal references remain valid
- **Structure Preservation**: Document hierarchy maintained
- **Performance Monitoring**: Processing time tracking

## Configuration Options

### Rule Configuration

```yaml
# Configuration can be embedded in project config
rules:
  enabled:
    - MD007 # List indentation
    - MD012 # Multiple blank lines
    - MD022 # Heading blank lines
    - MD024 # Duplicate headings
    - MD026 # Heading punctuation
    - MD029 # Ordered list prefix
    - MD031 # Code block blank lines
    - MD032 # List blank lines
    - MD036 # Emphasis as heading
    - MD040 # Code block language
    - MD051 # Link fragments
    - MD058 # Table blank lines

formatting:
  list_indentation: 2
  max_blank_lines: 1
  code_language_default: 'text'
  heading_style: 'atx'

files:
  include_patterns:
    - '**/*.md'
    - '**/*.markdown'
  exclude_patterns:
    - 'node_modules/**'
    - 'dist/**'
    - '.git/**'
```

### Performance Tuning

```yaml
performance:
  batch_size: 10        # Files processed in parallel
  max_file_size: '10MB' # Skip files larger than limit
  timeout_seconds: 30   # Max processing time per file
  memory_limit: '256MB' # Memory usage limit
```

## Error Handling

### Graceful Degradation

- **Individual File Failures**: Continue processing remaining files
- **Rule-Specific Errors**: Skip problematic rules, continue others
- **Backup Recovery**: Automatic restoration on processing failure
- **Detailed Logging**: Comprehensive error reporting and context

### Edge Case Handling

- **Binary Files**: Automatic detection and exclusion
- **Large Files**: Size-based processing optimization
- **Malformed Markdown**: Safe parsing with error boundaries
- **Unicode Issues**: Proper encoding detection and handling

## Output and Reporting

### Summary Report

```text
Markdown Formatting Report
================================
Files Processed: 42
Rules Applied: 12
Violations Fixed: 156
Processing Time: 2.3s

Successfully formatted: 40 files
Warnings: 2 files (large file skipped)
Errors: 0 files
```

### Detailed Breakdown

```text
File-by-File Report
======================
commands/commit.md
  - MD040: Added 3 language specifications
  - MD022: Added 12 heading blank lines
  - MD031: Added 5 code block blank lines

agents/product-technical.md (WARNING)
  - MD024: 2 duplicate headings require manual review
  - All other rules applied successfully
```

### Integration Points

- **Git Pre-commit**: Automatic formatting before commits
- **CI/CD Pipeline**: Quality gate enforcement
- **Editor Integration**: Real-time formatting on save
- **Command Line**: Standalone formatting utility

## Best Practices

### Usage Guidelines

1. **Clean Git State**: Always run on committed changes
2. **Review Changes**: Manually verify critical document changes
3. **Incremental Adoption**: Start with specific rules, expand gradually
4. **Team Alignment**: Ensure consistent formatting preferences
5. **Regular Execution**: Integrate into development workflow

### Maintenance

- **Rule Updates**: Regular review of rule effectiveness
- **Performance Monitoring**: Track processing time and memory usage
- **Community Feedback**: Incorporate user suggestions and improvements
- **Documentation Sync**: Keep command docs updated with capabilities

---

## Related Commands

- `/update-docs` - Update documentation content (uses format-markdown for style)
- `/quality-check` - Full quality validation
- `/commit` - Commit formatted documentation

---

**Success Criteria**: All markdown files pass linting with zero violations while
preserving semantic meaning and content integrity.
