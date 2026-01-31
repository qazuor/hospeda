# Billing Module - QZPay Integration

This module provides integration with the QZPay billing library through Drizzle ORM for Hospeda.

## Overview

QZPay is a comprehensive billing and subscription management library that provides:

- **Customer Management**: Customer profiles, metadata, and lifecycle
- **Subscription Management**: Recurring billing, trials, upgrades/downgrades
- **Usage-Based Billing**: Metered billing for consumption-based pricing
- **Invoice Generation**: Automatic invoice creation and management
- **Payment Processing**: Multi-gateway payment integration
- **Entitlement Management**: Feature access control and limits
- **Plan Configuration**: Flexible pricing models and add-ons
- **Promo Codes**: Discount codes and promotional campaigns
- **Vendor/Marketplace**: Multi-vendor payout management
- **Webhooks**: Event-driven integrations

## Database Tables

The integration creates 24 billing tables with the `billing_` prefix:

### Core Tables

- `billing_customers` - Customer accounts
- `billing_plans` - Subscription plans
- `billing_prices` - Pricing tiers and models
- `billing_subscriptions` - Active subscriptions
- `billing_invoices` - Generated invoices
- `billing_invoice_lines` - Invoice line items
- `billing_payments` - Payment records
- `billing_refunds` - Refund transactions

### Feature Management

- `billing_entitlements` - Feature definitions
- `billing_customer_entitlements` - Customer feature grants
- `billing_limits` - Limit definitions
- `billing_customer_limits` - Customer usage limits

### Payment Infrastructure

- `billing_payment_methods` - Stored payment methods
- `billing_invoice_payments` - Invoice-payment associations

### Add-ons & Promotions

- `billing_addons` - Available add-ons
- `billing_subscription_addons` - Subscription add-on assignments
- `billing_promo_codes` - Promotional codes
- `billing_promo_code_usage` - Promo code redemptions

### Usage Tracking

- `billing_usage_records` - Usage event tracking

### Marketplace/Vendor

- `billing_vendors` - Vendor profiles
- `billing_vendor_payouts` - Payout tracking

### System Tables

- `billing_webhook_events` - Webhook event log
- `billing_webhook_dead_letter` - Failed webhooks
- `billing_audit_logs` - Audit trail
- `billing_idempotency_keys` - Duplicate prevention

## Installation

The package is already installed in `@repo/db`:

```json
{
  "dependencies": {
    "@qazuor/qzpay-core": "^1.1.0",
    "@qazuor/qzpay-drizzle": "^1.1.0"
  }
}
```

## Usage

### Step 1: Initialize Database

The billing adapter uses the same database connection as the rest of Hospeda:

```typescript
import { Pool } from 'pg';
import { initializeDb } from '@repo/db';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Initialize database - required before using billing adapter
initializeDb(pool);
```

### Step 2: Create Billing Adapter

```typescript
import { getDb, createBillingAdapter } from '@repo/db';

// Get initialized database instance
const db = getDb();

// Create billing adapter
const billingAdapter = createBillingAdapter(db, {
  livemode: process.env.NODE_ENV === 'production'
});
```

### Step 3: Initialize QZPay

```typescript
import { QZPay } from '@qazuor/qzpay-core';

const qzpay = new QZPay({
  storage: billingAdapter,
  config: {
    currency: 'ARS',
    locale: 'es-AR',
    timezone: 'America/Argentina/Buenos_Aires'
  }
});
```

## Common Operations

### Customer Management

```typescript
// Create customer
const customer = await qzpay.customers.create({
  email: 'customer@example.com',
  name: 'John Doe',
  metadata: {
    userId: 'user_123',
    source: 'web'
  }
});

// Retrieve customer
const retrievedCustomer = await qzpay.customers.retrieve(customer.id);

// Update customer
const updatedCustomer = await qzpay.customers.update(customer.id, {
  name: 'John Smith'
});

// List customers
const customers = await qzpay.customers.list({
  limit: 20,
  offset: 0
});
```

### Subscription Management

