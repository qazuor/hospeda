# Creating Schemas Guide

Complete tutorial for creating entity schema sets in the Hospeda project using Zod validation.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Tutorial: Review Entity Schemas](#tutorial-review-entity-schemas)
  - [Planning the Schema](#planning-the-schema)
  - [Base Schema](#base-schema)
  - [CRUD Schemas](#crud-schemas)
  - [Query Schemas](#query-schemas)
  - [HTTP Schemas](#http-schemas)
  - [Relations Schema](#relations-schema)
  - [Exports](#exports)
  - [Testing](#testing)
  - [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Overview

In Hospeda, schemas are the foundation of type safety and validation throughout the entire stack:

- **Database** → Drizzle schemas define structure
- **Validation** → Zod schemas validate data
- **Types** → TypeScript types inferred via `z.infer<typeof schema>`
- **API** → Hono uses schemas with `zValidator`
- **Frontend** → React forms use schemas with `zodResolver`

### When to Create Schemas

Create a complete schema set when:

- Adding a new entity (e.g., Review, Product, Event)
- Implementing a new feature requiring data validation
- Exposing new API endpoints
- Building forms that need validation

### Schema Variants

Each entity typically has:

1. **Base Schema** - Complete entity structure
2. **CRUD Schemas** - Create, update, delete operations
3. **Query Schemas** - Search, filter, pagination
4. **HTTP Schemas** - API requests and responses
5. **Relations Schema** - Related entity structures

### Benefits

- **Type Safety**: End-to-end type checking from database to UI
- **Runtime Validation**: Catch invalid data before it reaches the database
- **Documentation**: Schemas serve as living documentation
- **Consistency**: Single source of truth for data structure
- **Developer Experience**: Autocomplete and IntelliSense everywhere

## Prerequisites

### Required Knowledge

- TypeScript fundamentals
- Zod library basics ([Zod Documentation](https://zod.dev))
- Project structure (see [Portal](../portal.md))
- Understanding of [Type Inference](../concepts/type-inference.md)

### Project Setup

```bash
# Navigate to schemas package
cd packages/schemas

# Install dependencies (if needed)
pnpm install

# Run tests
pnpm test

# Type checking
pnpm typecheck
```

### File Structure

```text
packages/schemas/
├── src/
│   ├── entities/          # Entity schemas
│   │   ├── review/        # Review entity (our example)
│   │   │   ├── base.ts
│   │   │   ├── create.ts
│   │   │   ├── update.ts
│   │   │   ├── query.ts
│   │   │   ├── http.ts
│   │   │   ├── relations.ts
│   │   │   └── index.ts
│   ├── enums/             # Enumeration schemas
│   ├── common/            # Shared utilities
│   └── index.ts
```

## Tutorial: Review Entity Schemas

Let's create a complete schema set for a **Review** entity step by step.

### Planning the Schema

Before writing code, define your entity's requirements:

#### Review Entity Requirements

**Purpose**: Allow users to rate and comment on accommodations after verified stays.

**Fields**:

- `id` - Unique identifier (UUID)
- `rating` - Numeric rating (1-5)
- `comment` - Text review (10-1000 characters)
- `userId` - Reference to User entity
- `accommodationId` - Reference to Accommodation entity
- `createdAt` - Timestamp of creation
- `updatedAt` - Timestamp of last update
- `verifiedPurchase` - Boolean flag for verified bookings
- `status` - Lifecycle status (draft, published, flagged, deleted)

**Business Rules**:

- Rating must be integer between 1 and 5
- Comment required and between 10-1000 characters
- Only verified purchases can be published
- Users can only review accommodations they've booked
- One review per user per accommodation

**Use Cases**:

- Create review after checkout
- Update review (within 30 days)
- List reviews for accommodation
- Search reviews by rating/status
- Moderate flagged reviews (admin)

### Base Schema

The base schema defines the complete entity structure with all fields and validations.

**File**: `src/entities/review/base.ts`

```typescript
/**
 * Review Base Schema
 *
 * Complete entity structure for accommodation reviews with all fields
 * and validation rules.
 *
 * @module schemas/entities/review/base
 */

import { z } from 'zod';

/**
 * Review status enumeration
 *
 * - draft: User is still editing
 * - published: Publicly visible review
 * - flagged: Reported for moderation
 * - deleted: Soft-deleted review
 */
export const ReviewStatusEnum = z.enum([
  'draft',
  'published',
  'flagged',
  'deleted',
]);

/**
 * Review rating validation
 *
 * Must be an integer between 1 and 5 (inclusive)
 */
export const ReviewRatingSchema = z
  .number()
  .int('Rating must be a whole number')
  .min(1, 'Rating must be at least 1')
  .max(5, 'Rating must be at most 5');

/**
 * Review comment validation
 *
 * Text content with length constraints and sanitization
 */
export const ReviewCommentSchema = z
  .string()
  .trim()
  .min(10, 'Comment must be at least 10 characters')
  .max(1000, 'Comment must not exceed 1000 characters')
  .regex(
    /^[a-zA-Z0-9\s.,!?áéíóúÁÉÍÓÚñÑ\-'"()]+$/,
    'Comment contains invalid characters'
  );

/**
 * Base Review Schema
 *
 * Complete entity structure with all fields and validations.
 * Used as foundation for CRUD and query schemas.
 *
 * @example
 * ```typescript
 * const review: ReviewType = {
 *   id: 'rev-123',
 *   rating: 5,
 *   comment: 'Excellent accommodation, highly recommended!',
 *   userId: 'user-456',
 *   accommodationId: 'acc-789',
 *   verifiedPurchase: true,
 *   status: 'published',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export const BaseReviewSchema = z.object({
  /**
   * Unique identifier (UUID format)
   */
  id: z.string().uuid(),

  /**
   * Numeric rating (1-5)
   */
  rating: ReviewRatingSchema,

  /**
   * Text review content
   */
  comment: ReviewCommentSchema,

  /**
   * Reference to User entity
   */
  userId: z.string().uuid(),

  /**
   * Reference to Accommodation entity
   */
  accommodationId: z.string().uuid(),

  /**
   * Whether review is from verified booking
   */
  verifiedPurchase: z.boolean().default(false),

  /**
   * Review lifecycle status
   */
  status: ReviewStatusEnum.default('draft'),

  /**
   * Creation timestamp
   */
  createdAt: z.date(),

  /**
   * Last update timestamp
   */
  updatedAt: z.date(),
});

/**
 * Review type inferred from base schema
 *
 * Use this type throughout the application instead of defining
 * separate interfaces.
 */
export type ReviewType = z.infer<typeof BaseReviewSchema>;

/**
 * Review status type
 */
export type ReviewStatus = z.infer<typeof ReviewStatusEnum>;
```

**Key Points**:

- **Field-Level Schemas**: Define reusable field validators (`ReviewRatingSchema`, `ReviewCommentSchema`)
- **Enums**: Use `z.enum()` for status values
- **Constraints**: Apply min/max, regex, and custom validations
- **Defaults**: Set default values with `.default()`
- **Documentation**: JSDoc for all exports and fields
- **Type Inference**: Export types via `z.infer<typeof schema>`

### CRUD Schemas

CRUD schemas adapt the base schema for create, update, and delete operations.

#### Create Schema

**File**: `src/entities/review/create.ts`

```typescript
/**
 * Review Create Schema
 *
 * Schema for creating new reviews. Omits auto-generated fields
 * and applies creation-specific validation rules.
 *
 * @module schemas/entities/review/create
 */

import { z } from 'zod';
import {
  BaseReviewSchema,
  ReviewStatusEnum,
  ReviewRatingSchema,
  ReviewCommentSchema,
} from './base';

/**
 * Create Review Schema
 *
 * Omits id and timestamps (auto-generated by database).
 * Enforces required fields for new reviews.
 *
 * @example
 * ```typescript
 * const input: CreateReviewInput = {
 *   rating: 5,
 *   comment: 'Amazing place, will visit again!',
 *   userId: 'user-123',
 *   accommodationId: 'acc-456',
 *   verifiedPurchase: true,
 * };
 *
 * const result = CreateReviewSchema.parse(input);
 * ```
 */
export const CreateReviewSchema = BaseReviewSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  /**
   * Rating is required for creation
   */
  rating: ReviewRatingSchema,

  /**
   * Comment is required for creation
   */
  comment: ReviewCommentSchema,

  /**
   * User ID is required
   */
  userId: z.string().uuid('Invalid user ID format'),

  /**
   * Accommodation ID is required
   */
  accommodationId: z.string().uuid('Invalid accommodation ID format'),

  /**
   * Status defaults to draft for new reviews
   */
  status: ReviewStatusEnum.optional().default('draft'),

  /**
   * Verified purchase flag (set by system based on booking)
   */
  verifiedPurchase: z.boolean().optional().default(false),
});

/**
 * Create Review input type
 */
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

/**
 * Strict Create Review Schema
 *
 * Variant that requires all fields explicitly (no defaults).
 * Useful for validating API requests where all data must be provided.
 */
export const StrictCreateReviewSchema = CreateReviewSchema.required({
  rating: true,
  comment: true,
  userId: true,
  accommodationId: true,
});

/**
 * Create Review with Business Rules
 *
 * Extends basic creation with business logic validation:
 * - Published reviews must be from verified purchases
 * - Draft reviews can be unverified
 */
export const CreateReviewWithRulesSchema = CreateReviewSchema.refine(
  (data) => {
    // Published reviews must be verified
    if (data.status === 'published' && !data.verifiedPurchase) {
      return false;
    }
    return true;
  },
  {
    message: 'Only verified purchases can publish reviews',
    path: ['verifiedPurchase'],
  }
);

/**
 * Create Review input with business rules
 */
export type CreateReviewWithRulesInput = z.infer<
  typeof CreateReviewWithRulesSchema
>;
```

**Key Points**:

- **Omit Auto-Generated**: Use `.omit()` to remove id and timestamps
- **Extend for Customization**: Override fields with `.extend()`
- **Defaults**: Set sensible defaults for optional fields
- **Variants**: Create strict and rule-based versions
- **Refinements**: Add cross-field validation with `.refine()`

#### Update Schema

**File**: `src/entities/review/update.ts`

```typescript
/**
 * Review Update Schema
 *
 * Schema for updating existing reviews. Makes most fields optional
 * and protects immutable fields.
 *
 * @module schemas/entities/review/update
 */

import { z } from 'zod';
import {
  BaseReviewSchema,
  ReviewRatingSchema,
  ReviewCommentSchema,
  ReviewStatusEnum,
} from './base';

/**
 * Update Review Schema
 *
 * Allows partial updates. Immutable fields are omitted.
 *
 * @example
 * ```typescript
 * // Update only rating
 * const update1: UpdateReviewInput = {
 *   rating: 4,
 * };
 *
 * // Update comment and status
 * const update2: UpdateReviewInput = {
 *   comment: 'Updated my review after revisiting',
 *   status: 'published',
 * };
 * ```
 */
export const UpdateReviewSchema = BaseReviewSchema.omit({
  id: true,
  userId: true,
  accommodationId: true,
  verifiedPurchase: true,
  createdAt: true,
  updatedAt: true,
}).partial();

/**
 * Update Review input type
 */
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

/**
 * Update Review with ID Schema
 *
 * Includes the ID for operations that need it in the payload.
 */
export const UpdateReviewWithIdSchema = UpdateReviewSchema.extend({
  id: z.string().uuid(),
});

/**
 * Patch Review Schema
 *
 * For HTTP PATCH operations with explicit null handling.
 */
export const PatchReviewSchema = z.object({
  rating: ReviewRatingSchema.optional(),
  comment: ReviewCommentSchema.optional(),
  status: ReviewStatusEnum.optional(),
});

/**
 * Update Review with Business Rules
 *
 * Enforces update-specific business rules:
 * - Cannot change status from published to draft
 * - Flagged reviews can only be updated by admins
 * - Deleted reviews cannot be updated
 */
export const UpdateReviewWithRulesSchema = UpdateReviewSchema.extend({
  currentStatus: ReviewStatusEnum,
}).refine(
  (data) => {
    // Cannot unpublish reviews
    if (data.currentStatus === 'published' && data.status === 'draft') {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot change published reviews back to draft',
    path: ['status'],
  }
).refine(
  (data) => {
    // Cannot update deleted reviews
    if (data.currentStatus === 'deleted') {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot update deleted reviews',
    path: ['currentStatus'],
  }
);

/**
 * Status Transition Schema
 *
 * Validates allowed status transitions.
 */
export const ReviewStatusTransitionSchema = z.object({
  from: ReviewStatusEnum,
  to: ReviewStatusEnum,
}).refine(
  (data) => {
    const allowedTransitions: Record<string, string[]> = {
      draft: ['published', 'deleted'],
      published: ['flagged', 'deleted'],
      flagged: ['published', 'deleted'],
      deleted: [], // No transitions from deleted
    };

    return allowedTransitions[data.from]?.includes(data.to) ?? false;
  },
  {
    message: 'Invalid status transition',
  }
);
```

**Key Points**:

- **Partial Updates**: Use `.partial()` for optional fields
- **Immutable Fields**: Omit userId, accommodationId, verifiedPurchase
- **Variants**: With ID, patch, business rules
- **State Transitions**: Validate allowed status changes
- **Timestamps**: Excluded (managed by database)

### Query Schemas

Query schemas define filters, search, and pagination for retrieving reviews.

**File**: `src/entities/review/query.ts`

```typescript
/**
 * Review Query Schemas
 *
 * Schemas for searching, filtering, and paginating reviews.
 *
 * @module schemas/entities/review/query
 */

import { z } from 'zod';
import { ReviewStatusEnum, ReviewRatingSchema } from './base';
import { PaginationSchema, SortOrderSchema } from '../../common/pagination';

/**
 * Review Filter Schema
 *
 * Filters for searching reviews.
 *
 * @example
 * ```typescript
 * const filter: ReviewFilterInput = {
 *   accommodationId: 'acc-123',
 *   minRating: 4,
 *   status: 'published',
 * };
 * ```
 */
export const ReviewFilterSchema = z.object({
  /**
   * Filter by accommodation
   */
  accommodationId: z.string().uuid().optional(),

  /**
   * Filter by user
   */
  userId: z.string().uuid().optional(),

  /**
   * Filter by status
   */
  status: ReviewStatusEnum.optional(),

  /**
   * Filter by verified purchase
   */
  verifiedPurchase: z.boolean().optional(),

  /**
   * Minimum rating (inclusive)
   */
  minRating: ReviewRatingSchema.optional(),

  /**
   * Maximum rating (inclusive)
   */
  maxRating: ReviewRatingSchema.optional(),

  /**
   * Created after date
   */
  createdAfter: z.coerce.date().optional(),

  /**
   * Created before date
   */
  createdBefore: z.coerce.date().optional(),
}).refine(
  (data) => {
    // Min rating must be <= max rating
    if (data.minRating && data.maxRating) {
      return data.minRating <= data.maxRating;
    }
    return true;
  },
  {
    message: 'Minimum rating must be less than or equal to maximum rating',
    path: ['minRating'],
  }
).refine(
  (data) => {
    // Created after must be before created before
    if (data.createdAfter && data.createdBefore) {
      return data.createdAfter <= data.createdBefore;
    }
    return true;
  },
  {
    message: 'Start date must be before end date',
    path: ['createdAfter'],
  }
);

/**
 * Review filter input type
 */
export type ReviewFilterInput = z.infer<typeof ReviewFilterSchema>;

/**
 * Review Sort Schema
 *
 * Sorting options for reviews.
 */
export const ReviewSortSchema = z.object({
  /**
   * Field to sort by
   */
  sortBy: z
    .enum(['rating', 'createdAt', 'updatedAt'])
    .optional()
    .default('createdAt'),

  /**
   * Sort order (asc/desc)
   */
  sortOrder: SortOrderSchema.optional().default('desc'),
});

/**
 * Search Review Schema
 *
 * Complete search query with filters, sorting, and pagination.
 *
 * @example
 * ```typescript
 * const searchQuery: SearchReviewInput = {
 *   accommodationId: 'acc-123',
 *   minRating: 4,
 *   status: 'published',
 *   page: 1,
 *   pageSize: 20,
 *   sortBy: 'createdAt',
 *   sortOrder: 'desc',
 * };
 * ```
 */
export const SearchReviewSchema = ReviewFilterSchema.merge(
  ReviewSortSchema
).merge(PaginationSchema);

/**
 * Search Review input type
 */
export type SearchReviewInput = z.infer<typeof SearchReviewSchema>;

/**
 * Full-Text Search Schema
 *
 * Text-based search in review comments.
 */
export const ReviewTextSearchSchema = z.object({
  /**
   * Search query (searches in comment field)
   */
  q: z
    .string()
    .trim()
    .min(3, 'Search query must be at least 3 characters')
    .optional(),

  /**
   * Include filters
   */
  filters: ReviewFilterSchema.optional(),

  /**
   * Pagination
   */
  pagination: PaginationSchema.optional(),
});

/**
 * Review Statistics Query Schema
 *
 * For fetching aggregated review statistics.
 */
export const ReviewStatsQuerySchema = z.object({
  /**
   * Accommodation ID for stats
   */
  accommodationId: z.string().uuid(),

  /**
   * Include time-series data
   */
  includeTimeSeries: z.boolean().optional().default(false),

  /**
   * Time range for time-series
   */
  timeRange: z
    .enum(['7d', '30d', '90d', '1y', 'all'])
    .optional()
    .default('all'),
});

/**
 * Review Moderation Query Schema
 *
 * For admin moderation queue.
 */
export const ReviewModerationQuerySchema = z.object({
  /**
   * Only flagged reviews
   */
  flaggedOnly: z.boolean().optional().default(true),

  /**
   * Include auto-flagged by system
   */
  includeAutoFlagged: z.boolean().optional().default(true),

  /**
   * Pagination
   */
  pagination: PaginationSchema.optional(),
});
```

**Key Points**:

- **Filters**: Combine multiple filter criteria
- **Validation**: Cross-field validation for ranges
- **Pagination**: Merge with common pagination schema
- **Sorting**: Configurable sort fields and order
- **Specialized Queries**: Stats, moderation, text search
- **Date Handling**: Use `z.coerce.date()` for flexible date parsing

### HTTP Schemas

HTTP schemas define request and response structures for API endpoints.

**File**: `src/entities/review/http.ts`

```typescript
/**
 * Review HTTP Schemas
 *
 * Request and response schemas for Review API endpoints.
 *
 * @module schemas/entities/review/http
 */

import { z } from 'zod';
import { BaseReviewSchema } from './base';
import { CreateReviewSchema, UpdateReviewSchema } from './create';
import { SearchReviewSchema } from './query';
import {
  SuccessResponseSchema,
  ErrorResponseSchema,
  PaginatedResponseSchema,
} from '../../common/http';

/**
 * Review Response Schema
 *
 * Single review with nested user and accommodation data.
 *
 * @example
 * ```typescript
 * const response: ReviewResponse = {
 *   id: 'rev-123',
 *   rating: 5,
 *   comment: 'Excellent!',
 *   user: {
 *     id: 'user-456',
 *     name: 'John Doe',
 *     avatar: 'https://...',
 *   },
 *   accommodation: {
 *     id: 'acc-789',
 *     title: 'Beach House',
 *     image: 'https://...',
 *   },
 *   verifiedPurchase: true,
 *   status: 'published',
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 * ```
 */
export const ReviewResponseSchema = BaseReviewSchema.extend({
  /**
   * Nested user data
   */
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    avatar: z.string().url().nullable(),
  }),

  /**
   * Nested accommodation data
   */
  accommodation: z.object({
    id: z.string().uuid(),
    title: z.string(),
    image: z.string().url().nullable(),
  }),
});

/**
 * Review response type
 */
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

/**
 * Review Summary Schema
 *
 * Minimal review data for lists and cards.
 */
export const ReviewSummarySchema = BaseReviewSchema.pick({
  id: true,
  rating: true,
  comment: true,
  status: true,
  createdAt: true,
}).extend({
  userName: z.string(),
  userAvatar: z.string().url().nullable(),
  verifiedPurchase: z.boolean(),
});

/**
 * Review summary type
 */
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;

/**
 * Create Review Request Schema
 *
 * HTTP request body for creating reviews.
 */
export const CreateReviewRequestSchema = CreateReviewSchema;

/**
 * Create Review Response Schema
 *
 * Successful creation response.
 */
export const CreateReviewResponseSchema = SuccessResponseSchema.extend({
  data: ReviewResponseSchema,
});

/**
 * Update Review Request Schema
 *
 * HTTP request body for updating reviews.
 */
export const UpdateReviewRequestSchema = UpdateReviewSchema;

/**
 * Update Review Response Schema
 *
 * Successful update response.
 */
export const UpdateReviewResponseSchema = SuccessResponseSchema.extend({
  data: ReviewResponseSchema,
});

/**
 * List Reviews Request Schema
 *
 * Query parameters for listing reviews.
 */
export const ListReviewsRequestSchema = SearchReviewSchema;

/**
 * List Reviews Response Schema
 *
 * Paginated list of reviews.
 */
export const ListReviewsResponseSchema = PaginatedResponseSchema.extend({
  data: z.array(ReviewSummarySchema),
});

/**
 * Get Review Request Schema
 *
 * Path parameters for retrieving single review.
 */
export const GetReviewRequestSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Get Review Response Schema
 *
 * Single review response.
 */
export const GetReviewResponseSchema = SuccessResponseSchema.extend({
  data: ReviewResponseSchema,
});

/**
 * Delete Review Request Schema
 *
 * Path parameters for deleting review.
 */
export const DeleteReviewRequestSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Delete Review Response Schema
 *
 * Deletion confirmation response.
 */
export const DeleteReviewResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    id: z.string().uuid(),
    deletedAt: z.date(),
  }),
});

/**
 * Review Statistics Response Schema
 *
 * Aggregated review statistics.
 */
export const ReviewStatsResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    total: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5),
    ratingDistribution: z.object({
      1: z.number().int().nonnegative(),
      2: z.number().int().nonnegative(),
      3: z.number().int().nonnegative(),
      4: z.number().int().nonnegative(),
      5: z.number().int().nonnegative(),
    }),
    verifiedPurchaseCount: z.number().int().nonnegative(),
    verifiedPercentage: z.number().min(0).max(100),
  }),
});

/**
 * Review Error Response Schema
 *
 * Error responses for review operations.
 */
export const ReviewErrorResponseSchema = ErrorResponseSchema;
```

**Key Points**:

- **Response Enhancement**: Add nested user/accommodation data
- **Request/Response Pairs**: Match each endpoint operation
- **Common Schemas**: Reuse success/error/paginated responses
- **Summary Views**: Lighter schemas for lists
- **Statistics**: Specialized response for aggregated data
- **Type Safety**: Full type inference for API contracts

### Relations Schema

Relations schemas define how reviews connect to other entities.

**File**: `src/entities/review/relations.ts`

```typescript
/**
 * Review Relations Schemas
 *
 * Schemas defining relationships between reviews and other entities.
 *
 * @module schemas/entities/review/relations
 */

import { z } from 'zod';
import { BaseReviewSchema } from './base';

/**
 * Review with User Schema
 *
 * Review including full user relation.
 */
export const ReviewWithUserSchema = BaseReviewSchema.extend({
  user: z.object({
    id: z.string().uuid(),
    clerkId: z.string(),
    email: z.string().email(),
    name: z.string(),
    avatar: z.string().url().nullable(),
    role: z.enum(['user', 'host', 'admin']),
    createdAt: z.date(),
  }),
});

/**
 * Review with user type
 */
export type ReviewWithUser = z.infer<typeof ReviewWithUserSchema>;

/**
 * Review with Accommodation Schema
 *
 * Review including full accommodation relation.
 */
export const ReviewWithAccommodationSchema = BaseReviewSchema.extend({
  accommodation: z.object({
    id: z.string().uuid(),
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    city: z.string(),
    pricePerNight: z.number(),
    maxGuests: z.number().int().positive(),
    images: z.array(z.string().url()),
    status: z.enum(['draft', 'published', 'archived', 'deleted']),
  }),
});

/**
 * Review with accommodation type
 */
export type ReviewWithAccommodation = z.infer<
  typeof ReviewWithAccommodationSchema
>;

/**
 * Review with All Relations Schema
 *
 * Complete review with all related entities.
 */
export const ReviewWithRelationsSchema = BaseReviewSchema.extend({
  user: ReviewWithUserSchema.shape.user,
  accommodation: ReviewWithAccommodationSchema.shape.accommodation,
  booking: z
    .object({
      id: z.string().uuid(),
      checkIn: z.date(),
      checkOut: z.date(),
      totalPrice: z.number(),
      status: z.enum([
        'pending',
        'confirmed',
        'cancelled',
        'completed',
        'refunded',
      ]),
    })
    .nullable(),
});

/**
 * Review with all relations type
 */
export type ReviewWithRelations = z.infer<typeof ReviewWithRelationsSchema>;

/**
 * User Reviews Schema
 *
 * All reviews by a specific user.
 */
export const UserReviewsSchema = z.object({
  userId: z.string().uuid(),
  reviews: z.array(ReviewWithAccommodationSchema),
  stats: z.object({
    total: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5),
    verifiedCount: z.number().int().nonnegative(),
  }),
});

/**
 * Accommodation Reviews Schema
 *
 * All reviews for a specific accommodation.
 */
export const AccommodationReviewsSchema = z.object({
  accommodationId: z.string().uuid(),
  reviews: z.array(ReviewWithUserSchema),
  stats: z.object({
    total: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5),
    ratingDistribution: z.object({
      1: z.number().int().nonnegative(),
      2: z.number().int().nonnegative(),
      3: z.number().int().nonnegative(),
      4: z.number().int().nonnegative(),
      5: z.number().int().nonnegative(),
    }),
    verifiedPercentage: z.number().min(0).max(100),
  }),
});
```

**Key Points**:

- **Nested Entities**: Include related user/accommodation data
- **Optional Relations**: Use `.nullable()` for optional relations
- **Aggregated Views**: User/accommodation-specific views with stats
- **Booking Context**: Include booking data when relevant
- **Type Safety**: Maintain type inference for all relations

### Exports

Barrel file to export all review schemas.

**File**: `src/entities/review/index.ts`

```typescript
/**
 * Review Schemas - Barrel Export
 *
 * Centralized exports for all review-related schemas.
 *
 * @module schemas/entities/review
 */

