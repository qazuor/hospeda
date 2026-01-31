# Tourist Entitlement Gating - Implementation Summary

This document summarizes the implementation of tourist entitlement gating for the Hospeda API (Task T-045).

## What Was Implemented

### 1. Tourist Entitlement Middleware (`src/middlewares/tourist-entitlements.ts`)

Created 9 middleware functions to gate tourist features by subscription plan:

#### `gateFavorites()`

- **Feature**: Save accommodations as favorites
- **Entitlement**: `SAVE_FAVORITES` (all plans)
- **Limit**: `max_favorites` (Free: 3, Plus: 20, VIP: unlimited)
- **Context Required**: `currentFavoritesCount`

#### `gateAlerts()`

- **Feature**: Price alerts for accommodations
- **Entitlement**: `PRICE_ALERTS` (Plus/VIP)
- **Limit**: `max_active_alerts` (Plus: 3, VIP: unlimited)
- **Context Required**: `currentActiveAlertsCount`
- **Note**: Requires new limit key in billing package

#### `gateComparator()`

- **Feature**: Compare accommodations side-by-side
- **Entitlement**: `can_compare_accommodations` (Plus/VIP)
- **Limit**: `max_compare_items` (Plus: 3, VIP: unlimited)
- **Context Required**: `currentCompareItemsCount`
- **Note**: Requires new entitlement and limit in billing package

#### `gateReviewPhotos()`

- **Feature**: Attach photos to reviews
- **Entitlement**: `can_attach_review_photos` (VIP only)
- **Note**: Requires new entitlement in billing package

#### `gateSearchHistory()`

- **Feature**: View search history
- **Entitlement**: `can_view_search_history` (Plus/VIP)
- **Note**: Requires new entitlement in billing package

#### `gateRecommendations()`

- **Feature**: Personalized recommendations
- **Entitlement**: `can_view_recommendations` (VIP only)
- **Note**: Requires new entitlement in billing package

#### `gateExclusiveDeals()`

- **Feature**: View exclusive deals
- **Entitlement**: `EXCLUSIVE_DEALS` (VIP only)
- **Uses existing entitlement**

#### `gateEarlyEventAccess()`

- **Feature**: Early event access (24h before public)
- **Entitlement**: `EARLY_ACCESS_EVENTS` (Plus/VIP)
- **Context Required**: `eventStartDate`
- **Validates**: 24-hour early access window

#### `gateDirectContact()`

- **Feature**: View direct contact info (email/phone)
- **Entitlement**: `can_contact_email_direct` (Plus/VIP)
- **Note**: Requires new entitlement in billing package

### 2. Content Filter Utility (`src/utils/tourist-entitlement-filter.ts`)

Created utility functions to filter API responses based on entitlements:

#### `filterContentForTourist(c, content, options)`

- Automatically filters content based on user's plan
- Options: `filterAds`, `filterExclusiveDeals`, `filterDirectContact`
- Removes ads for `AD_FREE` users
- Hides exclusive deals for non-VIP users
- Hides contact info for users without direct contact entitlement

#### Helper Functions

- `removeAds(content)` - Remove ad objects from responses
- `hideExclusiveDeals(content)` - Remove exclusive deal information
- `hideDirectContactInfo(content)` - Remove email/phone from responses
- `shouldShowAds(c)` - Check if ads should be shown
- `canViewExclusiveDeals(c)` - Check if user can view exclusive deals
- `canViewDirectContact(c)` - Check if user can view contact info

### 3. Updated Limit Check Utility (`src/utils/limit-check.ts`)

Added Spanish resource names for new limit keys:

- `max_active_alerts`: 'alertas activas'
- `max_compare_items`: 'items en el comparador'

### 4. Implementation Guide (`src/middlewares/TOURIST_ENTITLEMENTS_GUIDE.md`)

Comprehensive guide documenting:

- Where to apply each middleware
- Usage examples with code snippets
- Route structure recommendations
- Required updates to billing package
- Testing recommendations
- Error response formats

## Feature Matrix by Plan

| Feature | Free | Plus | VIP |
|---------|------|------|-----|
| Favorites | 3 | 20 | Unlimited |
| Alerts | ❌ | 3 | Unlimited |
| Comparator | ❌ | 3 items | Unlimited |
| Review Photos | ❌ | ❌ | ✅ |
| Search History | ❌ | ✅ | ✅ |
| Recommendations | ❌ | ❌ | ✅ |
| Exclusive Deals | ❌ | ✅ | ✅ |
| Early Event Access | ❌ | ✅ (24h) | ✅ (24h) |
| Ad-Free | ❌ | ✅ | ✅ |
| Direct Contact | ❌ | ✅ | ✅ |

## Required Updates to @repo/billing

The following additions are needed in the billing package:

### New Entitlement Keys (in `types/entitlement.types.ts`)

```typescript
COMPARE_ACCOMMODATIONS = 'can_compare_accommodations',
ATTACH_REVIEW_PHOTOS = 'can_attach_review_photos',
VIEW_SEARCH_HISTORY = 'can_view_search_history',
VIEW_RECOMMENDATIONS = 'can_view_recommendations',
CONTACT_DIRECT = 'can_contact_email_direct',
```

