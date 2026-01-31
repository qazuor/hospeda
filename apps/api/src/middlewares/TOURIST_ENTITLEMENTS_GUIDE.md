# Tourist Entitlement Gating - Implementation Guide

This guide documents the tourist entitlement gating system and explains where each middleware should be applied in the API routes.

## Overview

The tourist entitlement system gates premium features based on subscription plans:

- **Free Plan**: Basic features (3 favorites, write/read reviews)
- **Plus Plan**: Enhanced features (20 favorites, alerts, comparator, early access, exclusive deals, no ads, direct contact)
- **VIP Plan**: All features (unlimited favorites, recommendations, review photos, concierge service, airport transfers, VIP promotions)

## Middleware Functions

All middleware functions are exported from `apps/api/src/middlewares/tourist-entitlements.ts`.

### 1. `gateFavorites()`

**Feature**: Save accommodations as favorites
**Entitlement**: `SAVE_FAVORITES`
**Limit**: `max_favorites` (Free: 3, Plus: 20, VIP: unlimited)

**Usage Requirements**:

- Must set `currentFavoritesCount` in context before middleware runs
- Route handler should query current favorites count for the user

**Example**:

```typescript
import { gateFavorites } from '../middlewares/tourist-entitlements';

app.post('/favorites', entitlementMiddleware(), async (c) => {
  // Get actor
  const actor = getActorFromContext(c);

  // Count current favorites
  const favoritesService = new FavoritesService();
  const count = await favoritesService.count(actor);

  // Set in context for middleware
  c.set('currentFavoritesCount', count);

  // Apply gate
  const gateMiddleware = gateFavorites();
  await gateMiddleware(c, async () => {
    // Create favorite
    const result = await favoritesService.create(actor, { accommodationId });
    return c.json(result);
  });
});
```

**Alternative pattern** (recommended):

```typescript
app.post(
  '/favorites',
  entitlementMiddleware(),
  gateFavorites(), // Will check limit set in context
  async (c) => {
    // In handler, count is already validated
    const result = await favoritesService.create(actor, { accommodationId });
    return c.json(result);
  }
);
```

**Routes to apply**:

- `POST /api/v1/tourists/favorites` - Add favorite
- Any route that creates a new favorite

---

### 2. `gateAlerts()`

**Feature**: Price alerts for accommodations
**Entitlement**: `PRICE_ALERTS`
**Limit**: `max_active_alerts` (Plus: 3, VIP: unlimited)

**Note**: Requires new limit key `max_active_alerts` to be added to `@repo/billing`.

**Usage Requirements**:

- Must set `currentActiveAlertsCount` in context before middleware runs

**Example**:

```typescript
import { gateAlerts } from '../middlewares/tourist-entitlements';

app.post(
  '/alerts',
  entitlementMiddleware(),
  async (c) => {
    // Count active alerts first
    const actor = getActorFromContext(c);
    const alertService = new AlertService();
    const activeCount = await alertService.countActive(actor);

    // Set in context
    c.set('currentActiveAlertsCount', activeCount);

    // Apply gate
    const gate = gateAlerts();
    await gate(c, async () => {
      const result = await alertService.create(actor, alertData);
      return c.json(result);
    });
  }
);
```

**Routes to apply**:

- `POST /api/v1/tourists/alerts` - Create price alert
- `PATCH /api/v1/tourists/alerts/:id/activate` - Reactivate alert

---

### 3. `gateComparator()`

**Feature**: Compare multiple accommodations side-by-side
**Entitlement**: `can_compare_accommodations` (NEW - needs to be added)
**Limit**: `max_compare_items` (Plus: 3, VIP: unlimited)

**Note**: Requires new entitlement `can_compare_accommodations` and limit `max_compare_items` to be added to `@repo/billing`.

**Usage Requirements**:

- Must set `currentCompareItemsCount` in context before middleware runs

**Example**:

```typescript
import { gateComparator } from '../middlewares/tourist-entitlements';

app.post(
  '/compare',
  entitlementMiddleware(),
  async (c) => {
    const actor = getActorFromContext(c);
    const compareService = new CompareService();
    const currentCount = await compareService.countItems(actor);

    c.set('currentCompareItemsCount', currentCount);

    const gate = gateComparator();
    await gate(c, async () => {
      const result = await compareService.addItem(actor, { accommodationId });
      return c.json(result);
    });
  }
);
```

**Routes to apply**:

- `POST /api/v1/tourists/compare` - Add accommodation to comparison
- `GET /api/v1/tourists/compare` - Get comparison (check entitlement only)

---

### 4. `gateReviewPhotos()`

**Feature**: Attach photos to reviews
**Entitlement**: `can_attach_review_photos` (NEW - VIP only)

**Note**: Requires new entitlement `can_attach_review_photos` to be added to `@repo/billing`.

**Example**:

```typescript
import { gateReviewPhotos } from '../middlewares/tourist-entitlements';

app.post(
  '/reviews/:id/photos',
  entitlementMiddleware(),
  gateReviewPhotos(),
  async (c) => {
    // User has VIP plan - allow photo upload
    const reviewId = c.req.param('id');
    const file = await c.req.parseBody();

    const result = await reviewService.addPhoto(actor, { reviewId, file });
    return c.json(result);
  }
);
```

**Routes to apply**:

- `POST /api/v1/reviews/:id/photos` - Upload photo to review
- `POST /api/v1/reviews` with photos in body (check if photos are included)

---

### 5. `gateSearchHistory()`

**Feature**: View search history
**Entitlement**: `can_view_search_history` (NEW - Plus/VIP)

**Note**: Requires new entitlement `can_view_search_history` to be added to `@repo/billing`.

**Example**:

```typescript
import { gateSearchHistory } from '../middlewares/tourist-entitlements';

app.get(
  '/search-history',
  entitlementMiddleware(),
  gateSearchHistory(),
  async (c) => {
    const actor = getActorFromContext(c);
    const searchService = new SearchService();
    const history = await searchService.getHistory(actor);

    return c.json(history);
  }
);
```

**Routes to apply**:

- `GET /api/v1/tourists/search-history` - View search history

---

### 6. `gateRecommendations()`

**Feature**: Personalized accommodation recommendations
**Entitlement**: `can_view_recommendations` (NEW - VIP only)

**Note**: Requires new entitlement `can_view_recommendations` to be added to `@repo/billing`.

**Example**:

```typescript
import { gateRecommendations } from '../middlewares/tourist-entitlements';

app.get(
  '/recommendations',
  entitlementMiddleware(),
  gateRecommendations(),
  async (c) => {
    const actor = getActorFromContext(c);
    const recommendationService = new RecommendationService();
    const recommendations = await recommendationService.getForUser(actor);

    return c.json(recommendations);
  }
);
```

**Routes to apply**:

- `GET /api/v1/tourists/recommendations` - Get personalized recommendations

---

### 7. `gateExclusiveDeals()`

**Feature**: View exclusive deals
**Entitlement**: `EXCLUSIVE_DEALS` (VIP only)

**Example**:

```typescript
import { gateExclusiveDeals } from '../middlewares/tourist-entitlements';

app.get(
  '/deals/exclusive',
  entitlementMiddleware(),
  gateExclusiveDeals(),
  async (c) => {
    const dealService = new DealService();
    const deals = await dealService.getExclusive();

    return c.json(deals);
  }
);
```

**Routes to apply**:

- `GET /api/v1/deals/exclusive` - List exclusive deals
- `GET /api/v1/deals/:id` - View specific exclusive deal (check if deal is exclusive)

---

### 8. `gateEarlyEventAccess()`

**Feature**: Early access to event tickets (24h before public sale)
**Entitlement**: `EARLY_ACCESS_EVENTS` (Plus/VIP)

**Usage Requirements**:

- Must set `eventStartDate` in context before middleware runs
- Middleware validates 24-hour early access window

**Example**:

```typescript
import { gateEarlyEventAccess } from '../middlewares/tourist-entitlements';

app.post(
  '/events/:id/tickets',
  entitlementMiddleware(),
  async (c) => {
    const eventId = c.req.param('id');
    const eventService = new EventService();

    // Get event details
    const event = await eventService.getById(eventId);

    // Set event start date for gate validation
    c.set('eventStartDate', event.publicSaleStart);

    // Apply gate
    const gate = gateEarlyEventAccess();
    await gate(c, async () => {
      // Create ticket purchase
      const result = await eventService.purchaseTicket(actor, { eventId });
      return c.json(result);
    });
  }
);
```

**Routes to apply**:

- `POST /api/v1/events/:id/tickets` - Purchase event ticket (during early access window)

---

### 9. `gateDirectContact()`

**Feature**: View direct contact information (email/phone)
**Entitlement**: `can_contact_email_direct` (NEW - Plus/VIP)

**Note**: Requires new entitlement `can_contact_email_direct` to be added to `@repo/billing`.

**Example**:

```typescript
import { gateDirectContact } from '../middlewares/tourist-entitlements';

app.get(
  '/accommodations/:id/contact',
  entitlementMiddleware(),
  gateDirectContact(),
  async (c) => {
    const accommodationId = c.req.param('id');
    const accommodationService = new AccommodationService();
    const contact = await accommodationService.getContactInfo(accommodationId);

    return c.json(contact);
  }
);
```

**Routes to apply**:

- `GET /api/v1/accommodations/:id/contact` - Get direct contact info
- `GET /api/v1/accommodations/:id` - Filter contact from response if user lacks entitlement (use content filter)

---

## Content Filtering

The `tourist-entitlement-filter.ts` utility provides functions to filter response content based on entitlements.

### `filterContentForTourist(c, content, options)`

**Purpose**: Automatically filter content based on user's plan

**Example**:

```typescript
import { filterContentForTourist } from '../utils/tourist-entitlement-filter';

app.get('/accommodations', entitlementMiddleware(), async (c) => {
  const results = await accommodationService.search(query);

  // Filter based on user's plan
  const filtered = filterContentForTourist(c, results, {
    filterAds: true,              // Remove ads if user has AD_FREE
    filterDirectContact: true,     // Hide contact if user lacks entitlement
    filterExclusiveDeals: true     // Hide exclusive deals if user lacks entitlement
  });

  return c.json(filtered);
});
```

### `shouldShowAds(c)`

**Purpose**: Check if ads should be shown

**Example**:

```typescript
import { shouldShowAds } from '../utils/tourist-entitlement-filter';

app.get('/content', entitlementMiddleware(), async (c) => {
  const content = await getContent();

  if (shouldShowAds(c)) {
    content.ads = await getAds();
  }

  return c.json(content);
});
```

### `canViewExclusiveDeals(c)`

**Purpose**: Check if user can view exclusive deals

**Example**:

```typescript
import { canViewExclusiveDeals } from '../utils/tourist-entitlement-filter';

app.get('/deals', entitlementMiddleware(), async (c) => {
  let deals = await dealService.getAll();

  if (!canViewExclusiveDeals(c)) {
    deals = deals.filter(d => !d.isExclusive);
  }

  return c.json(deals);
});
```

### `canViewDirectContact(c)`

**Purpose**: Check if user can view direct contact info

**Example**:

```typescript
import { canViewDirectContact } from '../utils/tourist-entitlement-filter';

app.get('/accommodations/:id', entitlementMiddleware(), async (c) => {
  const accommodation = await accommodationService.getById(id);

  if (!canViewDirectContact(c)) {
    delete accommodation.contactEmail;
    delete accommodation.contactPhone;
  }

  return c.json(accommodation);
});
```

---

## Route Structure Recommendations

### Tourist Routes (`/api/v1/tourists/*`)

