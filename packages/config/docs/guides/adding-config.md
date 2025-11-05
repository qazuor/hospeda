# Adding Configuration Guide

Step-by-step guide to add new configuration to the Hospeda platform.

## Overview

Adding new configuration involves:

1. Identify the configuration need
2. Choose appropriate section (or create new)
3. Define Zod schema with validation
4. Create parser function
5. Update section client (optional)
6. Export from index.ts
7. Update `.env.example`
8. Document in env-vars.md
9. Test configuration
10. Use in application

## Complete Example: Adding Email Configuration

Let's add complete email configuration from scratch.

### Step 1: Identify Configuration Need

**Requirements:**

- SMTP host and port
- Authentication credentials
- Default "from" address
- Feature flag to enable/disable
- Support for multiple environments

### Step 2: Choose Configuration Section

Create new section: `email`

**Location**: `packages/config/src/sections/`

**Files to create:**

- `email.schema.ts` - Schema and parser
- `email.client.ts` - Client functions

### Step 3: Define Zod Schema

Create `packages/config/src/sections/email.schema.ts`:

```typescript
import { z } from 'zod';
import { validateEnv } from '../env.js';
import { commonEnvSchemas } from '../utils.js';

/**
 * Email configuration schema
 *
 * Validates SMTP settings and email configuration
 */
export const emailSchema = z.object({
  /**
   * SMTP server hostname
   *
   * @example "smtp.gmail.com"
   * @example "smtp.sendgrid.net"
   */
  EMAIL_HOST: commonEnvSchemas.string('smtp.gmail.com'),

  /**
   * SMTP server port
   *
   * Common ports:
   * - 25: Standard SMTP (unencrypted)
   * - 465: SMTP with SSL
   * - 587: SMTP with STARTTLS (recommended)
   */
  EMAIL_PORT: commonEnvSchemas.port(587),

  /**
   * SMTP authentication username
   *
   * Usually an email address
   */
  EMAIL_USER: z.string().email(),

  /**
   * SMTP authentication password or app password
   *
   * For Gmail, use an app-specific password
   */
  EMAIL_PASS: z.string().min(1),

  /**
   * Default "from" email address
   *
   * This address will be used as the sender for all emails
   */
  EMAIL_FROM: z.string().email(),

  /**
   * Default "from" name
   *
   * Display name for the sender
   */
  EMAIL_FROM_NAME: commonEnvSchemas.string('Hospeda'),

  /**
   * Enable email sending
   *
   * Set to false to disable email functionality (e.g., in development)
   */
  EMAIL_ENABLED: commonEnvSchemas.boolean(false),

  /**
   * Use TLS/SSL for secure connection
   */
  EMAIL_SECURE: commonEnvSchemas.boolean(true),
});

/**
 * Email configuration type
 *
 * Inferred from the email schema
 */
export type EmailConfig = z.infer<typeof emailSchema>;

/**
 * Parse and validate email configuration from environment variables
 *
 * @throws {EnvValidationError} If validation fails
 * @returns Validated email configuration
 *
 * @example
 * ```typescript
 * const config = parseEmailConfig();
 * console.log(config.EMAIL_HOST); // "smtp.gmail.com"
 * ```
 */
export function parseEmailConfig(): EmailConfig {
  return validateEnv(emailSchema, 'Email');
}
```

### Step 4: Create Parser Function

Already included in the schema file above (`parseEmailConfig`).

### Step 5: Create Client Functions

Create `packages/config/src/sections/email.client.ts`:

