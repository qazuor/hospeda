# Tourist Entitlements - Quick Reference

## Import

```typescript
import {
  gateFavorites,
  gateAlerts,
  gateComparator,
  gateReviewPhotos,
  gateSearchHistory,
  gateRecommendations,
  gateExclusiveDeals,
  gateEarlyEventAccess,
  gateDirectContact
} from '../middlewares/tourist-entitlements';

import {
  filterContentForTourist,
  shouldShowAds,
  canViewExclusiveDeals,
  canViewDirectContact
} from '../utils/tourist-entitlement-filter';
```

## Middleware Cheat Sheet

| Middleware | Entitlement | Limit | Plans | Context Required |
|------------|-------------|-------|-------|------------------|
| `gateFavorites()` | `SAVE_FAVORITES` | `max_favorites` (3/20/∞) | All | `currentFavoritesCount` |
| `gateAlerts()` | `PRICE_ALERTS` | `max_active_alerts` (0/3/∞) | Plus/VIP | `currentActiveAlertsCount` |
| `gateComparator()` | `can_compare_accommodations` | `max_compare_items` (0/3/∞) | Plus/VIP | `currentCompareItemsCount` |
| `gateReviewPhotos()` | `can_attach_review_photos` | - | VIP | - |
| `gateSearchHistory()` | `can_view_search_history` | - | Plus/VIP | - |
| `gateRecommendations()` | `can_view_recommendations` | - | VIP | - |
| `gateExclusiveDeals()` | `EXCLUSIVE_DEALS` | - | VIP | - |
| `gateEarlyEventAccess()` | `EARLY_ACCESS_EVENTS` | - | Plus/VIP | `eventStartDate` |
| `gateDirectContact()` | `can_contact_email_direct` | - | Plus/VIP | - |

## Quick Examples

### Simple Gate (No Limit)

```typescript
app.get(
  '/recommendations',
  entitlementMiddleware(),
  gateRecommendations(),
  async (c) => {
    // User has VIP plan
    const recommendations = await service.get();
    return c.json(recommendations);
  }
);
```

### Gate with Limit

```typescript
app.post('/favorites', entitlementMiddleware(), async (c) => {
  const actor = getActorFromContext(c);

  // Count current favorites
  const count = await favoritesService.count(actor);
  c.set('currentFavoritesCount', count);

  // Apply gate
  const gate = gateFavorites();
  return gate(c, async () => {
    const result = await favoritesService.create(actor, data);
    return c.json(result);
  });
});
```

### Content Filtering

```typescript
app.get('/accommodations', entitlementMiddleware(), async (c) => {
  const results = await service.search(query);

  // Auto-filter based on user's plan
  const filtered = filterContentForTourist(c, results, {
    filterAds: true,
    filterDirectContact: true,
    filterExclusiveDeals: true
  });

  return c.json(filtered);
});
```

### Manual Filtering

```typescript
app.get('/content', entitlementMiddleware(), async (c) => {
  const content = await getContent();

  // Add ads only for Free plan users
  if (shouldShowAds(c)) {
    content.ads = await getAds();
  }

  // Show contact if user has entitlement
  if (canViewDirectContact(c)) {
    content.contactInfo = await getContact();
  }

  return c.json(content);
});
```

### Early Access with Time Window

```typescript
app.post('/events/:id/tickets', entitlementMiddleware(), async (c) => {
  const event = await eventService.getById(c.req.param('id'));

  // Set event date for validation
  c.set('eventStartDate', event.publicSaleStart);

  const gate = gateEarlyEventAccess();
  return gate(c, async () => {
    // User can purchase during early access window
    const result = await eventService.purchaseTicket(actor, eventId);
    return c.json(result);
  });
});
```

## Routes to Apply

### Creation Endpoints (POST)

- `/favorites` → `gateFavorites()`
- `/alerts` → `gateAlerts()`
- `/compare` → `gateComparator()`
- `/reviews/:id/photos` → `gateReviewPhotos()`
- `/events/:id/tickets` → `gateEarlyEventAccess()`

### View Endpoints (GET)

- `/search-history` → `gateSearchHistory()`
- `/recommendations` → `gateRecommendations()`
- `/deals/exclusive` → `gateExclusiveDeals()`
- `/accommodations/:id/contact` → `gateDirectContact()`

### List Endpoints with Filtering

- `/accommodations` → `filterContentForTourist()`
- `/deals` → `canViewExclusiveDeals()`
- `/content` → `shouldShowAds()`

## Error Codes

- `ENTITLEMENT_REQUIRED` - User lacks required entitlement
- `LIMIT_REACHED` - User has reached plan limit
- `EARLY_ACCESS_NOT_STARTED` - Event early access hasn't started yet

## Common Patterns

### Pattern 1: Direct Middleware Application

```typescript
app.post('/resource', entitlementMiddleware(), gateMiddleware(), handler);
```

### Pattern 2: With Context Setup

```typescript
app.post('/resource', entitlementMiddleware(), async (c) => {
  c.set('contextKey', value);
  const gate = gateMiddleware();
  return gate(c, handler);
});
```

### Pattern 3: Conditional Logic

```typescript
app.get('/resource', entitlementMiddleware(), async (c) => {
  const data = await service.get();

  if (canViewExclusiveDeals(c)) {
    data.exclusiveDeals = await getExclusiveDeals();
  }

  return c.json(data);
});
```

## Plan Limits Reference

| Feature | Free | Plus | VIP |
|---------|------|------|-----|
| Favorites | 3 | 20 | ∞ |
| Alerts | - | 3 | ∞ |
| Compare | - | 3 | ∞ |

Legend: ∞ = unlimited, - = not available
