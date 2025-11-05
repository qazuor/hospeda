# Schema Composition Guide

Advanced patterns for composing, reusing, and combining Zod schemas in Hospeda.

## Table of Contents

- [Overview](#overview)
- [Core Composition Methods](#core-composition-methods)
  - [extend()](#extend)
  - [merge()](#merge)
  - [pick()](#pick)
  - [omit()](#omit)
  - [partial()](#partial)
  - [required()](#required)
- [Reusability Patterns](#reusability-patterns)
  - [Shared Field Groups](#shared-field-groups)
  - [Base Schema Patterns](#base-schema-patterns)
  - [Generic Schemas](#generic-schemas)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)
- [Common Pitfalls](#common-pitfalls)

## Overview

Schema composition is the practice of building complex schemas from simpler, reusable parts. This approach:

- **Reduces Duplication**: Write field definitions once, use everywhere
- **Maintains Consistency**: Changes propagate automatically
- **Improves Maintainability**: Update in one place affects all consumers
- **Enables Flexibility**: Mix and match schemas for different use cases

### When to Use Composition

- Multiple entities share common fields (audit fields, location, contact info)
- Creating CRUD variants from a base schema
- Building API request/response schemas
- Implementing multi-step forms
- Supporting different user roles or permissions

## Core Composition Methods

### extend()

Adds or overrides fields in an existing schema.

#### Syntax

```typescript
const ExtendedSchema = BaseSchema.extend({
  newField: z.string(),
  existingField: z.string().optional(), // Override
});
```

#### Adding Fields

```typescript
import { z } from 'zod';

const UserBaseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});

// Add admin-specific fields
const AdminUserSchema = UserBaseSchema.extend({
  role: z.literal('admin'),
  permissions: z.array(z.string()),
  lastLoginAt: z.date().nullable(),
});

type AdminUser = z.infer<typeof AdminUserSchema>;
// {
//   id: string;
//   email: string;
//   name: string;
//   role: 'admin';
//   permissions: string[];
//   lastLoginAt: Date | null;
// }
```

#### Overriding Fields

```typescript
const UserWithOptionalEmailSchema = UserBaseSchema.extend({
  email: z.string().email().optional(), // Override to make optional
});

// Change field type
const UserWithNumericIdSchema = UserBaseSchema.extend({
  id: z.number().int().positive(), // Change from UUID to number
});

// Add constraints
const UserWithVerifiedEmailSchema = UserBaseSchema.extend({
  email: z.string().email().endsWith('@hospeda.com'), // Add domain restriction
});
```

#### Practical Example: Accommodation Variants

```typescript
const BaseAccommodationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  status: z.enum(['draft', 'published', 'archived']),
});

// Hotel-specific fields
const HotelSchema = BaseAccommodationSchema.extend({
  type: z.literal('hotel'),
  starRating: z.number().int().min(1).max(5),
  roomCount: z.number().int().positive(),
  hasPool: z.boolean(),
  hasGym: z.boolean(),
  hasRestaurant: z.boolean(),
});

// Vacation rental-specific fields
const VacationRentalSchema = BaseAccommodationSchema.extend({
  type: z.literal('vacation_rental'),
  bedrooms: z.number().int().positive(),
  bathrooms: z.number().positive(),
  maxGuests: z.number().int().positive(),
  hasKitchen: z.boolean(),
});

// Hostel-specific fields
const HostelSchema = BaseAccommodationSchema.extend({
  type: z.literal('hostel'),
  dormBeds: z.number().int().positive(),
  privateBeds: z.number().int().nonnegative(),
  sharedBathrooms: z.boolean(),
  hasLounge: z.boolean(),
});
```

### merge()

Combines two schemas, with conflicts resolved by the second schema.

#### Syntax

```typescript
const MergedSchema = SchemaA.merge(SchemaB);
```

#### Basic Merge

```typescript
const LocationSchema = z.object({
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  zipCode: z.string().optional(),
  country: z.string().default('Argentina'),
});

const ContactSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  email: z.string().email(),
  website: z.string().url().optional(),
});

// Combine location and contact
const LocationWithContactSchema = LocationSchema.merge(ContactSchema);

type LocationWithContact = z.infer<typeof LocationWithContactSchema>;
// {
//   address: string;
//   city: string;
//   state: string;
//   zipCode?: string;
//   country: string;
//   phone: string;
//   email: string;
//   website?: string;
// }
```

#### Conflict Resolution

```typescript
const SchemaA = z.object({
  name: z.string(),
  value: z.number(),
  shared: z.string(),
});

const SchemaB = z.object({
  value: z.string(), // Conflicts with SchemaA
  shared: z.string().optional(), // Conflicts with SchemaA
  extra: z.boolean(),
});

// SchemaB wins for conflicts
const Merged = SchemaA.merge(SchemaB);

type MergedType = z.infer<typeof Merged>;
// {
//   name: string;
//   value: string;      // From SchemaB (overrides number)
//   shared?: string;    // From SchemaB (now optional)
//   extra: boolean;
// }
```

#### Practical Example: Full Accommodation Schema

```typescript
const BaseInfoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(5).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(20).max(2000),
});

const LocationSchema = z.object({
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  zipCode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const ContactSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  email: z.string().email(),
  website: z.string().url().optional(),
});

const PricingSchema = z.object({
  pricePerNight: z.number().positive(),
  cleaningFee: z.number().nonnegative(),
  currency: z.string().length(3).default('ARS'),
  weekendSurcharge: z.number().min(0).max(1).default(0),
});

const AmenitiesSchema = z.object({
  amenities: z.array(z.string()),
  features: z.array(z.string()),
  rules: z.array(z.string()),
});

const AuditSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

// Compose complete accommodation schema
const CompleteAccommodationSchema = BaseInfoSchema
  .merge(LocationSchema)
  .merge(ContactSchema)
  .merge(PricingSchema)
  .merge(AmenitiesSchema)
  .merge(AuditSchema);
```

### pick()

Selects specific fields from a schema.

#### Syntax

```typescript
const PickedSchema = BaseSchema.pick({
  field1: true,
  field2: true,
});
```

#### Creating Summary Schemas

```typescript
const AccommodationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  address: z.string(),
  city: z.string(),
  pricePerNight: z.number(),
  images: z.array(z.string().url()),
  rating: z.number(),
  reviewCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Summary for list views
const AccommodationSummarySchema = AccommodationSchema.pick({
  id: true,
  title: true,
  city: true,
  pricePerNight: true,
  images: true,
  rating: true,
});

// Card view
const AccommodationCardSchema = AccommodationSchema.pick({
  id: true,
  title: true,
  slug: true,
  city: true,
  pricePerNight: true,
  images: true,
  rating: true,
  reviewCount: true,
});

// Admin list view
const AccommodationAdminListSchema = AccommodationSchema.pick({
  id: true,
  title: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});
```

#### Public vs Private Views

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  clerkId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().url().nullable(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['user', 'host', 'admin']),
  emailVerified: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Public profile
const PublicUserProfileSchema = UserSchema.pick({
  id: true,
  name: true,
  avatar: true,
  bio: true,
  createdAt: true,
});

// Private profile (user viewing own profile)
const PrivateUserProfileSchema = UserSchema.pick({
  id: true,
  email: true,
  name: true,
  avatar: true,
  bio: true,
  phone: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
});
```

### omit()

Removes specific fields from a schema.

#### Syntax

```typescript
const OmittedSchema = BaseSchema.omit({
  field1: true,
  field2: true,
});
```

#### Creating CRUD Schemas

```typescript
const BaseBookingSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accommodationId: z.string().uuid(),
  checkIn: z.date(),
  checkOut: z.date(),
  guests: z.number().int().positive(),
  totalPrice: z.number().positive(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

// Create schema - omit auto-generated fields
const CreateBookingSchema = BaseBookingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
});

// Update schema - omit immutable and auto-generated fields
const UpdateBookingSchema = BaseBookingSchema.omit({
  id: true,
  userId: true,
  accommodationId: true,
  createdAt: true,
  deletedAt: true,
}).partial();
```

#### Removing Sensitive Fields

```typescript
const UserWithPasswordSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  passwordHash: z.string(),
  passwordSalt: z.string(),
  apiKey: z.string(),
  role: z.enum(['user', 'admin']),
});

// Public-safe user schema
const SafeUserSchema = UserWithPasswordSchema.omit({
  passwordHash: true,
  passwordSalt: true,
  apiKey: true,
});
```

### partial()

Makes all fields optional.

#### Syntax

```typescript
const PartialSchema = BaseSchema.partial();
```

#### Update Schemas

```typescript
const AccommodationSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  city: z.string(),
  pricePerNight: z.number().positive(),
  maxGuests: z.number().int().positive(),
});

// All fields optional for updates
const UpdateAccommodationSchema = AccommodationSchema.partial();

type UpdateAccommodation = z.infer<typeof UpdateAccommodationSchema>;
// {
//   title?: string;
//   description?: string;
//   city?: string;
//   pricePerNight?: number;
//   maxGuests?: number;
// }
```

#### Selective Partial

```typescript
// Make only some fields optional
const PartiallyOptionalSchema = AccommodationSchema.partial({
  description: true,
  city: true,
});

type PartiallyOptional = z.infer<typeof PartiallyOptionalSchema>;
// {
//   title: string;          // Still required
//   description?: string;   // Now optional
//   city?: string;          // Now optional
//   pricePerNight: number;  // Still required
//   maxGuests: number;      // Still required
// }
```

### required()

Makes all fields required (removes optionality).

#### Syntax

```typescript
const RequiredSchema = BaseSchema.required();
```

#### Strict Validation

```typescript
const OptionalFieldsSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

// Require all fields
const RequiredFieldsSchema = OptionalFieldsSchema.required();

type RequiredFields = z.infer<typeof RequiredFieldsSchema>;
// {
//   name: string;    // No longer optional
//   email: string;   // No longer optional
//   phone: string;   // No longer optional
//   bio: string;     // No longer optional
// }
```

#### Selective Required

```typescript
// Require only specific fields
const SelectivelyRequiredSchema = OptionalFieldsSchema.required({
  name: true,
  email: true,
});

type SelectivelyRequired = z.infer<typeof SelectivelyRequiredSchema>;
// {
//   name: string;     // Required
//   email: string;    // Required
//   phone?: string;   // Still optional
//   bio?: string;     // Still optional
// }
```

## Reusability Patterns

### Shared Field Groups

Create reusable "mixin" schemas for common field groups.

#### Audit Fields

```typescript
/**
 * Audit fields mixin
 *
 * Add to any entity that needs creation/update tracking
 */
export const AuditFieldsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

// Usage
const AccommodationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  // ... other fields
}).merge(AuditFieldsSchema);
```

#### Location Fields

```typescript
/**
 * Location fields mixin
 *
 * Standard location structure for all location-based entities
 */
export const LocationFieldsSchema = z.object({
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  zipCode: z.string().optional(),
  country: z.string().default('Argentina'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// Usage
const VenueSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
}).merge(LocationFieldsSchema);

const EventSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
}).merge(LocationFieldsSchema);
```

#### Contact Fields

```typescript
/**
 * Contact fields mixin
 */
export const ContactFieldsSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  socialMedia: z.object({
    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
    twitter: z.string().url().optional(),
  }).optional(),
});
```

#### SEO Fields

```typescript
/**
 * SEO fields mixin
 */
export const SEOFieldsSchema = z.object({
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  metaKeywords: z.array(z.string()).optional(),
  ogImage: z.string().url().optional(),
  canonicalUrl: z.string().url().optional(),
});
```

### Base Schema Patterns

#### Timestamped Base

```typescript
/**
 * Base schema with timestamps
 */
export const createTimestampedSchema = <T extends z.ZodRawShape>(
  shape: T
) => {
  return z.object({
    ...shape,
    createdAt: z.date(),
    updatedAt: z.date(),
  });
};

// Usage
const AccommodationSchema = createTimestampedSchema({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
});
```

#### Soft-Deletable Base

```typescript
/**
 * Base schema with soft delete support
 */
export const createSoftDeletableSchema = <T extends z.ZodRawShape>(
  shape: T
) => {
  return z.object({
    ...shape,
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().nullable(),
  });
};

// Usage
const UserSchema = createSoftDeletableSchema({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});
```

#### Lifecycle Status Base

```typescript
/**
 * Base schema with lifecycle status
 */
export const createLifecycleSchema = <T extends z.ZodRawShape>(
  shape: T
) => {
  return z.object({
    ...shape,
    status: z.enum(['draft', 'published', 'archived', 'deleted']).default('draft'),
    publishedAt: z.date().nullable(),
    archivedAt: z.date().nullable(),
  });
};

// Usage
const PostSchema = createLifecycleSchema({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
});
```

### Generic Schemas

#### Paginated Response

```typescript
/**
 * Generic paginated response schema
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) => {
  return z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  });
};

// Usage
const PaginatedAccommodationsSchema = createPaginatedResponseSchema(
  AccommodationSummarySchema
);

type PaginatedAccommodations = z.infer<typeof PaginatedAccommodationsSchema>;
// {
//   data: AccommodationSummary[];
//   pagination: {
//     page: number;
//     pageSize: number;
//     total: number;
//     totalPages: number;
//   };
// }
```

#### API Response Wrapper

```typescript
/**
 * Generic API response wrapper
 */
export const createApiResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T
) => {
  return z.object({
    success: z.boolean(),
    data: dataSchema,
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }).optional(),
  });
};

