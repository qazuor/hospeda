# OWASP Top 10 Prevention Guide

## Table of Contents

<!-- markdownlint-disable MD051 -->

- [A01:2021 - Broken Access Control](#a012021-broken-access-control)
- [A02:2021 - Cryptographic Failures](#a022021-cryptographic-failures)
- [A03:2021 - Injection](#a032021-injection)
- [A04:2021 - Insecure Design](#a042021-insecure-design)
- [A05:2021 - Security Misconfiguration](#a052021-security-misconfiguration)
- [A06:2021 - Vulnerable and Outdated Components](#a062021-vulnerable-and-outdated-components)
- [A07:2021 - Identification and Authentication Failures](#a072021-identification-and-authentication-failures)
- [A08:2021 - Software and Data Integrity Failures](#a082021-software-and-data-integrity-failures)
- [A09:2021 - Security Logging and Monitoring Failures](#a092021-security-logging-and-monitoring-failures)
- [A10:2021 - Server-Side Request Forgery (SSRF)](#a102021-server-side-request-forgery-ssrf)

<!-- markdownlint-enable MD051 -->

---

## A01:2021 - Broken Access Control

### Description

Access control enforces policy such that users cannot act outside of their intended permissions. Failures typically lead to unauthorized information disclosure, modification, or destruction of data, or performing a business function outside the user's limits.

**Common Weaknesses:**

- Bypassing access control checks by modifying URLs, internal state, or HTML
- Permitting viewing or editing someone else's account by providing its unique identifier (IDOR)
- Accessing API with missing access controls for POST, PUT, and DELETE
- Elevation of privilege (acting as a user without being logged in, or acting as an admin when logged in as a user)
- Metadata manipulation (replaying or tampering with JWT tokens, cookies, or hidden fields)
- CORS misconfiguration allowing unauthorized API access

### How Hospeda Prevents It

#### 1. Authentication Middleware

All protected endpoints require valid JWT tokens:

```typescript
// apps/api/src/middleware/auth.ts
import { auth } from '../lib/auth';
import { createMiddleware } from 'hono/factory';

export const requireAuth = createMiddleware(async (c, next) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Set authenticated context
    c.set('userId', session.user.id);
    c.set('sessionId', session.session.id);

    await next();
  } catch (error) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }
});
```

#### 2. Role-Based Access Control (RBAC)

```typescript
// packages/schemas/src/auth/roles.ts
export enum UserRole {
  GUEST = 'guest',
  HOST = 'host',
  ADMIN = 'admin',
}

export type Permission =
  | 'accommodation:create'
  | 'accommodation:read'
  | 'accommodation:update'
  | 'accommodation:delete'
  | 'booking:create'
  | 'booking:read'
  | 'booking:update'
  | 'booking:cancel'
  | 'user:read'
  | 'user:update'
  | 'admin:*';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.GUEST]: [
    'accommodation:read',
    'booking:create',
    'booking:read',
    'booking:cancel',
    'user:read',
    'user:update',
  ],
  [UserRole.HOST]: [
    'accommodation:create',
    'accommodation:read',
    'accommodation:update',
    'accommodation:delete',
    'booking:read',
    'user:read',
    'user:update',
  ],
  [UserRole.ADMIN]: ['admin:*'],
};

export const hasPermission = (
  role: UserRole,
  permission: Permission
): boolean => {
  if (role === UserRole.ADMIN) return true;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
};
```

#### 3. Permission Middleware

```typescript
// apps/api/src/middleware/permissions.ts
import { createMiddleware } from 'hono/factory';
import { hasPermission, type Permission } from '@repo/schemas';

export const requirePermission = (permission: Permission) => {
  return createMiddleware(async (c, next) => {
    const userId = c.get('userId');

    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Fetch user role from database
    const user = await getUserById(userId);
    const role = user.role as UserRole;

    if (!hasPermission(role, permission)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    c.set('userRole', role);
    await next();
  });
};

// Usage example
app.delete(
  '/api/accommodations/:id',
  requireAuth,
  requirePermission('accommodation:delete'),
  async (c) => {
    // Only users with accommodation:delete permission reach here
  }
);
```

#### 4. Resource Ownership Validation

Prevents IDOR (Insecure Direct Object References):

```typescript
// packages/service-core/src/services/accommodation/accommodation.service.ts
export class AccommodationService extends BaseCrudService {
  async update(input: UpdateAccommodationInput): Promise<Result<Accommodation>> {
    // Fetch existing accommodation
    const result = await this.findById({ id: input.id });

    if (!result.success) {
      return Result.fail('Accommodation not found');
    }

    const accommodation = result.data;

    // Verify ownership (unless admin)
    if (!this.ctx.actor.isAdmin()) {
      if (accommodation.ownerId !== this.ctx.actor.id) {
        return Result.fail('Unauthorized: You do not own this accommodation');
      }
    }

    // Proceed with update
    return this.model.update(input);
  }

  async delete(input: DeleteAccommodationInput): Promise<Result<void>> {
    // Same ownership check for delete
    const result = await this.findById({ id: input.id });

    if (!result.success) {
      return Result.fail('Accommodation not found');
    }

    const accommodation = result.data;

    if (!this.ctx.actor.isAdmin() && accommodation.ownerId !== this.ctx.actor.id) {
      return Result.fail('Unauthorized: You do not own this accommodation');
    }

    return this.model.delete(input);
  }
}
```

#### 5. Service Layer Authorization

Authorization checks at multiple layers (defense in depth):

```typescript
// Service layer always validates actor permissions
export abstract class BaseCrudService<T, M, C, U, S> {
  protected ctx: ServiceContext;

  constructor(ctx: ServiceContext, protected model: M) {
    this.ctx = ctx;
  }

  protected canCreate(): boolean {
    // Override in subclass for specific permission check
    return true;
  }

  protected canRead(resource: T): boolean {
    // Override in subclass
    return true;
  }

  protected canUpdate(resource: T): boolean {
    // Override in subclass
    return true;
  }

  protected canDelete(resource: T): boolean {
    // Override in subclass
    return true;
  }
}
```

### Testing Procedures

#### Test 1: Unauthorized Access

```typescript
// test: Guest cannot delete accommodation
describe('Access Control - Delete Accommodation', () => {
  it('should deny guest user from deleting accommodation', async () => {
    const guestToken = await createGuestToken();

    const response = await fetch('/api/accommodations/acc-123', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${guestToken}`,
      },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Insufficient permissions',
    });
  });
});
```

#### Test 2: IDOR Prevention

```typescript
// test: User cannot access another user's booking
describe('Access Control - IDOR', () => {
  it('should prevent user from viewing another user\'s booking', async () => {
    const userAToken = await createUserToken('user-a');
    const userBBookingId = 'booking-belonging-to-user-b';

    const response = await fetch(`/api/bookings/${userBBookingId}`, {
      headers: {
        'Authorization': `Bearer ${userAToken}`,
      },
    });

    expect(response.status).toBe(403);
  });
});
```

#### Test 3: Role Escalation

```typescript
// test: Guest cannot become host by modifying request
describe('Access Control - Role Escalation', () => {
  it('should prevent role escalation via request manipulation', async () => {
    const guestToken = await createGuestToken();

    const response = await fetch('/api/accommodations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Beach House',
        // Attempting to bypass authorization
        role: 'admin',
        ownerId: 'another-user',
      }),
    });

    expect(response.status).toBe(403);
  });
});
```

---

## A02:2021 - Cryptographic Failures

### Description

Cryptographic failures relate to failures that expose sensitive data. This was previously known as "Sensitive Data Exposure". Common issues include:

- Transmitting data in clear text (HTTP instead of HTTPS)
- Using old or weak cryptographic algorithms
- Not encrypting sensitive data
- Not properly validating certificates
- Missing or improper cryptographic key management

### How Hospeda Prevents It

#### 1. HTTPS Enforcement

All connections use HTTPS with TLS 1.3:

```typescript
// Enforced at platform level (Vercel)
// Automatic HTTP → HTTPS redirect