```typescript
import type { EmailConfig } from './email.schema.js';
import { parseEmailConfig } from './email.schema.js';

/**
 * Cached email configuration
 *
 * Configuration is parsed once and cached for performance
 */
let cachedConfig: EmailConfig | null = null;

/**
 * Get email configuration
 *
 * Returns cached configuration if available, otherwise parses and caches
 *
 * @returns Email configuration object
 *
 * @example
 * ```typescript
 * const config = emailConfig();
 * console.log(config.EMAIL_HOST);
 * console.log(config.EMAIL_PORT);
 * ```
 */
export function emailConfig(): EmailConfig {
  if (!cachedConfig) {
    cachedConfig = parseEmailConfig();
  }
  return cachedConfig;
}

/**
 * Check if email sending is enabled
 *
 * Convenience function to check the EMAIL_ENABLED flag
 *
 * @returns True if email sending is enabled
 *
 * @example
 * ```typescript
 * if (isEmailEnabled()) {
 *   await sendEmail({ to, subject, body });
 * }
 * ```
 */
export function isEmailEnabled(): boolean {
  return emailConfig().EMAIL_ENABLED;
}

/**
 * Get SMTP connection configuration
 *
 * Returns configuration object suitable for nodemailer or similar
 *
 * @returns SMTP configuration
 *
 * @example
 * ```typescript
 * const smtpConfig = getSmtpConfig();
 * const transporter = nodemailer.createTransport(smtpConfig);
 * ```
 */
export function getSmtpConfig(): {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
} {
  const config = emailConfig();
  return {
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: config.EMAIL_SECURE,
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS,
    },
  };
}

/**
 * Get default "from" address
 *
 * Returns formatted "from" address with name
 *
 * @returns Formatted from address
 *
 * @example
 * ```typescript
 * const from = getFromAddress();
 * // "Hospeda <noreply@hospeda.com>"
 * ```
 */
export function getFromAddress(): string {
  const config = emailConfig();
  return `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>`;
}
```

### Step 6: Export from Index

Update `packages/config/src/index.ts`:

```typescript
// Existing exports
export * from './env.js';
export * from './client.js';
export * from './utils.js';

// Configuration sections
export * from './sections/main.schema.js';
export * from './sections/main.client.js';
export * from './sections/db.schema.js';
export * from './sections/logger.schema.js';
export * from './sections/logger.client.js';

// NEW: Email configuration
export * from './sections/email.schema.js';
export * from './sections/email.client.js';
```

### Step 7: Update `.env.example`

Add to project root `.env.example`:

```bash
#===============================================================================
# Email Configuration
#===============================================================================

# SMTP server hostname
# Common providers:
#   - Gmail: smtp.gmail.com
#   - SendGrid: smtp.sendgrid.net
#   - AWS SES: email-smtp.us-east-1.amazonaws.com
EMAIL_HOST=smtp.gmail.com

# SMTP server port
# Common ports:
#   - 587: STARTTLS (recommended)
#   - 465: SSL
#   - 25: Unencrypted (not recommended)
EMAIL_PORT=587

# SMTP authentication username (usually an email address)
EMAIL_USER=noreply@hospeda.com

# SMTP authentication password
# For Gmail, use an app-specific password:
# https://support.google.com/accounts/answer/185833
EMAIL_PASS=your-app-password-here

# Default "from" email address
EMAIL_FROM=noreply@hospeda.com

# Default "from" name (display name)
EMAIL_FROM_NAME=Hospeda

# Enable email sending
# Set to false in development to prevent sending real emails
EMAIL_ENABLED=false

# Use TLS/SSL for secure connection
EMAIL_SECURE=true
```

### Step 8: Document in env-vars.md

Add to `packages/config/docs/api/env-vars.md`:

```markdown
## Email Configuration

SMTP configuration for sending emails.

### `EMAIL_HOST`

SMTP server hostname.

| Property | Value |
|----------|-------|
| **Type** | `string` |
| **Required** | No |
| **Default** | `smtp.gmail.com` |
| **Used In** | `apps/api` |

**Example:**

\```bash
EMAIL_HOST=smtp.gmail.com
\```

### `EMAIL_PORT`

SMTP server port.

| Property | Value |
|----------|-------|
| **Type** | `number` (port) |
| **Required** | No |
| **Default** | `587` |
| **Valid Range** | 1-65535 |
| **Used In** | `apps/api` |

**Example:**

\```bash
EMAIL_PORT=587
\```

<!-- Add other variables similarly -->
```

### Step 9: Test Configuration