// Base schemas
export {
  BaseReviewSchema,
  ReviewStatusEnum,
  ReviewRatingSchema,
  ReviewCommentSchema,
  type ReviewType,
  type ReviewStatus,
} from './base';

// CRUD schemas
export {
  CreateReviewSchema,
  StrictCreateReviewSchema,
  CreateReviewWithRulesSchema,
  type CreateReviewInput,
  type CreateReviewWithRulesInput,
} from './create';

export {
  UpdateReviewSchema,
  UpdateReviewWithIdSchema,
  PatchReviewSchema,
  UpdateReviewWithRulesSchema,
  ReviewStatusTransitionSchema,
  type UpdateReviewInput,
} from './update';

// Query schemas
export {
  ReviewFilterSchema,
  ReviewSortSchema,
  SearchReviewSchema,
  ReviewTextSearchSchema,
  ReviewStatsQuerySchema,
  ReviewModerationQuerySchema,
  type ReviewFilterInput,
  type SearchReviewInput,
} from './query';

// HTTP schemas
export {
  ReviewResponseSchema,
  ReviewSummarySchema,
  CreateReviewRequestSchema,
  CreateReviewResponseSchema,
  UpdateReviewRequestSchema,
  UpdateReviewResponseSchema,
  ListReviewsRequestSchema,
  ListReviewsResponseSchema,
  GetReviewRequestSchema,
  GetReviewResponseSchema,
  DeleteReviewRequestSchema,
  DeleteReviewResponseSchema,
  ReviewStatsResponseSchema,
  ReviewErrorResponseSchema,
  type ReviewResponse,
  type ReviewSummary,
} from './http';

