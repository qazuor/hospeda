# Security Best Practices

Comprehensive security guide for managing configuration and secrets in the Hospeda project.

## Table of Contents

- [Secret Management](#secret-management)
- [Validation Security](#validation-security)
- [Access Control](#access-control)
- [Common Vulnerabilities](#common-vulnerabilities)
- [Security Checklist](#security-checklist)
- [Secure vs Insecure Patterns](#secure-vs-insecure-patterns)

---

## Secret Management

### Never Commit Secrets to Git

**Critical Rule:** NEVER commit secrets, API keys, passwords, or tokens to version control.

**❌ INSECURE:**

```bash
# .env - NEVER COMMIT THIS
DATABASE_URL=postgresql://user:MySecretPassword123@prod-db.neon.tech/hospeda
CLERK_SECRET_KEY=YOUR_SECRET_KEY_HERE
MERCADOPAGO_ACCESS_TOKEN=APP-1234567890-REAL-TOKEN
```

**✅ SECURE:**

```bash
# .env.example - Safe to commit (template only)
DATABASE_URL=postgresql://user:password@host:port/database
CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE
MERCADOPAGO_ACCESS_TOKEN=TEST-your-token-here
```

**Checking Git History:**

```bash
# Check if secrets were accidentally committed
git log -p | grep -i "password\|secret\|token"

# If secrets found, they MUST be rotated immediately
# Even if removed from current commit, they exist in git history
```

**Git Hooks to Prevent Commits:**

```bash
# .git/hooks/pre-commit
#!/bin/bash

# Check for potential secrets
if git diff --cached | grep -i "sk_live\|APP-.*-PROD\|password.*=.*[^x]"; then
  echo "ERROR: Potential secret detected in commit"
  echo "Please remove secrets and use environment variables"
  exit 1
fi
```

### Use Environment Variables Only

**Secure Pattern:**

```typescript
// ✅ SECURE - Read from environment
import { databaseConfig } from '@repo/config';

const connection = createConnection({
  url: databaseConfig.DATABASE_URL,
});
```

**Insecure Pattern:**

```typescript
// ❌ INSECURE - Hardcoded secret
const connection = createConnection({
  url: 'postgresql://user:password@prod-db.neon.tech/db',
});
```

### Rotate Secrets Regularly

**Rotation Schedule:**

- **Production API Keys:** Every 90 days
- **Database Passwords:** Every 180 days
- **Service Tokens:** Every 30 days
- **After Breach:** Immediately

**Rotation Process:**

1. **Generate New Secret:**
   - Create new API key/password
   - Test in staging environment

2. **Update Production:**
   - Update environment variables
   - Deploy new version
   - Verify functionality

3. **Revoke Old Secret:**
   - Wait for deployment to complete
   - Revoke/delete old secret
   - Monitor for errors

4. **Document:**
   - Log rotation in security log
   - Update documentation if needed

### Secret Management Services

**Vercel (Recommended for Hospeda):**

```bash
# Add secret via Vercel CLI
vercel env add DATABASE_URL production

# Or via Dashboard:
# 1. Project Settings
# 2. Environment Variables
# 3. Add New
# 4. Mark as "Sensitive"
```

**Benefits:**

- Encrypted at rest
- Hidden from logs
- Access control
- Audit trail

**AWS Secrets Manager (Alternative):**

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  return response.SecretString!;
}

// Usage
const databaseUrl = await getSecret('prod/database/url');
```

---

## Validation Security

### Validate All Inputs

**Principle:** Never trust environment variables - validate everything.

**Secure Validation:**

```typescript
import { z } from 'zod';

const SecureConfigSchema = z.object({
  // Validate URL format
  DATABASE_URL: z.string().url().startsWith('postgresql://'),

  // Validate API key format
  CLERK_SECRET_KEY: z.string().regex(/^sk_(test|live)_[A-Za-z0-9]+$/),

  // Validate allowed values only
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']),

  // Validate numeric ranges
  API_PORT: z.coerce.number().min(1).max(65535),
});

// Validation fails on invalid/malicious input
export const config = SecureConfigSchema.parse(process.env);
```

**Why This Matters:**

```typescript
// Without validation, malicious input could cause issues:

// ❌ INSECURE - No validation
const port = Number(process.env.API_PORT); // Could be NaN, Infinity, negative
const dbUrl = process.env.DATABASE_URL; // Could be empty, malformed, malicious

// ✅ SECURE - Validated
const port = config.API_PORT; // Guaranteed to be 1-65535
const dbUrl = config.DATABASE_URL; // Guaranteed to be valid PostgreSQL URL
```

### Fail Closed (Secure Defaults)

**Principle:** If configuration is missing or invalid, fail securely.

**Secure Defaults:**

```typescript
const SecurityConfigSchema = z.object({
  // Default to most secure option
  DATABASE_SSL: z.coerce.boolean().default(true),

  // Require HTTPS in production
  API_HTTPS_ONLY: z.coerce.boolean().default(true),

  // Default to restrictive CORS
  CORS_ORIGINS: z.string().default(''),

  // Default to minimal logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('warn'),
});
```

**Fail Fast on Invalid Config:**

```typescript
// Application startup
try {
  const config = parseApiSchema(process.env);
} catch (error) {
  console.error('FATAL: Invalid configuration');
  console.error(error);
  process.exit(1); // Exit immediately - don't run with invalid config
}
```

### Sanitize Logs (Mask Secrets)

**Critical:** NEVER log secrets, even in error messages.

**❌ INSECURE - Logs Secret:**

```typescript
console.log('Database config:', {
  url: databaseConfig.DATABASE_URL, // Contains password!
});

console.error('Failed to connect:', {
  connectionString: dbUrl, // Contains password!
});
```

**✅ SECURE - Masked Logging:**

```typescript
function maskSecret(value: string): string {
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '***' + value.slice(-4);
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Mask password in URL
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return '***';
  }
}

// Safe logging
console.log('Database config:', {
  url: maskUrl(databaseConfig.DATABASE_URL),
});

console.log('API Key:', maskSecret(apiConfig.CLERK_SECRET_KEY));
```

**Production Logger:**

```typescript
import { createLogger } from '@repo/logger';

const logger = createLogger({
  level: 'info',
  redact: [
    'password',
    'secret',
    'token',
    'apiKey',
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
  ],
});

// Automatically masks sensitive fields
logger.info({
  msg: 'Starting server',
  config: {
    port: 3000,
    DATABASE_URL: 'postgresql://user:password@host/db', // Automatically masked
  },
});
```

### Error Messages (Don't Expose Secrets)

**❌ INSECURE - Exposes Secret in Error:**

```typescript
throw new Error(`Failed to connect to ${DATABASE_URL}`);
throw new Error(`Invalid API key: ${CLERK_SECRET_KEY}`);
```

**✅ SECURE - Generic Error Messages:**

```typescript
throw new Error('Failed to connect to database');
throw new Error('Invalid API key format');

// If details needed, log securely (masked)
logger.error({
  msg: 'Database connection failed',
  url: maskUrl(DATABASE_URL),
});
```

---

## Access Control

### Limit Who Can Set Variables

**Principle:** Only authorized personnel should access production secrets.

**Role-Based Access:**

**Vercel Access Control:**

1. **Owner:** Full access to all environment variables
2. **Member:** Read-only access (can't modify production)
3. **Viewer:** No access to environment variables

**Best Practice:**

- Only owners can modify production environment variables
- Developers get development/staging access only
- Use service accounts for CI/CD

### Audit Configuration Changes

**Track Who Changed What:**

**Vercel Audit Log:**

- Automatic logging of all changes
- Who, what, when
- Accessible via dashboard

**Manual Audit Log:**

```typescript
// packages/config/CHANGELOG.md
## 2024-01-15

- Updated DATABASE_URL (production) - @tech-lead
- Rotated CLERK_SECRET_KEY - @security-team
- Added MERCADOPAGO_WEBHOOK_SECRET - @backend-dev

## 2024-01-01

- Initial production configuration - @tech-lead
```

### Role-Based Access Control (RBAC)

**Access Levels:**

**Development:**

- All developers
- Read/write access to development environment variables
- No access to production secrets

**Staging:**

- Senior developers
- DevOps team
- Read/write access to staging
- Read-only access to production (for debugging)

**Production:**

- Tech lead
- DevOps lead
- Read/write access to production
- Changes require approval

**Implementation:**

```typescript
// Check role before accessing production config
function getProductionConfig(role: UserRole) {
  if (!['tech-lead', 'devops-lead'].includes(role)) {
    throw new Error('Insufficient permissions for production config');
  }
  return parseProductionConfig(process.env);
}
```

### Principle of Least Privilege

**Principle:** Grant minimum access necessary for the job.

**Examples:**

**CI/CD:**

- Only needs read access to environment variables
- No write access
- Scoped to specific environments

**Deployment Service:**

- Only needs production environment variables
- No access to development/staging
- Can't modify variables

**Monitoring Service:**

- No access to secrets
- Only needs connection URLs (without credentials)
- Read-only access

---

## Common Vulnerabilities

### Exposed API Keys in Logs

**Vulnerability:**

```typescript
// ❌ VULNERABLE
console.log('Starting with config:', process.env);
logger.debug('API Key:', apiKey);
console.error('Connection failed:', { connectionString });
```

**Exploitation:**

- Logs collected by monitoring services
- Logs visible to support staff
- Logs stored long-term
- Secrets compromised

**Fix:**

```typescript
// ✅ SECURE
console.log('Starting with config: [REDACTED]');
logger.debug('API Key:', maskSecret(apiKey));
console.error('Connection failed: [REDACTED]');
```

### Weak Validation Allowing Injection

**Vulnerability:**

```typescript
// ❌ VULNERABLE - No validation
const tableName = process.env.TABLE_NAME;
const query = `SELECT * FROM ${tableName}`; // SQL injection risk
```

**Exploitation:**

```bash
TABLE_NAME="users; DROP TABLE users; --"
```

**Fix:**

```typescript
// ✅ SECURE - Validated input
const TableNameSchema = z.string().regex(/^[a-z_]+$/);
const tableName = TableNameSchema.parse(process.env.TABLE_NAME);
```

### Insecure Defaults

**Vulnerability:**

```typescript
// ❌ VULNERABLE - Insecure defaults
const config = z.object({
  DATABASE_SSL: z.coerce.boolean().default(false), // Insecure default!
  ENABLE_DEBUG: z.coerce.boolean().default(true), // Dangerous in prod!
});
```

**Fix:**

```typescript
// ✅ SECURE - Secure defaults
const config = z.object({
  DATABASE_SSL: z.coerce.boolean().default(true),
  ENABLE_DEBUG: z.coerce.boolean().default(false),
});
```

### Secrets in Error Messages

**Vulnerability:**

```typescript
// ❌ VULNERABLE
function connectDatabase(url: string) {
  try {
    return connect(url);
  } catch (error) {
    throw new Error(`Failed to connect to ${url}: ${error}`);
  }
}
```

**Exploitation:**

- Error shown to users
- Error logged to monitoring
- URL contains password
- Secret compromised

**Fix:**

```typescript
// ✅ SECURE
function connectDatabase(url: string) {
  try {
    return connect(url);
  } catch (error) {
    logger.error({
      msg: 'Database connection failed',
      url: maskUrl(url),
    });
    throw new Error('Failed to connect to database');
  }
}
```

---

## Security Checklist

**Before Deployment:**

- [ ] All secrets in environment variables (not in code)
- [ ] No secrets in git history
- [ ] Validation at application startup
- [ ] Secrets not logged or exposed in errors
- [ ] .env files in .gitignore
- [ ] Access control configured for environment variables
- [ ] Regular secret rotation scheduled
- [ ] Audit trail for configuration changes
- [ ] Secure defaults used (SSL enabled, debug disabled, etc.)
- [ ] Error messages don't expose sensitive information

**Monthly:**

- [ ] Review access logs
- [ ] Rotate service tokens
- [ ] Check for exposed secrets in logs
- [ ] Update security documentation

**Quarterly:**

- [ ] Rotate production API keys
- [ ] Review and update access control
- [ ] Security audit of configuration
- [ ] Update secrets in secret management service

**After Incidents:**

- [ ] Rotate all affected secrets immediately
- [ ] Review access logs
- [ ] Investigate root cause
- [ ] Update security procedures

---

## Secure vs Insecure Patterns

### Hardcoded Secrets

**❌ INSECURE:**

```typescript
const apiKey = 'sk_live_12345'; // Hardcoded secret
const dbPassword = 'MyPassword123'; // Hardcoded password

export const config = {
  apiKey,
  database: `postgresql://user:${dbPassword}@host/db`,
};
```

**✅ SECURE:**

```typescript
import { apiConfig } from '@repo/config';

// Secrets from environment variables
export const config = {
  apiKey: apiConfig.API_KEY,
  database: apiConfig.DATABASE_URL,
};
```

### Logging Secrets

**❌ INSECURE:**

```typescript
console.log('API Key:', apiKey); // Logs secret
logger.info({ apiKey }); // Logs secret
console.log('Config:', process.env); // Logs all secrets
```

**✅ SECURE:**

```typescript
console.log('API Key:', maskSecret(apiKey)); // Masked
logger.info({ apiKey: '***' }); // Redacted
console.log('Config loaded successfully'); // No details
```

### Error Handling

**❌ INSECURE:**

```typescript
try {
  await connect(DATABASE_URL);
} catch (error) {
  throw new Error(`Connection failed: ${DATABASE_URL}`); // Exposes password
}
```

**✅ SECURE:**

```typescript
try {
  await connect(DATABASE_URL);
} catch (error) {
  logger.error({ msg: 'Connection failed', url: maskUrl(DATABASE_URL) });
  throw new Error('Database connection failed');
}
```

### Validation

**❌ INSECURE:**

```typescript
const port = Number(process.env.API_PORT) || 3000; // No validation
const dbUrl = process.env.DATABASE_URL; // Could be undefined
```

**✅ SECURE:**

```typescript
import { apiConfig } from '@repo/config';

// Validated at startup - guaranteed to be valid
const port = apiConfig.API_PORT; // 1-65535
const dbUrl = apiConfig.DATABASE_URL; // Valid PostgreSQL URL
```

### Environment Detection

**❌ INSECURE:**

```typescript
const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  enableDebugMode(); // Could be enabled in production by accident
}
```

**✅ SECURE:**

```typescript
import { isProduction } from '@repo/config';

if (isProduction()) {
  // Ensure debug always disabled in production
  if (config.ENABLE_DEBUG) {
    throw new Error('Debug mode cannot be enabled in production');
  }
}
```

---

## Related Documentation

- [Configuration Validation](./validation.md)
- [Environment Variables Reference](../api/env-vars.md)
- [Managing Environments](./environments.md)
- [Testing Configuration](./testing.md)
