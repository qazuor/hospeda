/**
 * Complete Example: Adding New Environment Variable
 *
 * This example demonstrates the complete workflow for adding
 * email configuration to the @repo/config package.
 *
 * Steps:
 * 1. Define Zod schema
 * 2. Create parser function
 * 3. Create client (parse on module load)
 * 4. Export from package
 * 5. Use in application/service
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// STEP 1: Define Email Schema (src/sections/email.schema.ts)
// ============================================================================

/**
 * Email Configuration Schema
 *
 * Validates email server and sender configuration.
 *
 * Required environment variables:
 * - EMAIL_HOST: SMTP server host
 * - EMAIL_PORT: SMTP server port (1-65535)
 * - EMAIL_USER: SMTP username/email
 * - EMAIL_PASS: SMTP password
 * - EMAIL_FROM: Default sender email address
 *
 * Optional environment variables:
 * - EMAIL_SECURE: Use TLS/SSL (default: true)
 */
export const EmailSchema = z.object({
  /**
   * SMTP server hostname
   *
   * @example 'smtp.gmail.com'
   * @example 'smtp.sendgrid.net'
   */
  EMAIL_HOST: z.string().min(1, 'EMAIL_HOST is required'),

  /**
   * SMTP server port
   *
   * Common ports:
   * - 587: TLS (recommended)
   * - 465: SSL
   * - 25: Plain (not recommended)
   */
  EMAIL_PORT: z.coerce
    .number()
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be at most 65535')
    .int('Port must be an integer'),

  /**
   * SMTP username (usually email address)
   *
   * @example 'noreply@hospeda.com'
   * @example 'apikey' (for SendGrid)
   */
  EMAIL_USER: z.string().email('EMAIL_USER must be valid email'),

  /**
   * SMTP password or API key
   *
   * Note: This is a sensitive value - never log or expose
   */
  EMAIL_PASS: z.string().min(1, 'EMAIL_PASS is required'),

  /**
   * Default sender email address
   *
   * Used as "from" address for all emails unless overridden
   *
   * @example 'noreply@hospeda.com'
   */
  EMAIL_FROM: z.string().email('EMAIL_FROM must be valid email'),

  /**
   * Use secure connection (TLS/SSL)
   *
   * @default true
   */
  EMAIL_SECURE: z.coerce.boolean().default(true),
});

/**
 * Inferred TypeScript type from EmailSchema
 *
 * Use this type for type-safe access to email configuration.
 *
 * @example
 * ```typescript
 * function sendEmail(config: EmailConfig) {
 *   // config.EMAIL_PORT is typed as number
 *   // config.EMAIL_SECURE is typed as boolean
 * }
 * ```
 */
export type EmailConfig = z.infer<typeof EmailSchema>;

// ============================================================================
// STEP 2: Create Parser Function
// ============================================================================

/**
 * Parse and validate email configuration from environment variables
 *
 * This function reads email configuration from process.env,
 * validates it against EmailSchema, and returns a type-safe
 * configuration object.
 *
 * @param env - Environment variables object (usually process.env)
 * @returns Validated email configuration
 * @throws {ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const config = parseEmailSchema(process.env);
 * console.log(config.EMAIL_PORT); // Type: number
 * ```
 */
export function parseEmailSchema(env: NodeJS.ProcessEnv): EmailConfig {
  return EmailSchema.parse({
    EMAIL_HOST: env.EMAIL_HOST,
    EMAIL_PORT: env.EMAIL_PORT,
    EMAIL_USER: env.EMAIL_USER,
    EMAIL_PASS: env.EMAIL_PASS,
    EMAIL_FROM: env.EMAIL_FROM,
    EMAIL_SECURE: env.EMAIL_SECURE,
  });
}

// ============================================================================
// STEP 3: Create Client (src/sections/email.client.ts)
// ============================================================================

/**
 * Email configuration client
 *
 * This is the parsed and validated email configuration,
 * ready to use throughout the application.
 *
 * Validation happens when this module is imported.
 * If validation fails, the application will not start.
 *
 * @example
 * ```typescript
 * import { emailConfig } from '@repo/config';
 *
 * console.log(emailConfig.EMAIL_HOST); // Validated and type-safe
 * ```
 */
