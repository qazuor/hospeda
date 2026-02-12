---
name: security-review
description: Enhanced security review with confidence scoring and false positive exclusion for precise vulnerability detection
---

# Security Review Command

## Purpose

Performs an enhanced security review of the codebase with confidence-based scoring and intelligent false positive filtering. Unlike a broad security audit, this command focuses on precision -- each finding includes a confidence score, and only findings meeting the confidence threshold (default >= 0.8) are reported. An exclusion list of 17 known false positive categories prevents noise, making the results immediately actionable.

This is the preferred command for security-focused code review where signal quality matters more than comprehensive breadth.

## When to Use

- **Before Production Deployment**: Validate security with high-confidence findings
- **After Security-Related Changes**: Review authentication, authorization, or data handling modifications
- **Pull Request Review**: Security-focused review of proposed changes
- **Regular Security Reviews**: Scheduled security validation
- **Post-Incident Analysis**: After security incidents or vulnerability reports
- **Compliance Requirements**: When security documentation with confidence levels is needed

## Usage

```bash
/security-review [options]
```

### Options

- `--scope <area>`: Focus on specific area (auth, api, database, frontend, deps, config, all)
- `--confidence <threshold>`: Minimum confidence score to report (0.0-1.0, default: 0.8)
- `--include-low-confidence`: Report all findings regardless of confidence
- `--report`: Generate detailed security review report file
- `--fix-suggestions`: Include remediation code suggestions
- `--diff-only`: Only review changed files (staged + unstaged)
- `--exclude <categories>`: Additional false positive categories to exclude

### Examples

```bash
/security-review                                  # Standard review (confidence >= 0.8)
/security-review --scope auth --confidence 0.9    # High-confidence auth review
/security-review --diff-only --fix-suggestions    # Review changes with fixes
/security-review --include-low-confidence         # Show all findings
/security-review --scope api --report             # API review with report
/security-review --confidence 0.7 --scope all     # Broader review
```

## Confidence Scoring System

### How Confidence is Calculated

Each potential security finding is scored from 0.0 to 1.0 based on:

1. **Pattern Match Strength** (0.0-0.3):
   - Exact match to known vulnerability pattern: 0.3
   - Partial match: 0.15
   - Heuristic match: 0.05

2. **Context Analysis** (0.0-0.3):
   - User-controlled input flows to sink: 0.3
   - Indirect input (configuration, database): 0.15
   - Static/constant values: 0.0

3. **Code Flow Analysis** (0.0-0.2):
   - No sanitization between source and sink: 0.2
   - Partial sanitization: 0.1
   - Full sanitization present: 0.0

4. **Environmental Factors** (0.0-0.2):
   - Production code path: 0.2
   - Shared utility: 0.15
   - Test/development only: 0.05

### Confidence Thresholds

| Threshold | Use Case |
|-----------|----------|
| >= 0.9 | Critical deployments, high-stakes reviews |
| >= 0.8 | Standard reviews (default) |
| >= 0.7 | Thorough reviews, security-focused sprints |
| >= 0.5 | Comprehensive analysis, security audits |
| >= 0.0 | Full scan, includes low-confidence findings |

## False Positive Exclusion List

The following 17 categories are excluded by default to reduce noise:

1. **Test File Patterns**: Hardcoded credentials in test fixtures
2. **Example/Documentation Code**: Security anti-patterns shown as examples
3. **Type Definitions**: TypeScript type declarations mentioning sensitive fields
4. **Comment References**: Security terms in code comments
5. **Logging Statements**: Structured log field names (not values)
6. **Error Message Templates**: Static error message strings
7. **Configuration Schema Definitions**: Schema field definitions, not values
8. **Mock/Fixture Data**: Test mocks with dummy credentials
9. **Environment Variable References**: Variable name references (not values)
10. **Constants/Enums**: Named constants for auth roles, permissions
11. **Interface/Type Properties**: Property declarations in interfaces
12. **Import Statements**: Importing security-related modules
13. **Package Metadata**: Package.json fields with security-related names
14. **CI/CD Configuration**: Pipeline config referencing secret names
15. **Linter Rules**: Security-related linter configuration
16. **Generated Code**: Auto-generated files (Prisma client, GraphQL types)
17. **Changelog/Documentation**: Security mentions in markdown files