// Relations schemas
export {
  ReviewWithUserSchema,
  ReviewWithAccommodationSchema,
  ReviewWithRelationsSchema,
  UserReviewsSchema,
  AccommodationReviewsSchema,
  type ReviewWithUser,
  type ReviewWithAccommodation,
  type ReviewWithRelations,
} from './relations';
```

**Key Points**:

- **Organized Exports**: Group by category (base, CRUD, query, etc.)
- **Type Exports**: Export all inferred types
- **Clear Naming**: Descriptive names prevent conflicts
- **Single Import**: Users can import everything from `/review`

### Testing

Create comprehensive tests for all schemas.

**File**: `test/entities/review/base.test.ts` (example)

```typescript
/**
 * Review Base Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  BaseReviewSchema,
  ReviewRatingSchema,
  ReviewCommentSchema,
  ReviewStatusEnum,
  type ReviewType,
} from '../../../src/entities/review/base';

describe('ReviewRatingSchema', () => {
  it('should accept valid ratings', () => {
    expect(ReviewRatingSchema.parse(1)).toBe(1);
    expect(ReviewRatingSchema.parse(3)).toBe(3);
    expect(ReviewRatingSchema.parse(5)).toBe(5);
  });

  it('should reject ratings below 1', () => {
    expect(() => ReviewRatingSchema.parse(0)).toThrow();
    expect(() => ReviewRatingSchema.parse(-1)).toThrow();
  });

  it('should reject ratings above 5', () => {
    expect(() => ReviewRatingSchema.parse(6)).toThrow();
    expect(() => ReviewRatingSchema.parse(10)).toThrow();
  });

  it('should reject non-integer ratings', () => {
    expect(() => ReviewRatingSchema.parse(3.5)).toThrow('whole number');
  });
});

describe('ReviewCommentSchema', () => {
  it('should accept valid comments', () => {
    const validComment = 'Great place, highly recommended!';
    expect(ReviewCommentSchema.parse(validComment)).toBe(validComment);
  });

  it('should reject comments under 10 characters', () => {
    expect(() => ReviewCommentSchema.parse('Too short')).toThrow('at least 10');
  });

  it('should reject comments over 1000 characters', () => {
    const longComment = 'a'.repeat(1001);
    expect(() => ReviewCommentSchema.parse(longComment)).toThrow('not exceed 1000');
  });

  it('should trim whitespace', () => {
    const result = ReviewCommentSchema.parse('  Valid comment text  ');
    expect(result).toBe('Valid comment text');
  });

  it('should reject invalid characters', () => {
    expect(() => ReviewCommentSchema.parse('Invalid <script> tag')).toThrow(
      'invalid characters'
    );
  });
});

describe('BaseReviewSchema', () => {
  const validReview: ReviewType = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    rating: 5,
    comment: 'Excellent accommodation!',
    userId: '123e4567-e89b-12d3-a456-426614174001',
    accommodationId: '123e4567-e89b-12d3-a456-426614174002',
    verifiedPurchase: true,
    status: 'published',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should accept valid review', () => {
    const result = BaseReviewSchema.parse(validReview);
    expect(result).toMatchObject(validReview);
  });

  it('should reject invalid UUID format', () => {
    const invalid = { ...validReview, id: 'not-a-uuid' };
    expect(() => BaseReviewSchema.parse(invalid)).toThrow();
  });

  it('should apply default status', () => {
    const withoutStatus = { ...validReview };
    delete (withoutStatus as Partial<ReviewType>).status;
    const result = BaseReviewSchema.parse(withoutStatus);
    expect(result.status).toBe('draft');
  });

  it('should apply default verifiedPurchase', () => {
    const withoutVerified = { ...validReview };
    delete (withoutVerified as Partial<ReviewType>).verifiedPurchase;
    const result = BaseReviewSchema.parse(withoutVerified);
    expect(result.verifiedPurchase).toBe(false);
  });
});
```

### Usage Examples

#### In Service Layer

```typescript
/**
 * Review Service Example
 */