export const emailConfig = parseEmailSchema(process.env);

// ============================================================================
// STEP 4: Export from Package (src/index.ts)
// ============================================================================

/*
// Add to src/index.ts:

export { emailConfig } from './sections/email.client.js';
export { EmailSchema, parseEmailSchema } from './sections/email.schema.js';
export type { EmailConfig } from './sections/email.schema.js';
*/

// ============================================================================
// STEP 5: Use in Application/Service
// ============================================================================

/**
 * Example: Email Service using email configuration
 *
 * This service demonstrates how to use the validated
 * email configuration in a real application.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email sending input
 */
interface SendEmailInput {
  /** Recipient email address */
  to: string;
  /** Email subject */
  subject: string;
  /** HTML email body */
  html: string;
  /** Plain text email body (optional) */
  text?: string;
}

/**
 * Email Service
 *
 * Handles sending emails using configured SMTP server.
 *
 * @example
 * ```typescript
 * const emailService = new EmailService();
 *
 * await emailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome to Hospeda',
 *   html: '<h1>Welcome!</h1>',
 * });
 * ```
 */
export class EmailService {
  private transporter: Transporter;

  constructor() {
    // Use validated configuration from @repo/config
    this.transporter = nodemailer.createTransport({
      host: emailConfig.EMAIL_HOST,
      port: emailConfig.EMAIL_PORT,
      secure: emailConfig.EMAIL_SECURE,
      auth: {
        user: emailConfig.EMAIL_USER,
        pass: emailConfig.EMAIL_PASS,
      },
    });
  }

  /**
   * Send an email
   *
   * @param input - Email details
   * @returns Promise that resolves when email is sent
   *
   * @example
   * ```typescript
   * await emailService.sendEmail({
   *   to: 'user@example.com',
   *   subject: 'Booking Confirmation',
   *   html: '<p>Your booking is confirmed</p>',
   * });
   * ```
   */
  async sendEmail(input: SendEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: emailConfig.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }

  /**
   * Send booking confirmation email
   *
   * @param input - Booking details
   */
  async sendBookingConfirmation(input: {
    to: string;
    bookingId: string;
    accommodationName: string;
    checkIn: string;
    checkOut: string;
  }): Promise<void> {
    await this.sendEmail({
      to: input.to,
      subject: 'Booking Confirmation - Hospeda',
      html: `
        <h1>Booking Confirmed!</h1>
        <p>Your booking has been confirmed.</p>
        <ul>
          <li><strong>Booking ID:</strong> ${input.bookingId}</li>
          <li><strong>Accommodation:</strong> ${input.accommodationName}</li>
          <li><strong>Check-in:</strong> ${input.checkIn}</li>
          <li><strong>Check-out:</strong> ${input.checkOut}</li>
        </ul>
      `,
    });
  }

  /**
   * Verify SMTP connection
   *
   * @returns Promise that resolves if connection is successful
   * @throws Error if connection fails
   */
  async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }
}

// ============================================================================
// STEP 6: Add Environment Variables
// ============================================================================

/*
// Add to .env.example:

# Email Configuration (NodeMailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@hospeda.com
EMAIL_PASS=your-password-here
EMAIL_FROM=noreply@hospeda.com
EMAIL_SECURE=true
*/

/*
// Add to .env.local (development):

EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your-mailtrap-user
EMAIL_PASS=your-mailtrap-pass
EMAIL_FROM=dev@hospeda.com
EMAIL_SECURE=false
*/

/*
// Add to Vercel environment variables (production):

EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.xxx (SendGrid API Key)
EMAIL_FROM=noreply@hospeda.com
EMAIL_SECURE=true
*/

// ============================================================================
// STEP 7: Document in API Reference
// ============================================================================

/*
// Add to docs/api/env-vars.md:

### Email Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| EMAIL_HOST | string | Yes | - | SMTP server hostname |
| EMAIL_PORT | number | Yes | - | SMTP server port (1-65535) |
| EMAIL_USER | string | Yes | - | SMTP username (email format) |
| EMAIL_PASS | string | Yes | - | SMTP password or API key |
| EMAIL_FROM | string | Yes | - | Default sender email address |
| EMAIL_SECURE | boolean | No | true | Use TLS/SSL connection |

**Example:**

```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=SG.xxxxxxxxxxxxx
EMAIL_FROM=noreply@hospeda.com
EMAIL_SECURE=true
```
*/

