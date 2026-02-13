# CLAUDE.md - Email Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Email package (`@repo/email`).

## Overview

Centralized email service for the Hospeda platform using Resend and React Email. Provides type-safe email sending and pre-built templates for authentication, notifications, and billing emails.

## Key Commands

```bash
# Development
pnpm dev               # No build needed (uses tsconfig paths)
pnpm build             # Build for production with tsup

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
pnpm check             # Biome check + fix
```

## Architecture

```
packages/email/
├── src/
│   ├── client.ts              # Resend client singleton
│   ├── send.ts                # Email sending function
│   ├── templates/
│   │   ├── base-layout.tsx    # Base email layout with branding
│   │   ├── verify-email.tsx   # Email verification template
│   │   └── reset-password.tsx # Password reset template
│   └── index.ts               # Public API exports
├── test/
│   └── send.test.ts           # Unit tests for email sending
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
└── CLAUDE.md
```

## Usage Examples

### Basic Email Sending

```typescript
import { sendEmail, VerifyEmailTemplate } from '@repo/email';

const result = await sendEmail({
  to: 'user@example.com',
  subject: 'Verifica tu correo electrónico',
  react: VerifyEmailTemplate({
    name: 'Juan Pérez',
    verificationUrl: 'https://hospeda.com.ar/verify?token=abc123'
  })
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Failed to send:', result.error);
}
```

### In Authentication Flow

```typescript
import { sendEmail, VerifyEmailTemplate } from '@repo/email';
import { generateVerificationToken } from '@repo/auth';

async function sendVerificationEmail(userId: string, email: string, name: string) {
  const token = await generateVerificationToken(userId);
  const verificationUrl = `${process.env.HOSPEDA_SITE_URL}/verify?token=${token}`;

  const result = await sendEmail({
    to: email,
    subject: 'Verifica tu cuenta de Hospeda',
    react: VerifyEmailTemplate({ name, verificationUrl })
  });

  return result.success;
}
```

### In Password Reset Flow

```typescript
import { sendEmail, ResetPasswordTemplate } from '@repo/email';
import { generatePasswordResetToken } from '@repo/auth';

async function sendPasswordResetEmail(userId: string, email: string, name: string) {
  const token = await generatePasswordResetToken(userId);
  const resetUrl = `${process.env.HOSPEDA_SITE_URL}/reset-password?token=${token}`;

  const result = await sendEmail({
    to: email,
    subject: 'Restablece tu contraseña de Hospeda',
    react: ResetPasswordTemplate({ name, resetUrl })
  });

  return result.success;
}
```

## Available Templates

### VerifyEmailTemplate

Email verification for new signups or email changes.

**Props:**

- `name` (string): User's display name
- `verificationUrl` (string): Verification link with unique token

**Expiry:** 24 hours

**Use cases:**

- New user registration
- Email address changes
- Re-verification requests

### ResetPasswordTemplate

Password reset request emails.

**Props:**

- `name` (string): User's display name
- `resetUrl` (string): Password reset link with unique token

**Expiry:** 1 hour

**Use cases:**

- Forgotten password
- Security-triggered password reset
- Account recovery

### BaseLayout

Base email layout with Hospeda branding.

**Props:**

- `children` (ReactNode): Email body content
- `showUnsubscribe` (boolean, optional): Show unsubscribe text (default: true)

**Features:**

- Consistent header with Hospeda logo
- Centered container (600px max-width)
- Branded footer with unsubscribe option
- Mobile-responsive styles

## Creating Custom Templates

All new templates should extend `BaseLayout`:

```typescript
import { BaseLayout } from './base-layout.js';
import { Button, Heading, Text } from '@react-email/components';

export interface WelcomeTemplateProps {
  readonly name: string;
  readonly ctaUrl: string;
}

/**
 * Welcome email template for new users.
 *
 * @param props - Template configuration
 * @returns Rendered email template
 *
 * @example
 * ```tsx
 * import { sendEmail, WelcomeTemplate } from '@repo/email';
 *
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Bienvenido a Hospeda',
 *   react: WelcomeTemplate({
 *     name: 'Juan Pérez',
 *     ctaUrl: 'https://hospeda.com.ar/dashboard'
 *   })
 * });
 * ```
 */
export function WelcomeTemplate({ name, ctaUrl }: WelcomeTemplateProps) {
  return (
    <BaseLayout>
      <Heading style={h1}>¡Bienvenido a Hospeda!</Heading>
      <Text style={text}>Hola {name},</Text>
      <Text style={text}>
        Gracias por unirte a Hospeda. Estamos emocionados de tenerte con nosotros.
      </Text>
      <Button href={ctaUrl} style={button}>
        Ir al Dashboard
      </Button>
    </BaseLayout>
  );
}

// Styles
const h1 = {
  color: '#1a202c',
  fontSize: '24px',
  fontWeight: 'bold',
  lineHeight: '32px',
  margin: '0 0 24px',
};

const text = {
  color: '#2d3748',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const button = {
  backgroundColor: '#3182ce',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'block',
  fontSize: '16px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  textDecoration: 'none',
  padding: '12px 24px',
  margin: '24px 0',
};
```

## Configuration

### Environment Variables

```env
# Required: Resend API key
HOSPEDA_RESEND_API_KEY=re_your_api_key_here
```

