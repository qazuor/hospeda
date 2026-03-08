# Quick Start

## Installation

```json
{
  "dependencies": {
    "@repo/notifications": "workspace:*"
  }
}
```

```bash
pnpm install
```

## Environment Variables

```env
HOSPEDA_RESEND_API_KEY=re_xxxxxxxxxxxxx
HOSPEDA_RESEND_FROM_EMAIL=noreply@hospeda.com.ar
HOSPEDA_RESEND_FROM_NAME=Hospeda
HOSPEDA_REDIS_URL=redis://localhost:6379  # Optional, for retry queue
```

## Basic Setup

```ts
import { NotificationService, NotificationType } from '@repo/notifications';
import { ResendEmailTransport } from '@repo/notifications/transports';
import { PreferenceService } from '@repo/notifications/services';
import { RetryService } from '@repo/notifications/services';
import { createResendClient } from '@repo/notifications/config';
import { getDb } from '@repo/db';
import { createLogger } from '@repo/logger';

// 1. Create email transport
const resendClient = createResendClient();
const emailTransport = new ResendEmailTransport(resendClient);

// 2. Create preference service
const preferenceService = new PreferenceService({
  getUserSettings: async (userId) => {
    // Fetch user settings from your database
    return getUserSettingsFromDb(userId);
  },
  updateUserSettings: async (userId, settings) => {
    // Update user settings in your database
    await updateUserSettingsInDb(userId, settings);
  }
});

// 3. Create retry service (null if Redis unavailable)
const retryService = redisClient ? new RetryService(redisClient) : null;

// 4. Create notification service
const notificationService = new NotificationService({
  emailTransport,
  preferenceService,
  retryService,
  db: getDb(),
  logger: createLogger('notifications')
});
```

## Send a Notification

```ts
const result = await notificationService.send({
  type: NotificationType.SUBSCRIPTION_PURCHASE,
  recipientEmail: 'user@example.com',
  recipientName: 'Juan Perez',
  userId: 'user-123',
  customerId: 'cus-456',
  planName: 'Premium',
  amount: 5000,
  currency: 'ARS',
  billingPeriod: 'monthly',
  nextBillingDate: '2026-04-04'
});

if (result.success) {
  console.log('Sent:', result.messageId);
} else if (result.status === 'skipped') {
  console.log('User opted out:', result.skippedReason);
} else {
  console.error('Failed:', result.error);
}
```

## Send Batch Notifications

```ts
const results = await notificationService.sendBatch([
  {
    type: NotificationType.RENEWAL_REMINDER,
    recipientEmail: 'user1@example.com',
    recipientName: 'User 1',
    userId: 'user-1',
    planName: 'Standard',
    renewalDate: '2026-03-07',
    daysRemaining: 3
  },
  {
    type: NotificationType.TRIAL_ENDING_REMINDER,
    recipientEmail: 'user2@example.com',
    recipientName: 'User 2',
    userId: 'user-2',
    planName: 'Premium',
    trialEndDate: '2026-03-07',
    daysRemaining: 3,
    upgradeUrl: 'https://hospeda.com.ar/upgrade'
  }
]);

const sent = results.filter(r => r.success).length;
console.log(`Sent ${sent} of ${results.length}`);
```

## Testing with Mock Transport

```ts
import { MockEmailTransport } from '@repo/notifications/transports';

const mockTransport = new MockEmailTransport();

const notificationService = new NotificationService({
  emailTransport: mockTransport,
  preferenceService,
  retryService: null,  // No Redis needed in tests
  db: getDb(),
  logger: createLogger('notifications')
});
```

## Next Steps

- [Notification Types](./guides/notification-types.md) .. All types, categories, and payload interfaces
- [Email Templates](./guides/email-templates.md) .. How templates work and how to add new ones
- [Retry System](./guides/retry-system.md) .. Exponential backoff and failure handling