import { injectable } from 'tsyringe';
import type { CreateReviewInput, SearchReviewInput, ReviewType } from '@repo/schemas';
import { CreateReviewSchema, SearchReviewSchema } from '@repo/schemas';
import { ReviewModel } from '@repo/db';

@injectable()
export class ReviewService {
  constructor(private reviewModel: ReviewModel) {}

  /**
   * Create new review
   */
  async create(input: CreateReviewInput): Promise<ReviewType> {
    // Validate input
    const validated = CreateReviewSchema.parse(input);

    // Business logic
    await this.checkUserCanReview(validated.userId, validated.accommodationId);

    // Create review
    const review = await this.reviewModel.create(validated);

    return review;
  }

  /**
   * Search reviews
   */
  async search(input: SearchReviewInput): Promise<ReviewType[]> {
    // Validate search params
    const validated = SearchReviewSchema.parse(input);

    // Query database
    const reviews = await this.reviewModel.findMany({
      where: {
        accommodationId: validated.accommodationId,
        status: validated.status,
        rating: {
          gte: validated.minRating,
          lte: validated.maxRating,
        },
      },
      orderBy: {
        [validated.sortBy]: validated.sortOrder,
      },
      skip: (validated.page - 1) * validated.pageSize,
      take: validated.pageSize,
    });

    return reviews;
  }