Get your API key from [Resend Dashboard](https://resend.com/api-keys).

### Default Sender

The default sender address is `Hospeda <noreply@hospeda.com.ar>`. Override with the `from` parameter:

```typescript
await sendEmail({
  from: 'Support <support@hospeda.com.ar>',
  to: 'user@example.com',
  subject: 'Support Request',
  react: SupportTemplate({ ... })
});
```

## Testing

### Unit Tests

Test email sending with mocked Resend client:

```typescript
import { vi } from 'vitest';
import { resetResendClient, sendEmail } from '@repo/email';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: 'msg_123456' },
        error: null
      })
    }
  }))
}));

describe('sendEmail', () => {
  beforeEach(() => {
    process.env.HOSPEDA_RESEND_API_KEY = 'test-key';
  });

  afterEach(() => {
    resetResendClient();
    vi.clearAllMocks();
  });

  it('should send email successfully', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      react: TestTemplate({ ... })
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg_123456');
  });
});
```

### Template Preview

Use React Email CLI to preview templates locally:

```bash
# Install React Email CLI (optional)
npm install -g react-email

# Preview templates
react-email dev packages/email/src/templates
```

## Best Practices

### 1. Always Use BaseLayout

All templates should use `BaseLayout` for consistent branding:

```typescript
// GOOD
export function MyTemplate() {
  return (
    <BaseLayout>
      <Text>Content</Text>
    </BaseLayout>
  );
}

// BAD - No consistent branding
export function MyTemplate() {
  return (
    <Html>
      <Body>
        <Text>Content</Text>
      </Body>
    </Html>
  );
}
```

### 2. Use Spanish for User-Facing Text

All email content should be in Spanish (Argentina market):

```typescript
// GOOD
<Text>Hola {name}, gracias por registrarte.</Text>

// BAD
<Text>Hello {name}, thanks for signing up.</Text>
```

### 3. Handle Errors Gracefully

Email sending is non-blocking and logs errors:

```typescript
// GOOD - Check result but don't throw
const result = await sendEmail({ ... });
if (!result.success) {
  logger.warn('Failed to send welcome email', { error: result.error });
  // Continue with flow, email is not critical
}

// BAD - Don't throw on email failure
const result = await sendEmail({ ... });
if (!result.success) {
  throw new Error('Email failed'); // Blocks user flow
}
```

### 4. Include Security Notes

For sensitive operations (password reset, email verification), include expiry and security notes:

```typescript
<Text style={notice}>
  Este enlace expira en 1 hora por motivos de seguridad.
</Text>

<Text style={securityNotice}>
  Si no solicitaste esto, ignora este correo de forma segura.
</Text>
```

### 5. Mobile-Responsive Design

Use inline styles and limit container width:

```typescript
const container = {
  maxWidth: '600px',
  margin: '0 auto',
  padding: '20px',
};

const text = {
  fontSize: '16px',
  lineHeight: '24px',
};
```

## Common Use Cases

### Authentication Emails

```typescript
// Email verification
sendEmail({
  to: user.email,
  subject: 'Verifica tu cuenta',
  react: VerifyEmailTemplate({ name: user.name, verificationUrl })
});

// Password reset
sendEmail({
  to: user.email,
  subject: 'Restablece tu contraseña',
  react: ResetPasswordTemplate({ name: user.name, resetUrl })
});
```

### Notification Emails

```typescript
// Booking confirmation
sendEmail({
  to: user.email,
  subject: 'Reserva confirmada',
  react: BookingConfirmationTemplate({ booking, accommodation })
});

// Payment receipt
sendEmail({
  to: user.email,
  subject: 'Recibo de pago',
  react: PaymentReceiptTemplate({ payment, invoice })
});
```

### Transactional Emails

```typescript
// Account updates
sendEmail({
  to: user.email,
  subject: 'Tu cuenta ha sido actualizada',
  react: AccountUpdateTemplate({ changes })
});

// Plan upgrade
sendEmail({
  to: user.email,
  subject: 'Plan mejorado exitosamente',
  react: PlanUpgradeTemplate({ oldPlan, newPlan })
});
```

## API Reference

### `sendEmail(input: SendEmailInput): Promise<SendEmailResult>`

Send an email using Resend.

**Parameters:**

- `input.to` - Recipient email(s)
- `input.subject` - Email subject
- `input.react` - React Email component
- `input.from` - Sender address (optional)
- `input.replyTo` - Reply-to address (optional)

**Returns:**

- `success` - Whether email was sent
- `messageId` - Unique message ID (on success)
- `error` - Error message (on failure)

### `getResendClient(): Resend`

Get the singleton Resend client instance.

**Throws:** Error if `HOSPEDA_RESEND_API_KEY` is not set

### `resetResendClient(): void`

Reset the Resend client (useful for testing).

## Troubleshooting

### Email Not Sending

1. Check API key is set: `echo $HOSPEDA_RESEND_API_KEY`
2. Verify domain is configured in Resend dashboard
3. Check Resend dashboard for delivery status
4. Review console logs for error messages

### Template Not Rendering

1. Ensure all React Email components are imported
2. Check for TypeScript errors in template
3. Preview template with React Email CLI
4. Verify props are passed correctly

### Styling Issues

1. Use inline styles (email clients don't support external CSS)
2. Limit container width to 600px for mobile
3. Test in multiple email clients (Gmail, Outlook, etc.)
4. Use React Email preview for quick iteration

## Dependencies

- **resend**: Email delivery service (^4.0.0)
- **@react-email/components**: React components for emails (^0.0.30)
- **react**: Peer dependency for React Email (>=18.2.0 || ^19)

## Notes

- All templates use Spanish text (Argentina market)
- Default sender: `Hospeda <noreply@hospeda.com.ar>`
- Email sending is non-blocking (logs errors, doesn't throw)
- Maximum email width: 600px (mobile-responsive)
- Templates include Hospeda branding and footer
- Sensitive operations include expiry and security notes

## Future Enhancements

Potential additions:

- Booking confirmation template
- Payment receipt template
- Review request template
- Promotional email template
- Newsletter template
- Account deletion confirmation
- Email preference management
- A/B testing support
- Analytics integration
- Multi-language support (English)
