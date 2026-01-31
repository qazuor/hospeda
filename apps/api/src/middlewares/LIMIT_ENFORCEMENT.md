# Limit Enforcement Middleware

## Overview

This module provides middleware for enforcing plan limits on resource creation. The middleware checks current usage against plan limits and returns 403 with upgrade prompts when limits are reached.

## Available Middleware

### 1. `enforceAccommodationLimit()`

Enforces `max_accommodations` limit before creating accommodations.

**Usage:**

```typescript
import { enforceAccommodationLimit } from '../middlewares/limit-enforcement';

export const createAccommodationRoute = createCRUDRoute({
  method: 'post',
  path: '/',
  // ... other config
  options: {
    middlewares: [enforceAccommodationLimit()]
  }
});
```

**Current Integration:**

- ✅ `apps/api/src/routes/accommodation/create.ts`

---

### 2. `enforcePhotoLimit()`

Enforces `max_photos_per_accommodation` limit before uploading photos.

**Important:** This middleware expects `accommodationId` to be available in route params (e.g., `/accommodations/:id/photos`).

**Usage:**

```typescript
import { enforcePhotoLimit } from '../middlewares/limit-enforcement';

export const uploadPhotoRoute = createOpenApiRoute({
  method: 'post',
  path: '/:id/photos',
  // ... other config
  options: {
    middlewares: [enforcePhotoLimit()]
  }
});
```

**Current Integration:**

- ⏳ **TO DO**: Photo upload routes not yet implemented
- **Expected routes:**
  - `POST /accommodations/:id/photos` - Upload new photo
  - `POST /accommodations/:id/photos/batch` - Batch photo upload

---

### 3. `enforcePromotionLimit()`

Enforces `max_active_promotions` limit before creating promotions.

**Usage:**

```typescript
import { enforcePromotionLimit } from '../middlewares/limit-enforcement';

export const createPromotionRoute = createProtectedRoute({
  method: 'post',
  path: '/',
  // ... other config
  options: {
    middlewares: [enforcePromotionLimit()]
  }
});
```

**Current Integration:**

- ✅ `apps/api/src/routes/owner-promotion/create.ts`

---

## Response Format

When a limit is reached, the middleware returns a 403 response with this format:

```json
{
  "success": false,
  "error": {
    "code": "LIMIT_REACHED",
    "message": "Has alcanzado el límite de {maxAllowed} {resource}. Actualiza tu plan para obtener más.",
    "details": {
      "limitKey": "max_accommodations",
      "currentCount": 5,
      "maxAllowed": 5,
      "upgradeUrl": "/billing/plans"
    }
  }
}
```

## How It Works

1. **Extract Actor**: Gets authenticated user from context
2. **Count Current Usage**: Calls service to count user's current resources
3. **Get Plan Limit**: Retrieves limit from user's entitlements (via `getRemainingLimit()`)
4. **Check Limit**: Compares current count with plan limit using `checkLimit()`
5. **Allow or Block**:
   - If `allowed = true`: Continues to next middleware/handler
   - If `allowed = false`: Returns 403 with upgrade message

## Dependencies

### Required Middleware (must run before)

1. **Authentication**: `requireAuth` or equivalent
2. **Actor Resolution**: `actorMiddleware()`
3. **Billing Customer**: `billingCustomerMiddleware()`
4. **Entitlements**: `entitlementMiddleware()`

### Services Used

- `AccommodationService` - For counting accommodations
- `OwnerPromotionService` - For counting active promotions
- Photo service (when implemented) - For counting photos

## Error Handling

The middleware is designed to be resilient:

- **Count failures**: Logs error and continues (doesn't block)
- **Service errors**: Logs error and continues
- **HTTP exceptions**: Re-throws to be handled by error middleware
- **Unexpected errors**: Logs and continues

## Testing

Example test structure:

```typescript
describe('enforceAccommodationLimit', () => {
  it('should allow creation when under limit', async () => {
    // Mock: User has 3 accommodations, limit is 5
    // Expect: Request proceeds
  });

  it('should block creation when at limit', async () => {
    // Mock: User has 5 accommodations, limit is 5
    // Expect: 403 response with upgrade message
  });

  it('should allow unlimited when limit is -1', async () => {
    // Mock: User has 100 accommodations, limit is -1
    // Expect: Request proceeds
  });

  it('should block when feature disabled (limit = 0)', async () => {
    // Mock: Limit is 0
    // Expect: 403 response with feature unavailable message
  });
});
```

## Future Enhancements

### Additional Limits to Implement

Based on `LimitKey` enum in `packages/billing/src/types/plan.types.ts`:

- ⏳ `max_favorites` - For tourist favorite lists
- ⏳ `max_properties` - For complex property management
- ⏳ `max_staff_accounts` - For staff account creation

### Enhancement Ideas

1. **Soft Warnings**: Return warning header when approaching limit (e.g., 80% used)
2. **Batch Operations**: Handle limit checks for batch creation endpoints
3. **Grace Period**: Allow X% overage for premium users
4. **Analytics**: Track limit enforcement events for business insights

## Related Files

- `apps/api/src/utils/limit-check.ts` - Core limit checking logic
- `apps/api/src/middlewares/entitlement.ts` - Loads user entitlements and limits
- `packages/billing/src/config/limits.config.ts` - Limit definitions
- `packages/billing/src/types/plan.types.ts` - LimitKey enum