// Strict Transport Security header
app.use('*', async (c, next) => {
  await next();

  c.header(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
});
```

#### 2. Database SSL Connections

```typescript
// packages/db/src/client.ts
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

neonConfig.fetchConnectionCache = true;

export const db = drizzle(
  neon(process.env.DATABASE_URL!, {
    ssl: true, // ✅ SSL required
  })
);
```

#### 3. Secure Cookie Configuration

```typescript
// Session cookies
const cookieOptions = {
  httpOnly: true, // Prevent XSS access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const, // CSRF protection
  maxAge: 3600, // 1 hour
  path: '/',
};

c.cookie('session', sessionToken, cookieOptions);
```

#### 4. Secrets Management

**Environment Variables (Encrypted):**

```bash
# .env.example (template only, no real values)
DATABASE_URL=
HOSPEDA_BETTER_AUTH_SECRET=
MERCADO_PAGO_ACCESS_TOKEN=

# Real secrets stored in:
# - GitHub Secrets (CI/CD)
# - Vercel Environment Variables (encrypted at rest, all apps)
```

**Never commit secrets:**

```bash
# .gitignore
.env
.env.local
.env.*.local
*.key
*.pem
```

#### 5. Password Handling

**Handled by Better Auth:**

- Passwords hashed with secure algorithms (bcrypt/argon2)
- Better Auth manages credential storage in our database
- Passwordless options (OAuth, magic links)
- Self-hosted, no external dependency for auth

#### 6. Payment Data

**Tokenization via Mercado Pago:**

```typescript
// NEVER store credit card details
// Use Mercado Pago tokenization

// ❌ BAD: Storing payment details
interface Booking {
  cardNumber: string; // NEVER DO THIS
  cvv: string; // NEVER DO THIS
}

// ✅ GOOD: Store only payment token
interface Booking {
  paymentToken: string; // Mercado Pago token
  paymentMethod: 'credit_card' | 'debit_card';
}
```

#### 7. Application-Level Encryption (if needed)

```typescript
// Utility for encrypting sensitive data
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

export const encrypt = (plaintext: string): string => {
  const iv = randomBytes(16); // Initialization vector
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decrypt = (ciphertext: string): string => {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};
```

### Implementation Details

#### TLS Configuration

**Vercel (Web & Admin):**

- Automatic HTTPS with TLS 1.3
- Perfect Forward Secrecy (PFS)
- Strong cipher suites only
- HSTS preload enabled

**Vercel (API):**

HTTPS is enforced automatically. All Vercel deployments serve over HTTPS only.
Redirection from HTTP to HTTPS is handled at the edge.

#### Certificate Management

- Automatic certificate issuance (Let's Encrypt)
- Automatic renewal (no manual intervention)
- CAA DNS records restrict certificate issuance
- Certificate transparency monitoring

### Configuration Examples

#### Security Headers

```typescript
// apps/api/src/middleware/security.ts
import { secureHeaders } from 'hono/secure-headers';

app.use('*', secureHeaders({
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    connectSrc: ["'self'"],
    upgradeInsecureRequests: [], // Force HTTPS
  },
}));
```

### Testing Procedures

#### Test 1: HTTPS Enforcement

```typescript
describe('Cryptographic Failures - HTTPS', () => {
  it('should redirect HTTP to HTTPS', async () => {
    const response = await fetch('http://api.hospeda.com/health', {
      redirect: 'manual',
    });

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toMatch(/^https:/);
  });

  it('should include HSTS header', async () => {
    const response = await fetch('https://api.hospeda.com/health');

    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
  });
});
```

#### Test 2: Secure Cookies

```typescript
describe('Cryptographic Failures - Cookies', () => {
  it('should set secure cookie flags', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'pass' }),
    });

    const setCookie = response.headers.get('set-cookie');

    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
  });
});
```

#### Test 3: Database SSL

```typescript
describe('Cryptographic Failures - Database', () => {
  it('should use SSL for database connection', () => {
    // Check connection string
    expect(process.env.DATABASE_URL).toContain('sslmode=require');

    // Verify Neon config
    expect(neonConfig.ssl).toBe(true);
  });
});
```

---

## A03:2021 - Injection

### Description

Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query. Common injection types:

- **SQL Injection**: Malicious SQL in database queries
- **NoSQL Injection**: Malicious queries in NoSQL databases
- **OS Command Injection**: Shell commands via user input
- **LDAP Injection**: LDAP queries
- **XPath Injection**: XML queries
- **Cross-Site Scripting (XSS)**: Malicious JavaScript

### How Hospeda Prevents It

#### 1. SQL Injection Prevention (Drizzle ORM)

**Drizzle ORM uses parameterized queries:**

```typescript
// ✅ SAFE: Parameterized query
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, userInput));

// Drizzle generates:
// SELECT * FROM users WHERE email = $1
// Parameters: [userInput]

// ❌ UNSAFE: String concatenation (NEVER DO THIS)
// const users = await db.execute(
//   `SELECT * FROM users WHERE email = '${userInput}'`
// );
```

**Complex queries with multiple conditions:**

```typescript
import { eq, and, or, like, gte, lte } from 'drizzle-orm';

// All user inputs are automatically parameterized
const accommodations = await db
  .select()
  .from(accommodationsTable)
  .where(
    and(
      eq(accommodationsTable.city, searchCity), // $1
      gte(accommodationsTable.pricePerNight, minPrice), // $2
      lte(accommodationsTable.pricePerNight, maxPrice), // $3
      or(
        like(accommodationsTable.title, `%${searchTerm}%`), // $4
        like(accommodationsTable.description, `%${searchTerm}%`) // $5
      )
    )
  );
```

**Full-text search (safe):**

```typescript
// Using PostgreSQL full-text search safely
import { sql } from 'drizzle-orm';

const results = await db
  .select()
  .from(accommodationsTable)
  .where(
    sql`to_tsvector('english', ${accommodationsTable.title} || ' ' || ${accommodationsTable.description})
        @@ plainto_tsquery('english', ${searchQuery})`
  );
// searchQuery is parameterized
```

#### 2. Input Validation (Zod Schemas)

**Validate ALL user inputs:**

```typescript
// packages/schemas/src/accommodation/search-accommodation.schema.ts
import { z } from 'zod';

export const searchAccommodationSchema = z.object({
  city: z.string()
    .min(2, 'City name too short')
    .max(100, 'City name too long')
    .regex(/^[a-zA-Z\s\-']+$/, 'City name contains invalid characters'),

  minPrice: z.number()
    .nonnegative('Price cannot be negative')
    .max(1000000, 'Price too high')
    .optional(),

  maxPrice: z.number()
    .nonnegative('Price cannot be negative')
    .max(1000000, 'Price too high')
    .optional(),

  searchTerm: z.string()
    .max(200, 'Search term too long')
    .regex(/^[a-zA-Z0-9\s\-,.!?']+$/, 'Search term contains invalid characters')
    .optional(),

  page: z.number().int().positive().max(1000).default(1),

  pageSize: z.number().int().positive().max(100).default(20),
}).refine(
  (data) => {
    if (data.minPrice && data.maxPrice) {
      return data.minPrice <= data.maxPrice;
    }
    return true;
  },
  { message: 'minPrice must be less than or equal to maxPrice' }
);

export type SearchAccommodationInput = z.infer<typeof searchAccommodationSchema>;
```

**Automatic validation middleware:**

```typescript
import { zValidator } from '@hono/zod-validator';

app.get(
  '/api/accommodations/search',
  zValidator('query', searchAccommodationSchema),
  async (c) => {
    // Input is guaranteed to be valid and type-safe
    const params = c.req.valid('query');

    // params.city is a valid string
    // params.minPrice is a valid number (if provided)
    // etc.
  }
);
```

#### 3. XSS Prevention

**Output Encoding (React Auto-Escaping):**

```tsx
// ✅ SAFE: React automatically escapes
const AccommodationCard = ({ title, description }: Props) => {
  return (
    <div>
      <h2>{title}</h2> {/* Automatically escaped */}
      <p>{description}</p> {/* Automatically escaped */}
    </div>
  );
};

// ❌ UNSAFE: Bypassing React's escaping (NEVER DO THIS)
// const UnsafeComponent = ({ html }: { html: string }) => {
//   return <div dangerouslySetInnerHTML={{ __html: html }} />;
// };
```

**Content Security Policy (CSP):**

```typescript
// Restrict where scripts can be loaded from
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind CSS
    ],
    imgSrc: [
      "'self'",
      'https://res.cloudinary.com', // Image CDN
      'data:', // Data URLs for small images
    ],
    connectSrc: [
      "'self'",
      'https://api.mercadopago.com',
    ],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"], // No Flash, Java, etc.
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"], // No iframes needed (Better Auth is self-hosted)
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"], // No framing (clickjacking protection)
    upgradeInsecureRequests: [], // Force HTTPS
  },
}));
```

**Sanitization for Rich Text (if needed):**

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Only if accepting HTML content (e.g., rich text editor)
export const sanitizeHTML = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3',
      'ul', 'ol', 'li', 'a', 'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target'],
    ALLOW_DATA_ATTR: false,
  });
};

// Use in schema validation
export const accommodationDescriptionSchema = z.string()
  .max(5000)
  .transform(sanitizeHTML);
```

#### 4. Command Injection Prevention

**NEVER execute shell commands with user input:**

```typescript
// ❌ EXTREMELY DANGEROUS (NEVER DO THIS)
// import { exec } from 'child_process';
// exec(`convert ${userFilename} output.jpg`); // Command injection!

// ✅ SAFE: Use libraries, not shell commands
import sharp from 'sharp';

const processImage = async (inputPath: string, outputPath: string) => {
  // Validate paths first
  if (!isValidPath(inputPath)) {
    throw new Error('Invalid input path');
  }

  // Use library (no shell execution)
  await sharp(inputPath)
    .resize(800, 600)
    .toFile(outputPath);
};
```

