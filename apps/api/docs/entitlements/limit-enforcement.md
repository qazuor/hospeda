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

---

## Deferred Limits: Properties and Staff Accounts

Two billing limits are scaffolded with `count = 0` stubs in `apps/api/src/middlewares/limit-enforcement.ts`. This is intentional because the underlying features (complex accommodation rooms and staff accounts) do not exist yet in v1.

### Active Limits (working in v1)

| Limit Key | Middleware | Count Source | Status |
|-----------|-----------|--------------|--------|
| `MAX_ACCOMMODATIONS` | `enforceAccommodationLimit()` | `AccommodationService.count()` | Active - mounted on POST /protected/accommodations |
| `MAX_PHOTOS_PER_ACCOMMODATION` | `enforcePhotoLimit()` | Reads photo count from `media` JSONB (`gallery.length + featuredImage`) | Active - reads photo count from media JSONB |
| `MAX_ACTIVE_PROMOTIONS` | `enforcePromotionLimit()` | `OwnerPromotionService.count()` | Active - mounted on POST /protected/owner-promotions |
| `MAX_FAVORITES` | `enforceFavoritesLimit()` | `UserBookmarkService.countBookmarksForUser()` | Active - mounted on POST /protected/user-bookmarks |

### Stubbed Limits (deferred)

| Limit Key | Middleware | Current Count | Status |
|-----------|-----------|---------------|--------|
| `MAX_PROPERTIES` | `enforcePropertiesLimit()` | `0` (hardcoded) | Deferred - no rooms/complex feature exists |
| `MAX_STAFF_ACCOUNTS` | `enforceStaffAccountsLimit()` | `0` (hardcoded) | Deferred - no staff management feature exists |

Both middleware scaffolds are production-safe: since count is always 0, the limit check always passes, meaning no user is incorrectly blocked. The scaffolding ensures that when the features are built, the billing enforcement is already wired and only needs the count query replaced.

### Properties Limit (MAX_PROPERTIES)

Maximum number of rooms/units within a single **complex accommodation** (hotel, hostel, apartment building). This is NOT the same as the accommodation count limit (which is already enforced).

**Example**: A hotel owner on `complex-pro` plan can have up to 50 rooms. Each room is a sub-entity of the accommodation.

**Current Code** (`apps/api/src/middlewares/limit-enforcement.ts`, line 558):

```typescript
// FUTURE FEATURE: Complex accommodations (hotels/hostels) with room/unit management.
const currentPropertyCount = 0;
```

**What Needs to Be Implemented**:

1. **Database**: Create `accommodation_rooms` (or `accommodation_units`) table in `packages/db/src/schemas/` with fields: `id` (UUID PK), `accommodation_id` (FK), `name`, `type`, `capacity`, `status`, `deleted_at`, and standard audit fields.
2. **Service**: Create `AccommodationRoomService` in `packages/service-core/src/services/accommodation-room/` extending `BaseCrudService`. Implement `countByAccommodation({ accommodationId })` excluding soft-deleted records.
3. **Middleware update**: Replace the stub:

   ```typescript
   const roomService = new AccommodationRoomService({ logger: apiLogger });
   const countResult = await roomService.countByAccommodation(actor, {
       accommodationId: complexId
   });
   const currentPropertyCount = countResult.data?.count || 0;
   ```

4. **API routes**: Create CRUD routes under `/api/v1/protected/accommodations/:id/rooms/`
5. **Admin routes**: Create admin routes under `/api/v1/admin/accommodations/:id/rooms/`

**When to implement**: When the complex accommodation management feature is built. Trigger: product decision to support hotels/hostels with room-level management.

### Staff Accounts Limit (MAX_STAFF_ACCOUNTS)

Maximum number of team members (receptionists, managers) that an accommodation owner can invite to help manage their properties.

**Example**: A hotel owner on `complex-premium` plan can have up to 10 staff accounts with granular permissions.

**Current Code** (`apps/api/src/middlewares/limit-enforcement.ts`, line 670):

```typescript
// FUTURE FEATURE: Staff account management.
// In v1, each accommodation is managed by a single user (the owner).
const currentCount = 0;
```

**What Needs to Be Implemented**:

1. **Database**: Create `staff_invitations` table in `packages/db/src/schemas/` with fields: `id` (UUID PK), `owner_user_id` (FK), `invited_email`, `invited_user_id` (FK, nullable), `role`, `status`, `permissions` (JSONB), timestamps, and `deleted_at`.
2. **Service**: Create `StaffService` in `packages/service-core/src/services/staff/` extending `BaseCrudService`. Implement `countAcceptedByOwner({ ownerId })` and invite/accept/revoke flows.
3. **Middleware update**: Replace the stub:

   ```typescript
   const staffService = new StaffService({ logger: apiLogger });
   const countResult = await staffService.countAcceptedByOwner(actor, {
       ownerId: actor.id
   });
   const currentCount = countResult.data?.count || 0;
   ```

4. **API routes**: Create routes for staff management (`POST /protected/staff/invite`, `POST /protected/staff/accept/:token`, `DELETE /protected/staff/:id`, `GET /protected/staff`).
5. **Admin routes**: Create admin routes under `/api/v1/admin/staff/`.
6. **Auth integration**: Staff members need delegated access recognition via Better Auth (custom plugin or organization plugin).

**When to implement**: When the staff/team management feature is built. The v1 launch strategy explicitly defers staff accounts.

### Effort Estimates

| Limit | Blocked By | Priority | Estimated Effort |
|-------|-----------|----------|-----------------|
| `MAX_PROPERTIES` | Complex accommodation rooms feature | Medium | 2-3 days (schema + service + routes + tests) |
| `MAX_STAFF_ACCOUNTS` | Staff/team management feature | Medium | 3-5 days (schema + service + routes + auth + tests) |

---

## Related Files

- `apps/api/src/utils/limit-check.ts` - Core limit checking logic
- `apps/api/src/middlewares/entitlement.ts` - Loads user entitlements and limits
- `packages/billing/src/config/limits.config.ts` - Limit definitions
- `packages/billing/src/types/plan.types.ts` - LimitKey enum
