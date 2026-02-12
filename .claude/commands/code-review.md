---
name: code-review
description: Invokes the code-reviewer agent for systematic code review of staged/unstaged changes or specified files, reporting findings by severity
---

# Code Review Command

## Purpose

Performs a systematic, comprehensive code review by invoking the code-reviewer agent. Reviews staged changes, unstaged changes, or specified files and directories. Reports findings organized by severity level (critical, high, medium, low, info) to help prioritize fixes.

This command provides an automated first-pass code review that catches common issues before human review, improving code quality and reducing review cycles.

## When to Use

- **Before Committing**: Review staged changes before creating a commit
- **Pull Request Preparation**: Ensure code quality before opening a PR
- **Refactoring Validation**: Verify refactored code maintains quality standards
- **Learning**: Get feedback on code patterns and best practices
- **Post-Implementation**: Review completed feature code for quality assurance

## Usage

```bash
/code-review [options]
```

### Options

- `--staged`: Review only staged (git add) changes (default when no files specified)
- `--unstaged`: Review unstaged working directory changes
- `--all`: Review both staged and unstaged changes
- `--files <paths>`: Review specific files or directories (comma-separated)
- `--focus <area>`: Focus review on specific concern (security, performance, patterns, testing, accessibility)
- `--severity <level>`: Minimum severity to report (critical, high, medium, low, info)
- `--report`: Generate detailed review report file
- `--fix-suggestions`: Include actionable fix suggestions for each finding

### Examples

```bash
/code-review                                  # Review staged changes
/code-review --all                            # Review all changes
/code-review --files src/auth/,src/api/       # Review specific directories
/code-review --focus security                 # Focus on security concerns
/code-review --severity medium --report       # Medium+ findings with report
/code-review --staged --fix-suggestions       # Staged changes with fix suggestions
```

## Review Process

### Step 1: Scope Determination

**Actions:**

- Determine review scope based on options provided
- If `--staged`: collect staged files via `git diff --cached --name-only`
- If `--unstaged`: collect modified files via `git diff --name-only`
- If `--all`: collect both staged and unstaged changes
- If `--files`: use specified file paths
- If no option: default to staged changes; if none staged, prompt user

**Checks:**

- [ ] At least one file is in scope for review
- [ ] All specified files exist and are readable
- [ ] File types are reviewable (source code, configuration, etc.)

### Step 2: Change Analysis

**Actions:**

- Read each file in the review scope
- For changed files, analyze the diff to understand what was modified
- Identify the language, framework, and patterns used
- Determine relevant review criteria based on file type and context

**Checks:**

- [ ] All files successfully read
- [ ] Language and framework context identified
- [ ] Relevant review criteria selected

### Step 3: Code Review Execution

**Review Categories:**

1. **Correctness**: Logic errors, edge cases, error handling
2. **Security**: Vulnerabilities, injection risks, data exposure
3. **Performance**: Inefficient patterns, N+1 queries, memory leaks
4. **Maintainability**: Code clarity, naming, documentation, complexity
5. **Patterns & Standards**: Consistency with project conventions
6. **Testing**: Test coverage gaps, missing edge case tests
7. **Accessibility**: UI accessibility concerns (for frontend code)

**Actions:**

- Review each file against all applicable categories
- Assign severity level to each finding
- Provide specific line references for each issue
- Generate fix suggestions when `--fix-suggestions` is enabled

### Step 4: Results Compilation

**Actions:**

- Organize findings by severity (critical -> info)
- Group related findings together
- Calculate summary statistics
- Generate report file if `--report` is enabled

**Checks:**

- [ ] All findings have severity assigned
- [ ] All findings have file and line references
- [ ] Summary statistics are accurate

## Severity Levels

### Critical

Issues that must be fixed before merge:

- Security vulnerabilities (injection, XSS, authentication bypass)
- Data loss or corruption risks
- Breaking changes to public APIs
- Crashes or unhandled exceptions in critical paths

### High

Issues that should be fixed before merge:

- Logic errors that affect functionality
- Missing error handling for common cases
- Performance issues with significant impact
- Missing input validation on user-facing endpoints

### Medium

Issues that should be addressed soon:

- Code duplication that affects maintainability
- Missing or inadequate tests
- Performance optimizations for better user experience
- Inconsistent pattern usage

### Low

Issues to consider improving:

- Code style inconsistencies
- Minor naming improvements
- Documentation gaps
- Refactoring opportunities

### Info

Informational observations:

- Positive patterns observed
- Suggestions for future improvement
- Alternative approaches to consider

## Output Format

### Terminal Output

```
Code Review Results
===================================================================

Scope: 12 files (staged changes)
Focus: All categories

CRITICAL (1)
-------------------------------------------------------------------
[CRIT-001] SQL Injection Risk
  File: src/api/routes/search.ts:45
  Issue: User input concatenated directly into query string
  Fix: Use parameterized queries or ORM query builder

HIGH (2)
-------------------------------------------------------------------
[HIGH-001] Missing Error Handling
  File: src/services/payment.ts:78
  Issue: Payment API call has no try-catch; failures will crash
  Fix: Wrap in try-catch, return meaningful error response

[HIGH-002] Authentication Bypass
  File: src/api/middleware/auth.ts:23
  Issue: Token expiry check missing; expired tokens accepted
  Fix: Add token expiry validation before proceeding

MEDIUM (3)
-------------------------------------------------------------------
[MED-001] Missing Input Validation
  File: src/api/routes/users.ts:34
  Issue: Request body not validated before processing
  Fix: Add schema validation middleware

[MED-002] N+1 Query Pattern
  File: src/services/booking.ts:56
  Issue: Database query inside loop fetches related records individually
  Fix: Use eager loading or batch query

[MED-003] Missing Test Coverage
  File: src/services/payment.ts
  Issue: No tests for error handling paths
  Fix: Add tests for payment failure scenarios

LOW (2)
-------------------------------------------------------------------
[LOW-001] Naming Inconsistency
  File: src/utils/helpers.ts:12
  Issue: Function 'getData' is too generic
  Fix: Rename to describe what data is retrieved

[LOW-002] Code Duplication
  File: src/api/routes/bookings.ts:89, src/api/routes/listings.ts:67
  Issue: Pagination logic duplicated across route handlers
  Fix: Extract shared pagination utility

===================================================================
Summary
===================================================================
  Critical: 1    High: 2    Medium: 3    Low: 2    Info: 0
  Total: 8 findings across 12 files

  Recommendation: Address critical and high issues before merge
```

### Report File

When `--report` is enabled, generates a detailed markdown report at
`.claude/reports/code-review-report.md` with full context, code snippets,
and remediation guidance for each finding.

## Integration with Workflow

This command integrates with the development workflow at multiple points:

- **During Development**: Run frequently for early feedback
- **Pre-Commit**: Review staged changes before committing
- **Pre-PR**: Final review before opening pull request
- **Validation Phase**: Part of comprehensive quality validation

## Best Practices

1. **Review Early and Often**: Run on small changesets for focused feedback
2. **Address Critical First**: Always fix critical issues before proceeding
3. **Use Focus Mode**: When working on specific concerns (e.g., security)
4. **Generate Reports**: For significant changes, keep review reports for reference
5. **Combine with Tests**: Run tests after fixing review findings
6. **Iterate**: Re-run after fixes to verify issues are resolved

## Related Commands

- `/security-review` - Deep security-focused review with confidence scoring
- `/design-review` - Visual UI and design review
- `/check-deps` - Dependency security and update review
- `/help` - Get help on available commands

## Notes

- The code-reviewer agent is invoked as a subagent to perform the actual review
- Review quality depends on the amount of context available; providing full files rather than just diffs produces better results
- For security-critical code, also run `/security-review` for deeper analysis
- Large changesets (50+ files) may take longer; consider reviewing in smaller batches
- The command does not modify any files; it only reports findings