Create `packages/config/test/sections/email.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseEmailConfig,
  type EmailConfig,
} from '../../src/sections/email.schema.js';
import {
  emailConfig,
  isEmailEnabled,
  getSmtpConfig,
  getFromAddress,
} from '../../src/sections/email.client.js';

describe('Email Configuration', () => {
  beforeEach(() => {
    // Set up valid test environment
    vi.stubEnv('EMAIL_HOST', 'smtp.test.com');
    vi.stubEnv('EMAIL_PORT', '587');
    vi.stubEnv('EMAIL_USER', 'test@test.com');
    vi.stubEnv('EMAIL_PASS', 'test-password');
    vi.stubEnv('EMAIL_FROM', 'noreply@test.com');
    vi.stubEnv('EMAIL_FROM_NAME', 'Test App');
    vi.stubEnv('EMAIL_ENABLED', 'true');
    vi.stubEnv('EMAIL_SECURE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('parseEmailConfig', () => {
    it('should parse valid email configuration', () => {
      const config = parseEmailConfig();

      expect(config.EMAIL_HOST).toBe('smtp.test.com');
      expect(config.EMAIL_PORT).toBe(587);
      expect(config.EMAIL_USER).toBe('test@test.com');
      expect(config.EMAIL_PASS).toBe('test-password');
      expect(config.EMAIL_FROM).toBe('noreply@test.com');
      expect(config.EMAIL_FROM_NAME).toBe('Test App');
      expect(config.EMAIL_ENABLED).toBe(true);
      expect(config.EMAIL_SECURE).toBe(true);
    });

    it('should use default values when not set', () => {
      // Remove optional variables
      vi.unstubAllEnvs();
      vi.stubEnv('EMAIL_USER', 'test@test.com');
      vi.stubEnv('EMAIL_PASS', 'password');
      vi.stubEnv('EMAIL_FROM', 'noreply@test.com');

      const config = parseEmailConfig();

      expect(config.EMAIL_HOST).toBe('smtp.gmail.com');
      expect(config.EMAIL_PORT).toBe(587);
      expect(config.EMAIL_FROM_NAME).toBe('Hospeda');
      expect(config.EMAIL_ENABLED).toBe(false);
      expect(config.EMAIL_SECURE).toBe(true);
    });

    it('should validate email format for EMAIL_USER', () => {
      vi.stubEnv('EMAIL_USER', 'invalid-email');

      expect(() => parseEmailConfig()).toThrow();
    });

    it('should validate email format for EMAIL_FROM', () => {
      vi.stubEnv('EMAIL_FROM', 'invalid-email');

      expect(() => parseEmailConfig()).toThrow();
    });

    it('should validate port range', () => {
      vi.stubEnv('EMAIL_PORT', '99999');

      expect(() => parseEmailConfig()).toThrow();
    });
  });

  describe('emailConfig', () => {
    it('should return cached configuration', () => {
      const config1 = emailConfig();
      const config2 = emailConfig();

      expect(config1).toBe(config2); // Same reference
    });
  });

  describe('isEmailEnabled', () => {
    it('should return true when enabled', () => {
      vi.stubEnv('EMAIL_ENABLED', 'true');

      expect(isEmailEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      vi.stubEnv('EMAIL_ENABLED', 'false');

      expect(isEmailEnabled()).toBe(false);
    });

    it('should return false by default', () => {
      vi.unstubAllEnvs();
      vi.stubEnv('EMAIL_USER', 'test@test.com');
      vi.stubEnv('EMAIL_PASS', 'password');
      vi.stubEnv('EMAIL_FROM', 'noreply@test.com');

      expect(isEmailEnabled()).toBe(false);
    });
  });

  describe('getSmtpConfig', () => {
    it('should return SMTP configuration object', () => {
      const smtpConfig = getSmtpConfig();

      expect(smtpConfig).toEqual({
        host: 'smtp.test.com',
        port: 587,
        secure: true,
        auth: {
          user: 'test@test.com',
          pass: 'test-password',
        },
      });
    });
  });

  describe('getFromAddress', () => {
    it('should return formatted from address', () => {
      const from = getFromAddress();

      expect(from).toBe('Test App <noreply@test.com>');
    });
  });
});
```

Run tests:

```bash
cd packages/config
pnpm test email
```

### Step 10: Use in Application

Create email service `apps/api/src/services/email.service.ts`:

```typescript
import {
  emailConfig,
  isEmailEnabled,
  getSmtpConfig,
  getFromAddress,
} from '@repo/config';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email service for sending transactional emails
 */
export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    if (isEmailEnabled()) {
      this.initializeTransporter();
    }
  }

  /**
   * Initialize nodemailer transporter with SMTP configuration
   */
  private initializeTransporter(): void {
    const smtpConfig = getSmtpConfig();

    this.transporter = nodemailer.createTransport(smtpConfig);
  }

  /**
   * Send an email
   *
   * @param params - Email parameters
   * @throws {Error} If email sending fails
   */
  async sendEmail(params: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (!isEmailEnabled()) {
      console.log('Email disabled, skipping:', params.subject);
      return;
    }

    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    const from = getFromAddress();

    await this.transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(params: {
    to: string;
    name: string;
  }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: 'Welcome to Hospeda!',
      html: `
        <h1>Welcome ${params.name}!</h1>
        <p>Thanks for joining Hospeda.</p>
      `,
      text: `Welcome ${params.name}! Thanks for joining Hospeda.`,
    });
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(params: {
    to: string;
    bookingId: string;
    accommodationName: string;
    checkIn: Date;
    checkOut: Date;
  }): Promise<void> {
    await this.sendEmail({
      to: params.to,
      subject: `Booking Confirmation - ${params.bookingId}`,
      html: `
        <h1>Booking Confirmed!</h1>
        <p>Your booking at ${params.accommodationName} has been confirmed.</p>
        <ul>
          <li>Booking ID: ${params.bookingId}</li>
          <li>Check-in: ${params.checkIn.toLocaleDateString()}</li>
          <li>Check-out: ${params.checkOut.toLocaleDateString()}</li>
        </ul>
      `,
    });
  }
}
```

Use in API route:

```typescript
// apps/api/src/routes/bookings.route.ts
import { Hono } from 'hono';
import { EmailService } from '../services/email.service.js';

const app = new Hono();
const emailService = new EmailService();

app.post('/bookings', async (c) => {
  // Create booking
  const booking = await createBooking(/* ... */);

  // Send confirmation email
  await emailService.sendBookingConfirmation({
    to: booking.userEmail,
    bookingId: booking.id,
    accommodationName: booking.accommodation.name,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
  });

  return c.json({ success: true, data: booking });
});

export { app as bookingsRouter };
```

## Adding to Existing Section

If adding to an existing section (e.g., `main`):

### 1. Update Schema

```typescript
// packages/config/src/sections/main.schema.ts
export const mainSchema = z.object({
  // Existing fields
  VITE_API_PORT: commonEnvSchemas.port(3000),
  VITE_API_HOST: commonEnvSchemas.string('http://localhost'),

  // NEW field
  API_TIMEOUT: commonEnvSchemas.number(30000),
});
```

### 2. Update Client (if needed)

```typescript
// packages/config/src/sections/main.client.ts
export function getApiTimeout(): number {
  return mainConfig().API_TIMEOUT;
}
```

### 3. Update Documentation

- Add to `.env.example`
- Add to `env-vars.md`
- Update tests

## Best Practices

### 1. Always Provide Defaults

```typescript
// ✅ GOOD: Default value
EMAIL_HOST: commonEnvSchemas.string('smtp.gmail.com'),

// ❌ BAD: No default (breaks if not set)
EMAIL_HOST: z.string(),
```

### 2. Use Common Schemas

```typescript
// ✅ GOOD: Reusable schema
EMAIL_PORT: commonEnvSchemas.port(587),

// ❌ BAD: Custom validation
EMAIL_PORT: z.coerce.number().int().min(1).max(65535).default(587),
```

### 3. Document Each Field

```typescript
/**
 * SMTP server hostname
 *
 * @example "smtp.gmail.com"
 */
EMAIL_HOST: commonEnvSchemas.string('smtp.gmail.com'),
```

### 4. Group Related Configuration

```typescript
// ✅ GOOD: Grouped in section
const emailSchema = z.object({
  EMAIL_HOST: z.string(),
  EMAIL_PORT: commonEnvSchemas.port(),
  EMAIL_USER: z.string(),
  EMAIL_PASS: z.string(),
});

// ❌ BAD: Scattered across sections
```

### 5. Test Thoroughly

- Valid configuration
- Default values
- Validation errors
- Edge cases

## Troubleshooting

### Validation Fails

**Problem**: Schema validation fails.

**Solution**: Check environment variables match schema requirements.

### Type Errors

**Problem**: TypeScript errors when using configuration.

**Solution**: Ensure type is exported and inferred from schema.

### Caching Issues

**Problem**: Configuration not updating.

**Solution**: Clear cache or restart application.

## Related Documentation

- **[Quick Start](../quick-start.md)** - Basic usage
- **[API Reference](../api/config-reference.md)** - Complete API
- **[Validation Guide](./validation.md)** - Validation patterns
- **[Examples](../examples/)** - More examples
