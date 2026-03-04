# Add-on Management

## Overview

Add-ons allow users to extend their plan capabilities beyond the base limits. There are two billing types:

- **One-time** .. Purchased once, active for a fixed duration (e.g., visibility boost)
- **Recurring** .. Billed monthly/annually, active as long as the subscription is maintained

## Available Add-ons

### One-time Add-ons

| Add-on | Slug | Price (ARS) | Duration | Effect |
|--------|------|-------------|----------|--------|
| Visibility Boost (7d) | `visibility-boost-7d` | $5,000 | 7 days | Grants `FEATURED_LISTING` entitlement |
| Visibility Boost (30d) | `visibility-boost-30d` | $15,000 | 30 days | Grants `FEATURED_LISTING` entitlement |

Both visibility boost add-ons target `owner` and `complex` categories.

### Recurring Add-ons

| Add-on | Slug | Monthly (ARS) | Annual (ARS) | Limit Affected | Increase | Target |
|--------|------|---------------|--------------|----------------|----------|--------|
| Extra Photos (+20) | `extra-photos-20` | $5,000 | $48,000 | `MAX_PHOTOS_PER_ACCOMMODATION` | +20 | Owner, Complex |
| Extra Accommodations (+5) | `extra-accommodations-5` | $10,000 | $96,000 | `MAX_ACCOMMODATIONS` | +5 | Owner only |
| Extra Properties (+5) | `extra-properties-5` | $20,000 | $192,000 | `MAX_PROPERTIES` | +5 | Complex only |

Recurring add-ons offer a ~20% discount on annual billing.

## Add-on Definition Interface

```typescript
import type { AddonDefinition } from '@repo/billing';

// Each add-on has these fields:
interface AddonDefinition {
    slug: string;                        // Unique identifier
    name: string;                        // Display name
    description: string;                 // Description
    billingType: 'one_time' | 'recurring';
    priceArs: number;                    // Price in ARS centavos
    annualPriceArs: number | null;       // Annual price (null for one-time)
    durationDays: number | null;         // Duration (null for recurring)
    affectsLimitKey: LimitKey | null;    // Which limit this increases
    limitIncrease: number | null;        // How much to add
    grantsEntitlement: EntitlementKey | null; // Entitlement granted
    targetCategories: PlanCategory[];    // Who can buy this
    isActive: boolean;
    sortOrder: number;
}
```

## Usage

### List all add-ons

```typescript
import { ALL_ADDONS } from '@repo/billing';

// Returns array of all 5 AddonDefinition objects
const addons = ALL_ADDONS;
```

### Lookup by slug

```typescript
import { getAddonBySlug } from '@repo/billing';

const boost = getAddonBySlug('visibility-boost-7d');
if (boost) {
    console.log(`${boost.name}: ARS $${boost.priceArs / 100}`);
}
```

### Filter by category

```typescript
import { ALL_ADDONS } from '@repo/billing';

// Get add-ons available for owner plans
const ownerAddons = ALL_ADDONS.filter(
    (addon) => addon.targetCategories.includes('owner')
);
// Returns: visibility-boost-7d, visibility-boost-30d, extra-photos-20, extra-accommodations-5
```

## How Limit Increases Work

When a user purchases a recurring add-on that affects a limit:

1. The add-on's `limitIncrease` value is added to the plan's base limit
2. Multiple add-ons of the same type stack (e.g., two `extra-photos-20` gives +40 photos)
3. The effective limit is: `plan.limit + sum(addon.limitIncrease for active addons)`

Example: Owner Pro plan (15 photos base) + `extra-photos-20` = 35 photos per accommodation.

## How Entitlement Grants Work

One-time add-ons can grant entitlements temporarily:

1. Purchasing `visibility-boost-7d` grants `FEATURED_LISTING` for 7 days
2. The entitlement is active alongside the plan's existing entitlements
3. When the duration expires, the entitlement is removed (unless the plan already includes it)

## Target Category Restrictions

Add-ons are restricted to specific plan categories:

- `extra-accommodations-5` .. Owner only (complex uses properties, not accommodations)
- `extra-properties-5` .. Complex only
- All other add-ons .. Both owner and complex
- No tourist add-ons exist currently