  /**
   * Check if user can review accommodation
   */
  private async checkUserCanReview(
    userId: string,
    accommodationId: string
  ): Promise<void> {
    // Business logic implementation
    // ...
  }
}
```

#### In API Routes (Hono)

```typescript
/**
 * Review API Routes Example
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateReviewRequestSchema,
  SearchReviewSchema,
  GetReviewRequestSchema,
} from '@repo/schemas';
import { ReviewService } from '../services';

const app = new Hono();

/**
 * POST /reviews - Create review
 */
app.post(
  '/',
  zValidator('json', CreateReviewRequestSchema),
  async (c) => {
    const input = c.req.valid('json');
    const reviewService = c.get('reviewService') as ReviewService;

    const review = await reviewService.create(input);

    return c.json({
      success: true,
      data: review,
    }, 201);
  }
);

/**
 * GET /reviews - List reviews
 */
app.get(
  '/',
  zValidator('query', SearchReviewSchema),
  async (c) => {
    const query = c.req.valid('query');
    const reviewService = c.get('reviewService') as ReviewService;

    const reviews = await reviewService.search(query);

    return c.json({
      success: true,
      data: reviews,
    });
  }
);

/**
 * GET /reviews/:id - Get review
 */
app.get(
  '/:id',
  zValidator('param', GetReviewRequestSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const reviewService = c.get('reviewService') as ReviewService;

    const review = await reviewService.findById(id);

    return c.json({
      success: true,
      data: review,
    });
  }
);