// Usage
const AccommodationResponseSchema = createApiResponseSchema(
  AccommodationSchema
);
```

## Real-World Examples

### Example 1: Multi-Step Form Schema

```typescript
/**
 * Accommodation creation - 4 step form
 */

// Step 1: Basic Info
const Step1Schema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(2000),
  type: z.enum(['hotel', 'vacation_rental', 'hostel', 'other']),
});

// Step 2: Location
const Step2Schema = LocationFieldsSchema;

// Step 3: Pricing & Capacity
const Step3Schema = z.object({
  pricePerNight: z.number().positive(),
  cleaningFee: z.number().nonnegative(),
  maxGuests: z.number().int().positive(),
  minNights: z.number().int().positive().default(1),
  maxNights: z.number().int().positive().optional(),
});

// Step 4: Amenities & Photos
const Step4Schema = z.object({
  amenities: z.array(z.string()).min(1),
  images: z.array(z.string().url()).min(1).max(20),
});

// Complete form schema (all steps combined)
const CompleteAccommodationFormSchema = Step1Schema
  .merge(Step2Schema)
  .merge(Step3Schema)
  .merge(Step4Schema);

// Individual step validation
export const validateStep1 = (data: unknown) => Step1Schema.parse(data);
export const validateStep2 = (data: unknown) => Step2Schema.parse(data);
export const validateStep3 = (data: unknown) => Step3Schema.parse(data);
export const validateStep4 = (data: unknown) => Step4Schema.parse(data);

