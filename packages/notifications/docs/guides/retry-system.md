# Retry System

## Overview

Failed notification deliveries are automatically retried using a Redis sorted set as a delay queue. The system uses exponential backoff to space out retries, preventing API rate limit issues and giving transient failures time to resolve.

## How It Works

1. `NotificationService.send()` attempts to deliver an email
2. If delivery fails, the notification is enqueued in Redis with a calculated retry delay
3. A cron job calls `RetryService.processRetries()` periodically
4. Ready notifications (delay elapsed) are dequeued and re-sent
5. If a retry fails again, it is re-enqueued with an increased delay
6. After 3 total attempts, the notification is marked as permanently failed

## Configuration

Constants are defined in `src/constants/notification.constants.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_RETRY_ATTEMPTS` | `3` | Maximum retry attempts before abandoning |
| `RETRY_BASE_DELAY_MS` | `60,000` (1 min) | Base delay before first retry |
| `RETRY_BACKOFF_MULTIPLIER` | `5` | Exponential backoff multiplier |
| `REDIS_RETRY_QUEUE_KEY` | `notifications:retry_queue` | Redis sorted set key |
| `REDIS_RETRY_TTL_SECONDS` | `86,400` (24h) | TTL for retry queue entries |

## Retry Schedule

| Attempt | Delay Formula | Delay | Cumulative Wait |
|---------|---------------|-------|-----------------|
| 1st retry | `60000 * 5^0` | 1 minute | 1 minute |
| 2nd retry | `60000 * 5^1` | 5 minutes | 6 minutes |
| 3rd retry | `60000 * 5^2` | 25 minutes | 31 minutes |

Maximum delay is capped at 30 minutes per retry.

After the 3rd failed attempt, the notification is abandoned and logged with `status: 'failed'`.

## Backoff Formula

```
delay = min(baseDelay * multiplier^(attemptCount - 1), 30 minutes)
```

Example calculations:

```ts
RetryService.calculateRetryDelay(1);  // 60,000 ms (1 min)
RetryService.calculateRetryDelay(2);  // 300,000 ms (5 min)
RetryService.calculateRetryDelay(3);  // 1,500,000 ms (25 min)
RetryService.calculateRetryDelay(4);  // 1,800,000 ms (30 min, capped)
```

## Redis Data Structure

The retry queue uses a Redis **sorted set** where:

- **Score** = timestamp when the notification is ready for retry (`Date.now() + delay`)
- **Member** = JSON-serialized `RetryableNotification` object

```ts
interface RetryableNotification {
  id: string;           // Unique notification ID
  payload: string;      // JSON-serialized NotificationPayload
  attemptCount: number; // Current retry attempt number
  lastError: string;    // Error from last failed attempt
  createdAt: string;    // ISO timestamp of original send attempt
}
```

## Processing Retries

### Using processRetries()

The recommended way to process retries is via the `processRetries()` method, which handles the full lifecycle:

```ts
const retryService = new RetryService(redisClient);
const notificationService = new NotificationService({ /* deps */ });

// In a cron job handler:
const stats = await retryService.processRetries(
  async (payload) => notificationService.send(payload)
);

console.log({
  processed: stats.processed,          // Total notifications attempted
  succeeded: stats.succeeded,          // Successfully sent
  failed: stats.failed,                // Failed, re-enqueued for another retry
  permanentlyFailed: stats.permanentlyFailed  // Exhausted all retries
});
```

### Manual Processing

For more control, you can process retries manually:

```ts
// 1. Dequeue notifications ready for retry
const notifications = await retryService.dequeueReady();

for (const notification of notifications) {
  // 2. Check if max retries reached
  if (RetryService.isMaxRetriesReached(notification.attemptCount)) {
    console.log('Abandoned:', notification.id);
    continue;
  }

  // 3. Parse and re-send
  const payload = JSON.parse(notification.payload);
  const result = await notificationService.send(payload);

  // 4. Re-enqueue if failed
  if (!result.success) {
    const nextAttempt = notification.attemptCount + 1;
    const delay = RetryService.calculateRetryDelay(nextAttempt);

    await retryService.enqueue({
      ...notification,
      attemptCount: nextAttempt,
      lastError: result.error || 'Unknown error'
    }, delay);
  }
}
```

## Permanent Failure Callback

You can register a callback that fires when a notification exhausts all retries:

```ts
const retryService = new RetryService(redisClient, {
  onPermanentFailure: async (notification) => {
    // Send admin alert about permanently failed notification
    await adminAlertService.send({
      type: 'notification_permanent_failure',
      notificationId: notification.id,
      lastError: notification.lastError,
      attemptCount: notification.attemptCount
    });
  }
});
```

The callback is wrapped in a try/catch internally. Errors from the callback are logged but do not propagate.

## Graceful Degradation

### Redis Unavailable

When Redis is not available:

- `RetryService` is instantiated with `null` Redis client
- `enqueue()` logs a warning and returns without error
- `dequeueReady()` returns an empty array
- `processRetries()` returns zero stats
- **Notifications still send** on first attempt; only retries are disabled

### Integration Pattern

```ts
// Safe to pass null when Redis is unavailable
const retryService = redisClient
  ? new RetryService(redisClient)
  : null;

const notificationService = new NotificationService({
  emailTransport,
  preferenceService,
  retryService,  // null is accepted
  db,
  logger
});
```

## Delivery Logging

All notification attempts are logged to the `billing_notification_log` table in PostgreSQL:

| Column | Type | Description |
|--------|------|-------------|
| `customerId` | `string \| null` | Billing customer ID |
| `type` | `NotificationType` | Notification type enum value |
| `channel` | `'email'` | Delivery channel |
| `recipient` | `string` | Recipient email address |
| `subject` | `string` | Email subject line |
| `templateId` | `string` | Template identifier |
| `status` | `'sent' \| 'failed' \| 'skipped'` | Delivery outcome |
| `sentAt` | `Date \| null` | Timestamp when delivered |
| `errorMessage` | `string \| null` | Error details if failed |
| `metadata` | `JSON` | Additional context (userId, messageId, category, idempotency key) |

## Idempotency

To prevent duplicate notifications, pass an `idempotencyKey` in the payload:

```ts
await notificationService.send({
  type: NotificationType.PAYMENT_SUCCESS,
  idempotencyKey: `payment-${paymentId}`,
  // ... other fields
});
```

The notification service checks for existing log entries with the same idempotency key before sending. If a matching entry with `status: 'sent'` exists, the notification is skipped.
