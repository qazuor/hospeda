---
name: security-testing
description: Security testing methodology for authentication, authorization, and injection prevention. Use when validating security measures or testing OWASP compliance.
---

# Security Testing

## Purpose

Provide a comprehensive security testing methodology covering authentication, authorization, input validation, injection prevention, data protection, and OWASP Top 10 compliance. This skill identifies vulnerabilities across the application stack and validates that security measures are correctly implemented.

## When to Use

- Before production deployment
- After implementing authentication or authorization
- When handling sensitive data (PII, payments)
- After security-related code changes
- As part of regular security assessments
- When adding new API endpoints or user inputs

## Process

### Step 1: Authentication Testing

**Objective**: Verify authentication mechanisms are secure.

**Tests:**

1. Valid authentication succeeds
2. Invalid credentials are rejected
3. Brute force protection is active (rate limiting)
4. Session management is secure
5. Token expiration is enforced
6. Password policies are enforced
7. Logout invalidates sessions/tokens
8. OAuth/SSO flows are correctly implemented

**Example:**

```typescript
describe('Authentication Security', () => {
  it('should reject invalid credentials', async () => {
    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'wrongpassword',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('should rate limit failed login attempts', async () => {
    for (let i = 0; i < 10; i++) {
      await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'wrong' }),
      });
    }

    const response = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'wrong' }),
    });

    expect(response.status).toBe(429);
  });

  it('should reject invalid JWT tokens', async () => {
    const response = await app.request('/api/protected', {
      headers: { Authorization: 'Bearer invalid-token-value' },
    });

    expect(response.status).toBe(401);
  });
});
```

### Step 2: Authorization Testing

**Objective**: Ensure proper access control and permissions.

**Tests:**

1. Role-based access control (RBAC) enforcement
2. Resource ownership validation
3. Privilege escalation prevention
4. Horizontal access control (user A cannot access user B resources)
5. Vertical access control (regular users cannot access admin endpoints)

**Example:**

```typescript
describe('Authorization Security', () => {
  it('should prevent users from accessing other users resources', async () => {
    const userAToken = await getAuthToken('user-a');

    const response = await app.request('/api/resources/user-b-resource-id', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    expect(response.status).toBe(403);
  });

  it('should require admin role for admin endpoints', async () => {
    const regularUserToken = await getAuthToken('regular-user');

    const response = await app.request('/api/admin/users', {
      headers: { Authorization: `Bearer ${regularUserToken}` },
    });

    expect(response.status).toBe(403);
  });
});
```

### Step 3: Input Validation Testing

**Objective**: Prevent injection attacks and malicious input.

**SQL Injection:**

```typescript
it('should prevent SQL injection', async () => {
  const maliciousInput = "'; DROP TABLE users; --";

  const response = await app.request(
    `/api/search?q=${encodeURIComponent(maliciousInput)}`
  );

  expect(response.status).toBe(200);

  // Verify database is intact
  const usersExist = await db.users.count();
  expect(usersExist).toBeGreaterThan(0);
});
```

**XSS Prevention:**

```typescript
it('should prevent XSS attacks', async () => {
  const xssPayload = '<script>alert("XSS")</script>';

  const response = await app.request('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: xssPayload }),
  });

  const data = await response.json();
  expect(data.content).not.toContain('<script>');
});
```

**Additional input validation tests:**

- Command injection payloads
- Path traversal attempts (../../etc/passwd)
- Type confusion attacks
- Boundary value abuse
- Oversized payloads

### Step 4: Data Protection Testing

**Objective**: Ensure sensitive data is properly protected.

```typescript
describe('Data Protection', () => {
  it('should not expose sensitive fields in API responses', async () => {
    const response = await app.request('/api/users/profile', {
      headers: { Authorization: `Bearer ${validToken}` },
    });

    const user = await response.json();
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('resetToken');
  });

  it('should not leak internal details in error messages', async () => {
    const response = await app.request('/api/users/non-existent');

    expect(response.status).toBe(404);
    const error = await response.json();
    expect(error.message).not.toContain('database');
    expect(error.message).not.toContain('SQL');
    expect(error).not.toHaveProperty('stack');
  });
});
```

### Step 5: API Security Testing

**Objective**: Validate API-specific security measures.

```typescript
describe('API Security', () => {
  it('should include security headers', async () => {
    const response = await app.request('/api/resources');

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
  });

  it('should enforce CORS policy', async () => {
    const response = await app.request('/api/resources', {
      headers: { Origin: 'https://malicious-site.com' },
    });

    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
  });

  it('should enforce request size limits', async () => {
    const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB

    const response = await app.request('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: largePayload }),
    });

    expect(response.status).toBe(413);
  });
});
```

### Step 6: Dependency Security

**Objective**: Identify vulnerable dependencies.

1. Run package audit tools (npm audit, pnpm audit, yarn audit)
2. Review security advisories for critical packages
3. Verify no known CVEs affect the project
4. Update or patch vulnerable dependencies

```bash
# Check for vulnerabilities
npm audit --audit-level moderate
pnpm audit --audit-level moderate
```

## OWASP Top 10 Coverage Checklist

1. **A01 - Broken Access Control**: Authorization tests, resource ownership
2. **A02 - Cryptographic Failures**: HTTPS enforcement, password hashing, encryption
3. **A03 - Injection**: SQL injection, XSS, command injection tests
4. **A04 - Insecure Design**: Security by design, threat modeling
5. **A05 - Security Misconfiguration**: Headers, CORS, default configs
6. **A06 - Vulnerable Components**: Dependency scanning, CVE monitoring
7. **A07 - Authentication Failures**: Login, session, token tests
8. **A08 - Data Integrity Failures**: Input validation, deserialization
9. **A09 - Logging Failures**: No secrets in logs, audit trails
10. **A10 - SSRF**: URL validation, outbound request restrictions

## Best Practices

1. **Defense in depth** -- implement multiple security layers
2. **Fail securely** -- default to denying access
3. **Least privilege** -- grant only the minimum required permissions
4. **Validate all input** -- never trust client-side data
5. **Encode output** -- prevent XSS by encoding rendered data
6. **Use parameterized queries** -- prevent SQL injection
7. **Set security headers** -- CSP, HSTS, X-Frame-Options, etc.
8. **Audit regularly** -- run security scans continuously
9. **Keep dependencies current** -- patch known vulnerabilities promptly
10. **Log security events** -- monitor for suspicious activity
11. **Never trust client-side validation alone** -- always validate server-side
12. **Automate in CI/CD** -- run security tests on every build

## Output

When applying this skill, produce:

- Security test suite covering authentication, authorization, and input validation
- Vulnerability report with severity classification
- OWASP Top 10 compliance checklist
- Remediation recommendations for all findings
- Dependency audit results
