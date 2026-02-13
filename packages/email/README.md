# @repo/email

Centralized email service for the Hospeda platform using [Resend](https://resend.com) and [React Email](https://react.email).

## Features

- **Resend Integration**: Production-ready email delivery
- **React Email Templates**: Type-safe, component-based email templates
- **TypeScript Strict Mode**: Full type safety with zero `any` types
- **Non-blocking**: Errors are logged but not thrown
- **Template Library**: Pre-built templates for common use cases

## Installation

This package is part of the Hospeda monorepo and uses pnpm workspaces.

```bash
pnpm install
```

## Configuration

Set the Resend API key in your environment:

```bash
HOSPEDA_RESEND_API_KEY=re_your_api_key_here
```

Get your API key from [Resend Dashboard](https://resend.com/api-keys).

## Usage

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
  console.error('Failed to send email:', result.error);
}
```

### Multiple Recipients

```typescript
await sendEmail({
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Welcome to Hospeda',
  react: WelcomeTemplate({ name: 'Team' })
});
```

### Custom Sender and Reply-To

```typescript
await sendEmail({
  to: 'user@example.com',
  subject: 'Important notification',
  from: 'Support Team <support@hospeda.com.ar>',
  replyTo: 'help@hospeda.com.ar',
  react: NotificationTemplate({ ... })
});
```

## Available Templates

### VerifyEmailTemplate

Email verification for new signups or email changes.

```typescript
import { VerifyEmailTemplate } from '@repo/email';

VerifyEmailTemplate({
  name: 'Juan Pérez',
  verificationUrl: 'https://hospeda.com.ar/verify?token=abc123'
})
```

**Props:**

- `name` (string): User's display name
- `verificationUrl` (string): Verification link with token

**Expiry:** 24 hours

### ResetPasswordTemplate

Password reset request emails.

```typescript
import { ResetPasswordTemplate } from '@repo/email';

ResetPasswordTemplate({
  name: 'Juan Pérez',
  resetUrl: 'https://hospeda.com.ar/reset-password?token=xyz789'
})
```

**Props:**

- `name` (string): User's display name
- `resetUrl` (string): Password reset link with token

**Expiry:** 1 hour

### BaseLayout

Base layout component for creating custom email templates.

```typescript
import { BaseLayout } from '@repo/email';

function CustomTemplate() {
  return (
    <BaseLayout showUnsubscribe={false}>
      <Heading>Custom Email</Heading>
      <Text>Your content here</Text>
    </BaseLayout>
  );
}
```

**Props:**

- `children` (ReactNode): Email body content
- `showUnsubscribe` (boolean, optional): Show unsubscribe text in footer (default: true)

## Creating Custom Templates

All templates should use `BaseLayout` for consistent branding:

```typescript
import { BaseLayout } from '@repo/email';
import { Button, Heading, Text } from '@react-email/components';

export interface WelcomeTemplateProps {
  readonly name: string;
  readonly ctaUrl: string;
}

export function WelcomeTemplate({ name, ctaUrl }: WelcomeTemplateProps) {
  return (
    <BaseLayout>
      <Heading>Welcome to Hospeda!</Heading>
      <Text>Hi {name},</Text>
      <Text>Thanks for joining us.</Text>
      <Button href={ctaUrl}>Get Started</Button>
    </BaseLayout>
  );
}
```

## API Reference

### `sendEmail(input: SendEmailInput): Promise<SendEmailResult>`

Send an email using Resend.

**Parameters:**

- `input.to` (string | string[]): Recipient email address(es)
- `input.subject` (string): Email subject line
- `input.react` (ReactElement): React Email component to render
- `input.from` (string, optional): Sender address (default: "Hospeda <noreply@hospeda.com.ar>")
- `input.replyTo` (string, optional): Reply-to address

**Returns:**

- `success` (boolean): Whether email was sent successfully
- `messageId` (string, optional): Unique message ID from Resend
- `error` (string, optional): Error message if send failed

### `getResendClient(): Resend`

Get the singleton Resend client instance. Initializes on first call.

### `resetResendClient(): void`

Reset the Resend client (useful for testing).

## Testing

Run tests with coverage:

```bash
pnpm test
pnpm test:watch
```

Mock the Resend client in tests:

```typescript
import { vi } from 'vitest';
import { resetResendClient } from '@repo/email';

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: 'msg_123' },
        error: null
      })
    }
  }))
}));

afterEach(() => {
  resetResendClient();
});
```

## Development

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

## Dependencies

- **resend**: Email delivery service
- **@react-email/components**: React components for emails
- **react**: Peer dependency for React Email

## Notes

- All emails are sent from `noreply@hospeda.com.ar` by default
- Emails are non-blocking and log errors instead of throwing
- Templates use Spanish text (Argentina market)
- All templates are mobile-responsive
- Maximum email width: 600px

## License

Private package for Hospeda platform.
