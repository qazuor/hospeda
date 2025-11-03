---
name: security-audit
category: audit
description: Comprehensive security audit covering OWASP Top 10, authentication, authorization, data protection, and penetration testing
usage: Use for comprehensive security review before deployment, after major changes, or as part of regular security assessments
input: Codebase, API endpoints, authentication system, database schema, infrastructure configuration
output: Security audit report with severity-categorized findings, remediation steps, and compliance status
---

# Security Audit

## Overview

**Purpose**: Comprehensive security audit combining vulnerability assessment, code review, and penetration testing simulation

**Category**: Audit
**Primary Users**: tech-lead
**Coordinates**: Security reviews and vulnerability assessments

## When to Use This Skill

- Before production deployment
- After implementing security-critical features
- As part of regular security assessments (quarterly)
- After security incidents or breaches
- Before handling sensitive data (PII, payments)
- When compliance requirements mandate security audits

## Prerequisites

**Required:**

- Complete application codebase access
- Running application (dev/staging environment)
- API documentation
- Authentication/authorization system
- Database schema and access controls

**Optional:**

- Security scanning tools (OWASP ZAP, Snyk)
- Previous audit reports for comparison
- Compliance requirements (GDPR, PCI-DSS, etc.)

## Input

**What the skill needs:**

- Application URLs and endpoints
- Source code repository access
- Database schema documentation
- Authentication flow diagrams
- API documentation
- Infrastructure configuration
- Third-party integrations list

## Audit Areas (8 Comprehensive Checks)

### 1. Authentication & Authorization

**Checks:**

- Password policies and hashing (bcrypt, scrypt)
- Session management and timeout
- Token security (JWT signing, rotation)
- Multi-factor authentication implementation
- OAuth/SSO configuration
- Role-Based Access Control (RBAC) enforcement
- Principle of least privilege
- Account lockout and brute-force protection

**Output:** Authentication security score, vulnerabilities found, recommendations

### 2. Input Validation & Sanitization

**Checks:**

- Zod schema validation coverage
- SQL injection prevention (parameterized queries)
- XSS prevention (output encoding)
- Path traversal protection
- Command injection prevention
- File upload validation
- CSRF token implementation
- Content-Type validation

**Output:** Input validation coverage %, vulnerabilities, gaps

### 3. Data Protection & Privacy

**Checks:**

- Encryption at rest (database, files)
- Encryption in transit (TLS/HTTPS)
- API key and secret management
- PII handling and GDPR compliance
- Data retention policies
- Secure data deletion
- Logging sensitive data (avoid)
- Database field-level encryption

**Output:** Data protection compliance %, privacy issues, encryption gaps

### 4. API Security

**Checks:**

- Rate limiting implementation
- API authentication (API keys, tokens)
- CORS configuration
- API versioning
- Error message information leakage
- HTTP security headers
- API input/output validation
- GraphQL security (if applicable)

**Output:** API security score, exposed endpoints, header analysis

### 5. Infrastructure & Configuration

**Checks:**

- Environment variable security
- Secrets management (not in code)
- Docker/container security
- Dependency vulnerabilities (npm audit)
- TLS/SSL configuration
- HTTP security headers (CSP, HSTS, etc.)
- HTTPS enforcement
- Database connection security

**Output:** Infrastructure security score, configuration issues, dependencies audit

### 6. Code Security Patterns

**Checks:**

- Error handling (no stack traces in production)
- Secure coding practices
- Hardcoded secrets detection
- Security linting rules
- Type safety enforcement
- Safe deserialization
- Secure random number generation
- Timing attack prevention

**Output:** Code security score, pattern violations, recommendations

### 7. Frontend Security

**Checks:**

- XSS prevention (React auto-escaping)
- Content Security Policy (CSP)
- Subresource Integrity (SRI)
- Third-party script security
- Local storage security
- Cookie security (HttpOnly, Secure, SameSite)
- Clickjacking protection (X-Frame-Options)
- Client-side validation (as UX, not security)

**Output:** Frontend security score, browser vulnerabilities, CSP report

### 8. Penetration Testing Simulation

**Tests:**

- Authentication bypass attempts
- Authorization escalation tests
- SQL injection probes
- XSS injection attempts
- CSRF attack simulation
- Session hijacking tests
- API abuse scenarios
- Business logic flaws

**Output:** Penetration test results, exploitable vulnerabilities, risk assessment

## Workflow

### Phase 1: Preparation (10 minutes)

1. **Gather Information:**
   - Review codebase structure
   - Identify critical endpoints
   - Map authentication flows
   - List third-party integrations

2. **Setup Tools:**
   - Configure security scanners
   - Prepare test accounts
   - Setup monitoring

### Phase 2: Automated Scanning (15 minutes)

1. **Dependency Audit:**

   ```bash
   pnpm audit --audit-level moderate
   npm audit --audit-level moderate
   ```

2. **Code Scanning:**
   - Run ESLint security rules
   - Check for hardcoded secrets
   - Analyze dependencies (Snyk, Socket)

3. **Infrastructure Scan:**
   - Review environment configs
   - Check TLS/SSL certificates
   - Validate HTTP headers

### Phase 3: Manual Review (30 minutes)

1. **Authentication Review:**
   - Inspect password hashing
   - Review session management
   - Test token security
   - Validate RBAC implementation

