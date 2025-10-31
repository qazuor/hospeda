---
name: security-testing
category: testing
description: Security testing methodology covering authentication, authorization, input validation, XSS, SQL injection, and OWASP Top 10
usage: Use to validate security measures, identify vulnerabilities, and ensure secure coding practices before deployment
input: Application components (API, frontend, database), authentication system, validation logic
output: Security test suite, vulnerability report, remediation recommendations
---

# Security Testing

## Overview

**Purpose**: Comprehensive security testing to identify and prevent vulnerabilities across the application stack

**Category**: Testing
**Primary Users**: security-engineer, qa-engineer, tech-lead

## When to Use This Skill

- Before production deployment
- After implementing authentication/authorization
- When handling sensitive data
- After security-related code changes
- As part of regular security audits
- Before handling payments or PII

## Prerequisites

**Required:**

- Authentication system implemented
- API routes with authorization
- Input validation with Zod
- Database access controls
- Test environment isolated from production

**Optional:**

- Security scanning tools
- OWASP ZAP or Burp Suite
- npm audit / Snyk

## Input

**What the skill needs:**

- Application URLs and endpoints
- Authentication credentials (test accounts)
- API documentation
- Database schema
- Input validation schemas

## Workflow

### Step 1: Authentication Testing

**Objective**: Verify authentication mechanisms are secure

**Actions:**

1. Test valid authentication
2. Test invalid credentials
3. Test brute force protection
4. Test session management
5. Test token expiration
6. Test password policies
7. Test MFA (if applicable)
8. Test OAuth flows
9. Test logout functionality

**Validation:**

- [ ] Strong passwords enforced
- [ ] Failed login attempts limited
- [ ] Sessions expire appropriately
- [ ] Tokens properly validated
- [ ] Logout invalidates sessions

**Output**: Authentication security test results

**Example Test:**

```typescript
import { describe, it, expect } from 'vitest';
import { app } from '../../../src/index';

describe('Authentication Security', () => {
  it('should reject invalid credentials', async () => {
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrongpassword'
      })
    });

    expect(response.status).toBe(401);
  });

  it('should rate limit failed login attempts', async () => {
    // Attempt 10 failed logins
    for (let i = 0; i < 10; i++) {
      await app.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrong'
        })
      });
    }

    // 11th attempt should be rate limited
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'wrong'
      })
    });

    expect(response.status).toBe(429); // Too Many Requests
  });

  it('should validate JWT tokens', async () => {
    const response = await app.request('/api/protected', {
      headers: {
        Authorization: 'Bearer invalid-token'
      }
    });

    expect(response.status).toBe(401);
  });
});
```

### Step 2: Authorization Testing

**Objective**: Ensure proper access control and permissions

**Actions:**

1. Test role-based access control (RBAC)
2. Test resource ownership validation
3. Test privilege escalation attempts
4. Test horizontal access control
5. Test vertical access control
6. Test admin vs user permissions

**Validation:**

- [ ] Users can only access own resources
- [ ] Admin-only endpoints protected
- [ ] No privilege escalation possible
- [ ] Permissions checked on all operations

**Output**: Authorization security test results

**Example Test:**

```typescript
describe('Authorization Security', () => {
  it('should prevent users from accessing others resources', async () => {
    const userAToken = await getUserToken('user-a');
    const userBResourceId = 'user-b-resource-id';

    const response = await app.request(
      `/api/bookings/${userBResourceId}`,
      {
        headers: { Authorization: `Bearer ${userAToken}` }
      }
    );

    expect(response.status).toBe(403); // Forbidden
  });

  it('should require admin role for admin endpoints', async () => {
    const userToken = await getUserToken('regular-user');

    const response = await app.request('/api/admin/users', {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    expect(response.status).toBe(403);
  });
});
```

### Step 3: Input Validation Testing

**Objective**: Prevent injection attacks and malicious input

**Actions:**

1. **SQL Injection Testing**:
   - Test with SQL injection payloads
   - Verify parameterized queries used
   - Test all input fields

2. **XSS Testing**:
   - Test with XSS payloads
   - Verify output encoding
   - Test reflected and stored XSS

3. **Command Injection**:
   - Test system command inputs
   - Verify safe execution

4. **Path Traversal**:
   - Test file path inputs
   - Verify path sanitization

5. **Validation Bypass**:
   - Test client-side only validation
   - Test type confusion
   - Test boundary values

**Validation:**

- [ ] All inputs validated with Zod
- [ ] SQL injection prevented (Drizzle ORM)
- [ ] XSS prevented (React escaping)
- [ ] No command injection possible
- [ ] Path traversal blocked

**Output**: Input validation security results

**Example Test:**

```typescript
describe('Input Validation Security', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";

    const response = await app.request(
      `/api/search?q=${encodeURIComponent(maliciousInput)}`
    );

    // Should return safely (possibly empty results)
    expect(response.status).toBe(200);

    // Verify database intact
    const usersCount = await db.users.count();
    expect(usersCount).toBeGreaterThan(0);
  });

  it('should prevent XSS attacks', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await app.request('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ content: xssPayload })
    });

    const comment = await response.json();

    // Content should be escaped
    expect(comment.content).not.toContain('<script>');
    expect(comment.content).toContain('&lt;script&gt;');
  });
});
```

