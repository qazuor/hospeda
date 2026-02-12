# Security Standards

This document defines security standards and best practices for application development. All code must adhere to these requirements.

---

## Table of Contents

1. [OWASP Top 10](#owasp-top-10)
2. [Input Validation](#input-validation)
3. [Authentication](#authentication)
4. [Authorization](#authorization)
5. [Data Protection](#data-protection)
6. [API Security](#api-security)
7. [Dependency Security](#dependency-security)
8. [Security Headers](#security-headers)
9. [Logging and Monitoring](#logging-and-monitoring)
10. [Security Checklist](#security-checklist)

---

## OWASP Top 10

### A01: Broken Access Control

- Enforce least privilege: users access only what they need
- Deny by default; explicitly grant access
- Validate ownership on every data access
- Disable directory listing on web servers
- Log access control failures and alert on repeated attempts

### A02: Cryptographic Failures

- Use strong, up-to-date algorithms (AES-256, bcrypt, Argon2)
- Never store passwords in plaintext
- Use TLS 1.2+ for all data in transit
- Classify data by sensitivity level
- Avoid deprecated algorithms (MD5, SHA1 for passwords)

### A03: Injection

- Use parameterized queries (ORM or prepared statements)
- Validate and sanitize all user input
- Escape output data based on context (HTML, URL, SQL)
- Use allowlists for permitted values when possible

### A04: Insecure Design

- Establish secure design patterns from the start
- Use threat modeling during design phase
- Apply defense-in-depth strategy
- Separate tenant data in multi-tenant systems

### A05: Security Misconfiguration

- Remove default accounts and passwords
- Disable unnecessary features and services
- Keep frameworks and libraries updated
- Use environment-specific configurations

---

## Input Validation

### Always Validate on the Server

Client-side validation is for UX. **Server-side validation is for security.**

```typescript
import { z } from 'zod';

// Define strict schemas
const createUserSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.enum(['viewer', 'editor', 'admin']),
});

// Validate at API boundary
app.post('/api/users', async (c) => {
  const result = createUserSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json({ success: false, error: result.error.flatten() }, 400);
  }
  // result.data is now typed and safe
});
```

### Validation Rules

| Rule | Implementation |
|------|---------------|
| **Type checking** | Use Zod or equivalent schema validation |
| **Length limits** | Always set min/max on strings |
| **Format validation** | Use built-in validators (email, URL, UUID) |
| **Allowlists** | Use enums for known value sets |
| **Sanitization** | Trim whitespace, normalize case where appropriate |
| **File uploads** | Validate type, size, and scan for malware |

### Prevent Common Injection

```typescript
// SQL Injection: Use parameterized queries
// GOOD: ORM handles parameterization
const user = await db.query.users.findFirst({
  where: eq(users.email, email),
});

// BAD: String interpolation
const user = await db.execute(`SELECT * FROM users WHERE email = '${email}'`);

// XSS: Escape output
// GOOD: Framework auto-escapes
<p>{userInput}</p>

// BAD: Dangerous innerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

---

## Authentication

### Best Practices

| Practice | Details |
|----------|---------|
| **Use established providers** | Auth0, Clerk, Firebase Auth, or similar |
| **Enforce strong passwords** | Minimum 8 chars, check against breached lists |
| **Hash passwords securely** | bcrypt (cost 12+) or Argon2id |
| **Implement MFA** | TOTP-based where possible |
| **Secure session management** | HttpOnly, Secure, SameSite cookies |
| **Rate limit login attempts** | Lock after 5 failed attempts |

### JWT Best Practices

```typescript
// Token configuration
const tokenConfig = {
  algorithm: 'RS256',           // Use asymmetric signing
  expiresIn: '15m',             // Short-lived access tokens
  refreshExpiresIn: '7d',       // Longer refresh tokens
  issuer: 'your-app-name',
  audience: 'your-app-api',
};

// Always validate tokens
const validateToken = (token: string) => {
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: tokenConfig.issuer,
    audience: tokenConfig.audience,
  });
};
```

### Session Security

- Set `HttpOnly` flag on auth cookies (prevents XSS access)
- Set `Secure` flag (HTTPS only)
- Set `SameSite=Lax` or `Strict` (prevents CSRF)
- Regenerate session ID after login
- Implement idle timeout and absolute timeout

---

## Authorization

### Role-Based Access Control (RBAC)

```typescript
type Permission = 'read' | 'write' | 'delete' | 'admin';

type RolePermissions = Record<string, Permission[]>;

const rolePermissions: RolePermissions = {
  viewer: ['read'],
  editor: ['read', 'write'],
  admin: ['read', 'write', 'delete', 'admin'],
};

const hasPermission = (role: string, permission: Permission): boolean => {
  return rolePermissions[role]?.includes(permission) ?? false;
};

// Middleware usage
const requirePermission = (permission: Permission) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!hasPermission(user.role, permission)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
};
```

### Authorization Rules

- Check permissions on every request (not just UI)
- Validate resource ownership (user can only modify their own data)
- Use middleware for consistent enforcement
- Log authorization failures

---

## Data Protection

### Encryption

| Scenario | Method |
|----------|--------|
| Passwords | bcrypt (cost 12+) or Argon2id |
| Data at rest | AES-256-GCM |
| Data in transit | TLS 1.2+ |
| Sensitive fields | Field-level encryption |
| API keys | Store in environment variables, never in code |

### Sensitive Data Handling

- Never log passwords, tokens, or PII
- Mask sensitive fields in error messages
- Use environment variables for secrets
- Implement data retention policies
- Support GDPR/CCPA right-to-deletion requests

### Environment Variables

```bash
# GOOD: Use .env files (never commit)
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key
API_KEY=your-api-key

# .gitignore must include:
.env
.env.local
.env.production
```

---

## API Security

### Rate Limiting

```typescript
// Apply rate limits per endpoint sensitivity
const rateLimits = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },      // 5 per 15min
  api: { windowMs: 60 * 1000, max: 100 },             // 100 per minute
  publicSearch: { windowMs: 60 * 1000, max: 20 },     // 20 per minute
};
```

### CORS Configuration

```typescript
const corsOptions = {
  origin: ['https://your-app.com'],  // Never use '*' in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};
```

### Request Validation

- Validate Content-Type headers
- Enforce request body size limits
- Validate query parameter types and ranges
- Reject unexpected fields (strict schema validation)

---

## Dependency Security

### Keep Dependencies Updated

```bash
# Check for vulnerabilities
npm audit
pnpm audit

# Check for outdated packages
npm outdated
pnpm outdated
```

### Dependency Rules

- Pin exact versions in production
- Run `npm audit` in CI/CD pipeline
- Review new dependencies before adding
- Prefer well-maintained packages with active communities
- Monitor for security advisories

---

## Security Headers

### Required HTTP Headers

```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',  // Disable legacy XSS filter, use CSP instead
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
```

---

## Logging and Monitoring

### Security Event Logging

Log the following events:

- Authentication successes and failures
- Authorization failures
- Input validation failures
- Rate limit violations
- Data access patterns (especially admin operations)
- Configuration changes

### What NOT to Log

- Passwords (even hashed)
- Session tokens or JWTs
- Credit card numbers
- Social security numbers
- Personal health information

---

## Security Checklist

Before deploying, verify:

- [ ] All inputs validated server-side
- [ ] Authentication uses established provider or secure implementation
- [ ] Authorization checked on every endpoint
- [ ] Passwords hashed with bcrypt/Argon2
- [ ] Sensitive data encrypted at rest and in transit
- [ ] API rate limiting configured
- [ ] CORS properly configured (no wildcards in production)
- [ ] Security headers set
- [ ] Dependencies audited for vulnerabilities
- [ ] No secrets in source code
- [ ] Error messages do not leak internal details
- [ ] Logging captures security events without sensitive data
- [ ] HTTPS enforced everywhere

---

**Security is everyone's responsibility. Code with security vulnerabilities will be rejected in review.**