### New Limit Keys (in `types/plan.types.ts`)

```typescript
MAX_ACTIVE_ALERTS = 'max_active_alerts',
MAX_COMPARE_ITEMS = 'max_compare_items',
```

### Plan Configuration Updates (in `config/plans.config.ts`)

**TOURIST_PLUS_PLAN**:

```typescript
entitlements: [
  // existing...
  EntitlementKey.COMPARE_ACCOMMODATIONS,
  EntitlementKey.VIEW_SEARCH_HISTORY,
  EntitlementKey.CONTACT_DIRECT,
],
limits: [
  limit(LimitKey.MAX_FAVORITES, 20),
  limit(LimitKey.MAX_ACTIVE_ALERTS, 3),
  limit(LimitKey.MAX_COMPARE_ITEMS, 3),
]
```

**TOURIST_VIP_PLAN**:

```typescript
entitlements: [
  // existing...
  EntitlementKey.COMPARE_ACCOMMODATIONS,
  EntitlementKey.ATTACH_REVIEW_PHOTOS,
  EntitlementKey.VIEW_SEARCH_HISTORY,
  EntitlementKey.VIEW_RECOMMENDATIONS,
  EntitlementKey.CONTACT_DIRECT,
],
limits: [
  limit(LimitKey.MAX_FAVORITES, -1),      // unlimited
  limit(LimitKey.MAX_ACTIVE_ALERTS, -1),  // unlimited
  limit(LimitKey.MAX_COMPARE_ITEMS, -1),  // unlimited
]
```

### Entitlement Definitions (in `config/entitlements.config.ts`)

Add definitions for the 5 new entitlement keys with Spanish names and descriptions.

### Limit Metadata (in `config/limits.config.ts`)

Add metadata for the 2 new limit keys.

## Usage Patterns

### 1. Middleware Pattern (for creation endpoints)

```typescript
app.post(
  '/favorites',
  entitlementMiddleware(),
  gateFavorites(),  // Checks entitlement + limit
  async (c) => {
    // Proceed with creation
  }
);
```

### 2. Content Filtering Pattern (for list/detail endpoints)

```typescript
app.get('/accommodations', entitlementMiddleware(), async (c) => {
  const results = await accommodationService.search(query);

  // Filter based on user's plan
  const filtered = filterContentForTourist(c, results, {
    filterAds: true,
    filterDirectContact: true,
    filterExclusiveDeals: true
  });

  return c.json(filtered);
});
```

### 3. Conditional Access Pattern (for gated resources)

```typescript
app.get(
  '/recommendations',
  entitlementMiddleware(),
  gateRecommendations(),  // VIP only
  async (c) => {
    // Proceed to show recommendations
  }
);
```

## Error Responses

### Entitlement Required

```json
{
  "success": false,
  "error": {
    "code": "ENTITLEMENT_REQUIRED",
    "message": "Tu plan no incluye esta funcionalidad...",
    "details": {
      "entitlement": "can_compare_accommodations",
      "upgradeUrl": "/billing/plans"
    }
  }
}
```

### Limit Reached

```json
{
  "success": false,
  "error": {
    "code": "LIMIT_REACHED",
    "message": "Has alcanzado el límite de 3 favoritos...",
    "details": {
      "limitKey": "max_favorites",
      "currentCount": 3,
      "maxAllowed": 3,
      "remaining": 0,
      "upgradeUrl": "/billing/plans"
    }
  }
}
```

## Files Created

1. `apps/api/src/middlewares/tourist-entitlements.ts` - Middleware functions
2. `apps/api/src/utils/tourist-entitlement-filter.ts` - Content filtering utilities
3. `apps/api/src/middlewares/TOURIST_ENTITLEMENTS_GUIDE.md` - Implementation guide
4. `apps/api/TOURIST_ENTITLEMENTS_IMPLEMENTATION.md` - This summary

## Files Modified

1. `apps/api/src/utils/limit-check.ts` - Added new resource names

## Next Steps

1. **Update Billing Package**: Add new entitlement and limit keys
2. **Apply Middleware**: Add gates to appropriate API routes
3. **Implement Content Filtering**: Apply filters to list/detail endpoints
4. **Write Tests**: Unit and integration tests for all gates
5. **Update API Documentation**: Document entitlement requirements per endpoint
6. **Frontend Integration**: Update frontend to handle entitlement errors and show upgrade prompts

## Notes

- All middleware uses existing `entitlementMiddleware()` and `hasEntitlement()` helpers
- All middleware follows the pattern from `limit-enforcement.ts`
- Error messages are in Spanish as per project guidelines
- All code comments and JSDoc are in English
- Uses named exports only (RO-RO pattern)
- Type-safe with TypeScript strict mode
- Comprehensive JSDoc documentation included

## Testing Recommendations

### Unit Tests

- Test each gate function with different entitlements
- Test limit checks with different counts
- Test content filtering with different plan levels

### Integration Tests

- Test complete flows for Free/Plus/VIP users
- Test upgrade prompts when limits reached
- Test early access window validation
- Test content filtering in real responses

### E2E Tests

- Test user journey from Free → Plus → VIP
- Test feature access at each plan level
- Test upgrade flows triggered by entitlement gates
