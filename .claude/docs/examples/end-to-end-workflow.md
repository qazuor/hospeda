# End-to-End Workflow Example

**Feature:** User Favorites for Accommodations

This document shows a complete workflow from feature request to deployment, following the **Level 3: Feature Planning** protocol with all 4 phases.

## Table of Contents

- [Context](#context)
- [Phase 1: Planning](#phase-1-planning)
- [Phase 2: Implementation](#phase-2-implementation)
- [Phase 3: Validation](#phase-3-validation)
- [Phase 4: Finalization](#phase-4-finalization)
- [Results](#results)

---

## Context

### Feature Request

**From:** Product Manager
**Date:** 2025-11-01
**Priority:** High

> "We need to allow users to save their favorite accommodations for quick access later. Users should be able to add/remove favorites and see a list of their saved accommodations. This should work for both logged-in users (persisted) and guest users (session-based)."

### Initial Assessment

- **Workflow Level:** Level 3 (Feature Planning - 4 Phases)
- **Estimated Duration:** 3-5 days
- **Complexity:** Medium
- **Risk:** Low-Medium
- **Reason for Level 3:**
  - Database changes required (favorites table)
  - Multiple layers affected (DB, Service, API, Frontend)
  - New business logic (favorites management)
  - Authentication considerations
  - Session management for guests

---

## Phase 1: Planning

**Duration:** 4-6 hours
**Participants:** product-functional, product-technical, ux-ui-designer, tech-lead

### Step 1: Start Planning Session

```bash
# Create planning session
mkdir -p .claude/sessions/planning/active/P-007-user-favorites
cd .claude/sessions/planning/active/P-007-user-favorites
```

### Step 2: Product Functional Analysis

**Agent:** product-functional

**Output:** `PDR.md` (Product Design Requirements)

<details>
<summary>PDR.md (Click to expand)</summary>

```markdown
# PDR: User Favorites for Accommodations

**Feature ID:** F-007
**Priority:** High
**Status:** Planning
**Created:** 2025-11-01

## Overview

Allow users to save favorite accommodations for quick access and future reference.

## User Stories

### US-001: Add to Favorites (Logged User)

**As a** logged-in user
**I want** to mark accommodations as favorites
**So that** I can easily find them later

**Acceptance Criteria:**

- [ ] Heart icon appears on accommodation cards
- [ ] Clicking heart adds/removes from favorites
- [ ] Visual feedback shows favorite state (filled vs outline)
- [ ] Favorites persist across sessions
- [ ] Maximum 50 favorites per user

### US-002: View Favorites List

**As a** logged-in user
**I want** to see all my favorite accommodations
**So that** I can quickly access properties I'm interested in

**Acceptance Criteria:**

- [ ] Dedicated "Favorites" page accessible from navigation
- [ ] Shows all favorited accommodations
- [ ] Displays same info as search results (image, title, price, rating)
- [ ] Empty state shown when no favorites
- [ ] Can remove favorites from this page
- [ ] Results are paginated (20 per page)

### US-003: Guest User Favorites

**As a** guest user
**I want** to save favorites during my session
**So that** I can compare properties before deciding to register

**Acceptance Criteria:**

- [ ] Favorites stored in session/localStorage
- [ ] Same UI/UX as logged users
- [ ] Prompt to register when trying to exceed 5 favorites
- [ ] Clear message that favorites will be lost on logout
- [ ] Option to migrate favorites on registration

## Mockups

### Accommodation Card with Favorite Button

```

┌─────────────────────────────┐
│ [Image]              ♡ /❤️  │
│                             │
│ Beach House Villa           │
│ ⭐ 4.8 (120)               │
│ $150/night                  │
└─────────────────────────────┘

```

### Favorites Page

```

┌─────────────────────────────────────────┐
│ My Favorites (12)                       │
├─────────────────────────────────────────┤
│ ┌───────────┐                           │
│ │  [Image]  │ Beach Villa  ❤️ Remove   │
│ └───────────┘ $150/night  ⭐ 4.8       │
│                                         │
│ ┌───────────┐                           │
│ │  [Image]  │ City Apartment  ❤️ Remove│
│ └───────────┘ $80/night  ⭐ 4.5        │
└─────────────────────────────────────────┘

```

## Functional Requirements

### FR-001: Favorite Management

- Users can add/remove favorites
- System prevents duplicates
- Favorites associated with user ID
- Soft delete (mark as inactive instead of DELETE)

### FR-002: Limits

- Logged users: max 50 favorites
- Guest users: max 5 favorites
- Clear error messages when limits reached

### FR-003: Performance

- Favorites list loads < 500ms
- Add/remove operations < 200ms
- Optimistic UI updates

## Non-Functional Requirements

### NFR-001: Scalability

- Support up to 100,000 users with favorites
- Efficient queries (proper indexing)

### NFR-002: Data Integrity

- No orphaned favorites
- CASCADE delete when user deleted
- CASCADE update when accommodation deleted

### NFR-003: Security

- Users can only see/modify their own favorites
- Rate limiting on favorite operations (max 10/minute)

## Out of Scope

- Sharing favorites with other users
- Organizing favorites into lists/categories
- Email notifications for price changes on favorites
- Collaborative favorites (multiple users)

## Dependencies

- User authentication system (Clerk)
- Accommodation service (existing)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation with large favorites lists | Medium | Implement pagination, caching |
| Guest favorites lost | Low | Clear messaging, migration flow |
| Favorite spam/abuse | Low | Rate limiting, max limits |

## Success Metrics

- 40%+ users add at least one favorite within first week
- < 1% error rate on favorite operations
- Average 8 favorites per active user
```

</details>

### Step 3: UX/UI Design

**Agent:** ux-ui-designer

**Output:** Design specs in `PDR.md` (mockups section)

**Key Decisions:**

- Heart icon for consistency with booking platforms
- Filled heart (❤️) for favorited, outline (♡) for not favorited
- Optimistic UI: instant visual feedback, revert on error
- Toast notifications for add/remove confirmations

### Step 4: Technical Analysis

**Agent:** product-technical

**Output:** `tech-analysis.md`

<details>
<summary>tech-analysis.md (Click to expand)</summary>

```markdown
# Technical Analysis: User Favorites

**Feature ID:** F-007
**Complexity:** Medium
**Estimated Effort:** 20-24 hours

## Architecture Impact

### Database Layer

**New Table:** `favorites`

```sql
CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  accommodation_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE CASCADE,
  UNIQUE (user_id, accommodation_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id, is_active);
CREATE INDEX idx_favorites_accommodation ON favorites(accommodation_id);
```

### Service Layer

**New Service:** `FavoriteService extends BaseCrudService`

Methods:

- `addFavorite({ userId, accommodationId })` - Add favorite
- `removeFavorite({ userId, accommodationId })` - Remove favorite (soft delete)
- `getFavorites({ userId, pagination })` - Get user's favorites
- `isFavorite({ userId, accommodationId })` - Check if favorited
- `getFavoriteCount({ userId })` - Get count for limit checking

### API Layer

**New Routes:** `/api/favorites`

- `POST /favorites` - Add favorite
- `DELETE /favorites/:accommodationId` - Remove favorite
- `GET /favorites` - List user's favorites
- `GET /favorites/check/:accommodationId` - Check if favorited

### Frontend (Web)

**Components:**

- `FavoriteButton.tsx` - Heart icon toggle
- `FavoritesList.tsx` - Favorites page
- `FavoritesEmpty.tsx` - Empty state

**State Management:**

- TanStack Query for server state
- Optimistic updates for add/remove

### Frontend (Admin)

**No changes required** - Admin doesn't need favorites feature

## Technology Stack

| Layer | Technology |
|-------|------------|
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod schemas |
| API | Hono |
| Frontend | Astro + React 19 |
| State | TanStack Query |
| Auth | Clerk |

## Data Flow

```
User clicks heart
  ↓
Optimistic UI update (instant feedback)
  ↓
POST /api/favorites
  ↓
Auth middleware validates user
  ↓
Zod validates payload
  ↓
FavoriteService.addFavorite()
  ↓
Check user favorites count < limit
  ↓
FavoriteModel.create()
  ↓
Return success
  ↓
TanStack Query revalidates
  ↓
UI stays updated (or reverts on error)
```

## Security Considerations

### Authentication

- All endpoints require authentication
- User can only access their own favorites

### Authorization

- Verify userId from JWT matches request
- No admin-specific permissions needed

### Rate Limiting

- Max 10 operations/minute per user
- Prevents abuse/spam

### Input Validation

```typescript
addFavoriteSchema = z.object({
  accommodationId: z.string().uuid(),
});

// userId comes from authenticated session
```

## Performance Optimization

### Database

- Composite index on `(user_id, is_active)` for fast user lookups
- Soft deletes preserve data while keeping queries fast
- UNIQUE constraint prevents duplicates

### API

- Pagination for favorites list (20 per page)
- Response caching with short TTL (1 minute)

### Frontend

- Optimistic updates for instant feedback
- Prefetch favorites count on page load
- Debounce favorite toggle (prevent double-clicks)

## Testing Strategy

### Unit Tests

- FavoriteModel CRUD operations
- FavoriteService business logic
- Limit enforcement
- Duplicate prevention

### Integration Tests

- API endpoints with authentication
- Database constraints
- Cascading deletes

### E2E Tests

- Add favorite from search results
- Remove favorite from favorites page
- Guest user flow
- Limit enforcement UI

**Coverage Target:** 90%+ for all layers

## Error Handling

| Scenario | Response | HTTP Code |
|----------|----------|-----------|
| Accommodation not found | "Accommodation not found" | 404 |
| Already favorited | No-op (idempotent) | 200 |
| Limit reached | "Maximum favorites reached (50)" | 400 |
| Unauthorized | "Authentication required" | 401 |
| Rate limit exceeded | "Too many requests" | 429 |

## Rollout Plan

### Phase 1: Backend (Day 1-2)

1. Database migration
2. Models and services
3. API endpoints
4. Unit + integration tests

### Phase 2: Frontend (Day 3-4)

1. React components
2. TanStack Query integration
3. Optimistic updates
4. E2E tests

### Phase 3: Polish (Day 5)

1. Edge case handling
2. Error messages
3. Loading states
4. Documentation

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance issues with large lists | Low | Medium | Pagination + indexing |
| Race conditions on toggle | Medium | Low | Optimistic updates + debouncing |
| Guest migration complexity | Low | Low | Simple: prompt to login |

## Dependencies

- `@repo/db` - Database models
- `@repo/schemas` - Validation schemas
- `@repo/service-core` - Business logic
- `apps/api` - API routes
- `apps/web` - Frontend UI
- `@clerk/nextjs` - Authentication

## Acceptance Criteria

- [ ] All user stories met
- [ ] 90%+ test coverage
- [ ] Performance targets met (< 500ms list, < 200ms toggle)
- [ ] Security audit passed
- [ ] Accessibility WCAG 2.1 AA compliant
- [ ] Documentation complete

```

</details>

### Step 5: Task Breakdown

**Agent:** product-technical

**Output:** `TODOs.md`

<details>
<summary>TODOs.md (Click to expand)</summary>

```markdown
# TODOs: User Favorites Feature

**Feature ID:** F-007
**Session:** P-007-user-favorites

## Phase 2: Implementation

### PB-001: Database Schema & Migration

- **Description**: Create favorites table with indexes
- **Assignee**: @db-engineer
- **Estimated**: 2 hours
- **Dependencies**: None
- **Acceptance**:
  - [ ] Migration file created
  - [ ] Table with all fields
  - [ ] Foreign keys configured
  - [ ] Indexes created
  - [ ] Migration tested (up/down)

### PB-002: Zod Validation Schemas

- **Description**: Create Zod schemas for favorite operations
- **Assignee**: @node-typescript-engineer
- **Estimated**: 1 hour
- **Dependencies**: None
- **Acceptance**:
  - [ ] `createFavoriteSchema`
  - [ ] `getFavoritesSchema` (pagination)
  - [ ] Types exported via `z.infer`
  - [ ] Unit tests for schemas

### PB-003: Favorite Model

- **Description**: Implement FavoriteModel extending BaseModel
- **Assignee**: @db-engineer
- **Estimated**: 3 hours
- **Dependencies**: PB-001
- **Acceptance**:
  - [ ] Model class extends BaseModel
  - [ ] CRUD methods implemented
  - [ ] Soft delete support
  - [ ] 90%+ test coverage
  - [ ] JSDoc documentation

### PB-004: Favorite Service

- **Description**: Business logic for favorites management
- **Assignee**: @node-typescript-engineer
- **Estimated**: 4 hours
- **Dependencies**: PB-002, PB-003
- **Acceptance**:
  - [ ] Service extends BaseCrudService
  - [ ] `addFavorite()` with limit checking
  - [ ] `removeFavorite()` (soft delete)
  - [ ] `getFavorites()` with pagination
  - [ ] `isFavorite()` check
  - [ ] `getFavoriteCount()` for limits
  - [ ] Error handling
  - [ ] 90%+ test coverage

### PB-005: API Routes

- **Description**: Hono endpoints for favorites
- **Assignee**: @hono-engineer
- **Estimated**: 3 hours
- **Dependencies**: PB-004
- **Acceptance**:
  - [ ] POST /api/favorites
  - [ ] DELETE /api/favorites/:accommodationId
  - [ ] GET /api/favorites (paginated)
  - [ ] GET /api/favorites/check/:accommodationId
  - [ ] Zod validation middleware
  - [ ] Authentication middleware
  - [ ] Rate limiting (10/min)
  - [ ] Integration tests
  - [ ] API documentation

### PB-006: React Components

- **Description**: UI components for favorites
- **Assignee**: @react-senior-dev
- **Estimated**: 4 hours
- **Dependencies**: PB-005
- **Acceptance**:
  - [ ] `FavoriteButton` component
  - [ ] `FavoritesList` component
  - [ ] `FavoritesEmpty` component
  - [ ] Accessible (ARIA labels)
  - [ ] Responsive design
  - [ ] Unit tests
  - [ ] Storybook stories

### PB-007: TanStack Query Integration

- **Description**: Server state management for favorites
- **Assignee**: @astro-engineer
- **Estimated**: 3 hours
- **Dependencies**: PB-005, PB-006
- **Acceptance**:
  - [ ] Query hooks for favorites
  - [ ] Mutation hooks (add/remove)
  - [ ] Optimistic updates
  - [ ] Cache invalidation
  - [ ] Error handling
  - [ ] Loading states

### PB-008: Favorites Page

- **Description**: Dedicated page for favorites list
- **Assignee**: @astro-engineer
- **Estimated**: 3 hours
- **Dependencies**: PB-007
- **Acceptance**:
  - [ ] `/favorites` route
  - [ ] Server-side rendering
  - [ ] Pagination
  - [ ] Empty state
  - [ ] Remove functionality
  - [ ] Responsive design
  - [ ] SEO meta tags

## Phase 3: Validation

### PB-009: E2E Testing

- **Description**: End-to-end tests for favorites flow
- **Assignee**: @qa-engineer
- **Estimated**: 3 hours
- **Dependencies**: PB-008
- **Acceptance**:
  - [ ] Test: Add favorite from search
  - [ ] Test: Remove from favorites page
  - [ ] Test: Limit enforcement (50)
  - [ ] Test: Guest user flow
  - [ ] Test: Authentication required
  - [ ] All tests pass

### PB-010: Quality Check

- **Description**: Run comprehensive quality checks
- **Assignee**: @tech-lead
- **Estimated**: 2 hours
- **Dependencies**: PB-009
- **Acceptance**:
  - [ ] Code review passed
  - [ ] 90%+ test coverage
  - [ ] No lint errors
  - [ ] No type errors
  - [ ] Performance benchmarks met
  - [ ] Security audit passed
  - [ ] Accessibility audit passed

## Phase 4: Finalization

### PB-011: API Documentation

- **Description**: Document favorites API endpoints
- **Assignee**: @tech-writer
- **Estimated**: 2 hours
- **Dependencies**: PB-010
- **Acceptance**:
  - [ ] OpenAPI/Swagger docs
  - [ ] Request/response examples
  - [ ] Error codes documented
  - [ ] Rate limits documented

### PB-012: User Documentation

- **Description**: User-facing documentation
- **Assignee**: @tech-writer
- **Estimated**: 1 hour
- **Dependencies**: PB-010
- **Acceptance**:
  - [ ] Feature guide created
  - [ ] Screenshots added
  - [ ] FAQ section

### PB-013: CHANGELOG Update

- **Description**: Add feature to changelog
- **Assignee**: @tech-writer
- **Estimated**: 0.5 hours
- **Dependencies**: PB-011, PB-012
- **Acceptance**:
  - [ ] Entry in CHANGELOG.md
  - [ ] Follows Keep a Changelog format
  - [ ] Links to documentation

## Summary

- **Total Tasks**: 13
- **Total Estimated**: 31.5 hours
- **Backend**: 10 hours (PB-001 to PB-003)
- **API**: 3 hours (PB-005)
- **Frontend**: 10 hours (PB-006 to PB-008)
- **QA**: 5 hours (PB-009 to PB-010)
- **Docs**: 3.5 hours (PB-011 to PB-013)
```

</details>

### Step 6: Planning Approval

**Participants:** User + tech-lead

**Review:**

- PDR approved ✅
- Technical approach validated ✅
- Task breakdown realistic ✅
- Risks acceptable ✅

**Decision:** Proceed to implementation

---

## Phase 2: Implementation

**Duration:** 3-4 days
**Methodology:** TDD (Red → Green → Refactor)

### Day 1: Backend Foundation

#### PB-001: Database Schema

**Agent:** db-engineer

```bash
# Create migration file
pnpm db:generate

# Migration: 0007_add_favorites.sql
```

```sql
CREATE TABLE favorites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  accommodation_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,

  CONSTRAINT fk_favorites_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_favorites_accommodation
    FOREIGN KEY (accommodation_id)
    REFERENCES accommodations(id)
    ON DELETE CASCADE,

  CONSTRAINT unique_user_accommodation
    UNIQUE (user_id, accommodation_id)
);

CREATE INDEX idx_favorites_user_active
  ON favorites(user_id, is_active)
  WHERE is_active = TRUE;

CREATE INDEX idx_favorites_accommodation
  ON favorites(accommodation_id);
```

**Commit:**

```bash
git add packages/db/drizzle/migrations/0007_add_favorites.sql
git commit -m "feat(db): add favorites table schema [PB-001]"
```

#### PB-002: Validation Schemas

**Agent:** node-typescript-engineer

```typescript
// packages/schemas/src/favorite.schema.ts
import { z } from 'zod';

export const createFavoriteSchema = z.object({
  accommodationId: z.string().uuid(),
});

export const getFavoritesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const checkFavoriteSchema = z.object({
  accommodationId: z.string().uuid(),
});

// Types
export type CreateFavorite = z.infer<typeof createFavoriteSchema>;
export type GetFavorites = z.infer<typeof getFavoritesSchema>;
export type CheckFavorite = z.infer<typeof checkFavoriteSchema>;
```

**Tests:**

```typescript
// packages/schemas/test/favorite.schema.test.ts
describe('Favorite Schemas', () => {
  it('should validate create favorite schema', () => {
    const valid = createFavoriteSchema.parse({
      accommodationId: '123e4567-e89b-12d3-a456-426614174000',
    });

    expect(valid.accommodationId).toBeDefined();
  });

  // ... more tests
});
```

**Commit:**

```bash
git add packages/schemas/src/favorite.schema.ts
git add packages/schemas/test/favorite.schema.test.ts
git commit -m "feat(schemas): add favorite validation schemas [PB-002]"
```

#### PB-003: Favorite Model (TDD)

**Agent:** db-engineer

**Red Phase:**

```typescript
// packages/db/test/models/favorite.model.test.ts
describe('FavoriteModel', () => {
  it('should create favorite', async () => {
    const result = await favoriteModel.create({
      userId: testUser.id,
      accommodationId: testAccommodation.id,
    });

    expect(result.success).toBe(true);
    expect(result.data?.userId).toBe(testUser.id);
  });

  // ... tests fail (model doesn't exist)
});
```

**Green Phase:**

```typescript
// packages/db/src/models/favorite.model.ts
import { BaseModel } from './base.model';
import type { Favorite } from '../schemas/favorite';

export class FavoriteModel extends BaseModel<Favorite> {
  protected table = favoritesTable;
  protected entityName = 'favorite';

  async findByUser(userId: string): Promise<Favorite[]> {
    return this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.userId, userId),
          eq(this.table.isActive, true)
        )
      );
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(this.table)
      .set({ isActive: false })
      .where(eq(this.table.id, id));
  }
}
```

**Refactor Phase:**

- Extract common queries
- Add JSDoc
- Optimize indexes usage

**Commit:**

```bash
git add packages/db/src/models/favorite.model.ts
git add packages/db/test/models/favorite.model.test.ts
git commit -m "feat(db): implement favorite model with tests [PB-003]"
```

### Day 2: Service & API

#### PB-004: Favorite Service (TDD)

**Agent:** node-typescript-engineer

```typescript
// packages/service-core/src/favorite.service.ts
export class FavoriteService extends BaseCrudService<
  Favorite,
  FavoriteModel,
  CreateFavorite,
  never, // No update
  GetFavorites
> {
  private readonly MAX_FAVORITES = 50;

  async addFavorite(input: {
    userId: string;
    accommodationId: string;
  }): Promise<Result<Favorite>> {
    // Check limit
    const count = await this.getFavoriteCount({ userId: input.userId });
    if (count >= this.MAX_FAVORITES) {
      return {
        success: false,
        error: {
          code: ServiceErrorCode.VALIDATION_ERROR,
          message: `Maximum favorites reached (${this.MAX_FAVORITES})`,
        },
      };
    }

    // Check if exists (idempotent)
    const existing = await this.model.findOne({
      userId: input.userId,
      accommodationId: input.accommodationId,
    });

    if (existing) {
      return { success: true, data: existing };
    }

    // Create
    return this.model.create({
      userId: input.userId,
      accommodationId: input.accommodationId,
    });
  }

  // ... other methods
}
```

**Commit:**

```bash
git add packages/service-core/src/favorite.service.ts
git add packages/service-core/test/favorite.service.test.ts
git commit -m "feat(service): add favorite CRUD service [PB-004]"
```

#### PB-005: API Routes

**Agent:** hono-engineer

```typescript
// apps/api/src/routes/favorites.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

const app = new Hono();

app.use('*', requireAuth());
app.use('*', rateLimit({ max: 10, window: '1m' }));

// Add favorite
app.post(
  '/',
  zValidator('json', createFavoriteSchema),
  async (c) => {
    const { accommodationId } = c.req.valid('json');
    const userId = c.get('userId');

    const service = new FavoriteService(c.get('ctx'));
    const result = await service.addFavorite({ userId, accommodationId });

    if (!result.success) {
      return c.json(result.error, 400);
    }

    return c.json(result.data, 201);
  }
);

// Remove favorite
app.delete('/:accommodationId', async (c) => {
  const accommodationId = c.req.param('accommodationId');
  const userId = c.get('userId');

  const service = new FavoriteService(c.get('ctx'));
  const result = await service.removeFavorite({ userId, accommodationId });

  if (!result.success) {
    return c.json(result.error, 400);
  }

  return c.json({ success: true }, 200);
});

// List favorites (paginated)
app.get(
  '/',
  zValidator('query', getFavoritesSchema),
  async (c) => {
    const { page, limit } = c.req.valid('query');
    const userId = c.get('userId');

    const service = new FavoriteService(c.get('ctx'));
    const result = await service.getFavorites({
      userId,
      page,
      limit,
    });

    if (!result.success) {
      return c.json(result.error, 400);
    }

    return c.json(result.data);
  }
);

export default app;
```

**Commit:**

```bash
git add apps/api/src/routes/favorites.ts
git add apps/api/test/routes/favorites.test.ts
git commit -m "feat(api): add favorite endpoints with auth & rate limiting [PB-005]"
```

### Day 3-4: Frontend

#### PB-006: React Components

**Agent:** react-senior-dev

```tsx
// apps/web/src/components/FavoriteButton.tsx
import { useState } from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

interface FavoriteButtonProps {
  accommodationId: string;
  initialIsFavorite: boolean;
  onToggle: (isFavorite: boolean) => Promise<void>;
}

export function FavoriteButton({
  accommodationId,
  initialIsFavorite,
  onToggle,
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Don't navigate if in a link

    setIsLoading(true);
    const newState = !isFavorite;

    // Optimistic update
    setIsFavorite(newState);

    try {
      await onToggle(newState);
    } catch (error) {
      // Revert on error
      setIsFavorite(!newState);
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="favorite-button"
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorite}
    >
      {isFavorite ? (
        <HeartSolidIcon className="w-6 h-6 text-red-500" />
      ) : (
        <HeartIcon className="w-6 h-6 text-gray-400 hover:text-red-500" />
      )}
    </button>
  );
}
```

**Commit:**

```bash
git add apps/web/src/components/FavoriteButton.tsx
git add apps/web/test/components/FavoriteButton.test.tsx
git commit -m "feat(web): add favorite button component with optimistic updates [PB-006]"
```

#### PB-007: TanStack Query Integration

**Agent:** astro-engineer

```typescript
// apps/web/src/hooks/useFavorites.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useFavorites() {
  const queryClient = useQueryClient();

  const { data: favorites, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const res = await fetch('/api/favorites');
      if (!res.ok) throw new Error('Failed to fetch favorites');
      return res.json();
    },
  });

  const addFavorite = useMutation({
    mutationFn: async (accommodationId: string) => {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accommodationId }),
      });
      if (!res.ok) throw new Error('Failed to add favorite');
      return res.json();
    },
    // Optimistic update
    onMutate: async (accommodationId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData(['favorites']);

      queryClient.setQueryData(['favorites'], (old: any) => ({
        ...old,
        items: [...(old?.items || []), { accommodationId }],
      }));

      return { previous };
    },
    // Revert on error
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites'], context.previous);
      }
    },
    // Refetch on success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  return {
    favorites: favorites?.items || [],
    isLoading,
    addFavorite: addFavorite.mutate,
    removeFavorite: removeFavorite.mutate,
  };
}
```

**Commit:**

```bash
git add apps/web/src/hooks/useFavorites.ts
git commit -m "feat(web): add TanStack Query hooks for favorites [PB-007]"
```

#### PB-008: Favorites Page

**Agent:** astro-engineer

```astro
---
// apps/web/src/pages/favorites.astro
import Layout from '../layouts/Layout.astro';
import { FavoritesList } from '../components/FavoritesList';
---

<Layout title="My Favorites | Hospeda">
  <main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">My Favorites</h1>

    <FavoritesList client:load />
  </main>
</Layout>
```

**Commit:**

```bash
git add apps/web/src/pages/favorites.astro
git add apps/web/src/components/FavoritesList.tsx
git commit -m "feat(web): add favorites page with SSR [PB-008]"
```

---

## Phase 3: Validation

**Duration:** 1 day

### PB-009: E2E Testing

**Agent:** qa-engineer

```typescript
// apps/web/e2e/favorites.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Favorites Feature', () => {
  test('should add favorite from search results', async ({ page }) => {
    await page.goto('/search');

    // Click first favorite button
    const favoriteBtn = page.locator('[aria-label="Add to favorites"]').first();
    await favoriteBtn.click();

    // Should show filled heart
    await expect(favoriteBtn).toHaveAttribute('aria-pressed', 'true');

    // Should show toast notification
    await expect(page.locator('text=Added to favorites')).toBeVisible();
  });

  test('should remove favorite from favorites page', async ({ page }) => {
    await page.goto('/favorites');

    const removeBtn = page.locator('[aria-label="Remove from favorites"]').first();
    await removeBtn.click();

    await expect(page.locator('text=Removed from favorites')).toBeVisible();
  });

  test('should enforce 50 favorites limit', async ({ page }) => {
    // Add 50 favorites...
    // Try to add 51st
    await page.goto('/accommodation/123');
    await page.locator('[aria-label="Add to favorites"]').click();

    await expect(page.locator('text=Maximum favorites reached')).toBeVisible();
  });
});
```

**Commit:**

```bash
git add apps/web/e2e/favorites.spec.ts
git commit -m "test(e2e): add favorites feature tests [PB-009]"
```

### PB-010: Quality Check

**Agent:** tech-lead

```bash
# Run all checks
pnpm typecheck  # ✅ No errors
pnpm lint       # ✅ No errors
pnpm test:coverage # ✅ 94% coverage

# Run quality check command
pnpm quality-check
```

**Results:**

- ✅ Code review: All patterns followed
- ✅ Test coverage: 94% (exceeds 90% minimum)
- ✅ Performance: All endpoints < 200ms
- ✅ Security: Auth enforced, rate limiting active
- ✅ Accessibility: WCAG 2.1 AA compliant

**Approval:** Ready for finalization

---

## Phase 4: Finalization

**Duration:** 0.5 day

### PB-011: API Documentation

**Agent:** tech-writer

```yaml
# docs/api/favorites.yml
paths:
  /api/favorites:
    post:
      summary: Add favorite
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                accommodationId:
                  type: string
                  format: uuid
      responses:
        201:
          description: Favorite added
        400:
          description: Limit reached or invalid request
        401:
          description: Unauthorized
```

**Commit:**

```bash
git add docs/api/favorites.yml
git commit -m "docs(api): add favorites endpoint documentation [PB-011]"
```

### PB-012: User Documentation

**Agent:** tech-writer

```markdown
# docs/features/favorites.md

## User Favorites

Save your favorite accommodations for quick access later.

### How to Use

1. **Add Favorite**: Click the heart icon (♡) on any accommodation card
2. **View Favorites**: Navigate to "Favorites" from the menu
3. **Remove Favorite**: Click the filled heart (❤️) to remove

### Limits

- **Logged Users**: Up to 50 favorites
- **Guest Users**: Up to 5 favorites (lost on logout)

### FAQs

**Q: Can I share my favorites?**
A: Not yet, but this feature is planned for a future release.
```

**Commit:**

```bash
git add docs/features/favorites.md
git commit -m "docs(features): add user guide for favorites [PB-012]"
```

### PB-013: CHANGELOG Update

**Agent:** tech-writer

```markdown
# CHANGELOG.md

## [Unreleased]

### Added

- **User Favorites** - Users can now save favorite accommodations
  - Add/remove favorites with heart icon
  - Dedicated favorites page with pagination
  - Max 50 favorites per logged user, 5 for guests
  - Optimistic UI updates for instant feedback
  - Rate limiting to prevent abuse (10 operations/min)
  - See [Favorites Guide](docs/features/favorites.md) for details
```

**Commit:**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): add favorites feature entry [PB-013]"
```

---

## Results

### Metrics

- **Total Duration:** 4.5 days (36 hours actual vs 31.5 estimated)
- **Commits:** 13 atomic commits (one per task)
- **Test Coverage:** 94% (exceeded 90% target)
- **Performance:**
  - Add favorite: 150ms avg
  - List favorites: 380ms avg
  - Both under targets ✅

### Deliverables

✅ Database migration
✅ Backend services
✅ API endpoints
✅ Frontend components
✅ Favorites page
✅ E2E tests
✅ Documentation
✅ CHANGELOG update

### Pull Request

```bash
# Create PR
gh pr create \
  --title "feat: user favorites for accommodations [F-007]" \
  --body "$(cat <<'EOF'
## Summary

Implements user favorites feature allowing users to save and manage favorite accommodations.

## Changes

- Database: `favorites` table with indexes
- Backend: FavoriteService, FavoriteModel
- API: 4 new endpoints with auth & rate limiting
- Frontend: FavoriteButton, FavoritesList components
- Tests: 94% coverage (Unit + Integration + E2E)

## Testing

- [x] All tests pass
- [x] Manual testing completed
- [x] E2E tests pass
- [x] Performance benchmarks met

## Documentation

- [x] API docs updated
- [x] User guide created
- [x] CHANGELOG updated

## Related

- Planning Session: P-007
- Feature ID: F-007
- Tasks: PB-001 to PB-013

## Screenshots

(Screenshots of favorite button and favorites page)
EOF
)"
```

### Deployment

```bash
# After PR approval and merge
git checkout main
git pull

# Vercel auto-deploys from main branch
# Migration runs automatically on deploy

# Verify deployment
curl -f https://hospeda.com/health || exit 1
```

### Success Metrics (1 week after launch)

- ✅ 42% users added at least one favorite
- ✅ 0.3% error rate (below 1% target)
- ✅ Average 9 favorites per active user

---

## Lessons Learned

### What Went Well

1. **TDD Approach** - Caught bugs early, tests gave confidence
2. **Atomic Commits** - Easy to review, clear history
3. **Optimistic UI** - Great user experience
4. **Planning Phase** - Clear requirements avoided scope creep

### Challenges

1. **Optimistic Updates** - Needed careful error handling
2. **Rate Limiting** - Initial implementation too strict, relaxed to 10/min
3. **Guest Migration** - Decided to keep simple (just prompt to login)

### Would Do Differently

- Add analytics events from the start (added in hotfix)
- Include performance monitoring from day 1
- More edge case testing for concurrent operations

---

*End of Example*

This example demonstrates a complete workflow following all standards, protocols, and best practices from the Hospeda project.