// Final validation
export const validateCompleteForm = (data: unknown) =>
  CompleteAccommodationFormSchema.parse(data);
```

### Example 2: Role-Based Permissions

```typescript
/**
 * User schemas with role-based field access
 */

const BaseUserSchema = z.object({
  id: z.string().uuid(),
  clerkId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().url().nullable(),
  role: z.enum(['user', 'host', 'moderator', 'admin']),
  status: z.enum(['active', 'suspended', 'banned']),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Public view (anyone can see)
export const PublicUserSchema = BaseUserSchema.pick({
  id: true,
  name: true,
  avatar: true,
  createdAt: true,
});

// Self view (user viewing own profile)
export const SelfUserSchema = BaseUserSchema.omit({
  // Hide nothing - user sees everything
});

// Host view (host viewing user who booked)
export const HostViewUserSchema = BaseUserSchema.pick({
  id: true,
  name: true,
  avatar: true,
  email: true,
  createdAt: true,
});

// Moderator view
export const ModeratorUserSchema = BaseUserSchema.pick({
  id: true,
  clerkId: true,
  email: true,
  name: true,
  avatar: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

// Admin view (sees everything + can modify)
export const AdminUserSchema = BaseUserSchema.extend({
  lastLoginAt: z.date().nullable(),
  loginCount: z.number().int().nonnegative(),
  apiKey: z.string().nullable(),
  permissions: z.array(z.string()),
});
```

### Example 3: Privacy-Aware Profile

```typescript
/**
 * User profile with privacy controls
 */

const FullUserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().url().nullable(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  location: z.object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
  }).optional(),
  socialLinks: z.object({
    website: z.string().url().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),
  }).optional(),
  settings: z.object({
    showEmail: z.boolean(),
    showPhone: z.boolean(),
    showLocation: z.boolean(),
    showSocialLinks: z.boolean(),
  }),
  createdAt: z.date(),
});

