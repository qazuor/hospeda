# @repo/notifications

Email notification system for the Hospeda billing platform. Provides transactional emails, reminders, and admin notifications with support for user preferences, retry mechanisms, and delivery tracking.

## Overview

The notification system handles all email communications for billing events, subscription lifecycle, add-ons, trials, and system alerts. It integrates with Resend for email delivery, Redis for retry queue management, and PostgreSQL for delivery logging.

**Key Features:**

- **Type-safe notifications** - All notification types defined with TypeScript enums
- **Category-based preferences** - Users can opt out of reminder notifications
- **Automatic retry with exponential backoff** - Failed deliveries retry up to 3 times
- **Delivery tracking** - All notifications logged to database
- **React Email templates** - Beautiful, responsive email templates
- **Idempotency** - Duplicate prevention via idempotency keys

## Installation

```bash
pnpm add @repo/notifications
```

## Environment Variables

Required environment variables:

```env
# Resend API Configuration
HOSPEDA_RESEND_API_KEY=re_xxxxxxxxxxxxx          # Resend API key
HOSPEDA_RESEND_FROM_EMAIL=noreply@hospeda.com.ar # Default sender email
HOSPEDA_RESEND_FROM_NAME=Hospeda                  # Default sender name

# Redis (Optional - for retry queue)
HOSPEDA_REDIS_URL=redis://localhost:6379         # Redis connection URL
```

## Notification Types

### Transactional Notifications

**Always sent, cannot be opted out:**

| Type | Description | Triggered By |
|------|-------------|--------------|
| `SUBSCRIPTION_PURCHASE` | Subscription purchase confirmation | Successful subscription payment |
| `ADDON_PURCHASE` | Add-on purchase confirmation | Successful add-on payment |
| `PAYMENT_SUCCESS` | Payment processed successfully | Successful recurring payment |
| `PAYMENT_FAILURE` | Payment failed | Failed payment attempt |
| `PLAN_CHANGE_CONFIRMATION` | Plan upgrade/downgrade confirmed | Plan change completed |
| `ADDON_RENEWAL_CONFIRMATION` | Recurring add-on renewed | Add-on auto-renewal |

### Reminder Notifications

**Can be opted out by user:**

| Type | Description | Triggered By |
|------|-------------|--------------|
| `RENEWAL_REMINDER` | Subscription renewal reminder | 3 days before renewal |
| `ADDON_EXPIRATION_WARNING` | Add-on expiring soon | 7 days before expiry |
| `ADDON_EXPIRED` | Add-on has expired | Add-on expiry date |
| `TRIAL_ENDING_REMINDER` | Trial ending soon | 3 days before trial ends |
| `TRIAL_EXPIRED` | Trial has expired | Trial end date |

### Admin Notifications

**Sent to admin email list only:**

| Type | Description | Triggered By |
|------|-------------|--------------|
| `ADMIN_PAYMENT_FAILURE` | Payment failure requiring attention | Critical payment failure |
| `ADMIN_SYSTEM_EVENT` | System event notification | System errors or alerts |

## Notification Categories

```ts
enum NotificationCategory {
  TRANSACTIONAL = 'transactional',  // Always sent, cannot be opted out
  REMINDER = 'reminder',            // Can be opted out by user
  ADMIN = 'admin'                   // Sent to admin email list only
}
```

## Email Templates

All templates are built with React Email for responsive, beautiful emails.

### Billing Templates

- `PurchaseConfirmation` - Subscription/add-on purchase receipt
- `PaymentSuccess` - Successful payment notification
- `PaymentFailure` - Failed payment alert
- `RenewalReminder` - Upcoming renewal reminder
- `PlanChangeConfirmation` - Plan change confirmation

### Add-on Templates

- `AddonExpirationWarning` - Add-on expiring soon
- `AddonExpired` - Add-on expired
- `AddonRenewalConfirmation` - Add-on renewed

### Trial Templates

- `TrialEndingReminder` - Trial ending soon
- `TrialExpired` - Trial expired

### Admin Templates

- `AdminPaymentFailure` - Payment failure alert
- `AdminSystemEvent` - System event notification

## Usage

### Basic Usage

