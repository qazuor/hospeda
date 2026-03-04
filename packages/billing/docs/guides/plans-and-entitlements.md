# Plans and Entitlements

## Plan Categories

Hospeda has three plan categories targeting different user types:

| Category | Target User | Plans | Trial |
|----------|-------------|-------|-------|
| `owner` | Individual property owners | Basico, Pro, Premium | 14 days |
| `complex` | Hotels and complexes | Basico, Pro, Premium | 14 days |
| `tourist` | Travelers and guests | Free, Plus, VIP | No trial |

Each category has exactly one **default plan** assigned automatically to new users:

- Owner: `owner-basico`
- Complex: `complex-basico`
- Tourist: `tourist-free`

## Owner Plans

| Feature | Basico | Pro | Premium |
|---------|--------|-----|---------|
| **Slug** | `owner-basico` | `owner-pro` | `owner-premium` |
| **Monthly (ARS)** | $15,000 | $35,000 | $75,000 |
| **Annual (ARS)** | $150,000 | $350,000 | $750,000 |
| **USD Ref** | $15 | $35 | $75 |
| Max accommodations | 1 | 3 | 10 |
| Max photos/accommodation | 5 | 15 | 30 |
| Max active promotions | 0 | 3 | Unlimited |
| Basic stats | Yes | Yes | Yes |
| Advanced stats | - | Yes | Yes |
| Featured listing | - | Yes | Yes |
| Custom branding | - | - | Yes |
| API access | - | - | Yes |
| Dedicated manager | - | - | Yes |
| Verification badge | - | - | Yes |
| Rich description | - | Yes | Yes |
| Video embed | - | Yes | Yes |
| Calendar | Yes | Yes | Yes |
| External calendar sync | - | Yes | Yes |
| WhatsApp display | Yes | Yes | Yes |
| WhatsApp direct | - | Yes | Yes |

## Complex Plans

| Feature | Basico | Pro | Premium |
|---------|--------|-----|---------|
| **Slug** | `complex-basico` | `complex-pro` | `complex-premium` |
| **Monthly (ARS)** | $50,000 | $100,000 | $200,000 |
| **Annual (ARS)** | $500,000 | $1,000,000 | $2,000,000 |
| **USD Ref** | $50 | $100 | $200 |
| Max properties | 3 | 10 | Unlimited |
| Max photos/accommodation | 10 | 20 | 50 |
| Max staff accounts | 2 | 5 | Unlimited |
| Max active promotions | 0 | 5 | Unlimited |
| Multi-property management | Yes | Yes | Yes |
| Consolidated analytics | - | Yes | Yes |
| Centralized booking | - | Yes | Yes |
| Staff management | - | Yes | Yes |
| White label | - | - | Yes |
| Multi-channel integration | - | - | Yes |

Complex plans include all applicable owner entitlements plus complex-specific features.

## Tourist Plans

| Feature | Free | Plus | VIP |
|---------|------|------|-----|
| **Slug** | `tourist-free` | `tourist-plus` | `tourist-vip` |
| **Monthly (ARS)** | $0 | $5,000 | $15,000 |
| **Annual (ARS)** | - | $50,000 | $150,000 |
| **USD Ref** | $0 | $5 | $15 |
| Max favorites | 3 | 20 | Unlimited |
| Save favorites | Yes | Yes | Yes |
| Write reviews | Yes | Yes | Yes |
| Read reviews | Yes | Yes | Yes |
| Recommendations | Yes | Yes | Yes |
| Ad-free | - | Yes | Yes |
| Price alerts | - | Yes | Yes |
| Early event access | - | Yes | Yes |
| Exclusive deals | - | Yes | Yes |
| Compare accommodations | - | Yes | Yes |
| Attach review photos | - | Yes | Yes |
| Search history | - | Yes | Yes |
| WhatsApp display | - | Yes | Yes |
| WhatsApp direct | - | - | Yes |
| VIP support | - | - | Yes |
| Concierge service | - | - | Yes |
| Airport transfers | - | - | Yes |
| VIP promotions | - | - | Yes |

## Entitlement System

