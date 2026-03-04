# Notification Types

## Categories

Every notification type belongs to one of three categories:

| Category | Opt-Out | Recipient | Description |
|----------|---------|-----------|-------------|
| `TRANSACTIONAL` | Not allowed | User | Payment confirmations, receipts. Always delivered. |
| `REMINDER` | Allowed | User | Renewal reminders, expiration warnings. User can opt out. |
| `ADMIN` | Not allowed | Admin list | System alerts. Sent to admin email addresses. |

## Type Reference

### Transactional (always sent)

| Enum Value | String | Trigger | Payload Type |
|------------|--------|---------|--------------|
| `SUBSCRIPTION_PURCHASE` | `subscription_purchase` | Successful subscription payment | `PurchaseConfirmationPayload` |
| `ADDON_PURCHASE` | `addon_purchase` | Successful add-on payment | `PurchaseConfirmationPayload` |
| `PAYMENT_SUCCESS` | `payment_success` | Successful recurring payment | `PaymentNotificationPayload` |
| `PAYMENT_FAILURE` | `payment_failure` | Failed payment attempt | `PaymentNotificationPayload` |
| `PLAN_CHANGE_CONFIRMATION` | `plan_change_confirmation` | Plan upgrade/downgrade completed | `SubscriptionEventPayload` |
| `ADDON_RENEWAL_CONFIRMATION` | `addon_renewal_confirmation` | Add-on auto-renewal | `AddonEventPayload` |

### Reminder (user can opt out)

| Enum Value | String | Trigger | Payload Type |
|------------|--------|---------|--------------|
| `RENEWAL_REMINDER` | `renewal_reminder` | 3 days before subscription renewal | `SubscriptionEventPayload` |
| `ADDON_EXPIRATION_WARNING` | `addon_expiration_warning` | 7 days before add-on expiry | `AddonEventPayload` |
| `ADDON_EXPIRED` | `addon_expired` | Add-on expiration date reached | `AddonEventPayload` |
| `TRIAL_ENDING_REMINDER` | `trial_ending_reminder` | 3 days before trial ends | `TrialEventPayload` |
| `TRIAL_EXPIRED` | `trial_expired` | Trial end date reached | `TrialEventPayload` |

### Admin (sent to admin email list)

| Enum Value | String | Trigger | Payload Type |
|------------|--------|---------|--------------|
| `ADMIN_PAYMENT_FAILURE` | `admin_payment_failure` | Critical payment failure | `AdminNotificationPayload` |
| `ADMIN_SYSTEM_EVENT` | `admin_system_event` | System errors or alerts | `AdminNotificationPayload` |

## Payload Interfaces

### BaseNotificationPayload

All payloads extend this base:

```ts
interface BaseNotificationPayload {
  type: NotificationType;
  recipientEmail: string;
  recipientName: string;
  userId: string | null;
  customerId?: string;
  idempotencyKey?: string;
}
```

### PurchaseConfirmationPayload

Used for `SUBSCRIPTION_PURCHASE` and `ADDON_PURCHASE`:

```ts
interface PurchaseConfirmationPayload extends BaseNotificationPayload {
  planName: string;
  amount: number;         // In centavos
  currency: string;       // e.g., 'ARS'
  billingPeriod?: string; // e.g., 'monthly', 'yearly'
  nextBillingDate?: string;
}
```

### PaymentNotificationPayload

Used for `PAYMENT_SUCCESS` and `PAYMENT_FAILURE`:

```ts
interface PaymentNotificationPayload extends BaseNotificationPayload {
  amount: number;
  currency: string;
  planName: string;
  failureReason?: string;  // Only for PAYMENT_FAILURE
  retryDate?: string;      // Only for PAYMENT_FAILURE
  paymentMethod?: string;
}
```

### SubscriptionEventPayload

Used for `RENEWAL_REMINDER` and `PLAN_CHANGE_CONFIRMATION`:

```ts
interface SubscriptionEventPayload extends BaseNotificationPayload {
  planName: string;
  amount?: number;
  currency?: string;
  renewalDate?: string;
  daysRemaining?: number;
  oldPlanName?: string;   // Only for PLAN_CHANGE_CONFIRMATION
  newPlanName?: string;   // Only for PLAN_CHANGE_CONFIRMATION
}
```

