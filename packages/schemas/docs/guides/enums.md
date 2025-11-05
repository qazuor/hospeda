# Enums Guide

Complete guide to using enumerations in Hospeda schemas with Zod.

## Table of Contents

- [Overview](#overview)
- [Enum Syntax](#enum-syntax)
- [Enum Categories](#enum-categories)
  - [Lifecycle Enums](#lifecycle-enums)
  - [Role and Permission Enums](#role-and-permission-enums)
  - [Entity-Specific Enums](#entity-specific-enums)
  - [Technical Enums](#technical-enums)
- [Creating New Enums](#creating-new-enums)
- [Using Enums in Schemas](#using-enums-in-schemas)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)

## Overview

Enums provide a way to define a fixed set of named values, ensuring that a field can only contain one of the predefined options.

### Benefits of Enums

- **Type Safety**: Compile-time and runtime validation
- **Auto-completion**: IDE support with IntelliSense
- **Documentation**: Self-documenting valid values
- **Consistency**: Prevents typos and invalid values
- **Refactoring**: Easy to rename or add values

### When to Use Enums

- **Fixed set of options**: Status values, types, categories
- **Business constants**: Roles, permissions, priorities
- **State machines**: Workflow states, transitions
- **Configuration**: Feature flags, modes, levels

## Enum Syntax

### Zod Enum

Preferred method for string literal unions.

```typescript
import { z } from 'zod';

// Define enum
export const StatusEnum = z.enum(['draft', 'published', 'archived']);

// Infer type
export type Status = z.infer<typeof StatusEnum>;
// type Status = 'draft' | 'published' | 'archived'

// Use in schema
const PostSchema = z.object({
  status: StatusEnum,
});

// Access enum values
StatusEnum.enum.draft; // 'draft'
StatusEnum.enum.published; // 'published'

// Get all values
StatusEnum.options; // ['draft', 'published', 'archived']
```

### Native TypeScript Enum

For numeric enums or when interoperating with existing TypeScript enums.

```typescript
// TypeScript enum
enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
  Critical = 4,
}

// Zod schema
const PrioritySchema = z.nativeEnum(Priority);

// Use in schema
const TaskSchema = z.object({
  priority: PrioritySchema,
});

// Usage
Priority.High; // 3
```

### Literal Unions

For simple cases with few options.

```typescript
const TypeSchema = z.union([
  z.literal('hotel'),
  z.literal('hostel'),
  z.literal('vacation_rental'),
]);

// Or more concise with enum
const TypeEnum = z.enum(['hotel', 'hostel', 'vacation_rental']);
```

## Enum Categories

### Lifecycle Enums

Enums for entity lifecycle and visibility management.

#### Lifecycle Status

```typescript
/**
 * Lifecycle Status Enum
 *
 * Standard status for entities with draft/publish workflow
 *
 * - draft: Work in progress, not public
 * - published: Live and visible to users
 * - archived: Hidden but preserved
 * - deleted: Soft-deleted, recoverable
 */
export const LifecycleStatusEnum = z.enum([
  'draft',
  'published',
  'archived',
  'deleted',
]);

export type LifecycleStatus = z.infer<typeof LifecycleStatusEnum>;

// Usage
const AccommodationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: LifecycleStatusEnum.default('draft'),
  publishedAt: z.date().nullable(),
});
```

#### Visibility Enum

```typescript
/**
 * Visibility Enum
 *
 * Control who can see an entity
 */
export const VisibilityEnum = z.enum([
  'public',      // Everyone
  'unlisted',    // Anyone with link
  'private',     // Owner only
  'restricted',  // Specific users/groups
]);

export type Visibility = z.infer<typeof VisibilityEnum>;

// Usage
const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  visibility: VisibilityEnum.default('public'),
  allowedUsers: z.array(z.string().uuid()).optional(),
});
```

#### Moderation Status

```typescript
/**
 * Moderation Status Enum
 *
 * For content that requires review
 */
export const ModerationStatusEnum = z.enum([
  'pending',     // Awaiting review
  'approved',    // Passed moderation
  'rejected',    // Failed moderation
  'flagged',     // Reported by users
  'reviewing',   // Currently being reviewed
]);

export type ModerationStatus = z.infer<typeof ModerationStatusEnum>;
```

### Role and Permission Enums

#### User Roles

```typescript
/**
 * User Role Enum
 *
 * Hierarchical role system
 */
export const UserRoleEnum = z.enum([
  'user',          // Regular user
  'host',          // Accommodation owner
  'moderator',     // Content moderator
  'admin',         // System administrator
  'super_admin',   // Full access
]);

export type UserRole = z.infer<typeof UserRoleEnum>;

// Role hierarchy helper
export const roleHierarchy: Record<UserRole, number> = {
  user: 1,
  host: 2,
  moderator: 3,
  admin: 4,
  super_admin: 5,
};

export const hasRoleOrHigher = (
  userRole: UserRole,
  requiredRole: UserRole
): boolean => {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};
```

#### Permissions

```typescript
/**
 * Permission Enum
 *
 * Granular permission system
 */
export const PermissionEnum = z.enum([
  // Accommodation permissions
  'accommodation:create',
  'accommodation:read',
  'accommodation:update',
  'accommodation:delete',
  'accommodation:publish',

  // Booking permissions
  'booking:create',
  'booking:read',
  'booking:update',
  'booking:cancel',
  'booking:refund',

  // User permissions
  'user:read',
  'user:update',
  'user:delete',
  'user:impersonate',

  // Review permissions
  'review:create',
  'review:read',
  'review:update',
  'review:delete',
  'review:moderate',

  // Admin permissions
  'admin:access',
  'admin:settings',
  'admin:users',
  'admin:reports',
]);

export type Permission = z.infer<typeof PermissionEnum>;

// Role-permission mapping
export const rolePermissions: Record<UserRole, Permission[]> = {
  user: [
    'accommodation:read',
    'booking:create',
    'booking:read',
    'review:create',
    'review:read',
  ],
  host: [
    'accommodation:create',
    'accommodation:read',
    'accommodation:update',
    'accommodation:publish',
    'booking:read',
    'booking:update',
    'review:read',
  ],
  moderator: [
    'accommodation:read',
    'booking:read',
    'review:read',
    'review:moderate',
    'user:read',
  ],
  admin: [
    'accommodation:create',
    'accommodation:read',
    'accommodation:update',
    'accommodation:delete',
    'booking:read',
    'booking:cancel',
    'booking:refund',
    'review:moderate',
    'user:read',
    'user:update',
    'admin:access',
    'admin:users',
  ],
  super_admin: PermissionEnum.options, // All permissions
};
```

#### Subscription Tiers

```typescript
/**
 * Subscription Tier Enum
 *
 * Pricing tiers for hosts
 */
export const SubscriptionTierEnum = z.enum([
  'free',
  'basic',
  'professional',
  'enterprise',
]);

export type SubscriptionTier = z.infer<typeof SubscriptionTierEnum>;

// Tier features
export const tierFeatures: Record<SubscriptionTier, {
  maxListings: number;
  commissionRate: number;
  prioritySupport: boolean;
  analytics: boolean;
  customBranding: boolean;
}> = {
  free: {
    maxListings: 1,
    commissionRate: 0.15,
    prioritySupport: false,
    analytics: false,
    customBranding: false,
  },
  basic: {
    maxListings: 5,
    commissionRate: 0.12,
    prioritySupport: false,
    analytics: true,
    customBranding: false,
  },
  professional: {
    maxListings: 20,
    commissionRate: 0.10,
    prioritySupport: true,
    analytics: true,
    customBranding: true,
  },
  enterprise: {
    maxListings: Infinity,
    commissionRate: 0.08,
    prioritySupport: true,
    analytics: true,
    customBranding: true,
  },
};
```

### Entity-Specific Enums

#### Accommodation Type

```typescript
/**
 * Accommodation Type Enum
 *
 * Different types of lodging
 */
export const AccommodationTypeEnum = z.enum([
  'hotel',
  'hostel',
  'vacation_rental',
  'apartment',
  'cabin',
  'villa',
  'bed_and_breakfast',
  'resort',
  'other',
]);

export type AccommodationType = z.infer<typeof AccommodationTypeEnum>;
```

#### Booking Status

```typescript
/**
 * Booking Status Enum
 *
 * Lifecycle of a booking
 */
export const BookingStatusEnum = z.enum([
  'pending',      // Awaiting payment
  'confirmed',    // Payment received
  'cancelled',    // Cancelled by user/host
  'completed',    // Stay completed
  'refunded',     // Payment refunded
  'no_show',      // Guest didn't arrive
]);

export type BookingStatus = z.infer<typeof BookingStatusEnum>;

// State machine transitions
export const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  cancelled: ['refunded'],
  completed: ['refunded'], // Partial refunds
  refunded: [], // Final state
  no_show: ['refunded'],
};

export const canTransitionBooking = (
  from: BookingStatus,
  to: BookingStatus
): boolean => {
  return bookingTransitions[from]?.includes(to) ?? false;
};
```

#### Payment Status

```typescript
/**
 * Payment Status Enum
 *
 * Payment processing states
 */
export const PaymentStatusEnum = z.enum([
  'pending',       // Awaiting payment
  'processing',    // Payment in progress
  'paid',          // Successfully paid
  'failed',        // Payment failed
  'refunded',      // Full refund
  'partially_refunded', // Partial refund
  'disputed',      // Chargeback/dispute
]);

export type PaymentStatus = z.infer<typeof PaymentStatusEnum>;

// Payment method enum
export const PaymentMethodEnum = z.enum([
  'credit_card',
  'debit_card',
  'mercadopago',
  'bank_transfer',
  'cash',
]);

export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
```

#### Event Category

```typescript
/**
 * Event Category Enum
 *
 * Tourism event categories
 */
export const EventCategoryEnum = z.enum([
  'cultural',
  'sports',
  'music',
  'gastronomy',
  'art',
  'nature',
  'education',
  'business',
  'religious',
  'other',
]);

export type EventCategory = z.infer<typeof EventCategoryEnum>;
```

### Technical Enums

#### Error Codes

```typescript
/**
 * Error Code Enum
 *
 * Standard application error codes
 */
export const ErrorCodeEnum = z.enum([
  // Validation errors (400)
  'VALIDATION_ERROR',
  'INVALID_INPUT',
  'MISSING_REQUIRED_FIELD',

  // Authentication errors (401)
  'UNAUTHORIZED',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',

  // Authorization errors (403)
  'FORBIDDEN',
  'INSUFFICIENT_PERMISSIONS',

  // Not found errors (404)
  'NOT_FOUND',
  'RESOURCE_NOT_FOUND',

  // Conflict errors (409)
  'CONFLICT',
  'DUPLICATE_ENTRY',
  'RESOURCE_ALREADY_EXISTS',

  // Business logic errors (422)
  'BUSINESS_RULE_VIOLATION',
  'INVALID_STATE_TRANSITION',
  'INSUFFICIENT_CAPACITY',

  // Server errors (500)
  'INTERNAL_ERROR',
  'DATABASE_ERROR',
  'EXTERNAL_SERVICE_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCodeEnum>;
```

#### Log Levels

```typescript
/**
 * Log Level Enum
 *
 * Standard logging levels
 */
export const LogLevelEnum = z.enum([
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
]);

export type LogLevel = z.infer<typeof LogLevelEnum>;
```

#### Notification Types

```typescript
/**
 * Notification Type Enum
 *
 * Types of system notifications
 */
export const NotificationTypeEnum = z.enum([
  'booking_confirmation',
  'booking_cancellation',
  'payment_received',
  'payment_failed',
  'review_received',
  'message_received',
  'accommodation_approved',
  'accommodation_rejected',
  'system_announcement',
]);

export type NotificationType = z.infer<typeof NotificationTypeEnum>;

// Notification channels
export const NotificationChannelEnum = z.enum([
  'email',
  'sms',
  'push',
  'in_app',
]);

export type NotificationChannel = z.infer<typeof NotificationChannelEnum>;
```

## Creating New Enums

### Step-by-Step Guide

1. **Define the enum values**

```typescript
export const MyEnum = z.enum([
  'value1',
  'value2',
  'value3',
]);
```

2. **Infer the TypeScript type**

```typescript
export type MyEnumType = z.infer<typeof MyEnum>;
```

3. **Add JSDoc documentation**

```typescript
/**
 * My Enum
 *
 * Description of what this enum represents
 *
 * - value1: Description of value1
 * - value2: Description of value2
 * - value3: Description of value3
 */
export const MyEnum = z.enum([
  'value1',
  'value2',
  'value3',
]);
```

4. **Add to barrel exports**

```typescript
// enums/index.ts
export { MyEnum, type MyEnumType } from './my-enum';
```

### Naming Conventions

```typescript
// ✅ Good: Clear, descriptive names
export const BookingStatusEnum = z.enum(['pending', 'confirmed']);
export const UserRoleEnum = z.enum(['user', 'admin']);
export const AccommodationTypeEnum = z.enum(['hotel', 'hostel']);

// ❌ Bad: Ambiguous names
export const StatusEnum = z.enum(['pending', 'confirmed']); // Status of what?
export const TypeEnum = z.enum(['user', 'admin']); // Type of what?
```

### Value Naming

```typescript
// ✅ Good: lowercase with underscores
export const StatusEnum = z.enum([
  'pending_approval',
  'in_progress',
  'completed',
]);

// ✅ Good: lowercase with hyphens (URLs, slugs)
export const CategoryEnum = z.enum([
  'bed-and-breakfast',
  'vacation-rental',
]);

// ❌ Bad: Mixed case, spaces
export const StatusEnum = z.enum([
  'PendingApproval',  // Use lowercase
  'in progress',      // Use underscores or hyphens
]);
```

## Using Enums in Schemas

### Basic Usage

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  role: UserRoleEnum,
  status: LifecycleStatusEnum,
});
```

### With Defaults

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  role: UserRoleEnum.default('user'),
  status: LifecycleStatusEnum.default('draft'),
  visibility: VisibilityEnum.default('public'),
});
```

### Optional Enums

```typescript
const EventSchema = z.object({
  id: z.string().uuid(),
  category: EventCategoryEnum.optional(),
  subcategory: EventCategoryEnum.nullable(),
});
```

### Enum Arrays

```typescript
const AccommodationSchema = z.object({
  id: z.string().uuid(),
  amenities: z.array(z.enum([
    'wifi',
    'parking',
    'pool',
    'gym',
    'kitchen',
  ])),
  allowedPaymentMethods: z.array(PaymentMethodEnum),
});
```

### Discriminated Unions

```typescript
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('booking_confirmation'),
    bookingId: z.string().uuid(),
    checkIn: z.date(),
    checkOut: z.date(),
  }),
  z.object({
    type: z.literal('payment_received'),
    paymentId: z.string().uuid(),
    amount: z.number(),
  }),
  z.object({
    type: z.literal('message_received'),
    messageId: z.string().uuid(),
    from: z.string(),
  }),
]);
```

## Best Practices

### 1. Use Enums for Fixed Sets

```typescript
// ✅ Good: Fixed set of statuses
const StatusEnum = z.enum(['draft', 'published', 'archived']);

// ❌ Bad: Open-ended values (use string instead)
const TagEnum = z.enum(['tag1', 'tag2', 'tag3']); // Tags are dynamic
```

### 2. Document Enum Values

```typescript
/**
 * Booking Status Enum
 *
 * - pending: Awaiting payment confirmation
 * - confirmed: Payment received, booking active
 * - cancelled: Cancelled by user or host
 * - completed: Stay completed successfully
 * - refunded: Payment refunded to user
 */
export const BookingStatusEnum = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'refunded',
]);
```

### 3. Consider Extensibility

```typescript
// ✅ Good: Includes 'other' for future flexibility
const AccommodationTypeEnum = z.enum([
  'hotel',
  'hostel',
  'vacation_rental',
  'other',
]);

// ❌ Bad: No escape hatch for new types
const AccommodationTypeEnum = z.enum([
  'hotel',
  'hostel',
  'vacation_rental',
]);
```

### 4. Group Related Enums

```typescript
// enums/booking.ts
export const BookingStatusEnum = z.enum([/* ... */]);
export const BookingCancellationReasonEnum = z.enum([/* ... */]);
export const BookingSourceEnum = z.enum([/* ... */]);

// enums/payment.ts
export const PaymentStatusEnum = z.enum([/* ... */]);
export const PaymentMethodEnum = z.enum([/* ... */]);
export const RefundReasonEnum = z.enum([/* ... */]);
```

### 5. Maintain Backwards Compatibility

```typescript
// ✅ Good: Add new values at the end
const StatusEnum = z.enum([
  'draft',
  'published',
  'archived',
  'scheduled', // New value added
]);

// ❌ Bad: Removing values breaks existing data
const StatusEnum = z.enum([
  'draft',
  'published',
  // 'archived' removed - BREAKING CHANGE!
]);

// ✅ Good: Deprecate instead
/**
 * @deprecated Use 'archived' instead
 */
const StatusEnum = z.enum([
  'draft',
  'published',
  'archived',
  'deleted', // Deprecated but kept for compatibility
]);
```

## Common Patterns

### State Machines

```typescript
/**
 * Booking state machine
 */

export const BookingStatusEnum = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'refunded',
]);

// Valid transitions
export const bookingStateTransitions: Record<
  BookingStatus,
  BookingStatus[]
> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  cancelled: ['refunded'],
  completed: ['refunded'],
  refunded: [],
};

// Validation helper
export const validateBookingTransition = (
  from: BookingStatus,
  to: BookingStatus
): boolean => {
  return bookingStateTransitions[from]?.includes(to) ?? false;
};

// Schema with transition validation
export const UpdateBookingStatusSchema = z.object({
  id: z.string().uuid(),
  status: BookingStatusEnum,
  _currentStatus: BookingStatusEnum,
}).refine(
  (data) => validateBookingTransition(data._currentStatus, data.status),
  {
    message: 'Invalid status transition',
    path: ['status'],
  }
);
```

### Feature Flags

```typescript
/**
 * Feature flags enum
 */

export const FeatureFlagEnum = z.enum([
  'new_search_ui',
  'instant_booking',
  'virtual_tours',
  'smart_pricing',
  'guest_verification',
]);

export type FeatureFlag = z.infer<typeof FeatureFlagEnum>;

// Feature flag configuration
export const featureFlags: Record<FeatureFlag, {
  enabled: boolean;
  rolloutPercentage: number;
  allowedRoles?: UserRole[];
}> = {
  new_search_ui: {
    enabled: true,
    rolloutPercentage: 100,
  },
  instant_booking: {
    enabled: true,
    rolloutPercentage: 50,
    allowedRoles: ['host', 'admin'],
  },
  virtual_tours: {
    enabled: false,
    rolloutPercentage: 0,
  },
  smart_pricing: {
    enabled: true,
    rolloutPercentage: 25,
    allowedRoles: ['admin'],
  },
  guest_verification: {
    enabled: true,
    rolloutPercentage: 100,
  },
};
```

### Routing

```typescript
/**
 * Route names enum for type-safe routing
 */

export const RouteNameEnum = z.enum([
  'home',
  'search',
  'accommodation_detail',
  'booking_checkout',
  'booking_confirmation',
  'user_profile',
  'user_bookings',
  'host_dashboard',
  'admin_panel',
]);

export type RouteName = z.infer<typeof RouteNameEnum>;

// Route configuration
export const routes: Record<RouteName, string> = {
  home: '/',
  search: '/search',
  accommodation_detail: '/accommodations/:id',
  booking_checkout: '/bookings/checkout',
  booking_confirmation: '/bookings/:id/confirmation',
  user_profile: '/profile',
  user_bookings: '/bookings',
  host_dashboard: '/host',
  admin_panel: '/admin',
};
```

## Next Steps

- **[Creating Schemas](./creating-schemas.md)**: Use enums in entity schemas
- **[Validation Patterns](./validation-patterns.md)**: Validate enum transitions
- **[Testing Guide](./testing.md)**: Test enum validations
- **[Composition](./composition.md)**: Combine schemas with enums

## Related Documentation

- **[Portal](../portal.md)**: Package overview
- **[Quick Start](../quick-start.md)**: Get started quickly
- **[Schema Reference](../api/schema-reference.md)**: Complete API docs