### SQL Injection Prevention

**Model Layer (Safe Queries):**

```typescript
// packages/db/src/models/accommodation.model.ts
export class AccommodationModel extends BaseModel<Accommodation> {
  async findByCity(city: string): Promise<Accommodation[]> {
    // ✅ SAFE: eq() uses parameterized query
    return this.db
      .select()
      .from(this.table)
      .where(eq(this.table.city, city)); // Parameter: $1
  }

  async search(term: string): Promise<Accommodation[]> {
    // ✅ SAFE: like() uses parameterized query
    return this.db
      .select()
      .from(this.table)
      .where(
        or(
          like(this.table.title, `%${term}%`), // Parameter: $1
          like(this.table.description, `%${term}%`) // Parameter: $2
        )
      );
  }

  // Even raw SQL is parameterized
  async customQuery(userId: string): Promise<any[]> {
    return this.db.execute(
      sql`SELECT * FROM accommodations WHERE owner_id = ${userId}` // Parameter: $1
    );
  }
}
```

### XSS Prevention

**API Responses (JSON encoding):**

```typescript
// JSON responses are automatically encoded
app.get('/api/accommodations/:id', async (c) => {
  const accommodation = await getAccommodation(c.req.param('id'));

  // ✅ SAFE: Hono automatically JSON-encodes
  return c.json({
    title: accommodation.title, // Special chars encoded
    description: accommodation.description, // Special chars encoded
  });

  // Output: { "title": "Beach &amp; Ocean View" }
  // < > " ' & are properly escaped in JSON
});
```

### Testing Procedures

#### Test 1: SQL Injection

```typescript
describe('Injection - SQL Injection', () => {
  it('should prevent SQL injection in search', async () => {
    const maliciousInput = "' OR '1'='1"; // Classic SQL injection

    const response = await fetch('/api/accommodations/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: maliciousInput,
      }),
    });

    // Should either validate and reject, or safely parameterize
    expect(response.status).toBe(400); // Validation error
  });

  it('should prevent SQL injection in numeric fields', async () => {
    const maliciousInput = "1; DROP TABLE users;--";

    const response = await fetch('/api/accommodations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test',
        pricePerNight: maliciousInput, // Trying to inject in number field
      }),
    });

    expect(response.status).toBe(400); // Zod validation fails
  });
});
```

#### Test 2: XSS Prevention

```typescript
describe('Injection - XSS', () => {
  it('should escape XSS in accommodation title', async () => {
    const xssPayload = '<script>alert("XSS")</script>';

    const response = await fetch('/api/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: xssPayload,
        description: 'Test',
        // ... other fields
      }),
    });

    // Should either reject invalid input or escape it
    if (response.ok) {
      const data = await response.json();
      // Title should be escaped in JSON response
      expect(data.title).not.toContain('<script>');
    } else {
      expect(response.status).toBe(400); // Validation error
    }
  });

  it('should prevent XSS via image URLs', async () => {
    const xssPayload = 'javascript:alert("XSS")';

    const response = await fetch('/api/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`,
      },
      body: JSON.stringify({
        title: 'Test',
        images: [xssPayload], // Malicious URL
      }),
    });

    expect(response.status).toBe(400); // Zod URL validation fails
  });
});
```

#### Test 3: Command Injection

```typescript
describe('Injection - Command Injection', () => {
  it('should prevent command injection in file operations', async () => {
    const maliciousFilename = '; rm -rf /';

    const formData = new FormData();
    formData.append('file', new Blob(['test']), maliciousFilename);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    expect(response.status).toBe(400); // Filename validation fails
  });
});
```

---

## A04:2021 - Insecure Design

### Description

Insecure design represents missing or ineffective security controls in the design phase. It's about security by design - thinking about threats before implementation.

**Key Concepts:**

- Threat modeling
- Secure design patterns
- Security requirements
- Defense in depth
- Principle of least privilege

### How Hospeda Prevents It

#### 1. Threat Modeling

**Performed during planning phase:**

- Identify assets (user data, payments, bookings)
- Identify threats (STRIDE model)
- Assess risk (likelihood × impact)
- Design mitigations

#### Example: Booking System Threat Model

| Asset | Threat | Mitigation |
|-------|--------|------------|
| Payment data | Interception | HTTPS, PCI DSS compliant processor |
| Booking records | Unauthorized access | RBAC, ownership validation |
| Availability | Calendar manipulation | Validation, conflict detection |
| User data | Information disclosure | Access controls, data minimization |

#### 2. Security by Design Principles

**Fail Securely:**

```typescript
// If permission check fails, deny access (don't continue)
const canUpdate = await checkPermission(user, 'accommodation:update', resourceId);

if (!canUpdate) {
  // ✅ SECURE: Deny by default
  return Result.fail('Unauthorized');
}

// Continue only if explicitly authorized
```

**Complete Mediation:**

```typescript
// Check permissions on EVERY request, not just once
app.use('/api/*', requireAuth); // All API routes require auth

// Don't assume previous checks are sufficient
export class AccommodationService {
  async update(input: UpdateAccommodationInput) {
    // Re-validate permission even if middleware checked
    if (!this.ctx.actor.can('accommodation:update')) {
      return Result.fail('Unauthorized');
    }

    // ... update logic
  }
}
```

**Defense in Depth:**

```typescript
// Multiple layers of validation
// 1. Client-side validation (UX, not security)
// 2. Zod schema validation (API layer)
// 3. Service layer business rules
// 4. Model layer constraints
// 5. Database constraints

// Example: Price validation at multiple layers
// Schema layer
const priceSchema = z.number().positive().max(1000000);

// Service layer
if (input.pricePerNight < 10) {
  return Result.fail('Minimum price is $10/night');
}

// Database layer
// ALTER TABLE accommodations ADD CONSTRAINT price_positive CHECK (price_per_night > 0);
```

**Least Privilege:**

```typescript
// Database user has minimal permissions
// - No DDL (CREATE, ALTER, DROP)
// - No admin functions
// - Only DML on assigned tables (SELECT, INSERT, UPDATE, DELETE)

// API keys have scoped permissions
// - Better Auth: authentication only (self-hosted)
// - Mercado Pago: payment processing only
// - Cloudinary: image upload only
```

#### 3. Secure Architecture Patterns

**Layered Architecture:**

```
Client (Web/Admin)
    ↓
API Gateway (Hono)
    ↓ (Authentication)
    ↓ (Authorization)
    ↓ (Validation)
Service Layer (Business Logic)
    ↓ (Data Access)
Model Layer (ORM)
    ↓
Database (PostgreSQL)
```

**Separation of Concerns:**

```typescript
// ✅ GOOD: Clear separation
// Route: HTTP handling only
app.post('/api/accommodations', requireAuth, zValidator('json', schema), async (c) => {
  const data = c.req.valid('json');
  const result = await accommodationService.create(data);
  return c.json(result);
});

// Service: Business logic
class AccommodationService {
  async create(input) {
    // Validate business rules
    // Check permissions
    // Call model
  }
}

// Model: Data access
class AccommodationModel {
  async create(data) {
    // Database operations only
  }
}
```

#### 4. Secure Defaults

**All features are secure by default:**

```typescript
// Rate limiting enabled by default
app.use('/api/*', rateLimiter({ /* ... */ }));

// CORS whitelist by default (no open CORS)
app.use('/api/*', cors({ origin: ALLOWED_ORIGINS }));

// Authentication required by default (opt-in to public routes)
app.use('/api/*', requireAuth);

// Public routes must be explicitly marked
app.get('/api/public/accommodations', publicRoute, async (c) => {
  // ...
});
```

**Secure cookie settings:**

```typescript
const SECURE_COOKIE_DEFAULTS = {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict' as const,
  path: '/',
};
```

#### 5. Input Validation & Business Logic

**Comprehensive validation:**

```typescript
export const createBookingSchema = z.object({
  accommodationId: z.string().uuid(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
  guests: z.number().int().min(1).max(20),
})
.refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  { message: 'Check-out must be after check-in' }
)
.refine(
  (data) => new Date(data.checkIn) >= new Date(),
  { message: 'Check-in cannot be in the past' }
);

// Service layer adds business rules
class BookingService {
  async create(input: CreateBookingInput) {
    // Check availability
    const isAvailable = await this.checkAvailability(
      input.accommodationId,
      input.checkIn,
      input.checkOut
    );

    if (!isAvailable) {
      return Result.fail('Accommodation not available for selected dates');
    }

    // Check max guests
    const accommodation = await this.accommodationModel.findById(input.accommodationId);
    if (input.guests > accommodation.maxGuests) {
      return Result.fail(`Maximum ${accommodation.maxGuests} guests allowed`);
    }

    // Create booking
    return this.model.create(input);
  }
}
```

### Architecture Decisions

**ADR (Architecture Decision Record) Example:**

```markdown
# ADR 001: Use Better Auth for Authentication