```typescript
// Create subscription
const subscription = await qzpay.subscriptions.create({
  customerId: customer.id,
  planId: 'plan_basic',
  trialDays: 14,
  metadata: {
    source: 'signup_flow'
  }
});

// Update subscription (upgrade/downgrade)
const upgraded = await qzpay.subscriptions.update(subscription.id, {
  planId: 'plan_premium'
});

// Cancel subscription
const canceled = await qzpay.subscriptions.cancel(subscription.id, {
  cancelAtPeriodEnd: true
});

// Retrieve subscription with details
const fullSubscription = await qzpay.subscriptions.retrieve(subscription.id, {
  expand: ['customer', 'plan', 'addons']
});
```

### Invoice Generation

```typescript
// Create invoice
const invoice = await qzpay.invoices.create({
  customerId: customer.id,
  subscriptionId: subscription.id,
  items: [
    {
      description: 'Pro Plan - January 2024',
      amount: 2900,
      quantity: 1
    }
  ]
});

// Finalize invoice
const finalized = await qzpay.invoices.finalize(invoice.id);

// Send invoice
await qzpay.invoices.send(invoice.id);

// List customer invoices
const invoices = await qzpay.invoices.list({
  customerId: customer.id,
  status: 'paid'
});
```

### Payment Processing

```typescript
// Create payment method
const paymentMethod = await qzpay.paymentMethods.create({
  customerId: customer.id,
  type: 'card',
  gateway: 'mercado_pago',
  gatewayPaymentMethodId: 'pm_xxx'
});

// Charge invoice
const payment = await qzpay.payments.create({
  invoiceId: invoice.id,
  paymentMethodId: paymentMethod.id,
  amount: invoice.total
});

// Process refund
const refund = await qzpay.refunds.create({
  paymentId: payment.id,
  amount: 1000, // Partial refund
  reason: 'customer_request'
});
```

### Entitlement Management

```typescript
// Define entitlement
const entitlement = await qzpay.entitlements.create({
  key: 'feature_advanced_analytics',
  name: 'Advanced Analytics',
  description: 'Access to advanced analytics dashboard'
});

// Grant entitlement to customer
await qzpay.entitlements.grant({
  customerId: customer.id,
  entitlementId: entitlement.id,
  expiresAt: new Date('2024-12-31')
});

// Check entitlement
const hasAccess = await qzpay.entitlements.check({
  customerId: customer.id,
  entitlementKey: 'feature_advanced_analytics'
});

// Revoke entitlement
await qzpay.entitlements.revoke({
  customerId: customer.id,
  entitlementId: entitlement.id
});
```

### Usage Tracking

```typescript
// Record usage
await qzpay.usage.record({
  customerId: customer.id,
  subscriptionId: subscription.id,
  metricKey: 'api_calls',
  quantity: 100,
  timestamp: new Date()
});

// Get usage summary
const usage = await qzpay.usage.summary({
  customerId: customer.id,
  metricKey: 'api_calls',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});
```

### Promo Codes

```typescript
// Create promo code
const promoCode = await qzpay.promoCodes.create({
  code: 'WELCOME20',
  type: 'percentage',
  value: 20, // 20% off
  maxRedemptions: 100,
  expiresAt: new Date('2024-12-31')
});

// Apply promo code
const applied = await qzpay.promoCodes.apply({
  customerId: customer.id,
  code: 'WELCOME20',
  subscriptionId: subscription.id
});

// Validate promo code
const isValid = await qzpay.promoCodes.validate('WELCOME20');
```

## Transaction Support

The billing adapter supports database transactions:

```typescript
import { withTransaction, createBillingAdapter } from '@repo/db';

await withTransaction(async (tx) => {
  // Create billing adapter with transaction
  const billingAdapter = createBillingAdapter(tx, { livemode: true });

  const qzpay = new QZPay({
    storage: billingAdapter,
    config: { currency: 'ARS' }
  });

  // All operations within this transaction
  const customer = await qzpay.customers.create({
    email: 'test@example.com'
  });

  const subscription = await qzpay.subscriptions.create({
    customerId: customer.id,
    planId: 'plan_basic'
  });

  // If any operation fails, entire transaction rolls back
});
```

## Schema Access

All billing schemas are exported and can be used for raw queries if needed:

```typescript
import {
  billingCustomers,
  billingSubscriptions,
  type QZPayBillingCustomer,
  type QZPayBillingSubscription
} from '@repo/db';
import { eq } from 'drizzle-orm';

// Raw query example (use sparingly - prefer QZPay API)
const customers = await db
  .select()
  .from(billingCustomers)
  .where(eq(billingCustomers.email, 'test@example.com'));
```

