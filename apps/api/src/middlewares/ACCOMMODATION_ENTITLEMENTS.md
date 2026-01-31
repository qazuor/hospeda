# Accommodation Entitlement Gating - Implementation Guide

This document describes how to apply accommodation entitlement middlewares to relevant API routes.

## Overview

The accommodation entitlement system gates premium features based on user subscription plans:

- **Free Plan**: Basic accommodation listing
- **Pro Plan**: Rich descriptions, calendar, WhatsApp display, review responses, promotions
- **Premium Plan**: All Pro features + video embeds, external calendar sync, WhatsApp direct links, verification badge, highlighted review responses

## Available Middlewares

### 1. `gateRichDescription()`

**Entitlement**: `CAN_USE_RICH_DESCRIPTION` (Pro+)
**Behavior**: Strips markdown from description if user lacks entitlement
**Apply to**:

- `POST /accommodations` (create)
- `PUT /accommodations/:id` (update)
- `PATCH /accommodations/:id` (partial update)

### 2. `gateVideoEmbed()`

**Entitlement**: `CAN_EMBED_VIDEO` (Premium)
**Behavior**: Strips video URLs from description and media if user lacks entitlement
**Apply to**:

- `POST /accommodations` (create)
- `PUT /accommodations/:id` (update)
- `PATCH /accommodations/:id` (partial update)

### 3. `gateCalendarAccess()`

**Entitlement**: `CAN_USE_CALENDAR` (Pro+)
**Behavior**: Returns 403 if user lacks entitlement
**Apply to**:

- `GET /accommodations/:id/calendar` (view calendar)
- `POST /accommodations/:id/calendar/availability` (set availability)
- `PUT /accommodations/:id/calendar/availability/:dateId` (update availability)

### 4. `gateExternalCalendarSync()`

**Entitlement**: `CAN_SYNC_EXTERNAL_CALENDAR` (Premium)
**Behavior**: Returns 403 if user lacks entitlement
**Apply to**:

- `POST /accommodations/:id/calendar/sync` (sync external calendar)
- `GET /accommodations/:id/calendar/sync/status` (sync status)
- `DELETE /accommodations/:id/calendar/sync` (disconnect sync)

### 5. `gateWhatsAppDisplay()`

**Entitlement**: `CAN_CONTACT_WHATSAPP_DISPLAY` (Pro+)
**Behavior**: Returns 403 if user tries to add WhatsApp number
**Apply to**:

- `POST /accommodations` (create with WhatsApp)
- `PUT /accommodations/:id` (update with WhatsApp)
- `PATCH /accommodations/:id` (partial update with WhatsApp)

### 6. `gateWhatsAppDirect()`

**Entitlement**: `CAN_CONTACT_WHATSAPP_DIRECT` (Premium)
**Behavior**: Returns 403 if user tries to enable direct WhatsApp link
**Apply to**:

- `POST /accommodations` (create with direct link)
- `PUT /accommodations/:id` (update with direct link)
- `PATCH /accommodations/:id` (partial update with direct link)

### 7. `gateReviewResponse()`

**Entitlement**: `RESPOND_REVIEWS` (Pro+)
**Behavior**: Returns 403 if user lacks entitlement
**Apply to**:

- `POST /accommodations/:id/reviews/:reviewId/response` (create response)
- `PUT /accommodations/:id/reviews/:reviewId/response` (update response)
- `DELETE /accommodations/:id/reviews/:reviewId/response` (delete response)

## Filtering Utilities

### `filterAccommodationByEntitlements(c, accommodation)`

Filters accommodation data based on viewer's entitlements. Use in:

- `GET /accommodations/:id` (single accommodation view)
- `GET /accommodations/:id/details` (detailed view)

### `filterAccommodationListByEntitlements(c, accommodations)`

Filters a list of accommodations. Use in:

- `GET /accommodations` (list all)
- `GET /accommodations/search` (search results)
- `GET /accommodations/featured` (featured listings)

## Implementation Examples

### Example 1: Accommodation Create Route

```typescript
// apps/api/src/routes/accommodation/create.ts
import {
  gateRichDescription,
  gateVideoEmbed,
  gateWhatsAppDisplay,
  gateWhatsAppDirect
} from '../../middlewares/accommodation-entitlements';

export const createAccommodationRoute = createCRUDRoute({
  method: 'post',
  path: '/',
  summary: 'Create accommodation',
  requestBody: AccommodationCreateInputSchema,
  responseSchema: AccommodationSchema,
  handler: async (ctx, _params, body) => {
    const actor = getActorFromContext(ctx);
    const result = await accommodationService.create(actor, body);
    return result.data;
  },
  options: {
    middlewares: [
      enforceAccommodationLimit(),
      gateRichDescription(),
      gateVideoEmbed(),
      gateWhatsAppDisplay(),
      gateWhatsAppDirect()
    ]
  }
});
```