/**
 * Build profile schema based on privacy settings
 */
export const buildProfileSchema = (settings: {
  showEmail: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showSocialLinks: boolean;
}) => {
  let schema = FullUserProfileSchema.pick({
    id: true,
    name: true,
    avatar: true,
    bio: true,
    createdAt: true,
  });

  if (settings.showEmail) {
    schema = schema.merge(FullUserProfileSchema.pick({ email: true }));
  }

  if (settings.showPhone) {
    schema = schema.merge(FullUserProfileSchema.pick({ phone: true }));
  }

  if (settings.showLocation) {
    schema = schema.merge(FullUserProfileSchema.pick({ location: true }));
  }

  if (settings.showSocialLinks) {
    schema = schema.merge(FullUserProfileSchema.pick({ socialLinks: true }));
  }

  return schema;
};
```

## Best Practices

### 1. Start with Base, Derive Everything

```typescript
// ✅ Good: Single source of truth
const BaseSchema = z.object({ /* ... */ });
const CreateSchema = BaseSchema.omit({ id: true, createdAt: true });
const UpdateSchema = CreateSchema.partial();

// ❌ Bad: Duplicated definitions
const CreateSchema = z.object({ /* ... */ });
const UpdateSchema = z.object({ /* ... */ }); // Manual duplication
```

### 2. Keep Mixins Focused

```typescript
// ✅ Good: Single responsibility
const AuditFields = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ❌ Bad: Mixed concerns
const MixedFields = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
  title: z.string(),        // Doesn't belong in audit fields
  description: z.string(),
});
```

### 3. Use Descriptive Names

```typescript
// ✅ Good: Clear intent
const PublicAccommodationSchema = /* ... */;
const AdminAccommodationSchema = /* ... */;
const CreateAccommodationSchema = /* ... */;

