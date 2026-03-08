# Quick Start

## Installation

`@repo/billing` is a workspace package. It is available to all apps and packages in the monorepo without publishing.

```bash
# Already available via pnpm workspaces. Add to your package.json if needed:
"@repo/billing": "workspace:*"
```

## Environment Variables

The billing package requires MercadoPago credentials when using the payment adapter. These are not needed if you only import plan definitions or constants.

```env
# Required for payment adapter
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-your-access-token

# Optional
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret
HOSPEDA_MERCADO_PAGO_SANDBOX=true                # default: true
HOSPEDA_MERCADO_PAGO_TIMEOUT=5000                # default: 5000ms
HOSPEDA_MERCADO_PAGO_PLATFORM_ID=               # marketplace tracking
HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID=             # integrator tracking
```

**Token format rules:**

- Sandbox tokens start with `TEST-`
- Production tokens start with `APP_USR-`
- Webhook secret is **required** in production mode (prevents forged webhooks)

## Basic Usage

### Import plan definitions

```typescript
import { ALL_PLANS, PLANS_BY_CATEGORY, getPlanBySlug, getDefaultPlan } from '@repo/billing';

// All 9 plans
const plans = ALL_PLANS;

// Plans by category
const ownerPlans = PLANS_BY_CATEGORY.owner;   // 3 plans
const complexPlans = PLANS_BY_CATEGORY.complex; // 3 plans
const touristPlans = PLANS_BY_CATEGORY.tourist; // 3 plans

// Lookup by slug
const plan = getPlanBySlug('owner-basico');

// Default plan for a category
const defaultOwner = getDefaultPlan('owner'); // owner-basico
```

### Check entitlements

```typescript
import { EntitlementKey } from '@repo/billing';

// Use entitlement keys for feature checks
const key = EntitlementKey.PUBLISH_ACCOMMODATIONS;
// Pass to your entitlement checking logic
```

### Import add-ons

```typescript
import { ALL_ADDONS, getAddonBySlug } from '@repo/billing';

const boost = getAddonBySlug('visibility-boost-7d');
```

### Import constants

```typescript
import {
    OWNER_TRIAL_DAYS,
    COMPLEX_TRIAL_DAYS,
    DEFAULT_CURRENCY,
    PAYMENT_GRACE_PERIOD_DAYS,
    DUNNING_GRACE_PERIOD_DAYS
} from '@repo/billing';
```

## Validation at Startup

Run billing config validation at API startup to catch misconfigurations early:

```typescript
import { validateBillingConfigOrThrow } from '@repo/billing';

// Throws if plans, addons, or promo codes have errors
// Logs warnings for non-critical issues (expired promos, etc.)
validateBillingConfigOrThrow();
```

Or use the non-throwing variant for custom handling:

```typescript
import { validateBillingConfig } from '@repo/billing';

const result = validateBillingConfig();
if (!result.valid) {
    logger.error('Billing config errors', { errors: result.errors });
}
if (result.warnings.length > 0) {
    logger.warn('Billing config warnings', { warnings: result.warnings });
}
```

## Config Drift Detection

Compare static config against database state to detect missing seeds or orphaned records:

```typescript
import {
    ALL_PLANS,
    ALL_ADDONS,
    EntitlementKey,
    LimitKey,
    checkConfigDrift,
    formatDriftReport
} from '@repo/billing';

const result = checkConfigDrift({
    plans: ALL_PLANS,
    addons: ALL_ADDONS,
    entitlementKeys: Object.values(EntitlementKey),
    limitKeys: Object.values(LimitKey),
    dbState: {
        planSlugs: await getPlanSlugsFromDb(),
        addonSlugs: await getAddonSlugsFromDb(),
        entitlementKeys: await getEntitlementKeysFromDb(),
        limitKeys: await getLimitKeysFromDb()
    }
});

console.log(formatDriftReport({ result }));
```

## Setting Up the Payment Adapter

```typescript
import { createMercadoPagoAdapter } from '@repo/billing';
import { QZPayBilling } from '@qazuor/qzpay-core';
import { createDrizzleAdapter } from '@qazuor/qzpay-drizzle';

// Create MercadoPago adapter (reads env vars automatically)
const paymentAdapter = createMercadoPagoAdapter();

// Create billing engine
const billing = new QZPayBilling({
    storage: createDrizzleAdapter({ db }),
    paymentAdapter
});
```

## Next Steps

- [Plans and Entitlements](./guides/plans-and-entitlements.md) .. Understand the plan tiers and feature system
- [MercadoPago Integration](./guides/mercadopago-integration.md) .. Detailed adapter configuration
- [Billing Constants](./api/billing-constants.md) .. Full reference of all constants