Entitlements are feature flags defined in the `EntitlementKey` enum. Each plan includes a set of entitlement keys that determine what features the user can access.

### How entitlements work

1. Plans define an array of `EntitlementKey` values
2. At runtime, the API checks if the user's active plan includes the required entitlement
3. **Never check roles directly**.. always check entitlements via `EntitlementKey`

### Entitlement categories

**Owner entitlements** (12 keys):
`PUBLISH_ACCOMMODATIONS`, `EDIT_ACCOMMODATION_INFO`, `VIEW_BASIC_STATS`, `VIEW_ADVANCED_STATS`, `RESPOND_REVIEWS`, `PRIORITY_SUPPORT`, `FEATURED_LISTING`, `CUSTOM_BRANDING`, `API_ACCESS`, `DEDICATED_MANAGER`, `CREATE_PROMOTIONS`, `SOCIAL_MEDIA_INTEGRATION`

**Accommodation feature entitlements** (7 keys):
`CAN_USE_RICH_DESCRIPTION`, `CAN_EMBED_VIDEO`, `CAN_USE_CALENDAR`, `CAN_SYNC_EXTERNAL_CALENDAR`, `CAN_CONTACT_WHATSAPP_DISPLAY`, `CAN_CONTACT_WHATSAPP_DIRECT`, `HAS_VERIFICATION_BADGE`

**Complex entitlements** (6 keys):
`MULTI_PROPERTY_MANAGEMENT`, `CONSOLIDATED_ANALYTICS`, `CENTRALIZED_BOOKING`, `STAFF_MANAGEMENT`, `WHITE_LABEL`, `MULTI_CHANNEL_INTEGRATION`

**Tourist entitlements** (15 keys):
`SAVE_FAVORITES`, `WRITE_REVIEWS`, `READ_REVIEWS`, `AD_FREE`, `PRICE_ALERTS`, `EARLY_ACCESS_EVENTS`, `EXCLUSIVE_DEALS`, `VIP_SUPPORT`, `CONCIERGE_SERVICE`, `AIRPORT_TRANSFERS`, `VIP_PROMOTIONS_ACCESS`, `CAN_COMPARE_ACCOMMODATIONS`, `CAN_ATTACH_REVIEW_PHOTOS`, `CAN_VIEW_SEARCH_HISTORY`, `CAN_VIEW_RECOMMENDATIONS`

### Usage example

```typescript
import { EntitlementKey } from '@repo/billing';

// In a middleware or service
function checkEntitlement({
    userEntitlements,
    required
}: {
    userEntitlements: readonly EntitlementKey[];
    required: EntitlementKey;
}): boolean {
    return userEntitlements.includes(required);
}

// Check if user can publish
const canPublish = checkEntitlement({
    userEntitlements: userPlan.entitlements,
    required: EntitlementKey.PUBLISH_ACCOMMODATIONS
});
```

## Limit System

Limits are numeric constraints that vary by plan. They are defined using the `LimitKey` enum.

| Limit Key | Description | Used By |
|-----------|-------------|---------|
| `MAX_ACCOMMODATIONS` | Max published accommodations | Owner plans |
| `MAX_PHOTOS_PER_ACCOMMODATION` | Max photos per listing | Owner + Complex |
| `MAX_ACTIVE_PROMOTIONS` | Max simultaneous promotions | Owner + Complex |
| `MAX_FAVORITES` | Max saved favorites | Tourist plans |
| `MAX_PROPERTIES` | Max properties in complex | Complex plans |
| `MAX_STAFF_ACCOUNTS` | Max staff accounts | Complex plans |

A value of `-1` means **unlimited** (used in premium tiers).

Limits can be increased with recurring add-ons. See [Add-on Management](./addon-management.md).

## Pricing Notes

- All prices are in **ARS centavos** (divide by 100 for display). Example: `1500000` = ARS $15,000.
- Annual pricing includes a discount (typically 2 months free for owner plans, varies by category).
- USD reference prices are for informational display only and are not used for billing.
- `tourist-free` has `annualPriceArs: null` since there is no annual option for free plans.
