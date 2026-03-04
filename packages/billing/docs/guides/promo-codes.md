# Promo Codes

## Overview

Promo codes provide percentage-based discounts on plan subscriptions. They are defined as static configuration in `@repo/billing` and seeded into the database.

## Default Promo Codes

| Code | Discount | Duration | Max Uses | Restriction | Active |
|------|----------|----------|----------|-------------|--------|
| `HOSPEDA_FREE` | 100% | Permanent | Unlimited | None | Yes |
| `LANZAMIENTO50` | 50% | 3 months | 100 | New users only | Yes |
| `BIENVENIDO30` | 30% | 1 month | 500 | New users only | Yes |

### HOSPEDA_FREE

Internal-use code that grants 100% permanent discount. Used for platform team accounts and special partnerships.

### LANZAMIENTO50

Launch promotion. 50% off for the first 3 billing cycles. Limited to 100 redemptions and restricted to new users.

### BIENVENIDO30

Welcome promotion. 30% off for the first billing cycle. Limited to 500 redemptions and restricted to new users.

## Promo Code Definition Interface

```typescript
import type { PromoCodeDefinition } from '@repo/billing';

interface PromoCodeDefinition {
    code: string;                      // Uppercase code string
    description: string;               // Description
    discountPercent: number;           // 0-100
    isPermanent: boolean;              // Permanent or time-limited
    durationCycles: number | null;     // Billing cycles (null = forever)
    maxRedemptions: number | null;     // Max uses (null = unlimited)
    expiresAt: Date | null;            // Expiry date (null = never)
    restrictedToPlans: string[] | null; // Plan slugs (null = all plans)
    newUserOnly: boolean;              // First-time users only
    isActive: boolean;
}
```

## Usage

### Import all promo codes

```typescript
import { DEFAULT_PROMO_CODES } from '@repo/billing';

// Array of 3 PromoCodeDefinition objects
const codes = DEFAULT_PROMO_CODES;
```

### Import specific codes

```typescript
import {
    HOSPEDA_FREE_CODE,
    LANZAMIENTO_50_CODE,
    BIENVENIDO_30_CODE
} from '@repo/billing';
```

## Promo Code Rules

### Discount calculation

The discount is applied as a percentage of the plan price:

```
discountedPrice = planPrice * (1 - discountPercent / 100)
```

### Duration behavior

- `isPermanent: true` .. Discount applies to all future billing cycles
- `isPermanent: false` with `durationCycles: N` .. Discount applies to the first N billing cycles, then full price resumes

### Redemption limits

- `maxRedemptions: null` .. No limit on how many users can redeem
- `maxRedemptions: N` .. After N total redemptions across all users, the code stops working

### Plan restrictions

- `restrictedToPlans: null` .. Code works with any plan
- `restrictedToPlans: ['owner-pro', 'owner-premium']` .. Code only works with specified plans

### Expiration

- `expiresAt: null` .. Code never expires
- `expiresAt: new Date('2026-06-30')` .. Code stops working after this date

## Validation

The billing config validator checks promo codes for:

- Duplicate codes
- Discount percentage in valid range (0-100)
- Plan slug references exist in the plan definitions
- Expired codes generate warnings (not errors)
