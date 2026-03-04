# CLAUDE.md - Notifications Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Centralized notification system for the Hospeda platform. Handles email, in-app, and push notifications through a unified API. All notification sending across the monorepo MUST go through this package.

## Key Files

```
src/
├── index.ts         # Package entry point
├── config/          # Notification configuration
├── constants/       # Notification type constants
├── services/        # Notification service implementations
├── templates/       # Email and notification templates
├── transports/      # Transport adapters (email, push, in-app)
├── types/           # TypeScript type definitions
└── utils/           # Notification utility functions
test/                # Test files
```

## Usage

```typescript
import { NotificationService } from '@repo/notifications';

const notifier = new NotificationService();

await notifier.send({
  type: 'email',
  template: 'booking-confirmation',
  to: 'user@example.com',
  data: { bookingId, accommodationName },
});
```

## Patterns

- **Never implement notification sending directly in other packages**.. always use this package
- Templates are centralized here.. do not create email templates elsewhere
- Each transport (email, push, in-app) has its own adapter
- All notification types must be registered in the constants directory
- Use Zod schemas for validating notification payloads
- Notification sending is async.. use proper error handling and retries
- Test with mocked transports.. never send real notifications in tests

## Related Documentation

- `packages/service-core/CLAUDE.md` - Services that trigger notifications
