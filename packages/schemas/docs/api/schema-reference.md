# Schema Reference - @repo/schemas

**Complete reference for all schemas in the @repo/schemas package**

This document provides comprehensive documentation of all available schemas, organized by category. Each schema includes field descriptions, validation rules, TypeScript types, and usage examples.

## Table of Contents

- [Entity Schemas](#entity-schemas)
  - [User](#user)
  - [Accommodation](#accommodation)
  - [Destination](#destination)
  - [Post](#post)
  - [Event](#event)
  - [Product](#product)
  - [Subscription](#subscription)
  - [Payment](#payment)
  - [Review](#review)
  - [Booking](#booking)
- [Common Schemas](#common-schemas)
- [Enum Schemas](#enum-schemas)
- [API Schemas](#api-schemas)
- [Utility Schemas](#utility-schemas)

## Entity Schemas

### User

User entity represents platform users (guests, hosts, admins, moderators).

#### Base Schema

```typescript
import { UserSchema, type User } from '@repo/schemas';
```

**Fields:**

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | `string` | Yes | Unique identifier | UUID |
| `slug` | `string` | Yes | URL-friendly username | Min 1 char |
| `email` | `string` | Yes | Email address | Valid email format |
| `displayName` | `string` | No | Public display name | 2-50 chars |
| `firstName` | `string` | No | First name | 2-50 chars |
| `lastName` | `string` | No | Last name | 2-50 chars |
| `birthDate` | `Date` | No | Birth date | Valid date |
| `phone` | `string` | No | Phone number | International format |
| `role` | `RoleEnum` | Yes | User role | 'user', 'moderator', 'admin' |
| `permissions` | `string[]` | Yes | Granted permissions | Array, default `[]` |
| `authProvider` | `string` | No | Auth provider | 'clerk', 'google', 'facebook' |
| `authProviderUserId` | `string` | No | Provider user ID | Min 1 char |
| `createdAt` | `Date` | Yes | Creation timestamp | Auto-generated |
| `updatedAt` | `Date` | Yes | Last update timestamp | Auto-updated |
| `deletedAt` | `Date` | No | Soft delete timestamp | Nullable |

**Base fields included:**
- `BaseAuditFields`: `createdAt`, `updatedAt`, `deletedAt`, `createdBy`, `updatedBy`
- `BaseLifecycleFields`: `lifecycleState`, `publishedAt`, `archivedAt`
- `BaseContactFields`: `email`, `phone`
- `FullLocationFields`: Address and coordinates
- `SocialNetworkFields`: Social media links

#### CRUD Schemas

**Create:**

```typescript
import { UserCreateInputSchema, type UserCreateInput } from '@repo/schemas';

// Omits: id, createdAt, updatedAt, deletedAt, createdBy, updatedBy
const createData: UserCreateInput = {
  slug: 'john-doe',
  email: 'john@example.com',
  displayName: 'John Doe',
  role: 'user',
  lifecycleState: 'draft'
};
```

**Update:**

```typescript
import { UserUpdateInputSchema, type UserUpdateInput } from '@repo/schemas';

// All fields optional except id (omitted)
const updateData: UserUpdateInput = {
  displayName: 'John Updated',
  phone: '+5491123456789'
};
```

**Delete:**

```typescript
import { UserDeleteInputSchema, type UserDeleteInput } from '@repo/schemas';

const deleteData: UserDeleteInput = {
  id: 'user-uuid',
  force: false // true for hard delete, false for soft delete
};
```

#### Query Schemas

**Search:**

```typescript
import { UserSearchInputSchema, type UserSearchInput } from '@repo/schemas';

const searchParams: UserSearchInput = {
  q: 'john',               // Full-text search
  role: 'user',            // Filter by role
  email: 'john@',          // Filter by email pattern
  isActive: true,          // Filter active users
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};
```

**List:**

```typescript
import { UserListInputSchema, type UserListInput } from '@repo/schemas';

const listParams: UserListInput = {
  role: 'user',
  page: 1,
  pageSize: 10
};
```

#### Relations Schemas

```typescript
import {
  UserWithProfileSchema,
  UserWithBookingsSchema,
  UserWithReviewsSchema,
  type UserWithProfile,
  type UserWithBookings
} from '@repo/schemas';
```

### Accommodation

Accommodation entity represents lodging places (hotels, apartments, hostels, etc.).

#### Base Schema

```typescript
import { AccommodationSchema, type Accommodation } from '@repo/schemas';
```

**Fields:**

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `id` | `string` | Yes | Unique identifier | UUID |
| `slug` | `string` | Yes | URL-friendly name | Min 1 char |
| `name` | `string` | Yes | Accommodation name | 1-255 chars |
| `description` | `string` | Yes | Full description | Min 10 chars |
| `shortDescription` | `string` | No | Brief description | Max 200 chars |
| `type` | `AccommodationTypeEnum` | Yes | Accommodation type | hotel, apartment, hostel, etc. |
| `destinationId` | `string` | Yes | Destination ID | UUID |
| `ownerId` | `string` | Yes | Owner user ID | UUID |
| `address` | `string` | Yes | Full address | 5-500 chars |
| `city` | `string` | Yes | City name | 2-100 chars |
| `state` | `string` | Yes | State/province | 2-100 chars |
| `country` | `string` | Yes | Country | Default 'Argentina' |
| `zipCode` | `string` | No | Postal code | Optional |
| `latitude` | `number` | No | GPS latitude | -90 to 90 |
| `longitude` | `number` | No | GPS longitude | -180 to 180 |
| `phone` | `string` | No | Contact phone | International format |
| `email` | `string` | No | Contact email | Valid email |
| `website` | `string` | No | Website URL | Valid URL |
| `checkInTime` | `string` | No | Check-in time | HH:mm format |
| `checkOutTime` | `string` | No | Check-out time | HH:mm format |
| `maxGuests` | `number` | Yes | Max guests | Min 1 |
| `bedrooms` | `number` | No | Number of bedrooms | Min 0 |
| `bathrooms` | `number` | No | Number of bathrooms | Min 0 |
| `pricePerNight` | `number` | No | Base price per night | Min 0 |
| `rating` | `number` | Yes | Average rating | 0-5, default 0 |
| `reviewCount` | `number` | Yes | Total reviews | Min 0, default 0 |
| `isActive` | `boolean` | Yes | Active status | Default true |
| `isFeatured` | `boolean` | Yes | Featured status | Default false |

**Additional nested schemas:**
- `AccommodationPriceSchema`: Detailed pricing with fees and discounts
- `AccommodationFaqSchema`: FAQ entries
- `AccommodationIaDataSchema`: AI-generated data

#### CRUD Schemas

Similar pattern to User (create omits system fields, update is partial).

#### Query Schemas

**Search with Filters:**

```typescript
import {
  AccommodationSearchInputSchema,
  type AccommodationSearchInput
} from '@repo/schemas';

const searchParams: AccommodationSearchInput = {
  q: 'beach house',
  destinationId: 'dest-uuid',
  type: 'apartment',
  minPrice: 50,
  maxPrice: 200,
  minGuests: 2,
  maxGuests: 6,
  bedrooms: 2,
  bathrooms: 1,
  amenities: ['wifi', 'pool', 'parking'],
  isFeatured: true,
  page: 1,
  pageSize: 20,
  sortBy: 'rating',
  sortOrder: 'desc'
};
```

### Destination

Destination entity represents cities/regions featured on the platform.

#### Base Schema

```typescript
import { DestinationSchema, type Destination } from '@repo/schemas';
```

**Key Fields:**

- `id`, `slug`, `name`, `description`
- `city`, `state`, `country`
- `latitude`, `longitude`
- `accommodationCount`, `eventCount`, `postCount`
- `rating`, `reviewCount`
- `isFeatured`, `isPopular`
- Images, videos, and media

#### Query Schemas

**Popular Destinations:**

```typescript
const popularParams = {
  isPopular: true,
  isFeatured: true,
  minRating: 4,
  page: 1,
  pageSize: 10
};
```

### Post

Post entity represents blog posts and articles about destinations and tourism.

#### Base Schema

```typescript
import { PostSchema, type Post } from '@repo/schemas';
```

**Key Fields:**

- `id`, `slug`, `title`, `content`
- `category`: PostCategoryEnum (guide, news, tips, etc.)
- `authorId`: User ID
- `destinationId`: Related destination (optional)
- `tags`: Array of tags
- `publishedAt`, `scheduledAt`
- `viewCount`, `likeCount`, `commentCount`
- `isFeatured`, `isSponsored`
- SEO metadata

**Content Structure:**

```typescript
{
  title: string;
  content: string; // Rich text/Markdown
  excerpt: string;
  coverImage: string; // URL
  tags: string[];
  category: PostCategoryEnum;
  seoTitle: string;
  seoDescription: string;
}
```

### Event

Event entity represents tourism events (festivals, concerts, exhibitions, etc.).

#### Base Schema

```typescript
import { EventSchema, type Event } from '@repo/schemas';
```

**Key Fields:**

- `id`, `slug`, `title`, `description`
- `category`: EventCategoryEnum (festival, concert, exhibition, etc.)
- `organizerId`: Event organizer ID
- `destinationId`: Related destination
- `locationId`: Specific location ID
- `startDate`, `endDate`, `startTime`, `endTime`
- `isRecurring`, `recurrence`: RecurrenceEnum
- `capacity`, `attendeeCount`
- `price`, `isFree`
- `registrationUrl`, `ticketUrl`
- `isFeatured`, `isCancelled`

**Date Handling:**

```typescript
{
  startDate: Date;
  endDate: Date;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timezone: string;
  isAllDay: boolean;
}
```

### Product

Product entity represents sellable items (listings, ads, premium features).

#### Base Schema

```typescript
import { ProductSchema, type Product } from '@repo/schemas';
```

**Key Fields:**

- `id`, `name`, `description`
- `type`: ProductTypeEnum (accommodation_listing, ad_campaign, premium_feature, etc.)
- `price`, `currency`
- `billingCycle`: BillingCycleEnum (monthly, yearly, one_time)
- `isActive`, `isFeatured`
- `metadata`: Flexible JSON data

**Product Types:**

- `accommodation_listing`: Premium listing feature
- `ad_campaign`: Advertising campaigns
- `premium_feature`: Platform features
- `sponsorship`: Sponsored content

### Subscription

Subscription entity tracks user subscriptions to products.

#### Base Schema

```typescript
import { SubscriptionSchema, type Subscription } from '@repo/schemas';
```

**Key Fields:**

- `id`, `userId`, `productId`
- `status`: SubscriptionStatusEnum (active, cancelled, expired, etc.)
- `startDate`, `endDate`
- `renewalDate`, `cancelledAt`
- `price`, `currency`
- `billingCycle`
- `autoRenew`

**Status Flow:**

```text
draft → active → [paused/cancelled] → expired
```

### Payment

Payment entity tracks all financial transactions.

#### Base Schema

```typescript
import { PaymentSchema, type Payment } from '@repo/schemas';
```

**Key Fields:**

- `id`, `userId`, `subscriptionId`
- `amount`, `currency`
- `status`: PaymentStatusEnum (pending, completed, failed, refunded)
- `method`: PaymentMethodEnum (credit_card, mercado_pago, etc.)
- `provider`: PaymentProviderEnum (mercadopago, stripe)
- `providerPaymentId`: External payment ID
- `providerStatus`: Provider-specific status
- `paidAt`, `refundedAt`

### Review

Review entities for accommodations and destinations.

#### AccommodationReview

```typescript
import { AccommodationReviewSchema } from '@repo/schemas';
```

**Fields:**

- `id`, `accommodationId`, `userId`
- `rating`: 1-5
- `title`, `comment`
- `pros`, `cons`: Arrays
- `visitDate`
- `isVerified`, `isRecommended`
- `helpfulCount`, `reportCount`

#### DestinationReview

Similar structure for destination reviews.

### Booking

Booking entity tracks accommodation reservations.

#### Base Schema

```typescript
import { BookingSchema, type Booking } from '@repo/schemas';
```

**Key Fields:**

- `id`, `accommodationId`, `guestId`
- `checkInDate`, `checkOutDate`
- `guests`, `adults`, `children`
- `totalPrice`, `currency`
- `status`: BookingStatusEnum (pending, confirmed, cancelled, completed)
- `paymentId`
- `specialRequests`
- `confirmedAt`, `cancelledAt`, `completedAt`

**Status Flow:**

```text
pending → confirmed → completed
            ↓
       cancelled
```

## Common Schemas

### Pagination

**Standard Pagination:**

```typescript
import { PaginationSchema, type PaginationType } from '@repo/schemas';

// Input
{
  page: number;      // Default 1
  pageSize: number;  // Default 10, max 100
}
```

**Cursor Pagination:**

```typescript
import {
  CursorPaginationParamsSchema,
  type CursorPaginationParamsType
} from '@repo/schemas';

// Input
{
  limit: number;      // Default 10, max 100
  cursor: string;     // Optional, for next page
  order: 'asc' | 'desc'; // Default 'desc'
  orderBy: string;    // Optional field name
}
```

**Pagination Result:**

```typescript
import { PaginationResultSchema } from '@repo/schemas';

// Generic output
{
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }
}
```

### Audit Fields

```typescript
import { BaseAuditFields } from '@repo/schemas';

// Fields
{
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null; // User ID
  updatedBy: string | null; // User ID
}
```

### Lifecycle Fields

```typescript
import { BaseLifecycleFields } from '@repo/schemas';

// Fields
{
  lifecycleState: LifecycleStateEnum; // draft, published, archived
  publishedAt: Date | null;
  archivedAt: Date | null;
}
```

### Visibility Fields

```typescript
import { BaseVisibilityFields } from '@repo/schemas';

// Fields
{
  visibility: VisibilityEnum; // public, private, unlisted
  isPublic: boolean;
}
```

### Location Fields

```typescript
import { FullLocationFields } from '@repo/schemas';

// Fields
{
  address: string;
  city: string;
  state: string;
  country: string;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
}
```

### Contact Fields

```typescript
import { BaseContactFields } from '@repo/schemas';

// Fields
{
  email: string;
  phone: string | null;
  website: string | null;
}
```

### Social Fields

```typescript
import { SocialNetworkFields } from '@repo/schemas';

// Fields
{
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
}
```

### SEO Fields

```typescript
import { BaseSeoFields } from '@repo/schemas';

// Fields
{
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  ogImage: string | null;
}
```

### Media Fields

```typescript
import { BaseMediaFields } from '@repo/schemas';

// Fields
{
  images: string[];       // Image URLs
  videos: string[];       // Video URLs
  coverImage: string | null;
  thumbnailImage: string | null;
}
```

## Enum Schemas

### Lifecycle State

```typescript
import { LifecycleStateEnumSchema, type LifecycleStateEnum } from '@repo/schemas';

// Values
type LifecycleStateEnum = 'draft' | 'published' | 'archived';
```

### Role

```typescript
import { RoleEnumSchema, type RoleEnum } from '@repo/schemas';

// Values
type RoleEnum = 'user' | 'moderator' | 'admin' | 'super_admin';
```

### Visibility

```typescript
import { VisibilityEnumSchema, type VisibilityEnum } from '@repo/schemas';

// Values
type VisibilityEnum = 'public' | 'private' | 'unlisted';
```

### Accommodation Type

```typescript
import { AccommodationTypeEnumSchema, type AccommodationTypeEnum } from '@repo/schemas';

// Values
type AccommodationTypeEnum =
  | 'hotel'
  | 'apartment'
  | 'house'
  | 'hostel'
  | 'cabin'
  | 'villa'
  | 'resort'
  | 'bed_and_breakfast'
  | 'campground'
  | 'other';
```

### Event Category

```typescript
import { EventCategoryEnumSchema, type EventCategoryEnum } from '@repo/schemas';

// Values
type EventCategoryEnum =
  | 'festival'
  | 'concert'
  | 'exhibition'
  | 'workshop'
  | 'conference'
  | 'sports'
  | 'food'
  | 'cultural'
  | 'other';
```

### Post Category

```typescript
import { PostCategoryEnumSchema, type PostCategoryEnum } from '@repo/schemas';

// Values
type PostCategoryEnum =
  | 'guide'
  | 'news'
  | 'tips'
  | 'review'
  | 'itinerary'
  | 'story'
  | 'other';
```

### Payment Status

```typescript
import { PaymentStatusEnumSchema, type PaymentStatusEnum } from '@repo/schemas';

// Values
type PaymentStatusEnum =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';
```

### Payment Method

```typescript
import { PaymentMethodEnumSchema, type PaymentMethodEnum } from '@repo/schemas';

// Values
type PaymentMethodEnum =
  | 'credit_card'
  | 'debit_card'
  | 'mercado_pago'
  | 'bank_transfer'
  | 'cash'
  | 'other';
```

### Subscription Status

```typescript
import { SubscriptionStatusEnumSchema, type SubscriptionStatusEnum } from '@repo/schemas';

// Values
type SubscriptionStatusEnum =
  | 'draft'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'past_due';
```

### Billing Cycle

```typescript
import { BillingCycleEnumSchema, type BillingCycleEnum } from '@repo/schemas';

// Values
type BillingCycleEnum =
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'yearly'
  | 'one_time';
```

### Currency

```typescript
import { CurrencyEnumSchema, type CurrencyEnum } from '@repo/schemas';

// Values
type CurrencyEnum = 'ARS' | 'USD' | 'EUR' | 'BRL';
```

## API Schemas

### Health Check

```typescript
import { HealthCheckSchema, type HealthCheck } from '@repo/schemas';

// Response
{
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: 'up' | 'down';
    cache: 'up' | 'down';
  };
}
```

### Error Response

```typescript
import { ErrorResponseSchema, type ErrorResponse } from '@repo/schemas';

// Structure
{
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### Success Response

```typescript
import { SuccessResponseSchema } from '@repo/schemas';

// Generic success wrapper
{
  success: true;
  data: T; // Generic type
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}
```

## Utility Schemas

### Slug Validation

```typescript
import { SlugRegex } from '@repo/schemas';

// Pattern: lowercase alphanumeric with hyphens
// Valid: 'my-slug', 'slug-123', 'a'
// Invalid: 'My-Slug', 'slug_name', 'slug--name', '-slug', 'slug-'
```

### Phone Number Validation

```typescript
import { InternationalPhoneRegex } from '@repo/schemas';

// Pattern: E.164 format
// Valid: '+5491123456789', '+1234567890'
// Invalid: '123456', '(11) 1234-5678'
```

### Time Validation

```typescript
import { TimeRegExp } from '@repo/schemas';

// Pattern: HH:mm (24-hour)
// Valid: '14:30', '09:00', '23:59'
// Invalid: '25:00', '14:60', '9:00'
```

### Coordinate Validation

```typescript
import { isValidLatitude, isValidLongitude } from '@repo/schemas';

// Latitude: -90 to 90
isValidLatitude('-34.603722'); // true
isValidLatitude('91'); // false

// Longitude: -180 to 180
isValidLongitude('-58.381592'); // true
isValidLongitude('181'); // false
```

### Social URL Validation

```typescript
import {
  FacebookUrlRegex,
  InstagramUrlRegex,
  TwitterUrlRegex,
  LinkedInUrlRegex,
  TikTokUrlRegex,
  YouTubeUrlRegex
} from '@repo/schemas';

// Validate social media URLs
const facebookRegex = FacebookUrlRegex;
facebookRegex.test('https://facebook.com/page'); // true
```

## Usage Patterns

### Creating New Entities

```typescript
// Import create schema
import { EntityCreateInputSchema, type EntityCreateInput } from '@repo/schemas';

// Define data
const data: EntityCreateInput = {
  // Required fields
  name: 'Example',
  // Optional fields
  description: 'Description'
};

// Validate
const result = EntityCreateInputSchema.safeParse(data);

if (result.success) {
  // Use validated data
  await entityService.create({ input: result.data });
}
```

### Updating Entities

```typescript
// Import update schema
import { EntityUpdateInputSchema, type EntityUpdateInput } from '@repo/schemas';

// Define update data (all fields optional)
const data: EntityUpdateInput = {
  name: 'Updated Name'
  // Only fields to update
};

// Validate
const result = EntityUpdateInputSchema.safeParse(data);

if (result.success) {
  await entityService.update({ id: entityId, input: result.data });
}
```

### Searching/Filtering

```typescript
// Import search schema
import { EntitySearchInputSchema, type EntitySearchInput } from '@repo/schemas';

// Define search parameters
const params: EntitySearchInput = {
  q: 'search term',
  filter1: 'value1',
  filter2: 'value2',
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

// Validate
const result = EntitySearchInputSchema.safeParse(params);

if (result.success) {
  const results = await entityService.search({ input: result.data });
}
```

### With Relations

```typescript
// Import relation schema
import { EntityWithRelationsSchema, type EntityWithRelations } from '@repo/schemas';

// Validate entity with relations
const result = EntityWithRelationsSchema.safeParse(data);

if (result.success) {
  // Access related data
  console.log(result.data.relatedEntity);
}
```

## Schema Composition Examples

### Extending Base Schema

```typescript
const BaseSchema = z.object({
  name: z.string(),
  description: z.string()
});

const ExtendedSchema = BaseSchema.extend({
  additionalField: z.string()
});
```

### Merging Schemas

```typescript
const SchemaA = z.object({
  field1: z.string()
});

const SchemaB = z.object({
  field2: z.number()
});

const MergedSchema = SchemaA.merge(SchemaB);
// { field1: string; field2: number }
```

### Picking Fields

```typescript
const FullSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  password: z.string()
});

const PublicSchema = FullSchema.pick({
  id: true,
  name: true,
  email: true
});
// { id: string; name: string; email: string }
```

### Omitting Fields

```typescript
const CreateSchema = FullSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
```

### Making Partial

```typescript
const UpdateSchema = BaseSchema.partial();
// All fields become optional
```

## Related Documentation

- **[Quick Start Guide](../quick-start.md)**: Get started with schemas
- **[Type Inference Guide](./type-inference.md)**: Advanced type patterns
- **[Validators Guide](./validators.md)**: Custom validation rules
- **[Main Documentation](../README.md)**: Package overview

## Need Help?

If you can't find a schema or need clarification:

1. Check the source code in `packages/schemas/src/`
2. Search for schema name in the repository
3. Review the [Main Documentation](../README.md)
4. Ask in team channels