2. **API Security Review:**
   - Check rate limiting
   - Review CORS configuration
   - Validate input validation
   - Test error handling

3. **Data Protection Review:**
   - Verify encryption usage
   - Check secrets management
   - Review logging practices
   - Validate PII handling

### Phase 4: Penetration Testing (20 minutes)

1. **Authentication Tests:**
   - Try common passwords
   - Test session fixation
   - Attempt token manipulation

2. **Injection Tests:**
   - SQL injection attempts
   - XSS payloads
   - Command injection

3. **Authorization Tests:**
   - Privilege escalation
   - Direct object reference
   - Path traversal

### Phase 5: Reporting (15 minutes)

1. **Categorize Findings:**
   - **Critical:** Immediate fix required (RCE, SQLi, auth bypass)
   - **High:** Fix before deployment (XSS, sensitive data leak)
   - **Medium:** Fix soon (weak encryption, missing headers)
   - **Low:** Best practice improvements (logging, monitoring)

2. **Generate Report:**
   - Executive summary
   - Findings by severity
   - Remediation steps with priority
   - Compliance status
   - Trend analysis (if previous audits exist)

## Output

**Security Audit Report** (saved as `security-audit-report.md`):

```markdown
# Security Audit Report

**Date:** YYYY-MM-DD
**Auditor:** tech-lead
**Application:** [App Name]
**Environment:** [dev/staging/production]

## Executive Summary

- **Overall Security Score:** X/100
- **Critical Issues:** X
- **High Issues:** X
- **Medium Issues:** X
- **Low Issues:** X

## Findings by Severity

### Critical (Immediate Action Required)

1. **[Finding Title]**
   - **Severity:** Critical
   - **Location:** [File/Endpoint]
   - **Description:** [Details]
   - **Impact:** [Security risk]
   - **Remediation:** [Fix steps]
   - **References:** [OWASP link, CVE, etc.]

### High (Fix Before Deployment)

[...]

### Medium (Fix Soon)

[...]

### Low (Improvements)

[...]

## OWASP Top 10 Compliance

- [ ] A01:2021 - Broken Access Control
- [ ] A02:2021 - Cryptographic Failures
- [ ] A03:2021 - Injection
- [ ] A04:2021 - Insecure Design
- [ ] A05:2021 - Security Misconfiguration
- [ ] A06:2021 - Vulnerable Components
- [ ] A07:2021 - Identification & Authentication Failures
- [ ] A08:2021 - Software & Data Integrity Failures
- [ ] A09:2021 - Security Logging & Monitoring Failures
- [ ] A10:2021 - Server-Side Request Forgery (SSRF)

## Recommendations

1. **Immediate Actions** (Critical/High)
   - [Action 1]
   - [Action 2]

2. **Short-term Improvements** (Medium)
   - [Action 1]
   - [Action 2]

3. **Long-term Enhancements** (Low)
   - [Action 1]
   - [Action 2]

## Next Steps

1. Address critical issues immediately
2. Schedule high-priority fixes for next sprint
3. Create GitHub issues for medium/low items
4. Re-audit after fixes are deployed
5. Schedule next audit (quarterly recommended)
```

## Success Criteria

- All critical and high-severity issues identified
- OWASP Top 10 compliance validated
- Remediation steps provided for all findings
- Security score calculated and documented
- Report delivered in actionable format

## Best Practices

1. **Run audits regularly** - Not just before deployment
2. **Track remediation** - Create GitHub issues for findings
3. **Trend analysis** - Compare with previous audits
4. **Automate** - Integrate security scans in CI/CD
5. **Document exceptions** - If findings are accepted risks
6. **Re-audit after fixes** - Verify remediation effectiveness

## Common Security Vulnerabilities to Check

### OWASP Top 10 (2021)

1. **Broken Access Control** - RBAC, direct object references
2. **Cryptographic Failures** - Weak encryption, exposed secrets
3. **Injection** - SQL, XSS, command injection
4. **Insecure Design** - Architecture flaws, threat modeling
5. **Security Misconfiguration** - Default configs, unnecessary features
6. **Vulnerable Components** - Outdated dependencies, CVEs
7. **Authentication Failures** - Weak passwords, session management
8. **Data Integrity Failures** - Insecure deserialization, unsigned updates
9. **Logging Failures** - Insufficient monitoring, log tampering
10. **SSRF** - Unvalidated URLs, internal network access

### Additional Checks

- Business logic flaws
- Race conditions
- Timing attacks
- Denial of service vectors
- Social engineering vulnerabilities

## Tools Integration

**Automated Scanners:**

- `pnpm audit` - Dependency vulnerabilities
- Socket Security - Supply chain security
- ESLint security plugins - Code analysis
- Snyk - Vulnerability scanning

**Manual Tools:**

- OWASP ZAP - Penetration testing
- Burp Suite - API security testing
- Browser DevTools - Frontend security

## Related Skills

- [security-testing](../testing/security-testing.md) - For development testing
- [qa-criteria-validator](../qa/qa-criteria-validator.md) - For acceptance validation
- [tdd-methodology](../patterns/tdd-methodology.md) - For secure development

## Related Commands

- `/security-audit` - Invoke this skill for comprehensive security review
- `/quality-check` - Includes automated security checks