## Migration

The billing tables are managed by QZPay migrations. To create the billing schema:

1. Generate migration files:

```bash
pnpm db:generate
```

2. Review generated migrations in `drizzle/migrations/`

3. Apply migrations:

```bash
pnpm db:migrate
```

### Data Migration: Addon Purchases

If you need to migrate existing addon purchase data from `billing_subscriptions.metadata.addonAdjustments` to the new `billing_addon_purchases` table, use the migration script:

#### Dry Run (Recommended First)

Test the migration without making changes:

```bash
cd packages/db
pnpm exec tsx src/billing/migrate-addon-purchases.ts --dry-run
```

Add `--verbose` or `-v` for detailed logging:

```bash
pnpm exec tsx src/billing/migrate-addon-purchases.ts --dry-run --verbose
```

#### Execute Migration

After verifying the dry run results, execute the migration:

```bash
pnpm exec tsx src/billing/migrate-addon-purchases.ts
```

With verbose output:

```bash
pnpm exec tsx src/billing/migrate-addon-purchases.ts --verbose
```

#### Migration Features

The addon purchases migration script:

- ✅ **Idempotent**: Safe to re-run, skips already migrated records
- ✅ **Calculates expiration**: Sets `expires_at` based on addon `durationDays` configuration
- ✅ **Preserves data**: Original JSON data remains in subscription metadata
- ✅ **Tracks origin**: Adds `{ migratedFrom: 'subscription_metadata' }` to metadata
- ✅ **Error handling**: Continues on individual errors, reports at the end
- ✅ **Structured logging**: Uses `@repo/logger` for consistent log format

#### Migration Output

The script provides detailed statistics:

```
============================================================
Migration Complete
============================================================
Subscriptions processed: 125
Addon adjustments found: 89
Addon purchases migrated: 89
Addon purchases skipped (duplicates): 0
Errors: 0
============================================================
```

## Testing

For testing, use test mode:

```typescript
const billingAdapter = createBillingAdapter(db, {
  livemode: false // Test mode
});
```

Test mode ensures:

- Separate data isolation
- No real payment processing
- Sandbox payment gateway connections

## Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/hospeda

# QZPay Configuration
QZPAY_LIVE_MODE=false
QZPAY_CURRENCY=ARS
QZPAY_LOCALE=es-AR
QZPAY_TIMEZONE=America/Argentina/Buenos_Aires

# Payment Gateways (example)
MERCADO_PAGO_ACCESS_TOKEN=your_access_token
MERCADO_PAGO_PUBLIC_KEY=your_public_key
```

## Best Practices

1. **Always initialize database first**: Call `initializeDb()` before creating billing adapter
2. **Use transactions for multi-step operations**: Wrap related operations in `withTransaction()`
3. **Use test mode in development**: Set `livemode: false` for safe testing
4. **Leverage QZPay API**: Prefer QZPay methods over raw database queries
5. **Handle errors gracefully**: Wrap billing operations in try-catch blocks
6. **Validate inputs**: Use Zod schemas for input validation
7. **Monitor webhook events**: Set up webhook handlers for billing events
8. **Test payment flows**: Test full payment flows in staging before production

## Troubleshooting

### Database not initialized error

```
Error: Database not initialized. Call initializeDb() before using database operations.
```

**Solution**: Call `initializeDb(pool)` before creating billing adapter

### Type compatibility issues

If you encounter type errors with the database connection:

```typescript
// The adapter handles type casting internally
const adapter = createBillingAdapter(db as any, config);
```

### Migration issues

If migrations fail:

1. Check database connection
2. Verify migration files in `drizzle/migrations/`
3. Run migrations manually: `pnpm db:migrate`
4. Check for schema conflicts with existing tables

## API Reference

See complete API documentation:

- **QZPay Core**: [@qazuor/qzpay-core](https://github.com/qazuor/qzpay)
- **Drizzle Adapter**: [@qazuor/qzpay-drizzle](https://github.com/qazuor/qzpay/tree/main/packages/drizzle)

## Support

For issues related to:

- **QZPay library**: Open issue on [qzpay repository](https://github.com/qazuor/qzpay/issues)
- **Hospeda integration**: Contact Hospeda development team
- **Database issues**: Check Drizzle ORM documentation

## License

QZPay is licensed under the MIT License.
