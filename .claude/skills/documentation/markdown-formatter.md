# Markdown Formatter Skill

**Purpose**: Comprehensive markdown formatting and linting skill that automatically detects and fixes all common markdown format violations across documentation files.

## Overview

This skill provides automated markdown formatting capabilities to ensure consistent, clean, and standards-compliant markdown documentation throughout the project. It addresses all major markdown linting rules and maintains documentation quality.

## Capabilities

### Supported Markdown Rules

#### **MD007** - Unordered List Indentation

- Ensures consistent 2-space indentation for nested lists
- Fixes mixed indentation patterns
- Maintains proper hierarchy structure

#### **MD012** - Multiple Consecutive Blank Lines

- Removes excessive blank lines (more than 1 consecutive)
- Preserves single blank lines for readability
- Maintains proper document structure

#### **MD022** - Headings Surrounded by Blank Lines

- Adds blank lines before and after headings
- Ensures proper heading separation
- Maintains document flow and readability

#### **MD024** - Duplicate Heading Content

- Detects and resolves duplicate heading text
- Suggests contextual alternatives
- Maintains heading hierarchy uniqueness

#### **MD026** - Trailing Punctuation in Headings

- Removes trailing punctuation (., !, ?, :) from headings
- Preserves heading clarity and consistency
- Follows markdown best practices

#### **MD029** - Ordered List Item Prefix

- Ensures consistent ordered list numbering
- Fixes incorrect or inconsistent numbering
- Maintains proper sequence order

#### **MD031** - Fenced Code Blocks Surrounded by Blank Lines

- Adds blank lines before and after code blocks
- Ensures proper code block isolation
- Improves readability and parsing

#### **MD032** - Lists Surrounded by Blank Lines

- Adds blank lines before and after list blocks
- Ensures proper list separation from content
- Maintains document structure

#### **MD036** - Emphasis Used Instead of Heading

- Converts bold/italic emphasis to proper headings
- Maintains document hierarchy
- Improves accessibility and structure

#### **MD040** - Fenced Code Blocks Language Specification

- Adds language identifiers to code blocks
- Improves syntax highlighting
- Enhances code readability

#### **MD051** - Valid Link Fragments

- Validates internal anchor links
- Fixes broken fragment references
- Ensures navigation functionality

#### **MD058** - Tables Surrounded by Blank Lines

- Adds blank lines before and after tables
- Ensures proper table separation
- Improves document structure

## Usage Patterns

### Automated Fixing

```typescript
// Fix single file
await formatMarkdownFile(filePath, options)

// Fix directory recursively  
await formatMarkdownDirectory(directoryPath, options)

// Fix with specific rules only
await formatMarkdownFile(filePath, { 
  rules: ['MD040', 'MD031', 'MD022'] 
})
```

### Validation Only

```typescript
// Validate without fixing
const issues = await validateMarkdown(filePath)

// Get detailed report
const report = await generateMarkdownReport(directoryPath)
```

## Implementation Strategy

### File Processing Pipeline

1. **Parse**: Read and tokenize markdown content
2. **Analyze**: Detect rule violations using AST analysis
3. **Plan**: Generate fix operations for detected issues
4. **Apply**: Execute fixes while preserving content integrity
5. **Validate**: Verify fixes and ensure no regressions

### Context-Aware Fixes

#### Language Detection for Code Blocks

- Analyze surrounding content for context clues
- Use file extension mapping for language hints
- Default to `text` for ambiguous blocks
- Maintain existing valid language specifications

#### Heading Duplicate Resolution

- Add contextual prefixes/suffixes to duplicates
- Consider document section context
- Preserve semantic meaning
- Suggest manual review for complex cases

#### List Indentation Normalization

- Detect existing indentation patterns
- Normalize to 2-space standard
- Preserve nested list relationships
- Handle mixed list types appropriately

## Configuration Options

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
  indentation: 2          # Spaces for list indentation
  line_length: 100        # Max line length
  blank_lines_max: 1      # Max consecutive blank lines
  code_language_default: "text"  # Default code block language
  heading_style: "atx"    # Heading style preference
```

### File Patterns

```yaml
files:
  include: ["**/*.md", "**/*.markdown"]
  exclude: ["node_modules/**", "dist/**", "build/**"]
  respect_gitignore: true
```

## Integration Points

### CLI Integration

- Integrate with project's lint/format commands
- Support for CI/CD pipeline checks
- Git pre-commit hook compatibility
- Watch mode for development

### Editor Integration  

- VS Code extension compatibility
- Real-time formatting on save
- Inline error highlighting
- Quick fix suggestions

### Build Process

- Automated formatting in build pipeline
- Documentation generation integration
- Quality gate enforcement
- Reporting and metrics

## Quality Assurance

### Testing Strategy

- Unit tests for each rule implementation
- Integration tests with real documentation
- Performance benchmarks for large files
- Regression testing for edge cases

### Validation

- Before/after content comparison
- Semantic preservation verification
- Link integrity checking
- Manual review checkpoints

## Error Handling

### Graceful Degradation

- Continue processing on individual rule failures
- Detailed error reporting with context
- Backup creation before modifications
- Rollback capabilities

### Edge Cases

- Malformed markdown handling
- Binary file detection and skipping
- Large file performance optimization
- Unicode and encoding support

## Reporting

### Fix Summary

- Number of files processed
- Rules applied and violations fixed
- Files requiring manual attention
- Performance metrics

### Detailed Reports

- File-by-file breakdown
- Rule violation statistics
- Before/after comparisons
- Suggested improvements

## Best Practices

### Usage Guidelines

1. Always run on clean git state for easy rollback
2. Review changes before committing
3. Configure rules based on project needs
4. Use validation mode first on new codebases
5. Integrate with existing workflow tools

### Maintenance

- Regular rule configuration updates
- Performance monitoring and optimization
- Community feedback integration
- Documentation synchronization

## Dependencies

### Core Requirements

- Node.js runtime environment
- Markdown parsing library (unified/remark)
- File system utilities
- Pattern matching capabilities

### Optional Enhancements

- Git integration for change tracking
- Advanced language detection
- Custom rule plugin system
- Reporting dashboard integration

---

**Note**: This skill should be used as part of the documentation quality assurance process and integrated into the project's development workflow for consistent markdown formatting across all documentation files.