```ts
import { NotificationService, NotificationType } from '@repo/notifications';
import { createResendClient } from '@repo/notifications/config';
import { ResendEmailTransport } from '@repo/notifications/transports';
import { getDb } from '@repo/db';
import { createLogger } from '@repo/logger';

// Create email transport
const resendClient = createResendClient();
const emailTransport = new ResendEmailTransport(resendClient);

// Create notification service
const notificationService = new NotificationService({
  emailTransport,
  preferenceService: new PreferenceService({ /* ... */ }),
  retryService: new RetryService(redisClient), // null if Redis unavailable
  db: getDb(),
  logger: createLogger('notifications')
});

// Send a notification
const result = await notificationService.send({
  type: NotificationType.SUBSCRIPTION_PURCHASE,
  recipientEmail: 'user@example.com',
  recipientName: 'John Doe',
  userId: 'user-123',
  customerId: 'cus-456',
  planName: 'Premium',
  amount: 5000,
  currency: 'ARS',
  billingPeriod: 'monthly',
  nextBillingDate: '2024-02-30'
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

### Batch Notifications

```ts
const results = await notificationService.sendBatch([
  {
    type: NotificationType.RENEWAL_REMINDER,
    recipientEmail: 'user1@example.com',
    // ...
  },
  {
    type: NotificationType.TRIAL_ENDING_REMINDER,
    recipientEmail: 'user2@example.com',
    // ...
  }
]);

const successful = results.filter(r => r.success).length;
console.log(`Sent ${successful} of ${results.length} notifications`);
```

## Preference System

Users can manage their notification preferences to opt out of reminder notifications.

### User Preferences Structure

```ts
interface NotificationPreferences {
  emailEnabled: boolean;                     // Master email toggle
  disabledCategories: NotificationCategory[]; // Disabled categories
  disabledTypes: NotificationType[];          // Disabled specific types
}
```

### Default Preferences

```ts
const DEFAULT_PREFERENCES = {
  emailEnabled: true,
  disabledCategories: [],
  disabledTypes: []
};
```

### Checking Preferences

The `PreferenceService` automatically checks if a notification should be sent:

```ts
const shouldSend = await preferenceService.shouldSendNotification(
  userId,
  NotificationType.RENEWAL_REMINDER
);
```

**Rules:**

1. **TRANSACTIONAL** notifications always send (cannot be opted out)
2. **ADMIN** notifications always send (go to admin list, not user)
3. **REMINDER** notifications respect user preferences

### Updating Preferences

```ts
await preferenceService.updatePreferences(userId, {
  disabledCategories: [NotificationCategory.REMINDER] // Opt out of all reminders
});

await preferenceService.updatePreferences(userId, {
  disabledTypes: [
    NotificationType.RENEWAL_REMINDER,
    NotificationType.ADDON_EXPIRATION_WARNING
  ] // Opt out of specific types
});
```

## Retry Mechanism

Failed notifications are automatically retried with exponential backoff.

### Retry Configuration

```ts
const RETRY_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,           // Maximum retry attempts
  RETRY_BASE_DELAY_MS: 60_000,     // Base delay (1 minute)
  RETRY_BACKOFF_MULTIPLIER: 5,     // Exponential multiplier
  REDIS_RETRY_TTL_SECONDS: 86_400  // 24 hours TTL for retry queue
};
```

### Retry Schedule

| Attempt | Delay | Total Wait Time |
|---------|-------|-----------------|
| 1st retry | 1 minute | 1 minute |
| 2nd retry | 5 minutes | 6 minutes |
| 3rd retry | 25 minutes | 31 minutes |

**After 3 failures:** Notification is abandoned and logged with `status: 'failed'`

### Exponential Backoff Formula

```ts
delay = baseDelay * multiplier^(attemptCount - 1)
```

Capped at maximum 30 minutes between retries.

### Processing Retry Queue

```ts
import { RetryService } from '@repo/notifications';

const retryService = new RetryService(redisClient);

// Get notifications ready for retry
const notifications = await retryService.dequeueReady();