### Overriding Exclusions

To include specific excluded categories:

```bash
/security-review --exclude "none"               # Disable all exclusions
/security-review --exclude "-test-patterns"      # Re-include test patterns
```

## Review Process

### Step 1: Scope & File Collection

**Actions:**

- Determine review scope from options
- Collect files matching scope criteria
- Filter out excluded file patterns
- Identify language and framework context

**Checks:**

- [ ] Review scope defined
- [ ] Files collected and accessible
- [ ] Exclusion patterns applied
- [ ] Language context identified

### Step 2: Static Analysis

**Review Areas:**

1. **Authentication & Session Management**
   - Token validation and expiry handling
   - Session fixation vulnerabilities
   - Credential storage patterns
   - Multi-factor authentication flows
   - OAuth/OIDC implementation

2. **Authorization & Access Control**
   - Permission checks on protected routes
   - Role-based access control (RBAC) implementation
   - Insecure direct object references (IDOR)
   - Privilege escalation risks
   - Missing authorization middleware

3. **Input Validation & Injection**
   - SQL injection (parameterized query verification)
   - XSS (output encoding, dangerouslySetInnerHTML)
   - Command injection (child_process, exec)
   - Path traversal (file system operations)
   - SSRF (server-side request forgery)
   - Template injection
   - Header injection

4. **Data Protection**
   - Hardcoded secrets and credentials
   - Sensitive data in logs
   - Information disclosure in error responses
   - Unencrypted sensitive data storage
   - PII exposure in API responses

5. **API Security**
   - Rate limiting presence
   - CORS configuration
   - Request size limits
   - Mass assignment vulnerabilities
   - API key exposure

6. **Cryptography**
   - Weak algorithms (MD5, SHA1 for security)
   - Insufficient key lengths
   - Insecure random number generation
   - Missing HTTPS enforcement

7. **Dependency Security**
   - Known vulnerable dependencies
   - Dependency confusion risks
   - Typosquatting detection

### Step 3: Confidence Scoring

**Actions:**

- Calculate confidence score for each potential finding
- Apply false positive exclusion filters
- Filter findings below confidence threshold
- Rank findings by confidence (highest first)

### Step 4: Results Compilation

**Actions:**

- Organize findings by severity and confidence
- Generate remediation suggestions
- Create summary statistics
- Generate report file if requested

## Output Format

### Terminal Output

```
Security Review Results
===================================================================

Scope: All files (143 files analyzed)
Confidence Threshold: >= 0.8
False Positive Exclusions: 17 categories active
Findings: 6 (of 23 total; 17 excluded by confidence/filter)

CRITICAL [confidence: 0.95]
-------------------------------------------------------------------
[SEC-001] SQL Injection via String Concatenation
  File: src/api/routes/search.ts:45
  Confidence: 0.95
  Pattern: User input concatenated into SQL query
  Context: req.query.term used in raw SQL without parameterization
  Impact: Full database access, data exfiltration
  Fix:
    // Before (vulnerable):
    const results = await db.execute(
      `SELECT * FROM items WHERE name LIKE '%${term}%'`
    );

    // After (safe):
    const results = await db.execute(
      sql`SELECT * FROM items WHERE name LIKE ${'%' + term + '%'}`
    );

CRITICAL [confidence: 0.92]
-------------------------------------------------------------------
[SEC-002] Hardcoded API Key
  File: src/services/payment.ts:12
  Confidence: 0.92
  Pattern: String literal matching API key format
  Context: Payment service API key hardcoded instead of env variable
  Impact: Key exposure in version control
  Fix: Move to environment variable, rotate exposed key

HIGH [confidence: 0.88]
-------------------------------------------------------------------
[SEC-003] Missing Authentication on Admin Route
  File: src/api/routes/admin/users.ts:23
  Confidence: 0.88
  Pattern: Route handler without auth middleware
  Context: DELETE /admin/users/:id lacks authentication check
  Impact: Unauthorized user deletion
  Fix: Add authentication middleware to route

HIGH [confidence: 0.85]
-------------------------------------------------------------------
[SEC-004] XSS via dangerouslySetInnerHTML
  File: src/components/RichText.tsx:34
  Confidence: 0.85
  Pattern: dangerouslySetInnerHTML with user-provided content
  Context: User bio rendered without sanitization
  Impact: Stored XSS, session hijacking
  Fix: Sanitize HTML using DOMPurify before rendering

MEDIUM [confidence: 0.83]
-------------------------------------------------------------------
[SEC-005] Missing Rate Limiting
  File: src/api/routes/auth/login.ts:15
  Confidence: 0.83
  Pattern: Authentication endpoint without rate limiter
  Context: Login endpoint allows unlimited attempts
  Impact: Brute force attacks
  Fix: Add rate limiting middleware (e.g., 5 attempts per minute)

MEDIUM [confidence: 0.80]
-------------------------------------------------------------------
[SEC-006] Overly Permissive CORS
  File: src/api/middleware/cors.ts:8
  Confidence: 0.80
  Pattern: CORS origin set to wildcard '*'
  Context: All origins allowed on API with authentication
  Impact: Cross-origin attacks possible
  Fix: Restrict to known frontend domains

===================================================================
Summary
===================================================================

  Critical: 2 (confidence: 0.92-0.95)
  High:     2 (confidence: 0.85-0.88)
  Medium:   2 (confidence: 0.80-0.83)
  Low:      0
  Total:    6 actionable findings

  Excluded: 17 findings below confidence threshold or in exclusion list

  Recommendation: Address critical findings immediately before deployment.
```