### AddonEventPayload

Used for `ADDON_EXPIRATION_WARNING`, `ADDON_EXPIRED`, `ADDON_RENEWAL_CONFIRMATION`:

```ts
interface AddonEventPayload extends BaseNotificationPayload {
  addonName: string;
  expirationDate?: string;
  daysRemaining?: number;
  amount?: number;
  currency?: string;
}
```

### TrialEventPayload

Used for `TRIAL_ENDING_REMINDER` and `TRIAL_EXPIRED`:

```ts
interface TrialEventPayload extends BaseNotificationPayload {
  planName: string;
  trialEndDate: string;
  daysRemaining?: number;
  upgradeUrl: string;
}
```

### AdminNotificationPayload

Used for `ADMIN_PAYMENT_FAILURE` and `ADMIN_SYSTEM_EVENT`:

```ts
interface AdminNotificationPayload extends BaseNotificationPayload {
  affectedUserEmail?: string;
  affectedUserId?: string;
  eventDetails: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
}
```

## Category-to-Type Mapping

The mapping is defined in `src/config/notification-categories.ts`:

```ts
const NOTIFICATION_CATEGORY_MAP: Record<NotificationType, NotificationCategory> = {
  // Transactional
  SUBSCRIPTION_PURCHASE:       TRANSACTIONAL,
  ADDON_PURCHASE:              TRANSACTIONAL,
  PAYMENT_SUCCESS:             TRANSACTIONAL,
  PAYMENT_FAILURE:             TRANSACTIONAL,
  PLAN_CHANGE_CONFIRMATION:    TRANSACTIONAL,
  ADDON_RENEWAL_CONFIRMATION:  TRANSACTIONAL,
  // Reminder
  RENEWAL_REMINDER:            REMINDER,
  ADDON_EXPIRATION_WARNING:    REMINDER,
  ADDON_EXPIRED:               REMINDER,
  TRIAL_ENDING_REMINDER:       REMINDER,
  TRIAL_EXPIRED:               REMINDER,
  // Admin
  ADMIN_PAYMENT_FAILURE:       ADMIN,
  ADMIN_SYSTEM_EVENT:          ADMIN,
};
```

## User Preferences

### Preference Structure

```ts
interface NotificationPreferences {
  emailEnabled: boolean;                     // Master email toggle
  disabledCategories: NotificationCategory[]; // Opt out entire categories
  disabledTypes: NotificationType[];          // Opt out specific types
}
```

### Default Preferences

All notifications enabled by default:

```ts
const DEFAULT_PREFERENCES = {
  emailEnabled: true,
  disabledCategories: [],
  disabledTypes: []
};
```

### Preference Check Logic

1. **TRANSACTIONAL** notifications .. always sent (cannot opt out)
2. **ADMIN** notifications .. always sent (goes to admin list, not user)
3. **REMINDER** notifications .. check in order:
   - Is `emailEnabled` false? Skip.
   - Is the category in `disabledCategories`? Skip.
   - Is the specific type in `disabledTypes`? Skip.
   - Otherwise, send.

### Updating Preferences

```ts
// Opt out of all reminders
await preferenceService.updatePreferences(userId, {
  disabledCategories: [NotificationCategory.REMINDER]
});

// Opt out of specific types only
await preferenceService.updatePreferences(userId, {
  disabledTypes: [
    NotificationType.RENEWAL_REMINDER,
    NotificationType.ADDON_EXPIRATION_WARNING
  ]
});

// Disable all email notifications
await preferenceService.updatePreferences(userId, {
  emailEnabled: false
});
```

## Delivery Result

```ts
interface DeliveryResult {
  success: boolean;
  status: 'sent' | 'failed' | 'skipped' | 'pending' | 'bounced';
  messageId?: string;      // Provider message ID (when sent)
  error?: string;          // Error message (when failed)
  skippedReason?: string;  // Reason (when skipped due to preferences)
}
```