for (const notification of notifications) {
  const payload = JSON.parse(notification.payload);

  if (RetryService.isMaxRetriesReached(notification.attemptCount)) {
    console.log('Max retries reached, abandoning:', notification.id);
    continue;
  }

  // Attempt to resend
  const result = await notificationService.send(payload);

  if (!result.success) {
    // Re-queue with next retry delay
    const nextDelay = RetryService.calculateRetryDelay(notification.attemptCount + 1);
    await retryService.enqueue({
      ...notification,
      attemptCount: notification.attemptCount + 1,
      lastError: result.error || 'Unknown error'
    }, nextDelay);
  }
}
```

## Delivery Tracking

All notifications are logged to the `billing_notification_log` table in PostgreSQL.

### Log Structure

```ts
{
  customerId: string | null;
  type: NotificationType;
  channel: 'email';
  recipient: string;
  subject: string;
  templateId: string;
  status: 'sent' | 'failed' | 'skipped';
  sentAt: Date | null;
  errorMessage: string | null;
  metadata: {
    userId: string | null;
    recipientName: string;
    messageId: string | null;
    category: NotificationCategory;
    idempotencyKey: string | null;
  }
}
```

### Delivery Status

- `sent` - Successfully delivered
- `failed` - Delivery failed (will retry if retries available)
- `skipped` - User opted out via preferences

## Adding a New Notification Type

### Step 1: Add Type and Category

```ts
// src/types/notification.types.ts
export enum NotificationType {
  // ... existing types
  NEW_FEATURE_ANNOUNCEMENT = 'new_feature_announcement'
}

// src/config/notification-categories.ts
export const NOTIFICATION_CATEGORY_MAP = {
  // ... existing mappings
  [NotificationType.NEW_FEATURE_ANNOUNCEMENT]: NotificationCategory.REMINDER
};
```

### Step 2: Define Payload Type

```ts
// src/types/notification.types.ts
export interface FeatureAnnouncementPayload extends BaseNotificationPayload {
  type: NotificationType.NEW_FEATURE_ANNOUNCEMENT;
  featureName: string;
  description: string;
  learnMoreUrl: string;
}

// Add to union type
export type NotificationPayload =
  | PurchaseConfirmationPayload
  // ... other payloads
  | FeatureAnnouncementPayload;
```

### Step 3: Create Email Template

```tsx
// src/templates/feature/feature-announcement.tsx
import { Html, Head, Body, Container, Heading, Text, Link } from '@react-email/components';

export interface FeatureAnnouncementProps {
  recipientName: string;
  featureName: string;
  description: string;
  learnMoreUrl: string;
}

export function FeatureAnnouncement({
  recipientName,
  featureName,
  description,
  learnMoreUrl
}: FeatureAnnouncementProps) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>¡Nueva función disponible!</Heading>
          <Text>Hola {recipientName},</Text>
          <Text>
            Tenemos el placer de anunciarte una nueva función: <strong>{featureName}</strong>
          </Text>
          <Text>{description}</Text>
          <Link href={learnMoreUrl}>Más información</Link>
        </Container>
      </Body>
    </Html>
  );
}
```

### Step 4: Add Subject Line

```ts
// src/utils/subject-builder.ts
const SUBJECT_TEMPLATES: Record<NotificationType, string> = {
  // ... existing subjects
  [NotificationType.NEW_FEATURE_ANNOUNCEMENT]: '¡Nueva función: {{featureName}}!'
};
```

### Step 5: Register Template

```ts
// src/services/notification.service.ts
private selectTemplate(payload: NotificationPayload): ReactElement {
  // ... existing switch cases

  case 'new_feature_announcement': {
    const p = payload as FeatureAnnouncementPayload;
    return FeatureAnnouncement({
      recipientName,
      featureName: p.featureName,
      description: p.description,
      learnMoreUrl: p.learnMoreUrl
    });
  }
}
```

### Step 6: Use the New Notification

```ts
await notificationService.send({
  type: NotificationType.NEW_FEATURE_ANNOUNCEMENT,
  recipientEmail: 'user@example.com',
  recipientName: 'Jane Doe',
  userId: 'user-123',
  featureName: 'Advanced Analytics',
  description: 'Track your bookings with detailed analytics',
  learnMoreUrl: 'https://hospeda.com.ar/features/analytics'
});
```

## Admin Notification Configuration

Admin notifications are sent to a predefined list of admin email addresses.

### Configuration

```ts
const ADMIN_EMAIL_LIST = [
  'admin@hospeda.com.ar',
  'ops@hospeda.com.ar',
  'tech@hospeda.com.ar'
];
```

### Sending Admin Notifications

```ts
await notificationService.send({
  type: NotificationType.ADMIN_PAYMENT_FAILURE,
  recipientEmail: ADMIN_EMAIL_LIST[0], // Send to first admin
  recipientName: 'Admin Team',
  userId: null, // No specific user
  affectedUserEmail: 'user@example.com',
  affectedUserId: 'user-123',
  eventDetails: {
    paymentId: 'pay-456',
    amount: 5000,
    errorCode: 'INSUFFICIENT_FUNDS'
  },
  severity: 'critical'
});

