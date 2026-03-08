# @repo/billing

Billing configuration and types package for the Hospeda platform.

## Overview

This package provides the core billing configuration for Hospeda's monetization system, including:

- **9 Plan Definitions** (3 owner plans, 3 complex plans, 3 tourist plans)
- **31 Entitlement Keys** (feature flags)
- **6 Limit Keys** (numeric limits like max accommodations, photos, etc.)
- **5 Add-on Definitions** (one-time and recurring add-ons)
- **3 Default Promo Codes**
- **Billing Constants** (trial days, grace periods, etc.)
- **Payment Adapter Configuration** (MercadoPago integration)

## Installation

This is a workspace package and should not be published to npm.

```bash
pnpm install
```

## Usage

### Import Plan Definitions

```typescript
import { ALL_PLANS, PLANS_BY_CATEGORY, getPlanBySlug, getDefaultPlan } from '@repo/billing';

// Get all plans
const allPlans = ALL_PLANS;

// Get plans by category
const ownerPlans = PLANS_BY_CATEGORY.owner;
const complexPlans = PLANS_BY_CATEGORY.complex;
const touristPlans = PLANS_BY_CATEGORY.tourist;

// Get specific plan by slug
const basicPlan = getPlanBySlug('owner-basico');

// Get default plan for a category
const defaultOwnerPlan = getDefaultPlan('owner');
```

### Import Entitlements

```typescript
import { EntitlementKey, ENTITLEMENT_DEFINITIONS } from '@repo/billing';

// Use entitlement keys
const canPublish = user.hasEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS);

// Get all entitlement definitions
const allEntitlements = ENTITLEMENT_DEFINITIONS;
```

### Import Add-ons

```typescript
import { ALL_ADDONS, getAddonBySlug } from '@repo/billing';

// Get all add-ons
const addons = ALL_ADDONS;

// Get specific add-on
const visibilityBoost = getAddonBySlug('visibility-boost-7d');
```

### Import Promo Codes

```typescript
import { DEFAULT_PROMO_CODES, HOSPEDA_FREE_CODE } from '@repo/billing';

// Get all default promo codes
const promoCodes = DEFAULT_PROMO_CODES;

// Use specific promo code
const freeCode = HOSPEDA_FREE_CODE;
```

### Import Constants

```typescript
import {
    OWNER_TRIAL_DAYS,
    COMPLEX_TRIAL_DAYS,
    DEFAULT_CURRENCY,
    REFERENCE_CURRENCY
} from '@repo/billing';

console.log(`Trial period: ${OWNER_TRIAL_DAYS} days`);
console.log(`Currency: ${DEFAULT_CURRENCY}`);
```

### Payment Adapter (MercadoPago)

```typescript
import { createMercadoPagoAdapter, getDefaultCurrency, getDefaultCountry } from '@repo/billing';

// Create adapter using environment variables (recommended)
const mpAdapter = createMercadoPagoAdapter();

// Or with custom configuration
const mpAdapter = createMercadoPagoAdapter({
  accessToken: 'TEST-your-access-token',
  sandbox: true,
  timeout: 10000,
  webhookSecret: 'your-webhook-secret',
  retry: {
    enabled: true,
    maxAttempts: 5,
    initialDelayMs: 2000
  }
});

// Use with QZPayBilling
import { QZPayBilling } from '@qazuor/qzpay-core';
import { createDrizzleAdapter } from '@qazuor/qzpay-drizzle';

const billing = new QZPayBilling({
  storage: createDrizzleAdapter({ db }),
  paymentAdapter: mpAdapter
});

// Get default values
const currency = getDefaultCurrency(); // 'ARS'
const country = getDefaultCountry();   // 'AR'
```

#### Environment Variables

Required environment variables for MercadoPago:

```env
# Required
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-your-access-token

# Optional
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=your-webhook-secret
HOSPEDA_MERCADO_PAGO_SANDBOX=true                # default: true
HOSPEDA_MERCADO_PAGO_TIMEOUT=5000                # default: 5000ms
HOSPEDA_MERCADO_PAGO_PLATFORM_ID=                # optional
HOSPEDA_MERCADO_PAGO_INTEGRATOR_ID=              # optional
```