### Example 2: Accommodation Update Route

```typescript
// apps/api/src/routes/accommodation/update.ts
import {
  gateRichDescription,
  gateVideoEmbed,
  gateWhatsAppDisplay,
  gateWhatsAppDirect
} from '../../middlewares/accommodation-entitlements';

export const updateAccommodationRoute = createCRUDRoute({
  method: 'put',
  path: '/:id',
  summary: 'Update accommodation',
  requestParams: { id: z.string().uuid() },
  requestBody: AccommodationUpdateInputSchema,
  responseSchema: AccommodationSchema,
  handler: async (ctx, params, body) => {
    const actor = getActorFromContext(ctx);
    const result = await accommodationService.update(actor, params.id, body);
    return result.data;
  },
  options: {
    middlewares: [
      gateRichDescription(),
      gateVideoEmbed(),
      gateWhatsAppDisplay(),
      gateWhatsAppDirect()
    ]
  }
});
```

### Example 3: Calendar Routes

```typescript
// apps/api/src/routes/accommodation/calendar/index.ts
import { gateCalendarAccess } from '../../../middlewares/accommodation-entitlements';

export const getCalendarRoute = createOpenApiRoute({
  method: 'get',
  path: '/:id/calendar',
  summary: 'Get accommodation calendar',
  requestParams: { id: z.string().uuid() },
  responseSchema: CalendarSchema,
  handler: async (ctx, params) => {
    const actor = getActorFromContext(ctx);
    const result = await calendarService.getCalendar(actor, params.id);
    return result.data;
  },
  options: {
    middlewares: [gateCalendarAccess()]
  }
});
```

### Example 4: External Calendar Sync

```typescript
// apps/api/src/routes/accommodation/calendar/sync.ts
import { gateExternalCalendarSync } from '../../../middlewares/accommodation-entitlements';

export const syncCalendarRoute = createOpenApiRoute({
  method: 'post',
  path: '/:id/calendar/sync',
  summary: 'Sync external calendar',
  requestParams: { id: z.string().uuid() },
  requestBody: CalendarSyncInputSchema,
  responseSchema: CalendarSyncResponseSchema,
  handler: async (ctx, params, body) => {
    const actor = getActorFromContext(ctx);
    const result = await calendarService.syncExternal(actor, params.id, body);
    return result.data;
  },
  options: {
    middlewares: [gateExternalCalendarSync()]
  }
});
```

### Example 5: Review Response

```typescript
// apps/api/src/routes/accommodation/reviews/response.ts
import { gateReviewResponse } from '../../../middlewares/accommodation-entitlements';

export const createReviewResponseRoute = createOpenApiRoute({
  method: 'post',
  path: '/:id/reviews/:reviewId/response',
  summary: 'Respond to review',
  requestParams: {
    id: z.string().uuid(),
    reviewId: z.string().uuid()
  },
  requestBody: ReviewResponseInputSchema,
  responseSchema: ReviewResponseSchema,
  handler: async (ctx, params, body) => {
    const actor = getActorFromContext(ctx);
    const result = await reviewService.createResponse(actor, params.reviewId, body);
    return result.data;
  },
  options: {
    middlewares: [gateReviewResponse()]
  }
});
```

### Example 6: Filtered List View

```typescript
// apps/api/src/routes/accommodation/list.ts
import { filterAccommodationListByEntitlements } from '../../utils/entitlement-filter';

export const listAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/',
  summary: 'List accommodations',
  querySchema: searchAccommodationSchema,
  responseSchema: z.array(AccommodationSchema),
  handler: async (ctx, params, body, query) => {
    const actor = getActorFromContext(ctx);
    const result = await accommodationService.findAll(actor, query);

    // Filter based on viewer's entitlements
    const filtered = filterAccommodationListByEntitlements(ctx, result.data);

    return {
      data: filtered,
      pagination: result.pagination
    };
  },
  options: {
    skipAuth: true // Public listing
  }
});
```

### Example 7: Filtered Detail View

```typescript
// apps/api/src/routes/accommodation/getById.ts
import { filterAccommodationByEntitlements } from '../../utils/entitlement-filter';

export const getAccommodationRoute = createOpenApiRoute({
  method: 'get',
  path: '/:id',
  summary: 'Get accommodation by ID',
  requestParams: { id: z.string().uuid() },
  responseSchema: AccommodationSchema,
  handler: async (ctx, params) => {
    const actor = getActorFromContext(ctx);
    const result = await accommodationService.getById(actor, params.id);

    // Filter based on viewer's entitlements
    const filtered = filterAccommodationByEntitlements(ctx, result.data);

    return filtered;
  },
  options: {
    skipAuth: true // Public view
  }
});
```