```
/api/v1/tourists/
├── favorites
│   ├── GET  /             - List favorites (SAVE_FAVORITES)
│   ├── POST /             - Add favorite (SAVE_FAVORITES + gateFavorites)
│   └── DELETE /:id        - Remove favorite (SAVE_FAVORITES)
├── alerts
│   ├── GET  /             - List alerts (PRICE_ALERTS)
│   ├── POST /             - Create alert (PRICE_ALERTS + gateAlerts)
│   ├── PATCH /:id         - Update alert (PRICE_ALERTS)
│   └── DELETE /:id        - Delete alert (PRICE_ALERTS)
├── compare
│   ├── GET  /             - Get comparison (can_compare_accommodations)
│   ├── POST /             - Add to comparison (can_compare_accommodations + gateComparator)
│   └── DELETE /:id        - Remove from comparison (can_compare_accommodations)
├── search-history
│   └── GET  /             - View history (can_view_search_history + gateSearchHistory)
└── recommendations
    └── GET  /             - Get recommendations (can_view_recommendations + gateRecommendations)
```

### Review Routes (`/api/v1/reviews/*`)

```
/api/v1/reviews/
├── GET  /                 - List reviews (READ_REVIEWS)
├── POST /                 - Create review (WRITE_REVIEWS)
├── GET  /:id              - Get review (READ_REVIEWS)
├── PATCH /:id             - Update review (WRITE_REVIEWS)
├── DELETE /:id            - Delete review (WRITE_REVIEWS)
└── photos
    └── POST /:id/photos   - Add photo (WRITE_REVIEWS + gateReviewPhotos)
```

### Accommodation Routes (`/api/v1/accommodations/*`)

```
/api/v1/accommodations/
├── GET  /                 - List (public, filter content)
├── GET  /:id              - Get details (public, filter contact/deals)
└── contact
    └── GET /:id/contact   - Get contact (can_contact_email_direct + gateDirectContact)
```

### Event Routes (`/api/v1/events/*`)

```
/api/v1/events/
├── GET  /                 - List events (public)
├── GET  /:id              - Get event (public)
└── tickets
    └── POST /:id/tickets  - Purchase (EARLY_ACCESS_EVENTS + gateEarlyEventAccess)
```

### Deal Routes (`/api/v1/deals/*`)

```
/api/v1/deals/
├── GET  /                 - List all deals (filter exclusive)
├── GET  /exclusive        - Exclusive deals only (EXCLUSIVE_DEALS + gateExclusiveDeals)
└── GET  /:id              - Get deal (filter if exclusive)
```

---

## Required Updates to @repo/billing

The following entitlement keys and limit keys need to be added to the billing package:

### New Entitlement Keys

Add to `packages/billing/src/types/entitlement.types.ts`:

```typescript
export enum EntitlementKey {
  // ... existing keys ...

  /** NEW: Tourist feature entitlements */
  COMPARE_ACCOMMODATIONS = 'can_compare_accommodations',
  ATTACH_REVIEW_PHOTOS = 'can_attach_review_photos',
  VIEW_SEARCH_HISTORY = 'can_view_search_history',
  VIEW_RECOMMENDATIONS = 'can_view_recommendations',
  CONTACT_DIRECT = 'can_contact_email_direct',
}
```

### New Limit Keys

Add to `packages/billing/src/types/plan.types.ts`:

```typescript
export enum LimitKey {
  // ... existing keys ...

  /** NEW: Tourist feature limits */
  MAX_ACTIVE_ALERTS = 'max_active_alerts',
  MAX_COMPARE_ITEMS = 'max_compare_items',
}
```

### Update Plan Configurations

Add to `packages/billing/src/config/plans.config.ts`:

```typescript
// TOURIST_PLUS_PLAN
entitlements: [
  // ... existing ...
  EntitlementKey.COMPARE_ACCOMMODATIONS,
  EntitlementKey.VIEW_SEARCH_HISTORY,
  EntitlementKey.CONTACT_DIRECT,
],
limits: [
  limit(LimitKey.MAX_FAVORITES, 20),
  limit(LimitKey.MAX_ACTIVE_ALERTS, 3),
  limit(LimitKey.MAX_COMPARE_ITEMS, 3),
]

// TOURIST_VIP_PLAN
entitlements: [
  // ... existing ...
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

### Update Limit Metadata

Add to `packages/billing/src/config/limits.config.ts`:

```typescript
export const LIMIT_METADATA: Record<LimitKey, { name: string; description: string }> = {
  // ... existing ...

  [LimitKey.MAX_ACTIVE_ALERTS]: {
    name: 'Alertas activas',
    description: 'Numero maximo de alertas de precio activas simultaneamente'
  },
  [LimitKey.MAX_COMPARE_ITEMS]: {
    name: 'Items en comparador',
    description: 'Numero maximo de alojamientos en el comparador'
  },
};
```

### Update Entitlement Definitions

Add to `packages/billing/src/config/entitlements.config.ts`:

```typescript
export const ENTITLEMENT_DEFINITIONS: EntitlementDefinition[] = [
  // ... existing ...

  {
    key: EntitlementKey.COMPARE_ACCOMMODATIONS,
    name: 'Comparador de alojamientos',
    description: 'Permite comparar multiples alojamientos lado a lado'
  },
  {
    key: EntitlementKey.ATTACH_REVIEW_PHOTOS,
    name: 'Adjuntar fotos a resenas',
    description: 'Permite adjuntar fotos a las resenas de alojamientos'
  },
  {
    key: EntitlementKey.VIEW_SEARCH_HISTORY,
    name: 'Historial de busqueda',
    description: 'Acceso al historial de busquedas realizadas'
  },
  {
    key: EntitlementKey.VIEW_RECOMMENDATIONS,
    name: 'Recomendaciones personalizadas',
    description: 'Acceso a recomendaciones de alojamientos personalizadas'
  },
  {
    key: EntitlementKey.CONTACT_DIRECT,
    name: 'Contacto directo',
    description: 'Acceso a informacion de contacto directo de alojamientos'
  },
];
```

### Update Resource Names in limit-check.ts

Add to `apps/api/src/utils/limit-check.ts`:

```typescript
const RESOURCE_NAMES: Record<LimitKey, string> = {
  // ... existing ...
  max_active_alerts: 'alertas activas',
  max_compare_items: 'items en el comparador',
};
```

---

## Testing Recommendations

### Unit Tests

Test each middleware function:

```typescript
describe('Tourist Entitlement Gates', () => {
  describe('gateFavorites', () => {
    it('should allow user with SAVE_FAVORITES entitlement', async () => {
      // Test implementation
    });

    it('should deny user without SAVE_FAVORITES entitlement', async () => {
      // Test implementation
    });

    it('should deny when favorites limit reached', async () => {
      // Test implementation
    });
  });

  // ... more tests for each gate
});
```

### Integration Tests

Test complete flows with different plan levels:

```typescript
describe('Tourist Feature Access', () => {
  it('Free plan: can add up to 3 favorites', async () => {
    // Test implementation
  });

  it('Plus plan: can create up to 3 alerts', async () => {
    // Test implementation
  });

  it('VIP plan: has unlimited favorites', async () => {
    // Test implementation
  });
});
```

---

## Error Response Format

All gates return consistent error responses:

### Entitlement Required

```json
{
  "success": false,
  "error": {
    "code": "ENTITLEMENT_REQUIRED",
    "message": "Tu plan no incluye esta funcionalidad. Actualiza tu plan para acceder.",
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
    "message": "Has alcanzado el límite de 3 favoritos. Actualiza tu plan para obtener más.",
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

---

## Summary

This implementation provides comprehensive entitlement gating for all tourist features across the Free, Plus, and VIP plans. The middleware functions are reusable, follow consistent patterns, and provide clear error messages to guide users to upgrade their plans.

**Next Steps**:

1. Add missing entitlement and limit keys to `@repo/billing`
2. Apply middleware to appropriate routes
3. Implement content filtering in list/detail endpoints
4. Write comprehensive tests
5. Update API documentation