**Important Notes:**

- Access token must start with `TEST-` (sandbox) or `APP_USR-` (production)
- Sandbox mode must match token type (TEST- for sandbox=true, APP_USR- for sandbox=false)
- Default currency is ARS (Argentine Peso)
- Default country is AR (Argentina)
- Retry is enabled by default with 3 attempts and exponential backoff

## Plan Structure

Each plan includes:

- **Metadata**: slug, name, description, category
- **Pricing**: monthly/annual prices in ARS cents, USD reference price
- **Trial**: whether trial is available and duration
- **Entitlements**: array of feature keys
- **Limits**: array of numeric limits
- **Status**: isActive, isDefault, sortOrder

## Plan Categories

### Owner Plans

1. **owner-basico** - ARS $15,000/month - 1 accommodation, 5 photos
2. **owner-pro** - ARS $35,000/month - 3 accommodations, 15 photos, featured listing
3. **owner-premium** - ARS $75,000/month - 10 accommodations, 30 photos, API access

### Complex Plans

1. **complex-basico** - ARS $50,000/month - 3 properties, 10 photos
2. **complex-pro** - ARS $100,000/month - 10 properties, 20 photos, analytics
3. **complex-premium** - ARS $200,000/month - Unlimited properties, 50 photos, white label

### Tourist Plans

1. **tourist-free** - Free - 3 favorites, basic features
2. **tourist-plus** - ARS $5,000/month - 20 favorites, no ads, price alerts
3. **tourist-vip** - ARS $15,000/month - Unlimited favorites, concierge service

## Entitlements

Entitlements are feature flags that enable/disable functionality:

- Owner: publish accommodations, view stats, respond to reviews, etc.
- Complex: multi-property management, consolidated analytics, staff management
- Tourist: save favorites, write reviews, ad-free experience, VIP support

## Limits

Numeric limits that vary by plan:

- `MAX_ACCOMMODATIONS` - Maximum number of accommodations
- `MAX_PHOTOS_PER_ACCOMMODATION` - Maximum photos per accommodation
- `MAX_ACTIVE_PROMOTIONS` - Maximum active promotions
- `MAX_FAVORITES` - Maximum saved favorites (tourist plans)
- `MAX_PROPERTIES` - Maximum properties (complex plans)
- `MAX_STAFF_ACCOUNTS` - Maximum staff accounts (complex plans)

Value of `-1` means unlimited.

## Add-ons

### One-time Add-ons

- **visibility-boost-7d** - ARS $5,000 - Featured listing for 7 days
- **visibility-boost-30d** - ARS $15,000 - Featured listing for 30 days

### Recurring Add-ons

- **extra-photos-20** - ARS $5,000/month - +20 photos per accommodation
- **extra-accommodations-5** - ARS $10,000/month - +5 accommodations (owner)
- **extra-properties-5** - ARS $20,000/month - +5 properties (complex)

## Promo Codes

Default promo codes included:

- **HOSPEDA_FREE** - 100% discount, permanent (internal use)
- **LANZAMIENTO50** - 50% discount for 3 months (first 100 users)
- **BIENVENIDO30** - 30% discount for 1 month (first 500 users)

## Development

```bash
# Build the package
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

## Notes

- All prices are in ARS cents (divide by 100 for display)
- USD prices are reference only for display purposes
- MercadoPago adapter is configured for Argentina (ARS currency)
- Types are defined in TypeScript, no Zod schemas needed for config
- All exports use named exports (no default exports)

## Payment Integration

This package now includes MercadoPago payment adapter configuration:

- Factory function for creating configured MercadoPago adapter
- Environment-based configuration with sensible defaults
- Sandbox/production mode validation
- Retry configuration for transient errors
- Argentina-specific defaults (ARS currency, AR country)

## Related Documentation

- [Billing Documentation](../../docs/billing/README.md)
- [ADR-005: MercadoPago Payments](../../docs/decisions/ADR-005-mercadopago-payments.md)

## License

Private - Not for distribution