// ============================================================================
// STEP 8: Write Tests
// ============================================================================

/*
// Create test/sections/email.schema.test.ts:

import { describe, it, expect, vi } from 'vitest';
import { parseEmailSchema, EmailSchema } from '../../src/sections/email.schema.js';
import { ZodError } from 'zod';

describe('EmailSchema', () => {
  describe('Valid Configuration', () => {
    it('should parse valid email configuration', () => {
      vi.stubEnv('EMAIL_HOST', 'smtp.gmail.com');
      vi.stubEnv('EMAIL_PORT', '587');
      vi.stubEnv('EMAIL_USER', 'test@example.com');
      vi.stubEnv('EMAIL_PASS', 'password123');
      vi.stubEnv('EMAIL_FROM', 'noreply@example.com');

      const config = parseEmailSchema(process.env);

      expect(config.EMAIL_HOST).toBe('smtp.gmail.com');
      expect(config.EMAIL_PORT).toBe(587);
      expect(config.EMAIL_SECURE).toBe(true); // Default
    });

    it('should use default for EMAIL_SECURE', () => {
      vi.stubEnv('EMAIL_HOST', 'smtp.example.com');
      vi.stubEnv('EMAIL_PORT', '25');
      vi.stubEnv('EMAIL_USER', 'test@example.com');
      vi.stubEnv('EMAIL_PASS', 'password');
      vi.stubEnv('EMAIL_FROM', 'test@example.com');

      const config = parseEmailSchema(process.env);

      expect(config.EMAIL_SECURE).toBe(true);
    });
  });

  describe('Invalid Configuration', () => {
    it('should fail on missing EMAIL_HOST', () => {
      vi.stubEnv('EMAIL_PORT', '587');
      vi.stubEnv('EMAIL_USER', 'test@example.com');
      vi.stubEnv('EMAIL_PASS', 'password');
      vi.stubEnv('EMAIL_FROM', 'test@example.com');

      expect(() => parseEmailSchema(process.env)).toThrow(ZodError);
    });

    it('should fail on invalid EMAIL_USER (not email)', () => {
      vi.stubEnv('EMAIL_HOST', 'smtp.example.com');
      vi.stubEnv('EMAIL_PORT', '587');
      vi.stubEnv('EMAIL_USER', 'not-an-email');
      vi.stubEnv('EMAIL_PASS', 'password');
      vi.stubEnv('EMAIL_FROM', 'test@example.com');

      expect(() => parseEmailSchema(process.env)).toThrow(/must be valid email/);
    });

    it('should fail on invalid port (too high)', () => {
      vi.stubEnv('EMAIL_HOST', 'smtp.example.com');
      vi.stubEnv('EMAIL_PORT', '99999');
      vi.stubEnv('EMAIL_USER', 'test@example.com');
      vi.stubEnv('EMAIL_PASS', 'password');
      vi.stubEnv('EMAIL_FROM', 'test@example.com');

      expect(() => parseEmailSchema(process.env)).toThrow(/Port must be at most 65535/);
    });
  });
});
*/

// ============================================================================
// SUMMARY
// ============================================================================

/*
Complete Workflow Summary:

1. ✅ Define Zod schema (src/sections/email.schema.ts)
2. ✅ Create parser function (parseEmailSchema)
3. ✅ Create client (src/sections/email.client.ts)
4. ✅ Export from package (src/index.ts)
5. ✅ Use in service (EmailService)
6. ✅ Add environment variables (.env.example, .env.local, Vercel)
7. ✅ Document in API reference (docs/api/env-vars.md)
8. ✅ Write comprehensive tests (test/sections/email.schema.test.ts)

This pattern ensures:
- Type safety (TypeScript + Zod)
- Startup validation (fails fast)
- Clear documentation
- Comprehensive testing
- Secure secret management
*/