// Send to all admins
for (const adminEmail of ADMIN_EMAIL_LIST) {
  await notificationService.send({
    type: NotificationType.ADMIN_SYSTEM_EVENT,
    recipientEmail: adminEmail,
    recipientName: 'Admin',
    userId: null,
    eventDetails: {
      eventType: 'database_backup_failed',
      timestamp: new Date().toISOString()
    },
    severity: 'warning'
  });
}
```

## Integration Guide

### Integration with Billing System

```ts
import { NotificationService, NotificationType } from '@repo/notifications';

// After successful subscription purchase
await notificationService.send({
  type: NotificationType.SUBSCRIPTION_PURCHASE,
  recipientEmail: customer.email,
  recipientName: customer.name,
  userId: customer.userId,
  customerId: customer.id,
  planName: plan.name,
  amount: subscription.amount,
  currency: 'ARS',
  billingPeriod: subscription.billingCycle,
  nextBillingDate: subscription.nextBillingDate
});
```

### Integration with Webhook Handlers

```ts
// In MercadoPago webhook handler
if (payment.status === 'approved') {
  await notificationService.send({
    type: NotificationType.PAYMENT_SUCCESS,
    recipientEmail: customer.email,
    recipientName: customer.name,
    userId: customer.userId,
    customerId: customer.id,
    amount: payment.amount,
    currency: 'ARS',
    planName: subscription.plan.name,
    paymentMethod: payment.paymentMethod
  });
} else if (payment.status === 'rejected') {
  await notificationService.send({
    type: NotificationType.PAYMENT_FAILURE,
    recipientEmail: customer.email,
    recipientName: customer.name,
    userId: customer.userId,
    customerId: customer.id,
    amount: payment.amount,
    currency: 'ARS',
    failureReason: payment.statusDetail,
    retryDate: calculateRetryDate(payment)
  });
}
```

### Integration with Cron Jobs

```ts
// Daily trial expiry check
const expiringTrials = await getExpiringTrials(3); // 3 days before expiry

for (const trial of expiringTrials) {
  await notificationService.send({
    type: NotificationType.TRIAL_ENDING_REMINDER,
    recipientEmail: trial.customer.email,
    recipientName: trial.customer.name,
    userId: trial.customer.userId,
    customerId: trial.customer.id,
    planName: trial.plan.name,
    trialEndDate: trial.endsAt,
    daysRemaining: 3,
    upgradeUrl: 'https://hospeda.com.ar/upgrade'
  });
}
```

## Error Handling

### Graceful Degradation

The notification system is designed to fail gracefully:

- **Redis unavailable**: Retry system disabled, errors logged
- **Resend API error**: Notification logged as failed, no crash
- **Database logging error**: Email still sent, logging error logged

### Error Response

```ts
interface DeliveryResult {
  success: boolean;
  status: 'sent' | 'failed' | 'skipped';
  messageId?: string;
  error?: string;
  skippedReason?: string;
}
```

### Example Error Handling

```ts
const result = await notificationService.send(payload);

if (!result.success) {
  if (result.status === 'skipped') {
    console.log('User opted out:', result.skippedReason);
  } else if (result.status === 'failed') {
    console.error('Delivery failed:', result.error);
    // Will be retried automatically if retry service available
  }
}
```

## Testing

### Unit Testing

```ts
import { describe, it, expect, vi } from 'vitest';
import { NotificationService } from '@repo/notifications';

describe('NotificationService', () => {
  it('should send notification successfully', async () => {
    const mockTransport = {
      send: vi.fn().mockResolvedValue({ messageId: 'msg-123' })
    };

    const service = new NotificationService({
      emailTransport: mockTransport,
      // ... other deps
    });

    const result = await service.send({
      type: NotificationType.PAYMENT_SUCCESS,
      // ... payload
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(mockTransport.send).toHaveBeenCalledOnce();
  });
});
```

## License

Private - Internal use only

## Support

For issues or questions, contact the Hospeda development team.
