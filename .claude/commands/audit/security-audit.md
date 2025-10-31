---
name: security-audit
type: audit
category: quality
description: Comprehensive security audit combining vulnerability assessment, penetration testing, and security best practices validation
---

# Security Audit Command

## Purpose

Performs a comprehensive security audit of the codebase, combining vulnerability assessment, penetration testing simulation, and security best practices validation. This command replaces the deprecated `/review-security` and `/pen-test` commands with a unified, thorough security analysis.

## When to Use

- **Before Production Deployment**: Validate security before going live
- **After Security-Related Changes**: Audit authentication, authorization, or data handling modifications
- **Regular Security Reviews**: Quarterly or after significant feature additions
- **Post-Incident Analysis**: After security incidents or vulnerability reports
- **Compliance Requirements**: When security documentation is needed

## Usage

```bash
/security-audit [options]
```

### Options

- `--scope <area>`: Focus audit on specific area (auth, api, database, frontend, all)
- `--depth <level>`: Analysis depth (quick, standard, thorough)
- `--report`: Generate detailed security-audit-report.md
- `--fix-suggestions`: Include automated fix suggestions

### Examples

```bash
/security-audit                           # Standard full audit
/security-audit --scope auth --depth thorough --report
/security-audit --scope api --fix-suggestions
```

## Audit Process

### 1. Authentication & Authorization Review

**Checks:**

- [ ] Authentication mechanism properly implemented (Clerk integration)
- [ ] JWT token validation and expiry handling
- [ ] Session management security
- [ ] Password policies (if applicable)
- [ ] Multi-factor authentication (if applicable)
- [ ] OAuth flow security
- [ ] Role-Based Access Control (RBAC) implementation
- [ ] Permission checks on all protected routes
- [ ] Authorization bypass vulnerabilities
- [ ] Privilege escalation risks

**Tools:**

- Static code analysis for auth patterns
- Route authorization verification
- Middleware inspection

### 2. Input Validation & Sanitization

**Checks:**

- [ ] All user inputs validated with Zod schemas
- [ ] SQL injection prevention (Drizzle ORM usage verified)
- [ ] XSS prevention in frontend components
- [ ] CSRF protection on state-changing operations
- [ ] Command injection risks in system calls
- [ ] Path traversal vulnerabilities
- [ ] File upload validation and restrictions
- [ ] API request validation
- [ ] Query parameter sanitization
- [ ] Header injection prevention

**Tools:**

- Zod schema coverage analysis
- Input validation pattern verification
- Grep for dangerous patterns (eval, innerHTML, etc.)

### 3. Data Protection & Privacy

**Checks:**

- [ ] Sensitive data encryption at rest
- [ ] Sensitive data encryption in transit (HTTPS)
- [ ] Database connection security
- [ ] Environment variable protection
- [ ] API key and secret management
- [ ] Personal data handling (GDPR compliance)
- [ ] Data retention policies
- [ ] Secure deletion of sensitive data
- [ ] Logging of sensitive information (prevention)
- [ ] Data exposure through error messages

**Tools:**

- Scan for hardcoded secrets
- Environment variable audit
- Database security configuration review

### 4. API Security

**Checks:**

- [ ] Rate limiting on all public endpoints
- [ ] API authentication required where needed
- [ ] Proper error handling (no information leakage)
- [ ] CORS configuration security
- [ ] Request size limits
- [ ] API versioning strategy
- [ ] Webhook signature verification
- [ ] API response information disclosure
- [ ] GraphQL query depth limits (if applicable)
- [ ] Mass assignment prevention

**Tools:**

- API endpoint enumeration
- Rate limit verification
- CORS configuration review

### 5. Infrastructure & Configuration

**Checks:**

- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] HTTP Strict Transport Security (HSTS)
- [ ] Content Security Policy (CSP)
- [ ] Dependency vulnerabilities (pnpm audit)
- [ ] Outdated package versions
- [ ] Debug mode disabled in production
- [ ] Error stack traces disabled in production
- [ ] Source maps disabled in production
- [ ] Admin interfaces protected
- [ ] Default credentials changed

**Tools:**

- pnpm audit
- Security header verification
- Configuration file review

### 6. Code Security Patterns

**Checks:**

- [ ] No use of dangerous functions (eval, Function constructor)
- [ ] Secure randomness generation
- [ ] Proper error handling without information leakage
- [ ] Secure file operations
- [ ] Safe deserialization
- [ ] Regex DoS prevention
- [ ] Timing attack prevention
- [ ] Race condition handling
- [ ] Secure cookie configuration
- [ ] No commented-out credentials

**Tools:**

- Pattern matching for dangerous code
- Code complexity analysis
- Security linting rules

### 7. Frontend Security

**Checks:**

