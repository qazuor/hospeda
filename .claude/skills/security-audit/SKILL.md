---
name: security-audit
description: Security audit patterns for OWASP Top 10 compliance. Use when conducting security reviews, penetration testing, or auditing authentication and data protection.
---

# Security Audit

## Purpose

Conduct a comprehensive security audit combining vulnerability assessment, code review, and penetration testing simulation. This skill covers OWASP Top 10 compliance, authentication, authorization, data protection, API security, infrastructure configuration, and dependency analysis to produce an actionable security report.

## When to Use

- Before production deployment
- After implementing security-critical features
- As part of regular security assessments (quarterly recommended)
- After security incidents or breaches
- Before handling sensitive data (PII, payments)
- When compliance requirements mandate a security audit

## Audit Areas

### 1. Authentication and Authorization

**Checks:**

- Password policies and hashing algorithms (bcrypt, scrypt, argon2)
- Session management and expiration
- Token security (JWT signing, rotation, revocation)
- Multi-factor authentication implementation
- OAuth/SSO configuration
- Role-Based Access Control (RBAC) enforcement
- Principle of least privilege
- Account lockout and brute-force protection

### 2. Input Validation and Sanitization

**Checks:**

- Schema validation coverage (all endpoints)
- SQL injection prevention (parameterized queries, ORM usage)
- XSS prevention (output encoding, CSP)
- Path traversal protection
- Command injection prevention
- File upload validation (type, size, content)
- CSRF token implementation
- Content-Type enforcement

### 3. Data Protection and Privacy

**Checks:**

- Encryption at rest (database, file storage)
- Encryption in transit (TLS/HTTPS enforcement)
- API key and secret management (env vars, vaults)
- PII handling and GDPR/privacy compliance
- Data retention and deletion policies
- No sensitive data in logs
- Database field-level encryption for critical fields

### 4. API Security

**Checks:**

- Rate limiting implementation
- API authentication (keys, tokens, OAuth)
- CORS configuration (no wildcard origins)
- Error message information leakage
- HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Request size limits
- API versioning

### 5. Infrastructure and Configuration

**Checks:**

- Environment variable management (no hardcoded secrets)
- Container/deployment security
- Dependency vulnerabilities (npm/pnpm audit)
- TLS/SSL certificate configuration
- HTTP security headers
- Database connection security
- Default credentials removed

### 6. Code Security Patterns

**Checks:**

- No stack traces exposed in production
- Secure coding practices followed
- Hardcoded secrets detection
- Type safety enforcement
- Safe deserialization
- Secure random number generation
- Timing attack prevention in comparisons

### 7. Frontend Security

**Checks:**

- XSS prevention (framework auto-escaping)
- Content Security Policy (CSP)
- Subresource Integrity (SRI) for CDN resources
- Third-party script security
- Local/session storage security (no tokens in localStorage)
- Cookie security flags (HttpOnly, Secure, SameSite)
- Clickjacking protection

### 8. Penetration Testing Simulation

**Tests:**

- Authentication bypass attempts
- Authorization escalation attempts
- SQL injection probes on all inputs
- XSS injection on all user-facing fields
- CSRF attack simulation
- Session hijacking attempts
- API abuse scenarios (rate limit bypass, parameter tampering)
- Business logic flaw exploration

## Workflow

### Phase 1: Preparation

1. Review codebase structure and identify critical endpoints
2. Map authentication and authorization flows
3. List third-party integrations and external dependencies
4. Configure security scanning tools
5. Prepare test accounts with different permission levels

### Phase 2: Automated Scanning

1. Run dependency audit:

```bash
npm audit --audit-level moderate
pnpm audit --audit-level moderate
```

2. Run code scanning (ESLint security rules, secret detection)
3. Review infrastructure configuration (environment, TLS, headers)

### Phase 3: Manual Review

1. Inspect password hashing and session management code
2. Review authorization checks on all endpoints
3. Verify input validation on all user-facing inputs
4. Check error handling for information leakage
5. Review logging for sensitive data exposure

### Phase 4: Penetration Testing

1. Test authentication bypass vectors
2. Attempt injection attacks on all inputs
3. Test authorization escalation paths
4. Verify rate limiting and abuse prevention
5. Check for business logic vulnerabilities

### Phase 5: Reporting

Categorize findings by severity:

- **Critical**: Immediate fix required (RCE, SQL injection, auth bypass)
- **High**: Fix before deployment (XSS, sensitive data exposure)
- **Medium**: Fix soon (weak encryption, missing headers)
- **Low**: Best practice improvements (logging, monitoring)

## Report Template

```markdown
# Security Audit Report

**Date:** YYYY-MM-DD
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
   - **Location:** [File/Endpoint]
   - **Description:** [Details]
   - **Impact:** [Security risk]
   - **Remediation:** [Fix steps]
   - **References:** [OWASP, CVE]

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
2. **Short-term Improvements** (Medium)
3. **Long-term Enhancements** (Low)

## Next Steps
1. Address critical issues immediately
2. Schedule high-priority fixes for next sprint
3. Create tickets for medium/low findings
4. Re-audit after fixes are deployed
5. Schedule next audit (quarterly)
```

## OWASP Top 10 Quick Reference

1. **Broken Access Control** -- RBAC, direct object references, path traversal
2. **Cryptographic Failures** -- weak encryption, exposed secrets, plaintext data
3. **Injection** -- SQL, XSS, command injection, LDAP injection
4. **Insecure Design** -- missing threat modeling, architecture flaws
5. **Security Misconfiguration** -- default configs, unnecessary features, verbose errors
6. **Vulnerable Components** -- outdated dependencies, known CVEs
7. **Authentication Failures** -- weak passwords, broken session management
8. **Data Integrity Failures** -- insecure deserialization, unsigned updates
9. **Logging Failures** -- insufficient monitoring, log tampering, missing audit trails
10. **SSRF** -- unvalidated URLs, internal network access from user input

## Best Practices

1. **Run audits regularly** -- quarterly at minimum, not just before deployment
2. **Track remediation** -- create tickets for every finding
3. **Trend analysis** -- compare results with previous audits
4. **Automate scanning** -- integrate security checks into CI/CD
5. **Document exceptions** -- record any accepted risks with justification
6. **Re-audit after fixes** -- verify that remediations are effective
7. **Defense in depth** -- never rely on a single security control
8. **Least privilege** -- grant minimum required access at every layer
9. **Keep dependencies current** -- patch vulnerabilities promptly
10. **Educate the team** -- security awareness is everyone's responsibility

## Recommended Tools

**Automated Scanners:**

- npm audit / pnpm audit -- dependency vulnerabilities
- Snyk -- vulnerability scanning and monitoring
- ESLint security plugins -- static code analysis
- Socket Security -- supply chain security

**Manual Testing:**

- OWASP ZAP -- web application scanning
- Burp Suite -- API and web security testing
- Browser DevTools -- frontend security inspection