### Report File

When `--report` is enabled, generates a comprehensive markdown report at
`.claude/reports/security-review-report.md` including:

- Executive summary with risk assessment
- Detailed findings with code context
- Confidence score breakdown per finding
- Remediation steps with code examples
- False positive analysis
- Comparison with previous review (if available)
- OWASP Top 10 mapping for each finding

## Integration with Workflow

### Validation Phase

This command is a key part of the validation workflow:

1. Run `/code-review` for general quality
2. Run `/security-review` for security-specific analysis
3. Run `/check-deps` for dependency security
4. Address all critical and high findings
5. Document accepted medium/low risks

### CI/CD Integration

```yaml
- name: Security Review
  run: /security-review --confidence 0.8 --report
  continue-on-error: false  # Fail pipeline on critical findings
```

## Best Practices

1. **Use Default Threshold**: 0.8 provides the best signal-to-noise ratio
2. **Lower for Audits**: Use 0.5-0.7 for comprehensive security audits
3. **Raise for CI/CD**: Use 0.9 in CI to only catch high-confidence issues
4. **Review Exclusions**: Periodically review the exclusion list for relevance
5. **Fix Before Deploy**: Never deploy with critical or high findings
6. **Track Over Time**: Generate reports to track security posture improvement
7. **Combine with Audit**: For thorough reviews, pair with `/check-deps`
8. **Rotate Credentials**: If hardcoded secrets are found, rotate immediately

## Comparison with Security Audit

| Aspect | /security-review | /security-audit |
|--------|-----------------|-----------------|
| Focus | Precision, actionable findings | Comprehensive coverage |
| Confidence | Scored (>= 0.8 default) | All findings reported |
| False Positives | 17-category exclusion list | Manual filtering |
| Speed | Faster (targeted analysis) | Slower (exhaustive scan) |
| Use Case | Regular reviews, CI/CD | Quarterly audits, compliance |
| Output | Findings with scores | Full audit report |

## Related Commands

- `/code-review` - General code quality review
- `/check-deps` - Dependency security analysis
- `/help` - Get help on available commands

## Notes

- Confidence scoring is heuristic-based and not a guarantee; human review is still recommended for critical systems
- The exclusion list is designed for common false positive patterns; some exclusions may need adjustment for specific codebases
- For full compliance audits, use a lower confidence threshold and review all findings
- The command does not execute code or make network requests; all analysis is static
- Custom exclusion categories can be added via `--exclude` flag
- Previous review results (if available in `.claude/reports/`) are used for trend analysis