export default app;
```

## Best Practices

### Schema Design

1. **Start with Base Schema**: Define complete entity structure first
2. **Derive Other Schemas**: Use `.omit()`, `.pick()`, `.extend()`, `.partial()`
3. **Single Source of Truth**: Base schema is the reference
4. **Type Inference**: Always use `z.infer<typeof schema>` for types

### Field Validation

1. **Be Specific**: Use precise validation (min/max, regex, format)
2. **Clear Messages**: Provide helpful error messages
3. **Defaults**: Set sensible defaults where appropriate
4. **Transformations**: Use `.trim()`, `.toLowerCase()` for normalization

### Business Rules

1. **Use Refinements**: Complex validation with `.refine()`
2. **Cross-Field Validation**: Validate relationships between fields
3. **Document Rules**: JSDoc explaining business logic
4. **Error Paths**: Specify which field caused the error

### Organization

1. **Barrel Exports**: Use `index.ts` for clean imports
2. **Consistent Naming**: `{Entity}{Variant}Schema` pattern
3. **Logical Grouping**: Related schemas in same file
4. **Avoid Circular Dependencies**: Be careful with cross-entity relations

### Performance

1. **Reuse Schemas**: Don't recreate schemas repeatedly
2. **Lazy Validation**: Use `.safeParse()` when errors are expected
3. **Selective Parsing**: Only validate what you need
4. **Cache Parsed Results**: Don't re-parse the same data

## Common Patterns

### Extending Base Schema

```typescript
// Add fields
const ExtendedSchema = BaseSchema.extend({
  newField: z.string(),
});