// ❌ Bad: Ambiguous
const AccommodationSchema1 = /* ... */;
const AccommodationSchema2 = /* ... */;
```

### 4. Document Composition Logic

```typescript
/**
 * Complete Accommodation Schema
 *
 * Composed from:
 * - BaseInfo: Core accommodation fields
 * - Location: Address and coordinates
 * - Contact: Phone, email, website
 * - Pricing: Rates and fees
 * - Amenities: Features and rules
 * - Audit: Timestamps and user tracking
 */
export const CompleteAccommodationSchema = BaseInfoSchema
  .merge(LocationSchema)
  .merge(ContactSchema)
  .merge(PricingSchema)
  .merge(AmenitiesSchema)
  .merge(AuditSchema);
```

### 5. Test Composed Schemas

```typescript
import { describe, it, expect } from 'vitest';

describe('CompleteAccommodationSchema', () => {
  it('should include all fields from composed schemas', () => {
    const result = CompleteAccommodationSchema.safeParse({
      // Fields from BaseInfo
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Test Accommodation',
      // Fields from Location
      address: '123 Main St',
      city: 'Buenos Aires',
      // Fields from Contact
      email: 'test@example.com',
      // Fields from Pricing
      pricePerNight: 100,
      // Fields from Amenities
      amenities: ['wifi'],
      // Fields from Audit
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result.success).toBe(true);
  });
});
```

## Common Pitfalls

### 1. Merge Conflicts

```typescript
// ⚠️ Problem: Conflicting field types
const SchemaA = z.object({
  value: z.number(),
});

const SchemaB = z.object({
  value: z.string(), // Conflicts!
});

const Merged = SchemaA.merge(SchemaB);
// SchemaB wins, value is now string

// ✅ Solution: Resolve explicitly
const Resolved = SchemaA.omit({ value: true }).merge(SchemaB);
```

### 2. Over-Composition

```typescript
// ❌ Bad: Too many merges, hard to understand
const ComplexSchema = BaseSchema
  .merge(Schema1)
  .merge(Schema2)
  .merge(Schema3)
  .merge(Schema4)
  .merge(Schema5)
  .merge(Schema6);

// ✅ Better: Group logically
const CoreSchema = BaseSchema.merge(Schema1).merge(Schema2);
const ExtendedSchema = CoreSchema.merge(Schema3).merge(Schema4);
const CompleteSchema = ExtendedSchema.merge(Schema5).merge(Schema6);
```

### 3. Circular Dependencies

```typescript
// ❌ Problem: Schemas reference each other
const UserSchema = z.object({
  id: z.string(),
  posts: z.array(PostSchema), // Error: PostSchema not defined yet
});

const PostSchema = z.object({
  id: z.string(),
  author: UserSchema, // Circular reference
});

// ✅ Solution: Use z.lazy()
const UserSchema: z.ZodType<User> = z.object({
  id: z.string(),
  posts: z.lazy(() => z.array(PostSchema)),
});

const PostSchema: z.ZodType<Post> = z.object({
  id: z.string(),
  author: z.lazy(() => UserSchema),
});
```

### 4. Lost Type Safety

```typescript
// ❌ Bad: Any type
const processData = (data: any) => {
  const schema = BaseSchema.merge(SomeOtherSchema);
  return schema.parse(data);
};

// ✅ Good: Explicit types
const processData = (data: unknown): CompleteData => {
  return CompleteDataSchema.parse(data);
};

type CompleteData = z.infer<typeof CompleteDataSchema>;
```

### 5. Forgetting to Export Types

```typescript
// ❌ Bad: Only schema exported
export const UserSchema = z.object({ /* ... */ });

// ✅ Good: Export both
export const UserSchema = z.object({ /* ... */ });
export type User = z.infer<typeof UserSchema>;
```

## Next Steps

- **[Validation Patterns](./validation-patterns.md)**: Advanced validation techniques
- **[Enums Guide](./enums.md)**: Working with enumerations
- **[Testing Guide](./testing.md)**: Testing composed schemas
- **[Creating Schemas](./creating-schemas.md)**: Full entity schema tutorial

## Related Documentation

- **[Portal](../portal.md)**: Package overview
- **[Quick Start](../quick-start.md)**: Get started quickly
- **[Type Inference](../concepts/type-inference.md)**: Type system deep dive
