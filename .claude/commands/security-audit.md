---
name: security-audit
description: Comprehensive security vulnerability assessment covering 8 audit areas aligned with OWASP Top 10, including penetration testing simulation and fix suggestions
---

# Security Audit Command

## Purpose

Performs a comprehensive security audit of the codebase, combining vulnerability
assessment, penetration testing simulation, and security best practices
validation. Provides structured findings with severity ratings and actionable
remediation guidance.

## When to Use

- **Before Production Deployment**: Validate security before going live
- **After Security-Related Changes**: Audit authentication, authorization, or
  data handling modifications
- **Regular Security Reviews**: Quarterly or after significant feature additions
- **Post-Incident Analysis**: After security incidents or vulnerability reports
- **Compliance Requirements**: When security documentation is needed

## Usage

```bash
/security-audit [options]
```

### Options

- `--scope <area>`: Focus audit on specific area (auth, api, database, frontend,
  all)
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

- [ ] Authentication mechanism properly implemented
- [ ] Token validation and expiry handling (JWT, session, etc.)
- [ ] Session management security
- [ ] Password policies (if applicable)
- [ ] Multi-factor authentication (if applicable)
- [ ] OAuth flow security (if applicable)
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

- [ ] All user inputs validated with schemas (Zod, Joi, Yup, etc.)
- [ ] SQL injection prevention (ORM usage verified, parameterized queries)
- [ ] XSS prevention in frontend components
- [ ] CSRF protection on state-changing operations
- [ ] Command injection risks in system calls
- [ ] Path traversal vulnerabilities
- [ ] File upload validation and restrictions
- [ ] API request validation
- [ ] Query parameter sanitization
- [ ] Header injection prevention

**Tools:**

- Schema coverage analysis
- Input validation pattern verification
- Grep for dangerous patterns (eval, innerHTML, dangerouslySetInnerHTML, etc.)

### 3. Data Protection & Privacy

**Checks:**

- [ ] Sensitive data encryption at rest
- [ ] Sensitive data encryption in transit (HTTPS)
- [ ] Database connection security
- [ ] Environment variable protection
- [ ] API key and secret management
- [ ] Personal data handling (GDPR, CCPA compliance)
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
- [ ] Dependency vulnerabilities (package audit)
- [ ] Outdated package versions
- [ ] Debug mode disabled in production
- [ ] Error stack traces disabled in production
- [ ] Source maps disabled in production
- [ ] Admin interfaces protected
- [ ] Default credentials changed

**Tools:**

- Package audit (`npm audit`, `pnpm audit`, `yarn audit`)
- Security header verification
- Configuration file review

### 6. Code Security Patterns

**Checks:**

- [ ] No use of dangerous functions (eval, Function constructor)
- [ ] Secure randomness generation
- [ ] Proper error handling without information leakage
- [ ] Secure file operations
- [ ] Safe deserialization
- [ ] Regex DoS prevention (ReDoS)
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

- [ ] XSS prevention in components
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

- Component security pattern analysis
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

```text
Security Audit Report

Summary
  Total Checks: 95
  Passed: 82 (86%)
  Failed: 8 (8%)
  Warnings: 5 (5%)

Critical Issues (0)
  None found

High Priority Issues (3)
  1. Missing rate limiting on /api/bookings endpoint
     Location: src/routes/bookings.ts:45
     Fix: Add rate limiting middleware

  2. Potential SQL injection in search query
     Location: src/models/item.model.ts:78
     Fix: Use parameterized query

  3. Sensitive data logged in error handler
     Location: src/middleware/error-handler.ts:23
     Fix: Redact sensitive fields before logging

Medium Priority Issues (5)
  [List of medium issues...]

Passed Checks
  Authentication properly implemented
  All inputs validated with schemas
  SQL injection prevented by ORM
  HTTPS enforced
  [...]

Recommendations
  1. Implement CSP headers
  2. Add security monitoring
  3. Schedule regular dependency audits
  4. Consider implementing WAF
```

### Report File Structure

When `--report` is used, generates a detailed markdown report:

```markdown
# Security Audit Report

**Date**: [timestamp]
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

### References
- OWASP Top 10
- CWE Top 25
- SANS Top 25
```

## OWASP Top 10 Coverage

This audit covers all OWASP Top 10 categories:

| OWASP Category                          | Audit Section                       |
| --------------------------------------- | ----------------------------------- |
| A01: Broken Access Control              | Section 1 (Auth & Authorization)    |
| A02: Cryptographic Failures             | Section 3 (Data Protection)         |
| A03: Injection                          | Section 2 (Input Validation)        |
| A04: Insecure Design                    | Section 6 (Code Security Patterns)  |
| A05: Security Misconfiguration          | Section 5 (Infrastructure & Config) |
| A06: Vulnerable Components             | Section 5 (Dependency audit)        |
| A07: Auth Failures                      | Section 1 (Auth & Authorization)    |
| A08: Software & Data Integrity Failures | Section 6 (Deserialization)         |
| A09: Logging & Monitoring Failures      | Section 3 (Data Protection)         |
| A10: Server-Side Request Forgery        | Section 4 (API Security)            |

## Best Practices

1. **Run Before Every Deployment**: Make security audits mandatory
2. **Address Critical Issues Immediately**: Never deploy with critical
   vulnerabilities
3. **Track Findings Over Time**: Monitor security improvement trends
4. **Educate Team**: Share findings to improve security awareness
5. **Regular Audits**: Schedule quarterly comprehensive audits
6. **Update Regularly**: Keep security patterns current with threats

## Related Commands

- `/quality-check` - Comprehensive quality validation (includes security)
- `/performance-audit` - Performance-specific audits
- `/accessibility-audit` - Accessibility compliance checks
- `/code-check` - Code quality and standards