// Override fields
const OverriddenSchema = BaseSchema.extend({
  existingField: z.string().optional(), // Make optional
});
```

### Conditional Fields

```typescript
const ConditionalSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('A'),
    fieldA: z.string(),
  }),
  z.object({
    type: z.literal('B'),
    fieldB: z.number(),
  }),
]);
```

### Transform Data

```typescript
const TransformSchema = z.object({
  email: z.string().email().toLowerCase(),
  phone: z.string().transform((val) => val.replace(/\D/g, '')),
});
```

### Optional with Default

```typescript
const WithDefaultSchema = z.object({
  status: z.enum(['active', 'inactive']).optional().default('active'),
  count: z.number().int().optional().default(0),
});
```

## Troubleshooting

### Common Errors

**Error: "Expected X, received Y"**

- **Cause**: Type mismatch
- **Fix**: Check input data type, use transformations if needed

**Error: "Required" on optional field**

- **Cause**: Missing `.optional()` or `.nullable()`
- **Fix**: Add `.optional()` to field definition

**Error: Circular dependency**

- **Cause**: Two schemas reference each other
- **Fix**: Use `z.lazy()` for recursive schemas

**Error: "Invalid UUID"**

- **Cause**: ID not in UUID format
- **Fix**: Ensure IDs are valid UUIDs or use different validation

### Debugging Tips

1. **Use `safeParse()`**: Get detailed error information
2. **Check Error Path**: See which field failed validation
3. **Test Incrementally**: Validate fields one at a time
4. **Log Input Data**: Compare with schema requirements

### Performance Issues

1. **Avoid Deep Nesting**: Keep schema depth manageable
2. **Use Selective Validation**: Only validate necessary fields
3. **Cache Schemas**: Don't recreate schemas in loops
4. **Profile Validation**: Identify slow validators

## Next Steps

- **[Schema Composition](./composition.md)**: Learn advanced composition patterns
- **[Validation Patterns](./validation-patterns.md)**: Explore validation strategies
- **[Enums Guide](./enums.md)**: Master enumeration usage
- **[Testing Guide](./testing.md)**: Write comprehensive schema tests
- **[API Reference](../api/README.md)**: Complete schema reference

## Related Documentation

- **[Portal](../portal.md)**: Package overview
- **[Quick Start](../quick-start.md)**: Get started quickly
- **[Type Inference](../concepts/type-inference.md)**: Type system deep dive
- **[Schema Reference](../api/schema-reference.md)**: Complete API docs