## Context
Need secure, scalable authentication for Hospeda platform.

## Decision
Use Better Auth for self-hosted authentication instead of a third-party SaaS.

## Security Rationale
- Open-source, self-hosted authentication (full control)
- No vendor dependency or external API calls for auth
- Session-based authentication (no JWT token management)
- MFA support
- OAuth providers
- Data stays in our database

## Consequences
- Positive: Full control over auth data and logic
- Positive: No external dependency for authentication
- Positive: Lower latency (no external API calls)
- Negative: Responsible for security updates ourselves
- Mitigation: Active open-source community, regular updates
```

### Threat Modeling

**STRIDE Analysis:**

| Threat | Example | Mitigation |
|--------|---------|------------|
| **S**poofing | Fake user identity | Better Auth session verification |
| **T**ampering | Modify booking data | HTTPS, integrity checks, audit logs |
| **R**epudiation | Deny creating booking | Audit logs, signed transactions |
| **I**nformation Disclosure | Expose PII | Access controls, encryption, data minimization |
| **D**enial of Service | Overload API | Rate limiting, caching, auto-scaling |
| **E**levation of Privilege | Guest acts as admin | RBAC, permission checks at service layer |

### Testing Procedures

#### Test 1: Authorization Bypass

```typescript
describe('Insecure Design - Authorization', () => {
  it('should not allow bypassing ownership check', async () => {
    // Try to update another user's accommodation by guessing ID
    const userAToken = await createUserToken('user-a');
    const userBAccommodationId = 'acc-belonging-to-user-b';

    const response = await fetch(`/api/accommodations/${userBAccommodationId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Hacked!' }),
    });

    expect(response.status).toBe(403);
  });
});
```

#### Test 2: Business Logic Flaws

```typescript
describe('Insecure Design - Business Logic', () => {
  it('should prevent booking in the past', async () => {
    const pastDate = new Date('2020-01-01');

    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        accommodationId: 'acc-123',
        checkIn: pastDate.toISOString(),
        checkOut: new Date('2020-01-02').toISOString(),
        guests: 2,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('past'),
    });
  });

  it('should prevent double booking', async () => {
    // Create first booking
    await createBooking({
      accommodationId: 'acc-123',
      checkIn: '2024-06-01',
      checkOut: '2024-06-05',
    });

    // Try overlapping booking
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        accommodationId: 'acc-123',
        checkIn: '2024-06-03', // Overlaps!
        checkOut: '2024-06-07',
        guests: 2,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('not available'),
    });
  });
});
```

---

## A05:2021 - Security Misconfiguration

### Description

Security misconfiguration occurs when security settings are not defined, implemented, or maintained properly. Common issues:

- Missing security patches
- Unnecessary features enabled
- Default accounts/passwords
- Overly detailed error messages
- Missing security headers
- Misconfigured CORS
- Insecure cloud storage

### How Hospeda Prevents It

#### 1. Secure Defaults

**Environment Configuration:**

```typescript
// packages/config/src/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  HOSPEDA_BETTER_AUTH_SECRET: z.string().min(32),

  // Optional with secure defaults
  API_RATE_LIMIT: z.number().default(300), // 300 req/min
  SESSION_DURATION: z.number().default(3600), // 1 hour
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Validate at startup
export const env = envSchema.parse(process.env);
```

#### 2. Security Headers

**Comprehensive security headers:**

```typescript
// apps/api/src/middleware/security.ts
import { secureHeaders } from 'hono/secure-headers';

export const securityHeadersMiddleware = secureHeaders({
  // Prevent clickjacking
  xFrameOptions: 'DENY',

  // Prevent MIME sniffing
  xContentTypeOptions: 'nosniff',

  // XSS protection (legacy browsers)
  xXssProtection: '1; mode=block',

  // Referrer policy
  referrerPolicy: 'strict-origin-when-cross-origin',

  // HSTS: Force HTTPS for 1 year
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',

  // Content Security Policy
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requires unsafe-inline
    imgSrc: ["'self'", 'https://res.cloudinary.com', 'data:'],
    connectSrc: ["'self'", 'https://api.mercadopago.com'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: [],
  },

  // Permissions Policy (formerly Feature-Policy)
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: ["'self'"],
    payment: ["'self'"],
  },
});

app.use('*', securityHeadersMiddleware);
```

#### 3. Error Handling

**Never expose sensitive information in errors:**

```typescript
// ✅ GOOD: Generic error messages in production
app.onError((err, c) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Log full error internally
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: c.req.path,
  });

  // Return safe error to client
  if (isDev) {
    // Development: detailed errors for debugging
    return c.json({
      error: err.message,
      stack: err.stack,
      path: c.req.path,
    }, 500);
  } else {
    // Production: generic error
    return c.json({
      error: 'Internal server error',
    }, 500);
  }
});

// ❌ BAD: Exposing stack traces
// app.onError((err, c) => {
//   return c.json({ error: err.message, stack: err.stack }, 500);
// });
```

**Validation error messages (safe to expose):**

```typescript
// Zod validation errors are safe (no sensitive data)
app.post('/api/accommodations', zValidator('json', schema), async (c) => {
  // If validation fails, Zod returns descriptive but safe errors
  // Example: "Title must be at least 10 characters"
});
```

#### 4. CORS Configuration

**Strict origin whitelist:**

```typescript
// apps/api/src/middleware/cors.ts
import { cors } from 'hono/cors';

const ALLOWED_ORIGINS = [
  'https://hospeda.com',
  'https://www.hospeda.com',
  'https://admin.hospeda.com',
  ...(process.env.NODE_ENV === 'development'
    ? ['http://localhost:4321', 'http://localhost:4322', 'http://localhost:3000']
    : []
  ),
];

export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow same-origin requests (no Origin header)
    if (!origin) return ALLOWED_ORIGINS[0];

    // Check whitelist
    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }

    // Reject unauthorized origins
    throw new HTTPException(403, { message: 'CORS policy violation' });
  },

  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['X-Request-Id'],
  maxAge: 86400, // 24 hours
});

app.use('/api/*', corsMiddleware);
```

#### 5. Dependency Management

**Automated security updates:**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10

    # Auto-merge security updates
    labels:
      - 'dependencies'
      - 'security'

    # Group minor/patch updates
    groups:
      dev-dependencies:
        dependency-type: 'development'
      production-dependencies:
        dependency-type: 'production'
```

**Regular audits:**

```bash
# Run weekly
pnpm audit

# Fix automatically (for patches)
pnpm audit --fix

# Review and fix manually (for majors)
pnpm outdated
```

#### 6. Deployment Configuration

**Vercel (Web & Admin):**

```json
{
  "framework": "astro",
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "devCommand": "pnpm run dev",

  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        }
      ]
    }
  ],

  "env": {
    "NODE_ENV": "production"
  }
}
```

**Vercel (API):**

```json
// apps/api/vercel.json
{
  "version": 2,
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=api",
  "nodeVersion": "20",
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Configuration Management

**Environment-Specific Settings:**

```typescript
// packages/config/src/index.ts
export const config = {
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  api: {
    port: env.API_PORT || 3000,
    rateLimit: env.API_RATE_LIMIT || 300,
    corsOrigins: ALLOWED_ORIGINS,
  },

  database: {
    url: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production',
  },

  auth: {
    betterAuth: {
      secret: env.HOSPEDA_BETTER_AUTH_SECRET,
    },
    sessionDuration: env.SESSION_DURATION || 3600,
  },

  logging: {
    level: env.LOG_LEVEL || 'info',
    // Never log sensitive data
    redact: ['password', 'token', 'secret', 'apiKey', 'creditCard'],
  },
};
```

### Testing Procedures

#### Test 1: Security Headers

```typescript
describe('Security Misconfiguration - Headers', () => {
  it('should include all security headers', async () => {
    const response = await fetch('https://api.hospeda.com/health');

    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(response.headers.get('content-security-policy')).toBeTruthy();
  });
});
```

#### Test 2: Error Messages

```typescript
describe('Security Misconfiguration - Error Messages', () => {
  it('should not expose stack traces in production', async () => {
    // Trigger an error
    const response = await fetch('/api/internal-error');

    const error = await response.json();

    expect(error.stack).toBeUndefined();
    expect(error.error).not.toContain('node_modules');
    expect(error.error).not.toContain(__dirname);
  });
});
```

#### Test 3: CORS Configuration

```typescript
describe('Security Misconfiguration - CORS', () => {
  it('should reject unauthorized origins', async () => {
    const response = await fetch('/api/accommodations', {
      headers: {
        'Origin': 'https://evil.com',
      },
    });

    expect(response.status).toBe(403);
  });

  it('should allow whitelisted origins', async () => {
    const response = await fetch('/api/accommodations', {
      headers: {
        'Origin': 'https://hospeda.com',
      },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('https://hospeda.com');
  });
});
```

---

## A06:2021 - Vulnerable and Outdated Components

### Description

Using components with known vulnerabilities. This includes:

- Outdated libraries with security patches available
- Unsupported or end-of-life software
- Not scanning for vulnerabilities regularly
- Not fixing or upgrading dependencies promptly

### How Hospeda Prevents It

#### 1. Dependency Management

**Lock Files:**

```bash
# pnpm-lock.yaml committed to Git
# Ensures reproducible builds
# Prevents unexpected updates
```

**Regular Updates:**

```bash
# Weekly dependency check
pnpm outdated

# Update patch versions (safe)
pnpm update

# Update specific package
pnpm update hono@latest

# Update all (review carefully)
pnpm update --latest
```

#### 2. Automated Vulnerability Scanning

**Dependabot Configuration:**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'

    # Security updates
    open-pull-requests-limit: 20
    labels:
      - 'dependencies'
      - 'security'

    # Reviewers
    reviewers:
      - 'tech-lead'

    # Auto-merge security patches
    allow:
      - dependency-type: 'direct'
        update-type: 'security'
```

**GitHub Security Alerts:**

- Enabled for all repositories
- Email notifications to team
- Automatic pull requests for fixes

#### 3. Continuous Monitoring

**Weekly Security Audit:**

```bash
# Check for known vulnerabilities
pnpm audit

# Output format:
# Severity: high
# Package: lodash
# Vulnerable versions: <4.17.21
# Recommendation: Upgrade to 4.17.21+
```

**CI/CD Security Check:**

```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 9 * * 1' # Every Monday 9 AM

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Security audit
        run: pnpm audit --audit-level=moderate

      - name: Check outdated packages
        run: pnpm outdated || true
```

#### 4. Update Strategy

**Severity-Based Response:**

| Severity | Response Time | Action |
|----------|--------------|--------|
| Critical | 24 hours | Immediate patch and deploy |
| High | 1 week | Priority fix in next sprint |
| Medium | 2 weeks | Regular update cycle |
| Low | 1 month | Include in maintenance window |

**Update Process:**

1. **Receive Alert**
   - Dependabot creates PR
   - Team notified via email/Slack

1. **Assess Impact**
   - Review changelog
   - Check breaking changes
   - Identify affected areas

1. **Test Update**
   - Run test suite
   - Manual testing if needed
   - Check for breaking changes

1. **Deploy**
   - Merge PR
   - Deploy to staging
   - Deploy to production

#### 5. Dependency Hygiene

**Minimize Dependencies:**

```json
{
  "dependencies": {
    // Only essential runtime dependencies
    "hono": "^4.0.0",
    "drizzle-orm": "^0.29.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    // Development tools
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

**Avoid Risky Packages:**

- Packages with no recent updates (>1 year)
- Packages with single maintainer
- Packages with low download count
- Packages with security history

**Use Trusted Sources:**

- Official packages from npm
- Verified organizations
- Well-maintained open source

#### 6. Version Pinning

**Production Dependencies:**

```json
{
  "dependencies": {
    // Caret (^): Patch & minor updates allowed
    "hono": "^4.0.0",

    // For critical packages, pin exact version
    "better-auth": "1.2.3"
  }
}
```

### Vulnerability Tracking

**Current Dependencies (Example):**

```bash
# Check installed versions
pnpm list --depth=0

# Output:
# hospeda@1.0.0
# ├── hono@4.0.5
# ├── drizzle-orm@0.29.3
# ├── zod@3.22.4
# └── better-auth@1.2.8
```

**Known Issues:**

```markdown
# Tracking: DEPENDENCIES.md

## Critical Issues
None

## High Priority
None

## Medium Priority
- lodash@4.17.20 → 4.17.21 (Prototype Pollution - CVE-2020-8203)
  Status: PR #123 created by Dependabot
  Action: Under review

## Low Priority
- axios@0.27.2 → 1.6.2 (Update available)
  Status: Non-security update
  Action: Scheduled for v1.2.0 release
```

### Update Procedures

**Security Update Workflow:**

```bash
# 1. Review Dependabot PR
git checkout dependabot/npm_and_yarn/lodash-4.17.21

# 2. Check for breaking changes
cat node_modules/lodash/CHANGELOG.md

# 3. Run tests
pnpm test

# 4. Build all apps
pnpm build

# 5. Manual testing (if needed)
pnpm dev

# 6. Merge PR
gh pr merge --squash

# 7. Deploy
# (Automatic via CI/CD)
```

### Testing Procedures

#### Test 1: No Known Vulnerabilities

```typescript
describe('Vulnerable Components - Audit', () => {
  it('should have no high/critical vulnerabilities', async () => {
    const result = await exec('pnpm audit --audit-level=high');

    expect(result.exitCode).toBe(0);
  });
});
```

#### Test 2: Dependency Versions

```typescript
describe('Vulnerable Components - Versions', () => {
  it('should use secure versions', () => {
    const pkg = require('../package.json');

    // Example: Ensure Hono >= 4.0.0
    expect(pkg.dependencies.hono).toMatch(/^\^4\./);

    // Ensure Better Auth >= 1.2.0
    expect(pkg.dependencies['better-auth']).toMatch(/^\^?1\.[2-9]\./);
  });
});
```

#### Test 3: Update Recency

```typescript
describe('Vulnerable Components - Recency', () => {
  it('should have recent dependency updates', async () => {
    const lastUpdate = await getLastDependencyUpdate();
    const daysSinceUpdate = daysBetween(lastUpdate, new Date());

    // Dependencies should be updated at least monthly
    expect(daysSinceUpdate).toBeLessThan(30);
  });
});
```

---

## A07:2021 - Identification and Authentication Failures

### Description

Authentication and session management vulnerabilities allow attackers to compromise passwords, keys, or session tokens, or to exploit implementation flaws to assume other users' identities.

**Common Issues:**

- Weak passwords
- Credential stuffing
- Missing or ineffective MFA
- Session fixation
- Insecure session management
- Missing authentication for sensitive functions

### How Hospeda Prevents It

#### 1. Better Auth Authentication

**Self-Hosted Authentication:**

Hospeda uses Better Auth for all authentication, providing:

- Secure password hashing (bcrypt/argon2)
- Multi-factor authentication (TOTP)
- OAuth providers (Google, GitHub, etc.)
- Session-based authentication
- Self-hosted (no external API dependency)

**Why Better Auth?**

- Open-source, self-hosted authentication
- Full control over user data
- No vendor dependency
- Session-based (no JWT token management)
- Active community and regular updates

#### 2. JWT Token Validation

**Every request validates JWT:**

```typescript
// apps/api/src/middleware/auth.ts
import { auth } from '../lib/auth';

export const requireAuth = createMiddleware(async (c, next) => {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Verify session is not expired (Better Auth handles this automatically)
    // Set context
    c.set('userId', session.user.id);
    c.set('sessionId', session.session.id);

    await next();
  } catch (error) {
    logger.warn('Session verification failed', {
      error: error.message,
      ip: c.req.header('x-forwarded-for'),
    });

    return c.json({ error: 'Invalid or expired session' }, 401);
  }
});
```

#### 3. Session Security

**Secure Session Configuration:**

```typescript
// Session tokens stored in secure cookies
const sessionCookieOptions = {
  httpOnly: true, // Prevent XSS access
  secure: true, // HTTPS only
  sameSite: 'strict' as const, // CSRF protection
  maxAge: 3600, // 1 hour
  path: '/',
};

// Set session cookie
c.cookie('__session', sessionToken, sessionCookieOptions);
```

**Session Lifecycle:**

```typescript
// Login: Better Auth creates session
const session = await auth.api.signInEmail({
  body: { email, password },
});

// Refresh: Automatic via Better Auth
// Session is refreshed on activity based on updateAge config

// Logout: Revoke session
await auth.api.signOut({ headers: c.req.raw.headers });

// Suspicious activity: Revoke all sessions for user
await db.delete(sessions).where(eq(sessions.userId, userId));
```

#### 4. Brute Force Protection

**Rate Limiting on Auth Endpoints:**

```typescript
import { rateLimiter } from 'hono-rate-limiter';

// Strict rate limit for authentication
app.use('/api/auth/*', rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // 5 attempts per minute per IP
  standardHeaders: 'draft-7',
  keyGenerator: (c) => c.req.header('x-forwarded-for') || 'unknown',
  handler: (c) => {
    logger.warn('Rate limit exceeded on auth endpoint', {
      ip: c.req.header('x-forwarded-for'),
      path: c.req.path,
    });

    return c.json({
      error: 'Too many authentication attempts. Please try again later.',
    }, 429);
  },
}));
```

**Account Lockout (Better Auth + Rate Limiting):**

- Automatic after repeated failed login attempts
- Temporary lockout (increases with subsequent failures)
- Email notification to user
- Admin can unlock account

#### 5. Multi-Factor Authentication

**MFA Support via Better Auth:**

```typescript
// Check if user has MFA enabled
const user = await getUserById(userId);
const hasMFA = user.twoFactorEnabled;

// Require MFA for admin users
if (user.role === 'admin' && !hasMFA) {
  return c.json({
    error: 'MFA required for admin accounts',
    action: 'enable_mfa',
  }, 403);
}
```

**MFA Enforcement:**

- Optional for regular users
- Required for admin users
- TOTP (Google Authenticator, Authy)
- SMS backup codes
- Recovery codes

#### 6. Password Policies

**Handled by Better Auth:**

- Minimum 8 characters
- Complexity requirements (configurable)
- Secure hashing (bcrypt/argon2)
- Password stored securely in our database by Better Auth
- Self-hosted, full control over password policies

**Better Auth manages password storage:**

```typescript
// Better Auth handles password hashing and storage in the database
// The password is never stored in plain text
// We configure password policies in Better Auth config

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
});
```

### Webhook Signature Verification

**MercadoPago Webhooks:**

```typescript
import { createHmac } from 'crypto';

app.post('/api/webhooks/mercadopago', async (c) => {
  const payload = await c.req.text();
  const signature = c.req.header('x-signature');
  const requestId = c.req.header('x-request-id');

  // Verify webhook signature
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;
  const expectedSignature = createHmac('sha256', secret)
    .update(requestId + payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('Invalid webhook signature', { requestId });
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Process verified event
  const event = JSON.parse(payload);
  switch (event.type) {
    case 'payment':
      await handlePaymentEvent(event.data);
      break;
    // ...
  }

  return c.json({ success: true });
});
```

### Testing Procedures

#### Test 1: Authentication Required

```typescript
describe('Authentication Failures - Auth Required', () => {
  it('should reject requests without token', async () => {
    const response = await fetch('/api/accommodations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(response.status).toBe(401);
  });

  it('should reject requests with invalid token', async () => {
    const response = await fetch('/api/accommodations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(response.status).toBe(401);
  });

  it('should reject expired tokens', async () => {
    const expiredToken = await createExpiredToken();

    const response = await fetch('/api/accommodations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${expiredToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('expired'),
    });
  });
});
```

#### Test 2: Brute Force Protection

```typescript
describe('Authentication Failures - Brute Force', () => {
  it('should rate limit authentication attempts', async () => {
    const attempts = [];

    // Make 10 login attempts
    for (let i = 0; i < 10; i++) {
      attempts.push(
        fetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: 'user@example.com',
            password: 'wrong',
          }),
        })
      );
    }

    const responses = await Promise.all(attempts);
    const rateLimited = responses.filter((r) => r.status === 429);

    // At least some requests should be rate limited
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

#### Test 3: Session Security

```typescript
describe('Authentication Failures - Session Security', () => {
  it('should set secure cookie flags', async () => {
    const response = await loginUser({ email: 'user@example.com' });

    const setCookie = response.headers.get('set-cookie');

    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('should expire sessions after logout', async () => {
    const { token, sessionId } = await loginUser();

    // Logout
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    // Try to use old token
    const response = await fetch('/api/accommodations', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    expect(response.status).toBe(401);
  });
});
```

---

## A08:2021 - Software and Data Integrity Failures

### Description

Software and data integrity failures relate to code and infrastructure that does not protect against integrity violations. Examples include:

- Unsigned software updates
- Insecure CI/CD pipelines
- Auto-update without integrity verification
- Insecure deserialization
- Trusting untrusted data

### How Hospeda Prevents It

#### 1. CI/CD Security

**GitHub Actions Security:**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

# Limit permissions (principle of least privilege)
permissions:
  contents: read
  deployments: write

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          # Verify Git signatures (if enabled)
          persist-credentials: false

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile # Use exact versions from lock file

      - name: Run tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Lock Files:**

```bash
# pnpm-lock.yaml ensures reproducible builds
# Contains exact versions and integrity hashes

# Example entry:
# hono@4.0.5:
#   resolution: {integrity: sha512-abc123...}
```

#### 2. Package Integrity

**Verify Package Integrity:**

```bash
# pnpm automatically verifies integrity hashes
pnpm install --frozen-lockfile

# If integrity mismatch:
# ERR_PNPM_TARBALL_INTEGRITY
```

**Avoid `npm install` without lock file:**

```bash
# ❌ BAD: Can install different versions
npm install

# ✅ GOOD: Uses exact versions
pnpm install --frozen-lockfile
```

#### 3. Dependency Provenance

**Use Official Packages:**

```json
{
  "dependencies": {
    // ✅ Official packages from verified publishers
    "hono": "^4.0.0", // @hono namespace
    "better-auth": "^1.2.0", // better-auth package
    "drizzle-orm": "^0.29.0" // drizzle-team org
  }
}
```

**Avoid Typosquatting:**

```bash
# ❌ Potential typosquatting
# "honno" instead of "hono"
# "drizzel-orm" instead of "drizzle-orm"

# ✅ Verify package names carefully
```

#### 4. Code Signing (Git)

**Commit Signing (Optional):**

```bash
# Enable GPG signing
git config commit.gpgsign true

# Sign commits
git commit -S -m "feat: add authentication"

# Verify signatures
git log --show-signature
```

**Branch Protection:**

```yaml
# .github/branch-protection.yml (for `main` branch)
required_status_checks:
  strict: true
  contexts:
    - test
    - build
    - security-audit

required_pull_request_reviews:
  required_approving_review_count: 1
  dismiss_stale_reviews: true

enforce_admins: true
```

#### 5. Secure Deserialization

**Avoid Insecure Deserialization:**

```typescript
// ❌ UNSAFE: eval() or Function()
// const data = eval(userInput); // NEVER DO THIS

// ✅ SAFE: JSON.parse() with validation
const parseUserData = (json: string) => {
  let data;

  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new Error('Invalid JSON');
  }

  // Validate with Zod
  return userDataSchema.parse(data);
};
```

**TypeScript Strict Mode:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

#### 6. Build Integrity

**Reproducible Builds:**

```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:check": "pnpm run typecheck && pnpm run test && pnpm run build"
  }
}
```

**Build Verification:**

```bash
# Hash build artifacts
sha256sum dist/index.js

# Compare across builds (should be identical)
```

### CI/CD Pipeline Security

**Environment Isolation:**

```yaml
# Separate environments
jobs:
  test:
    runs-on: ubuntu-latest
    environment: test

  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging
    needs: test

  deploy-production:
    runs-on: ubuntu-latest
    environment: production
    needs: deploy-staging
```

**Secret Management:**

```yaml
# Use GitHub Secrets (encrypted at rest)
- name: Deploy
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: pnpm deploy
```

### Integrity Validation

**Database Migrations:**

```typescript
// Track migration integrity
// packages/db/drizzle/meta/_journal.json
{
  "version": "5",
  "dialect": "pg",
  "entries": [
    {
      "idx": 0,
      "version": "5",
      "when": 1705334400000,
      "tag": "0000_create_users_table",
      "breakpoints": true
    }
  ]
}

// Drizzle verifies migration order and integrity
```

### Testing Procedures

#### Test 1: Dependency Integrity

```typescript
describe('Software Integrity - Dependencies', () => {
  it('should have integrity hashes in lock file', () => {
    const lockFile = readFileSync('pnpm-lock.yaml', 'utf8');

    expect(lockFile).toContain('integrity:');
    expect(lockFile).toContain('sha512-');
  });

  it('should use frozen lockfile in CI', () => {
    const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

    expect(workflow).toContain('--frozen-lockfile');
  });
});
```

#### Test 2: Build Reproducibility

```typescript
describe('Software Integrity - Build', () => {
  it('should produce identical builds', async () => {
    // Build twice
    await exec('pnpm build');
    const hash1 = await hashDirectory('dist');

    await exec('rm -rf dist');
    await exec('pnpm build');
    const hash2 = await hashDirectory('dist');

    // Builds should be identical
    expect(hash1).toBe(hash2);
  });
});
```

#### Test 3: Code Signing

```typescript
describe('Software Integrity - Code Signing', () => {
  it('should have signed commits (if enabled)', async () => {
    const { stdout } = await exec('git log -1 --show-signature');

    if (process.env.REQUIRE_SIGNED_COMMITS === 'true') {
      expect(stdout).toContain('gpg: Good signature');
    }
  });
});
```

---

## A09:2021 - Security Logging and Monitoring Failures

### Description

Insufficient logging and monitoring, coupled with missing or ineffective integration with incident response, allows attackers to further attack systems, maintain persistence, pivot to more systems, and tamper, extract, or destroy data.

**Common Issues:**

- Auditable events not logged
- Warnings and errors generate no logs
- Logs only stored locally
- No alerting on suspicious activities
- Penetration testing doesn't trigger alerts

### How Hospeda Prevents It

#### 1. Structured Logging

**Comprehensive Event Logging:**

```typescript
// packages/logger/src/index.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
      '*.password',
      '*.token',
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export { logger };
```

**Event Categories:**

```typescript
// Authentication events
logger.info('User logged in', {
  event: 'auth.login',
  userId: user.id,
  method: 'oauth',
  provider: 'google',
  ip: clientIp,
  userAgent: req.headers['user-agent'],
});

logger.warn('Login failed', {
  event: 'auth.login_failed',
  email: email,
  reason: 'invalid_password',
  ip: clientIp,
  attempts: failedAttempts,
});

// Authorization events
logger.warn('Authorization denied', {
  event: 'authz.denied',
  userId: user.id,
  resource: 'accommodation',
  action: 'delete',
  resourceId: accommodationId,
  reason: 'not_owner',
});

// Data access
logger.info('PII accessed', {
  event: 'data.pii_access',
  actorId: admin.id,
  targetUserId: user.id,
  dataType: 'user_profile',
  reason: 'support_request',
});

// Security events
logger.error('Rate limit exceeded', {
  event: 'security.rate_limit',
  ip: clientIp,
  endpoint: req.path,
  limit: 300,
  attempts: 350,
});

logger.error('Suspicious activity', {
  event: 'security.suspicious',
  userId: user.id,
  activity: 'multiple_failed_authz',
  count: 10,
  timeWindow: '5m',
});

// Business events
logger.info('Booking created', {
  event: 'business.booking_created',
  bookingId: booking.id,
  accommodationId: booking.accommodationId,
  userId: hash(user.id), // Hashed for privacy
  amount: booking.totalPrice,
});

// Errors
logger.error('Payment processing failed', {
  event: 'error.payment_failed',
  bookingId: booking.id,
  errorCode: error.code,
  errorMessage: error.message,
  // No sensitive payment details
});
```

#### 2. What NOT to Log

**Never log sensitive data:**

```typescript
// ❌ BAD: Logging sensitive data
logger.info('User registered', {
  email: user.email,
  password: password, // NEVER LOG PASSWORDS
  creditCard: paymentInfo.cardNumber, // NEVER LOG PAYMENT DATA
  ssn: user.ssn, // NEVER LOG PII
});

// ✅ GOOD: Log safe identifiers
logger.info('User registered', {
  event: 'user.registered',
  userId: user.id, // Safe identifier
  method: 'email', // Registration method
  timestamp: new Date().toISOString(),
});
```

**Redaction Configuration:**

```typescript
const logger = pino({
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
      'creditCard',
      'cardNumber',
      'cvv',
      'ssn',
      '*.password',
      '*.token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    remove: true, // Remove entirely instead of masking
  },
});
```

#### 3. Monitoring & Alerting

**Security Metrics:**

```typescript
// Track authentication failures
class AuthMetrics {
  private failuresByIP = new Map<string, number>();
  private failuresByUser = new Map<string, number>();

  recordFailure(ip: string, userId?: string) {
    // Track by IP
    this.failuresByIP.set(ip, (this.failuresByIP.get(ip) || 0) + 1);

    // Alert if >10 failures from same IP in 1 minute
    if (this.failuresByIP.get(ip)! > 10) {
      this.alert('High authentication failure rate', {
        ip,
        failures: this.failuresByIP.get(ip),
        severity: 'high',
      });
    }

    // Track by user (if available)
    if (userId) {
      this.failuresByUser.set(userId, (this.failuresByUser.get(userId) || 0) + 1);

      if (this.failuresByUser.get(userId)! > 5) {
        this.alert('Multiple failed login attempts', {
          userId,
          failures: this.failuresByUser.get(userId),
          severity: 'medium',
        });
      }
    }
  }

  private alert(message: string, context: any) {
    logger.error('SECURITY ALERT', { message, ...context });

    // Send to monitoring service (e.g., Sentry, Datadog)
    // Send email/Slack notification
  }
}
```

**Anomaly Detection:**

```typescript
// Detect unusual patterns
class AnomalyDetector {
  detectUnusualAccess(user: User, resource: Resource) {
    // Unusual time (3 AM - 6 AM)
    const hour = new Date().getHours();
    if (hour >= 3 && hour < 6) {
      logger.warn('Unusual access time', {
        event: 'security.unusual_time',
        userId: user.id,
        resource: resource.type,
        hour,
      });
    }

    // Unusual location (if available via GeoIP)
    const userCountry = user.lastKnownCountry;
    const currentCountry = getCountryFromIP(request.ip);

    if (userCountry && currentCountry !== userCountry) {
      logger.warn('Access from new location', {
        event: 'security.new_location',
        userId: user.id,
        previousCountry: userCountry,
        currentCountry,
      });
    }

    // Rapid resource access (potential scraping)
    const accessRate = this.getAccessRate(user.id);
    if (accessRate > 100) { // >100 requests/minute
      logger.warn('High access rate', {
        event: 'security.high_access_rate',
        userId: user.id,
        rate: accessRate,
      });
    }
  }
}
```

#### 4. Audit Logs

**Administrative Actions:**

```typescript
// Log all admin actions
export const auditMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user');

  // Only audit admin actions
  if (user.role === 'admin') {
    const startTime = Date.now();

    await next();

    const duration = Date.now() - startTime;

    logger.info('Admin action', {
      event: 'audit.admin_action',
      adminId: user.id,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      ip: c.req.header('x-forwarded-for'),
    });
  } else {
    await next();
  }
});

app.use('/api/admin/*', requireAuth, requireAdmin, auditMiddleware);
```

#### 5. Log Retention

**Retention Policy:**

```typescript
// Log retention periods
const LOG_RETENTION = {
  authentication: 90, // 90 days
  authorization: 90,
  audit: 365, // 1 year
  error: 90,
  access: 30, // 30 days
};

// Automated cleanup (scheduled job)
export const cleanupOldLogs = async () => {
  const cutoffDate = subDays(new Date(), LOG_RETENTION.access);

  await db
    .delete(accessLogs)
    .where(lt(accessLogs.createdAt, cutoffDate));

  logger.info('Log cleanup completed', {
    event: 'maintenance.log_cleanup',
    cutoffDate,
  });
};
```

#### 6. Real-Time Monitoring

**Integration with Monitoring Services:**

```typescript
// Sentry for error tracking
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,

  beforeSend(event, hint) {
    // Redact sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.authorization;
    }

    return event;
  },
});