- [ ] XSS prevention in React components
- [ ] Safe HTML rendering
- [ ] Client-side validation (defense in depth)
- [ ] Sensitive data not exposed in client
- [ ] localStorage/sessionStorage security
- [ ] postMessage security
- [ ] iframe security
- [ ] Third-party script security
- [ ] CDN integrity verification (SRI)
- [ ] Clickjacking prevention

**Tools:**

- React security pattern analysis
- DOM manipulation review
- Third-party dependency audit

### 8. Penetration Testing Simulation

**Checks:**

- [ ] SQL injection attempts (simulated)
- [ ] XSS payload tests (simulated)
- [ ] CSRF token bypass attempts
- [ ] Authentication bypass tests
- [ ] Authorization escalation tests
- [ ] Path traversal tests
- [ ] File inclusion tests
- [ ] Business logic vulnerabilities
- [ ] Rate limit bypass attempts
- [ ] Session fixation tests

**Tools:**

- Automated security testing
- Manual code review
- Attack vector simulation

## Output Format

### Terminal Output

```
🔒 Security Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Summary
  Total Checks: 95
  Passed: 82 (86%)
  Failed: 8 (8%)
  Warnings: 5 (5%)

🔴 Critical Issues (0)
  None found

🟠 High Priority Issues (3)
  1. Missing rate limiting on /api/bookings endpoint
     Location: apps/api/routes/bookings.ts:45
     Fix: Add rate limiting middleware

  2. Potential SQL injection in search query
     Location: packages/db/models/accommodation.model.ts:78
     Fix: Use parameterized query

  3. Sensitive data logged in error handler
     Location: apps/api/middleware/error-handler.ts:23
     Fix: Redact sensitive fields before logging

🟡 Medium Priority Issues (5)
  [List of medium issues...]

🟢 Passed Checks
  ✓ Authentication properly implemented
  ✓ All inputs validated with Zod
  ✓ SQL injection prevented by Drizzle ORM
  ✓ HTTPS enforced
  [...]

💡 Recommendations
  1. Implement CSP headers
  2. Add security monitoring with Sentry
  3. Schedule regular dependency audits
  4. Consider implementing WAF

📄 Detailed report: .claude/reports/security-audit-report.md
```

### Report File Structure

```markdown
# Security Audit Report

**Date**: 2024-01-15T10:30:00Z
**Scope**: Full Application
**Depth**: Standard
**Auditor**: Claude Code Security Audit

## Executive Summary

[High-level overview of findings]

## Critical Issues

### CRIT-001: [Issue Title]
- **Severity**: Critical
- **Location**: file.ts:line
- **Description**: [Detailed description]
- **Impact**: [Security impact]
- **Fix**: [Step-by-step remediation]
- **References**: [OWASP, CWE links]

## High Priority Issues

[Similar structure]

## Medium Priority Issues

[Similar structure]

## Low Priority Issues

[Similar structure]

## Passed Checks

[List of all passed security checks]

## Recommendations

[Security improvement suggestions]

## Next Steps

1. Address critical issues immediately
2. Plan fixes for high priority issues
3. Review and implement recommendations

## Appendix

### Testing Methodology
[Detailed testing approach]

### Tools Used
[List of tools and versions]

### References
- OWASP Top 10
- CWE Top 25
- SANS Top 25
```

## Integration with Workflow

### Phase 3 - Validation

This command should be run during Phase 3 (Validation) of the feature workflow:

1. After implementation complete
2. Before deployment
3. As part of `/quality-check` comprehensive validation

### CI/CD Integration

Can be integrated into GitHub Actions for automated security checks:

```yaml
- name: Security Audit
  run: claude /security-audit --report
```

## Best Practices

1. **Run Before Every Deployment**: Make security audits mandatory
2. **Address Critical Issues Immediately**: Never deploy with critical vulnerabilities
3. **Track Findings Over Time**: Monitor security improvement trends
4. **Educate Team**: Share findings to improve security awareness
5. **Regular Audits**: Schedule quarterly comprehensive audits
6. **Update Regularly**: Keep security patterns current with threats

## Common Vulnerabilities Detected

### Authentication Issues

- Missing authentication checks
- Weak token validation
- Session management flaws

### Authorization Issues

- Missing permission checks
- Privilege escalation risks
- Insecure direct object references

### Input Validation

- Missing input validation
- Inadequate sanitization
- Type confusion vulnerabilities

### Data Exposure

- Sensitive data in logs
- Information disclosure in errors
- Unencrypted sensitive data

## Related Commands

- `/quality-check` - Comprehensive quality validation (includes security)
- `/performance-audit` - Performance-specific audits
- `/accessibility-audit` - Accessibility compliance checks
- `/code-check` - Code quality and standards

## Notes

This command consolidates functionality from:

- Deprecated `/review-security` command
- Deprecated `/pen-test` command

It provides a more comprehensive, structured approach to security validation with automated reporting and fix suggestions.