### Step 4: Data Protection Testing

**Objective**: Ensure sensitive data is properly protected

**Actions:**

1. Test encryption at rest
2. Test encryption in transit (HTTPS)
3. Test sensitive data exposure
4. Test logging (no secrets logged)
5. Test error messages (no data leakage)
6. Test data deletion (proper cleanup)

**Validation:**

- [ ] HTTPS enforced
- [ ] Sensitive fields encrypted
- [ ] No secrets in logs
- [ ] No PII in error messages
- [ ] Secure data deletion

**Output**: Data protection security results

**Example Test:**

```typescript
describe('Data Protection Security', () => {
  it('should not expose sensitive data in API responses', async () => {
    const response = await app.request('/api/users/profile');
    const user = await response.json();

    // Should not include sensitive fields
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('resetToken');
  });

  it('should not leak data in error messages', async () => {
    const response = await app.request('/api/users/non-existent-id');

    expect(response.status).toBe(404);
    const error = await response.json();

    // Should not reveal internal details
    expect(error.message).not.toContain('database');
    expect(error.message).not.toContain('SQL');
    expect(error).not.toHaveProperty('stack');
  });
});
```

### Step 5: API Security Testing

**Objective**: Validate API-specific security measures

**Actions:**

1. Test rate limiting
2. Test CORS configuration
3. Test request size limits
4. Test API versioning
5. Test content-type validation
6. Test security headers

**Validation:**

- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] Request size limited
- [ ] Security headers set
- [ ] API keys protected

**Output**: API security test results

**Example Test:**

```typescript
describe('API Security', () => {
  it('should have security headers', async () => {
    const response = await app.request('/api/users');

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('should enforce CORS policy', async () => {
    const response = await app.request('/api/users', {
      headers: { Origin: 'https://malicious-site.com' }
    });

    expect(response.headers.get('Access-Control-Allow-Origin'))
      .not.toBe('*');
  });
});
```

### Step 6: Dependency Security Testing

**Objective**: Identify vulnerable dependencies

**Actions:**

1. Run `pnpm audit`
2. Check for outdated packages
3. Review security advisories
4. Test dependency updates
5. Monitor for new vulnerabilities

**Validation:**

- [ ] No critical vulnerabilities
- [ ] No high vulnerabilities
- [ ] Medium vulnerabilities documented
- [ ] Dependencies up to date

**Output**: Dependency vulnerability report

**Command:**

```bash
pnpm audit --audit-level moderate
```

## Output

**Produces:**

- Security test suite
- Vulnerability report
- Remediation recommendations
- Compliance checklist (OWASP Top 10)

**Success Criteria:**

- All security tests passing
- No critical vulnerabilities
- Authentication/authorization secure
- Input validation comprehensive
- Data protection adequate

## OWASP Top 10 Coverage

1. **Broken Access Control** ✓
   - Authorization tests
   - Resource ownership validation

2. **Cryptographic Failures** ✓
   - HTTPS enforcement
   - Sensitive data encryption

3. **Injection** ✓
   - SQL injection tests
   - Command injection tests

4. **Insecure Design** ✓
   - Security by design validation
   - Threat modeling

5. **Security Misconfiguration** ✓
   - Security headers tests
   - Default configuration checks

6. **Vulnerable Components** ✓
   - Dependency scanning
   - Update verification

7. **Authentication Failures** ✓
   - Auth mechanism tests
   - Session management tests

8. **Data Integrity Failures** ✓
   - Input validation tests
   - Data tampering prevention

9. **Logging Failures** ✓
   - Log security validation
   - No sensitive data logging

10. **SSRF** ✓
    - URL validation
    - External request validation

## Tools

- **Vitest**: Unit/integration security tests
- **OWASP ZAP**: Web application scanner
- **npm audit / pnpm audit**: Dependency scanning
- **Snyk**: Vulnerability monitoring
- **SonarQube**: Code security analysis

## Best Practices

1. **Defense in Depth**: Multiple security layers
2. **Fail Securely**: Default to deny access
3. **Least Privilege**: Minimal required permissions
4. **Input Validation**: Validate all inputs
5. **Output Encoding**: Prevent XSS
6. **Parameterized Queries**: Prevent SQL injection
7. **Security Headers**: Set all recommended headers
8. **Regular Audits**: Continuous security testing
9. **Update Dependencies**: Keep packages current
10. **Educate Team**: Security awareness training

## Related Skills

- `api-app-testing` - API functionality testing

## Notes

- Security is continuous, not one-time
- Test both happy paths and attack vectors
- Assume all input is malicious
- Never trust client-side validation alone
- Log security events for monitoring
- Stay updated on latest vulnerabilities
- Security testing should be automated in CI/CD

---

## Changelog

| Version | Date | Changes | Author | Related |
|---------|------|---------|--------|---------|
| 1.0.0 | 2025-10-31 | Initial version | @tech-lead | P-004 |
