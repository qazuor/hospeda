# @repo/notifications Documentation

## Overview

`@repo/notifications` is the email notification system for the Hospeda billing platform. It handles transactional emails, reminders, and admin alerts with user preference management, automatic retry with exponential backoff, and delivery tracking.

## Purpose

- **Billing communication** .. Purchase confirmations, payment receipts, renewal reminders, trial notifications
- **Admin alerting** .. Payment failure alerts, system event notifications
- **User preferences** .. Category-based opt-out for reminder notifications
- **Reliability** .. Automatic retry with exponential backoff via Redis queue
- **Tracking** .. All deliveries logged to PostgreSQL for auditing

## Architecture

```
Caller (API/Cron)
    |
    v
NotificationService
    |-- PreferenceService  (check opt-in/opt-out)
    |-- SubjectBuilder     (generate email subject)
    |-- Template selector  (pick React Email template)
    |-- EmailTransport     (Resend API / Mock)
    |-- DeliveryLogger     (PostgreSQL billing_notification_log)
    |-- RetryService       (Redis sorted set queue)
```

## Package Structure

```
packages/notifications/
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── notification-categories.ts  # Type-to-category mapping
│   │   └── resend.config.ts            # Resend client factory
│   ├── constants/
│   │   └── notification.constants.ts   # Retry config, defaults
│   ├── services/
│   │   ├── notification.service.ts     # Main orchestrator
│   │   ├── preference.service.ts       # User opt-in/opt-out
│   │   └── retry.service.ts            # Redis retry queue
│   ├── templates/
│   │   ├── billing/       # Purchase, payment, renewal, plan change
│   │   ├── addon/         # Addon expiration, renewal
│   │   ├── trial/         # Trial ending, expired
│   │   ├── admin/         # Payment failure, system event
│   │   ├── components/    # Shared layout, button, heading, info-row
│   │   └── utils/         # Format helpers
│   ├── transports/
│   │   └── email/
│   │       ├── email-transport.interface.ts  # Abstract interface
│   │       ├── resend-transport.ts           # Resend implementation
│   │       └── mock-transport.ts             # Test mock
│   ├── types/
│   │   ├── notification.types.ts   # NotificationType, payloads
│   │   ├── delivery.types.ts       # DeliveryResult, DeliveryStatus
│   │   └── preferences.types.ts    # NotificationPreferences
│   └── utils/
│       └── subject-builder.ts      # Email subject generation
└── docs/
    ├── README.md                    # This file
    ├── quick-start.md               # Getting started
    └── guides/
        ├── notification-types.md    # All notification types
        ├── email-templates.md       # Template system
        └── retry-system.md          # Retry and queue
```

## Key Dependencies

- **@react-email/components** .. React Email for template rendering
- **resend** .. Email delivery provider
- **ioredis** .. Redis client for retry queue
- **@repo/db** .. PostgreSQL delivery logging
- **@repo/logger** .. Structured logging

## Environment Variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx          # Resend API key
RESEND_FROM_EMAIL=noreply@hospeda.com.ar # Sender email
RESEND_FROM_NAME=Hospeda                  # Sender name
REDIS_URL=redis://localhost:6379         # Redis (optional, for retries)
```

## Documentation Index

| Document | Description |
|----------|-------------|
| [Quick Start](./quick-start.md) | Installation and basic usage |
| [Notification Types](./guides/notification-types.md) | All types, categories, and payloads |
| [Email Templates](./guides/email-templates.md) | Template system and how to add new ones |
| [Retry System](./guides/retry-system.md) | Retry queue, backoff, and failure handling |

## Related Resources

- [Billing Documentation](../../../docs/billing/)
- [@repo/db](../../db/docs/) .. Database schema for notification log
- [@repo/logger](../../logger/docs/) .. Logging integration