## Route Application Checklist

### Creation/Update Routes (Apply Content Gating)

- [ ] `POST /accommodations` - Add gateRichDescription, gateVideoEmbed, gateWhatsAppDisplay, gateWhatsAppDirect
- [ ] `PUT /accommodations/:id` - Add gateRichDescription, gateVideoEmbed, gateWhatsAppDisplay, gateWhatsAppDirect
- [ ] `PATCH /accommodations/:id` - Add gateRichDescription, gateVideoEmbed, gateWhatsAppDisplay, gateWhatsAppDirect

### Calendar Routes (Apply Feature Access)

- [ ] `GET /accommodations/:id/calendar` - Add gateCalendarAccess
- [ ] `POST /accommodations/:id/calendar/availability` - Add gateCalendarAccess
- [ ] `PUT /accommodations/:id/calendar/availability/:dateId` - Add gateCalendarAccess

### External Calendar Sync Routes (Premium Only)

- [ ] `POST /accommodations/:id/calendar/sync` - Add gateExternalCalendarSync
- [ ] `GET /accommodations/:id/calendar/sync/status` - Add gateExternalCalendarSync
- [ ] `DELETE /accommodations/:id/calendar/sync` - Add gateExternalCalendarSync

### Review Response Routes (Pro+ Only)

- [ ] `POST /accommodations/:id/reviews/:reviewId/response` - Add gateReviewResponse
- [ ] `PUT /accommodations/:id/reviews/:reviewId/response` - Add gateReviewResponse
- [ ] `DELETE /accommodations/:id/reviews/:reviewId/response` - Add gateReviewResponse

### View Routes (Apply Content Filtering)

- [ ] `GET /accommodations` - Add filterAccommodationListByEntitlements
- [ ] `GET /accommodations/:id` - Add filterAccommodationByEntitlements
- [ ] `GET /accommodations/search` - Add filterAccommodationListByEntitlements
- [ ] `GET /accommodations/featured` - Add filterAccommodationListByEntitlements

## Testing

### Test Scenarios

1. **Free Plan User**:
   - Cannot use rich description (markdown stripped)
   - Cannot embed videos (video content removed)
   - Cannot access calendar features (403)
   - Cannot add WhatsApp number (403)
   - Cannot respond to reviews (403)

2. **Pro Plan User**:
   - Can use rich description
   - Cannot embed videos (video content removed)
   - Can access calendar features
   - Can add WhatsApp number (display only)
   - Can respond to reviews

3. **Premium Plan User**:
   - Can use rich description
   - Can embed videos
   - Can access calendar features
   - Can sync external calendars
   - Can add WhatsApp number with direct link
   - Can respond to reviews with highlighting
   - Has verification badge

### Example Test

```typescript
describe('Accommodation Entitlement Gating', () => {
  it('should strip markdown for Free plan users', async () => {
    const freeUser = createMockActor({ plan: 'free' });

    const response = await app.request('/accommodations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Hotel',
        description: '**Bold text** and *italic* with [link](url)'
      }),
      headers: { Authorization: `Bearer ${freeUser.token}` }
    });

    const data = await response.json();
    expect(data.data.description).toBe('Bold text and italic with link');
  });

  it('should allow calendar access for Pro plan users', async () => {
    const proUser = createMockActor({ plan: 'pro' });

    const response = await app.request('/accommodations/123/calendar', {
      method: 'GET',
      headers: { Authorization: `Bearer ${proUser.token}` }
    });

    expect(response.status).toBe(200);
  });

  it('should block external calendar sync for non-Premium users', async () => {
    const proUser = createMockActor({ plan: 'pro' });

    const response = await app.request('/accommodations/123/calendar/sync', {
      method: 'POST',
      body: JSON.stringify({ provider: 'google' }),
      headers: { Authorization: `Bearer ${proUser.token}` }
    });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error.code).toBe('ENTITLEMENT_REQUIRED');
  });
});
```

## Notes

- All middlewares should be applied AFTER `entitlementMiddleware()` which loads user entitlements
- Middleware order matters: apply content-stripping middlewares (rich description, video) before content-blocking middlewares (WhatsApp, calendar)
- Use filtering utilities in public routes to hide premium content from non-entitled viewers
- Always provide helpful upgrade prompts in error messages
- Log all entitlement checks for analytics and debugging