// Capture security events
export const captureSecurityEvent = (message: string, context: any) => {
  Sentry.captureMessage(message, {
    level: 'warning',
    tags: { type: 'security' },
    extra: context,
  });
};
```

### Alert Configuration

**High-Priority Alerts:**

```typescript
const ALERT_THRESHOLDS = {
  authenticationFailures: {
    perIP: { count: 10, window: 60000 }, // 10 in 1 minute
    global: { count: 100, window: 300000 }, // 100 in 5 minutes
  },

  authorizationDenials: {
    perUser: { count: 5, window: 300000 }, // 5 in 5 minutes
  },

  rateLimitHits: {
    perEndpoint: { count: 100, window: 60000 }, // 100 in 1 minute
  },

  errors: {
    rate: 0.05, // 5% error rate
    count: 50, // 50 errors in window
    window: 300000, // 5 minutes
  },
};
```

### Testing Procedures

#### Test 1: Logging Enabled

```typescript
describe('Logging and Monitoring - Logging', () => {
  it('should log authentication events', async () => {
    const logs: any[] = [];
    const mockLogger = {
      info: (msg: string, data: any) => logs.push({ level: 'info', msg, data }),
    };

    // Override logger
    jest.spyOn(logger, 'info').mockImplementation(mockLogger.info);

    await loginUser({ email: 'user@example.com' });

    expect(logs).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'auth.login',
        }),
      })
    );
  });

  it('should log authorization failures', async () => {
    const logs: any[] = [];
    jest.spyOn(logger, 'warn').mockImplementation((msg, data) => logs.push({ msg, data }));

    // Attempt unauthorized action
    await fetch('/api/accommodations/123', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${guestToken}` },
    });

    expect(logs).toContainEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          event: 'authz.denied',
        }),
      })
    );
  });
});
```

#### Test 2: Sensitive Data Redaction

```typescript
describe('Logging and Monitoring - Redaction', () => {
  it('should redact passwords from logs', () => {
    const logs: any[] = [];
    jest.spyOn(logger, 'info').mockImplementation((msg, data) => logs.push(data));

    logger.info('User data', {
      email: 'user@example.com',
      password: 'secret123', // Should be redacted
    });

    const log = logs[0];
    expect(log.password).toBeUndefined();
    expect(log.email).toBe('user@example.com');
  });
});
```

#### Test 3: Alerting

```typescript
describe('Logging and Monitoring - Alerting', () => {
  it('should alert on excessive auth failures', async () => {
    const alerts: any[] = [];
    jest.spyOn(alertService, 'send').mockImplementation((alert) => alerts.push(alert));

    // Trigger 15 failed logins
    for (let i = 0; i < 15; i++) {
      await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com', password: 'wrong' }),
      });
    }

    expect(alerts).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('authentication failure'),
        severity: 'high',
      })
    );
  });
});
```

---

## A10:2021 - Server-Side Request Forgery (SSRF)

### Description

SSRF flaws occur when a web application fetches a remote resource without validating the user-supplied URL. Attackers can coerce the application to send requests to:

- Internal services (cloud metadata endpoints)
- Internal network resources
- External services (to bypass firewalls)

**Common Vectors:**

- Image upload with URL
- Webhook callbacks
- PDF generation from URL
- Import data from URL

### How Hospeda Prevents It

#### 1. URL Validation

**Strict URL Validation:**

```typescript
// packages/schemas/src/common/url.schema.ts
import { z } from 'zod';

// Allowed protocols
const ALLOWED_PROTOCOLS = ['https:', 'http:'] as const;

// Blocked hosts (internal, metadata, localhost)
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '10.0.0.0/8', // Private network
  '172.16.0.0/12', // Private network
  '192.168.0.0/16', // Private network
  '169.254.169.254', // AWS metadata
  'metadata.google.internal', // GCP metadata
  'metadata', // Generic metadata
];

export const safeUrlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url);

    // Check protocol
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol as any)) {
      return false;
    }

    // Check for blocked hosts
    const hostname = parsed.hostname.toLowerCase();

    for (const blocked of BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        return false;
      }
    }

    // Check for IP addresses (should use hostnames)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return false; // Block direct IP access
    }

    return true;
  },
  { message: 'URL not allowed' }
);

export type SafeUrl = z.infer<typeof safeUrlSchema>;
```

#### 2. Whitelist Approach

**Only Allow Specific Domains:**

```typescript
// For webhook callbacks
const ALLOWED_WEBHOOK_DOMAINS = [
  'mercadopago.com.ar',
  'mercadopago.com',
] as const;

export const webhookUrlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return ALLOWED_WEBHOOK_DOMAINS.some((domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  },
  { message: 'Webhook domain not allowed' }
);

// For image URLs
const ALLOWED_IMAGE_DOMAINS = [
  'res.cloudinary.com', // Cloudinary CDN
  'images.unsplash.com', // Unsplash (if used)
] as const;

export const imageUrlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }

    return ALLOWED_IMAGE_DOMAINS.some((domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  },
  { message: 'Image domain not allowed' }
);
```

#### 3. Input Sanitization

**Prevent SSRF in Image Upload:**

```typescript
// apps/api/src/routes/upload.ts
import { imageUrlSchema } from '@repo/schemas';

app.post('/api/upload/from-url', requireAuth, async (c) => {
  const { url } = await c.req.json();

  // Validate URL
  const result = imageUrlSchema.safeParse(url);

  if (!result.success) {
    return c.json({
      error: 'Invalid image URL',
      details: result.error.errors,
    }, 400);
  }

  // Fetch with timeout and size limit
  try {
    const response = await fetch(result.data, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
      headers: {
        'User-Agent': 'Hospeda-Bot/1.0',
      },
    });

    if (!response.ok) {
      return c.json({ error: 'Failed to fetch image' }, 400);
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return c.json({ error: 'URL does not point to an image' }, 400);
    }

    // Check content length (max 10MB)
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    if (contentLength > 10 * 1024 * 1024) {
      return c.json({ error: 'Image too large (max 10MB)' }, 400);
    }

    // Process image (upload to Cloudinary)
    const imageBuffer = await response.arrayBuffer();
    const uploadResult = await uploadToCloudinary(imageBuffer);

    return c.json({ url: uploadResult.url });
  } catch (error) {
    logger.error('Image fetch failed', { error, url: result.data });
    return c.json({ error: 'Failed to fetch image' }, 500);
  }
});
```

#### 4. Network Isolation

**Prevent Access to Internal Services:**

```typescript
// Block access to cloud metadata endpoints
const isMetadataEndpoint = (hostname: string): boolean => {
  const metadataEndpoints = [
    '169.254.169.254', // AWS, Azure
    'metadata.google.internal', // GCP
    'metadata', // Generic
  ];

  return metadataEndpoints.some((endpoint) =>
    hostname === endpoint || hostname.endsWith(endpoint)
  );
};

// Block private IP ranges
const isPrivateIP = (hostname: string): boolean => {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^127\./, // 127.0.0.0/8 (localhost)
    /^0\./, // 0.0.0.0/8
  ];

  return privateRanges.some((range) => range.test(hostname));
};

export const validateExternalUrl = (url: string): boolean => {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  // Block metadata endpoints
  if (isMetadataEndpoint(hostname)) {
    return false;
  }

  // Block private IPs
  if (isPrivateIP(hostname)) {
    return false;
  }

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }

  return true;
};
```

#### 5. Webhook Security

**Verify Webhook Sources:**

```typescript
// Only accept webhooks from verified sources
app.post('/api/webhooks/mercadopago', async (c) => {
  // Verify webhook signature (prevents spoofing)
  const signature = c.req.header('x-signature');
  const requestId = c.req.header('x-request-id');

  if (!signature || !requestId) {
    return c.json({ error: 'Missing webhook headers' }, 401);
  }

  const payload = await c.req.text();

  // Verify signature with MercadoPago secret
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;
  const expectedSignature = createHmac('sha256', secret)
    .update(requestId + payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('Invalid webhook signature', { requestId });
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Webhook verified, process event
  const event = JSON.parse(payload);
  await processPaymentEvent(event);

  return c.json({ success: true });
});
```

#### 6. Request Timeout & Size Limits

**Prevent Resource Exhaustion:**

```typescript
// Timeout for external requests
const FETCH_TIMEOUT = 5000; // 5 seconds

// Size limit for responses
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10 MB

export const safeFetch = async (url: string): Promise<Response> => {
  // Validate URL first
  if (!validateExternalUrl(url)) {
    throw new Error('URL not allowed');
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Hospeda-Bot/1.0',
      },
    });

    clearTimeout(timeout);

    // Check size
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    if (contentLength > MAX_RESPONSE_SIZE) {
      throw new Error('Response too large');
    }

    return response;
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }

    throw error;
  }
};
```

### Prevention Strategies

#### 1. Never Trust User-Supplied URLs

```typescript
// ❌ UNSAFE: Direct fetch
const response = await fetch(userSuppliedUrl);

// ✅ SAFE: Validate first
const validated = safeUrlSchema.parse(userSuppliedUrl);
const response = await safeFetch(validated);
```

#### 2. Use Allowlists, Not Blocklists

```typescript
// ❌ BLOCKLIST: Can be bypassed
const blocklist = ['127.0.0.1', 'localhost'];
if (!blocklist.includes(hostname)) {
  fetch(url); // Vulnerable
}

// ✅ ALLOWLIST: Only specific domains
const allowlist = ['res.cloudinary.com'];
if (allowlist.includes(hostname)) {
  fetch(url); // Safe
}
```

#### 3. Disable URL Redirects

```typescript
// Prevent redirect-based SSRF
const response = await fetch(url, {
  redirect: 'manual', // Don't follow redirects
});

if (response.status >= 300 && response.status < 400) {
  throw new Error('Redirects not allowed');
}
```

### Testing Procedures

#### Test 1: Block Internal URLs

```typescript
describe('SSRF - Internal URLs', () => {
  it('should block localhost', async () => {
    const response = await fetch('/api/upload/from-url', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'http://localhost:3000/admin',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('should block private IP ranges', async () => {
    const privateIPs = [
      'http://10.0.0.1',
      'http://172.16.0.1',
      'http://192.168.1.1',
    ];

    for (const ip of privateIPs) {
      const response = await fetch('/api/upload/from-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: ip }),
      });

      expect(response.status).toBe(400);
    }
  });

  it('should block cloud metadata endpoints', async () => {
    const metadataUrls = [
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
    ];

    for (const url of metadataUrls) {
      const response = await fetch('/api/upload/from-url', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      expect(response.status).toBe(400);
    }
  });
});
```

#### Test 2: Allow Only Whitelisted Domains

```typescript
describe('SSRF - Whitelist', () => {
  it('should allow whitelisted domains', async () => {
    const response = await fetch('/api/upload/from-url', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      }),
    });

    expect(response.status).toBe(200);
  });

  it('should block non-whitelisted domains', async () => {
    const response = await fetch('/api/upload/from-url', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://evil.com/image.jpg',
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

#### Test 3: Request Timeout

```typescript
describe('SSRF - Timeout', () => {
  it('should timeout slow requests', async () => {
    // Mock slow server
    const slowUrl = 'https://httpbin.org/delay/10'; // 10 second delay

    const startTime = Date.now();

    const response = await fetch('/api/upload/from-url', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: slowUrl }),
    });

    const duration = Date.now() - startTime;

    // Should timeout before 10 seconds
    expect(duration).toBeLessThan(7000); // 7 seconds (5s timeout + overhead)
    expect(response.status).toBe(500);
  });
});
```

---

**Last Updated**: 2024-01-15
**Next Review**: 2024-04-15
**Version**: 1.0.0
