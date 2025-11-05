# Validation Patterns Guide

Comprehensive guide to validation patterns for different operations in Hospeda.

## Table of Contents

- [Overview](#overview)
- [Entity Lifecycle Validation](#entity-lifecycle-validation)
  - [Create Operations](#create-operations)
  - [Update Operations](#update-operations)
  - [Delete Operations](#delete-operations)
- [Query and Search Patterns](#query-and-search-patterns)
  - [Text Search](#text-search)
  - [Filter Combinations](#filter-combinations)
  - [Pagination](#pagination)
- [Business Logic Validation](#business-logic-validation)
  - [Cross-Field Validation](#cross-field-validation)
  - [Business Rules](#business-rules)
  - [Authorization Constraints](#authorization-constraints)
- [Complex Scenarios](#complex-scenarios)
  - [Multi-Step Forms](#multi-step-forms)
  - [Wizard Validation](#wizard-validation)
  - [Conditional Schemas](#conditional-schemas)
  - [Dynamic Validation](#dynamic-validation)
- [Performance and Error Handling](#performance-and-error-handling)

## Overview

Validation in Hospeda serves multiple purposes:

- **Data Integrity**: Ensure data meets requirements before persisting
- **Security**: Prevent injection attacks and malicious input
- **User Experience**: Provide clear, helpful error messages
- **Business Rules**: Enforce domain-specific constraints
- **Type Safety**: Runtime validation matching compile-time types

### Validation Flow

```
Input → Schema Parse → Validation → Business Rules → Database
   ↓         ↓             ↓             ↓              ↓
 JSON    Type Check    Constraints   Domain Logic   Persist
```

## Entity Lifecycle Validation

### Create Operations

Create operations require all mandatory fields and apply initial state constraints.

#### Basic Create Validation

```typescript
/**
 * User Creation Schema
 *
 * Validates new user registration
 */

import { z } from 'zod';

export const CreateUserSchema = z.object({
  /**
   * Email must be valid and lowercase
   */
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .max(255, 'Email too long'),

  /**
   * Name required, 2-100 characters
   */
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/, 'Name contains invalid characters'),

  /**
   * Password strength requirements
   */
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  /**
   * Password confirmation must match
   */
  passwordConfirmation: z.string(),

  /**
   * Optional fields with defaults
   */
  role: z.enum(['user', 'host']).default('user'),
  newsletter: z.boolean().default(false),
  terms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
}).refine(
  (data) => data.password === data.passwordConfirmation,
  {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  }
);

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

#### Accommodation Creation

```typescript
/**
 * Accommodation Creation Schema
 *
 * Complete validation for new accommodation listing
 */

export const CreateAccommodationSchema = z.object({
  // Basic Info
  title: z
    .string()
    .trim()
    .min(10, 'Title must be at least 10 characters')
    .max(200, 'Title must not exceed 200 characters'),

  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .min(5)
    .max(200),

  description: z
    .string()
    .trim()
    .min(50, 'Description must be at least 50 characters')
    .max(5000, 'Description must not exceed 5000 characters'),

  // Location (all required for creation)
  address: z.string().min(5).max(500),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  country: z.string().default('Argentina'),
  zipCode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),

  // Pricing
  pricePerNight: z
    .number()
    .positive('Price must be greater than 0')
    .max(1000000, 'Price seems unreasonably high'),

  cleaningFee: z.number().nonnegative().default(0),

  currency: z.string().length(3).toUpperCase().default('ARS'),

  // Capacity
  maxGuests: z
    .number()
    .int()
    .positive()
    .max(50, 'Maximum guests cannot exceed 50'),

  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().positive(),
  beds: z.number().int().positive(),

  // Availability
  minNights: z.number().int().positive().default(1),
  maxNights: z.number().int().positive().optional(),

  // Requirements
  amenities: z
    .array(z.string())
    .min(1, 'At least one amenity is required')
    .max(50, 'Too many amenities'),

  images: z
    .array(z.string().url())
    .min(1, 'At least one image is required')
    .max(20, 'Maximum 20 images allowed'),

  rules: z.array(z.string()).default([]),

  // Initial status
  status: z.enum(['draft', 'published']).default('draft'),
}).refine(
  (data) => {
    // Max nights must be >= min nights
    if (data.maxNights && data.maxNights < data.minNights) {
      return false;
    }
    return true;
  },
  {
    message: 'Maximum nights must be greater than or equal to minimum nights',
    path: ['maxNights'],
  }
);
```

#### Booking Creation

```typescript
/**
 * Booking Creation Schema
 *
 * Validates new booking with date and business rules
 */

export const CreateBookingSchema = z.object({
  accommodationId: z.string().uuid(),
  userId: z.string().uuid(),

  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),

  guests: z.number().int().positive(),

  specialRequests: z.string().max(1000).optional(),

  // Payment info
  paymentMethod: z.enum(['credit_card', 'debit_card', 'mercadopago']),
}).refine(
  (data) => {
    // Check-out must be after check-in
    return data.checkOut > data.checkIn;
  },
  {
    message: 'Check-out date must be after check-in date',
    path: ['checkOut'],
  }
).refine(
  (data) => {
    // Check-in cannot be in the past
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return data.checkIn >= now;
  },
  {
    message: 'Check-in date cannot be in the past',
    path: ['checkIn'],
  }
).refine(
  (data) => {
    // Calculate nights
    const nights = Math.ceil(
      (data.checkOut.getTime() - data.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    return nights >= 1 && nights <= 365;
  },
  {
    message: 'Booking must be between 1 and 365 nights',
    path: ['checkOut'],
  }
);
```

### Update Operations

Update operations allow partial updates while protecting immutable fields.

#### Basic Update Validation

```typescript
/**
 * User Update Schema
 *
 * Allows updating profile information
 * Immutable: email, role, createdAt
 */

export const UpdateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/)
    .optional(),

  avatar: z.string().url().nullable().optional(),

  bio: z.string().max(500).optional(),

  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/)
    .optional(),

  location: z.object({
    city: z.string(),
    state: z.string(),
    country: z.string(),
  }).optional(),

  preferences: z.object({
    newsletter: z.boolean(),
    notifications: z.boolean(),
    language: z.enum(['es', 'en']),
  }).optional(),
}).strict(); // Prevent unknown fields

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
```

#### Conditional Update Validation

```typescript
/**
 * Accommodation Update Schema
 *
 * Different rules based on current status
 */

export const UpdateAccommodationSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  description: z.string().min(50).max(5000).optional(),

  pricePerNight: z.number().positive().optional(),
  cleaningFee: z.number().nonnegative().optional(),

  maxGuests: z.number().int().positive().max(50).optional(),

  amenities: z.array(z.string()).min(1).max(50).optional(),
  images: z.array(z.string().url()).min(1).max(20).optional(),

  status: z.enum(['draft', 'published', 'archived']).optional(),

  // Current status needed for validation
  _currentStatus: z.enum(['draft', 'published', 'archived']),
}).refine(
  (data) => {
    // Cannot publish without required fields
    if (data.status === 'published' && data._currentStatus === 'draft') {
      // Would need to check if all required fields are present
      // This is typically done in service layer with full entity
      return true;
    }
    return true;
  },
  {
    message: 'Cannot publish incomplete accommodation',
    path: ['status'],
  }
).refine(
  (data) => {
    // Cannot unpublish (only archive)
    if (data._currentStatus === 'published' && data.status === 'draft') {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot move published accommodation back to draft. Use archive instead.',
    path: ['status'],
  }
);
```

#### Update with Version Control

```typescript
/**
 * Post Update Schema with Optimistic Locking
 */

export const UpdatePostSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  content: z.string().min(20).max(10000).optional(),
  tags: z.array(z.string()).max(10).optional(),

  // Version for optimistic locking
  version: z.number().int().nonnegative(),
}).refine(
  (data) => {
    // Version must be provided for updates
    return data.version !== undefined;
  },
  {
    message: 'Version is required for updates',
    path: ['version'],
  }
);
```

### Delete Operations

Delete operations often involve soft deletes with validation constraints.

#### Soft Delete Validation

```typescript
/**
 * Delete Accommodation Schema
 *
 * Validates soft delete operation
 */

export const DeleteAccommodationSchema = z.object({
  id: z.string().uuid(),

  /**
   * Reason for deletion (optional but recommended)
   */
  reason: z.enum([
    'no_longer_available',
    'duplicate',
    'policy_violation',
    'owner_request',
    'other',
  ]).optional(),

  /**
   * Additional details
   */
  notes: z.string().max(500).optional(),

  /**
   * Current state needed for validation
   */
  _currentStatus: z.enum(['draft', 'published', 'archived']),

  /**
   * Check for active bookings
   */
  _hasActiveBookings: z.boolean(),
}).refine(
  (data) => {
    // Cannot delete with active bookings
    return !data._hasActiveBookings;
  },
  {
    message: 'Cannot delete accommodation with active bookings',
    path: ['id'],
  }
);
```

## Query and Search Patterns

### Text Search

```typescript
/**
 * Text Search Schema
 *
 * Full-text search with filters
 */

export const SearchAccommodationSchema = z.object({
  /**
   * Search query (title, description)
   */
  q: z
    .string()
    .trim()
    .min(2, 'Search query must be at least 2 characters')
    .max(100)
    .optional(),

  /**
   * Location filters
   */
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),

  /**
   * Price range
   */
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().positive().optional(),

  /**
   * Guest count
   */
  guests: z.number().int().positive().optional(),

  /**
   * Date range
   */
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),

  /**
   * Amenities (AND logic)
   */
  amenities: z.array(z.string()).optional(),

  /**
   * Property type
   */
  type: z.enum(['hotel', 'vacation_rental', 'hostel', 'other']).optional(),

  /**
   * Sort options
   */
  sortBy: z
    .enum(['price', 'rating', 'distance', 'newest'])
    .default('rating'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  /**
   * Pagination
   */
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).refine(
  (data) => {
    // Max price must be >= min price
    if (data.minPrice && data.maxPrice) {
      return data.maxPrice >= data.minPrice;
    }
    return true;
  },
  {
    message: 'Maximum price must be greater than or equal to minimum price',
    path: ['maxPrice'],
  }
).refine(
  (data) => {
    // Check-out after check-in
    if (data.checkIn && data.checkOut) {
      return data.checkOut > data.checkIn;
    }
    return true;
  },
  {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  }
);
```

### Filter Combinations

```typescript
/**
 * Advanced Booking Filters
 *
 * Complex filter combinations for admin panel
 */

export const BookingFilterSchema = z.object({
  /**
   * Status filters
   */
  status: z
    .array(z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'refunded']))
    .optional(),

  /**
   * Date range filters
   */
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),

  checkInAfter: z.coerce.date().optional(),
  checkInBefore: z.coerce.date().optional(),

  /**
   * Amount range
   */
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().positive().optional(),

  /**
   * Entity filters
   */
  userId: z.string().uuid().optional(),
  accommodationId: z.string().uuid().optional(),
  hostId: z.string().uuid().optional(),

  /**
   * Payment filters
   */
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']).optional(),
  paymentMethod: z.enum(['credit_card', 'debit_card', 'mercadopago']).optional(),
}).refine(
  (data) => {
    // Validate date ranges
    if (data.createdAfter && data.createdBefore) {
      return data.createdBefore >= data.createdAfter;
    }
    return true;
  },
  {
    message: 'End date must be after start date',
    path: ['createdBefore'],
  }
).refine(
  (data) => {
    // Validate amount range
    if (data.minAmount && data.maxAmount) {
      return data.maxAmount >= data.minAmount;
    }
    return true;
  },
  {
    message: 'Maximum amount must be greater than minimum amount',
    path: ['maxAmount'],
  }
);
```

### Pagination

```typescript
/**
 * Cursor-Based Pagination Schema
 *
 * For infinite scroll and real-time updates
 */

export const CursorPaginationSchema = z.object({
  /**
   * Cursor for next page
   */
  cursor: z.string().optional(),

  /**
   * Number of items to fetch
   */
  limit: z.coerce.number().int().min(1).max(100).default(20),

  /**
   * Sort direction
   */
  direction: z.enum(['forward', 'backward']).default('forward'),
});

/**
 * Offset-Based Pagination Schema
 *
 * For traditional page-based navigation
 */

export const OffsetPaginationSchema = z.object({
  /**
   * Page number (1-indexed)
   */
  page: z.coerce.number().int().positive().default(1),

  /**
   * Items per page
   */
  pageSize: z.coerce.number().int().min(1).max(100).default(20),

  /**
   * Total count calculation (can be expensive)
   */
  includeTotalCount: z.boolean().default(true),
});
```

## Business Logic Validation

### Cross-Field Validation

```typescript
/**
 * Event Schema with Cross-Field Validation
 *
 * Multiple fields must be validated together
 */

export const CreateEventSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),

  startDate: z.coerce.date(),
  endDate: z.coerce.date(),

  registrationOpenDate: z.coerce.date(),
  registrationCloseDate: z.coerce.date(),

  capacity: z.number().int().positive(),
  minAttendees: z.number().int().nonnegative(),

  price: z.number().nonnegative(),
  earlyBirdPrice: z.number().nonnegative().optional(),
  earlyBirdDeadline: z.coerce.date().optional(),

  location: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('physical'),
      address: z.string().min(5),
      city: z.string(),
      capacity: z.number().int().positive(),
    }),
    z.object({
      type: z.literal('virtual'),
      platform: z.string(),
      meetingLink: z.string().url(),
      capacity: z.number().int().positive().optional(),
    }),
    z.object({
      type: z.literal('hybrid'),
      address: z.string().min(5),
      city: z.string(),
      platform: z.string(),
      meetingLink: z.string().url(),
      physicalCapacity: z.number().int().positive(),
      virtualCapacity: z.number().int().positive(),
    }),
  ]),
})
  // End date after start date
  .refine(
    (data) => data.endDate > data.startDate,
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    }
  )
  // Registration closes before event starts
  .refine(
    (data) => data.registrationCloseDate <= data.startDate,
    {
      message: 'Registration must close before event starts',
      path: ['registrationCloseDate'],
    }
  )
  // Registration opens before it closes
  .refine(
    (data) => data.registrationOpenDate < data.registrationCloseDate,
    {
      message: 'Registration open date must be before close date',
      path: ['registrationOpenDate'],
    }
  )
  // Min attendees <= capacity
  .refine(
    (data) => data.minAttendees <= data.capacity,
    {
      message: 'Minimum attendees cannot exceed capacity',
      path: ['minAttendees'],
    }
  )
  // Early bird validation
  .refine(
    (data) => {
      if (data.earlyBirdPrice !== undefined) {
        // Must have deadline
        if (!data.earlyBirdDeadline) return false;
        // Must be less than regular price
        if (data.earlyBirdPrice >= data.price) return false;
        // Deadline before registration closes
        if (data.earlyBirdDeadline >= data.registrationCloseDate) return false;
      }
      return true;
    },
    {
      message: 'Invalid early bird pricing configuration',
      path: ['earlyBirdPrice'],
    }
  );
```

### Business Rules

```typescript
/**
 * Review Schema with Business Rules
 *
 * Only verified bookings can leave reviews
 */

export const CreateReviewSchema = z.object({
  bookingId: z.string().uuid(),
  userId: z.string().uuid(),
  accommodationId: z.string().uuid(),

  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(1000),

  categories: z.object({
    cleanliness: z.number().int().min(1).max(5),
    communication: z.number().int().min(1).max(5),
    checkIn: z.number().int().min(1).max(5),
    accuracy: z.number().int().min(1).max(5),
    location: z.number().int().min(1).max(5),
    value: z.number().int().min(1).max(5),
  }),

  // Metadata for business rule validation
  _bookingStatus: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  _bookingCheckOut: z.date(),
  _existingReview: z.boolean(),
})
  // Can only review completed bookings
  .refine(
    (data) => data._bookingStatus === 'completed',
    {
      message: 'Can only review completed bookings',
      path: ['bookingId'],
    }
  )
  // Must wait until after checkout
  .refine(
    (data) => {
      const now = new Date();
      return now >= data._bookingCheckOut;
    },
    {
      message: 'Can only review after checkout date',
      path: ['bookingId'],
    }
  )
  // No duplicate reviews
  .refine(
    (data) => !data._existingReview,
    {
      message: 'You have already reviewed this accommodation',
      path: ['accommodationId'],
    }
  )
  // Overall rating should be close to category average
  .refine(
    (data) => {
      const categoryAvg =
        (data.categories.cleanliness +
          data.categories.communication +
          data.categories.checkIn +
          data.categories.accuracy +
          data.categories.location +
          data.categories.value) / 6;

      const diff = Math.abs(data.rating - categoryAvg);
      return diff <= 1; // Allow 1 point difference
    },
    {
      message: 'Overall rating should reflect category ratings',
      path: ['rating'],
    }
  );
```

### Authorization Constraints

```typescript
/**
 * Update Accommodation Schema with Role-Based Validation
 *
 * Different fields accessible based on user role
 */

export const createUpdateAccommodationSchema = (userRole: string) => {
  const baseSchema = z.object({
    title: z.string().min(10).max(200).optional(),
    description: z.string().min(50).max(5000).optional(),
    pricePerNight: z.number().positive().optional(),
  });

  // Hosts can update their own listings
  if (userRole === 'host') {
    return baseSchema.extend({
      status: z.enum(['draft', 'published']).optional(),
      // Cannot set to archived (admin only)
    });
  }

  // Admins can do anything
  if (userRole === 'admin') {
    return baseSchema.extend({
      status: z.enum(['draft', 'published', 'archived', 'deleted']).optional(),
      featured: z.boolean().optional(),
      priority: z.number().int().min(0).max(10).optional(),
    });
  }

  // Moderators can review but not modify
  if (userRole === 'moderator') {
    return z.object({
      status: z.enum(['published', 'archived']).optional(),
      moderationNotes: z.string().max(1000).optional(),
    });
  }

  // Default: no updates allowed
  return z.object({});
};
```

## Complex Scenarios

### Multi-Step Forms

```typescript
/**
 * Multi-Step Booking Form
 *
 * Each step has independent validation
 */

// Step 1: Select dates and guests
export const BookingStep1Schema = z.object({
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  guests: z.number().int().positive().max(20),
}).refine(
  (data) => data.checkOut > data.checkIn,
  {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  }
);

// Step 2: Guest information
export const BookingStep2Schema = z.object({
  guestName: z.string().min(2).max(100),
  guestEmail: z.string().email(),
  guestPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  specialRequests: z.string().max(1000).optional(),
});

// Step 3: Payment information
export const BookingStep3Schema = z.object({
  paymentMethod: z.enum(['credit_card', 'debit_card', 'mercadopago']),
  savePaymentMethod: z.boolean().default(false),
  acceptTerms: z.literal(true),
});

// Complete form (all steps)
export const CompleteBookingSchema = BookingStep1Schema
  .merge(BookingStep2Schema)
  .merge(BookingStep3Schema)
  .extend({
    accommodationId: z.string().uuid(),
    userId: z.string().uuid(),
  });
```

### Wizard Validation

```typescript
/**
 * Property Listing Wizard
 *
 * Progressive validation with state management
 */

export type WizardStep = 'basic' | 'location' | 'details' | 'pricing' | 'photos' | 'review';

export const createWizardSchema = (currentStep: WizardStep, direction: 'next' | 'back') => {
  // Only validate when moving forward
  if (direction === 'back') {
    return z.object({}).passthrough(); // Allow any data
  }

  switch (currentStep) {
    case 'basic':
      return z.object({
        title: z.string().min(10).max(200),
        type: z.enum(['hotel', 'vacation_rental', 'hostel']),
        description: z.string().min(50).max(2000),
      });

    case 'location':
      return z.object({
        address: z.string().min(5),
        city: z.string().min(2),
        state: z.string().min(2),
        country: z.string(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      });

    case 'details':
      return z.object({
        maxGuests: z.number().int().positive(),
        bedrooms: z.number().int().nonnegative(),
        bathrooms: z.number().positive(),
        beds: z.number().int().positive(),
        amenities: z.array(z.string()).min(1),
      });

    case 'pricing':
      return z.object({
        pricePerNight: z.number().positive(),
        cleaningFee: z.number().nonnegative(),
        currency: z.string().length(3),
        minNights: z.number().int().positive(),
      });

    case 'photos':
      return z.object({
        images: z.array(z.string().url()).min(1).max(20),
      });

    case 'review':
      // Final validation - all steps
      return z.object({
        // All required fields from previous steps
        title: z.string(),
        type: z.enum(['hotel', 'vacation_rental', 'hostel']),
        // ... all other fields
        confirmPublish: z.boolean(),
      });

    default:
      return z.object({});
  }
};
```

### Conditional Schemas

```typescript
/**
 * Discriminated Union for Different Entity Types
 *
 * Validation changes based on entity type
 */

export const AccommodationSchema = z.discriminatedUnion('type', [
  // Hotel
  z.object({
    type: z.literal('hotel'),
    starRating: z.number().int().min(1).max(5),
    roomTypes: z.array(z.object({
      name: z.string(),
      capacity: z.number().int().positive(),
      price: z.number().positive(),
    })),
    checkInTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    checkOutTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }),

  // Vacation Rental
  z.object({
    type: z.literal('vacation_rental'),
    bedrooms: z.number().int().positive(),
    bathrooms: z.number().positive(),
    maxGuests: z.number().int().positive(),
    hasKitchen: z.boolean(),
    entirePlace: z.boolean(),
  }),

  // Hostel
  z.object({
    type: z.literal('hostel'),
    dormBeds: z.number().int().positive(),
    privateBeds: z.number().int().nonnegative(),
    sharedBathrooms: z.boolean(),
    ageRestriction: z.object({
      minAge: z.number().int().positive(),
      maxAge: z.number().int().positive().optional(),
    }).optional(),
  }),
]);
```

### Dynamic Validation

```typescript
/**
 * Dynamic Validation Based on External State
 */

export const createDynamicBookingSchema = async (
  accommodationId: string,
  checkIn: Date,
  checkOut: Date
) => {
  // Fetch accommodation details
  const accommodation = await getAccommodation(accommodationId);

  // Fetch availability
  const availability = await checkAvailability(accommodationId, checkIn, checkOut);

  // Build dynamic schema
  return z.object({
    accommodationId: z.literal(accommodationId),
    checkIn: z.literal(checkIn),
    checkOut: z.literal(checkOut),

    guests: z
      .number()
      .int()
      .positive()
      .max(accommodation.maxGuests, `Maximum ${accommodation.maxGuests} guests`),

    rooms: z
      .number()
      .int()
      .positive()
      .max(availability.availableRooms, `Only ${availability.availableRooms} rooms available`)
      .optional(),
  }).refine(
    () => availability.isAvailable,
    {
      message: 'Accommodation not available for selected dates',
      path: ['checkIn'],
    }
  ).refine(
    (data) => {
      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      return nights >= accommodation.minNights;
    },
    {
      message: `Minimum stay is ${accommodation.minNights} nights`,
      path: ['checkOut'],
    }
  );
};
```

## Performance and Error Handling

### Efficient Validation

```typescript
/**
 * Use safeParse for expected failures
 */

// ❌ Bad: Throws on every validation failure
export const validateUser = (data: unknown) => {
  return UserSchema.parse(data); // Throws
};

// ✅ Good: Returns result with error details
export const validateUser = (data: unknown) => {
  return UserSchema.safeParse(data); // Returns { success, data?, error? }
};

// Usage
const result = validateUser(input);
if (!result.success) {
  // Handle errors gracefully
  console.error(result.error.format());
  return { error: result.error };
}
// Use validated data
const user = result.data;
```

### Custom Error Messages

```typescript
/**
 * Helpful, user-friendly error messages
 */

export const BookingSchema = z.object({
  checkIn: z.coerce.date({
    errorMap: () => ({
      message: 'Please provide a valid check-in date',
    }),
  }),

  guests: z.number({
    required_error: 'Number of guests is required',
    invalid_type_error: 'Guests must be a number',
  }).int('Guests must be a whole number')
    .positive('At least one guest is required')
    .max(20, 'Maximum 20 guests allowed'),

  email: z.string()
    .email('Please provide a valid email address')
    .endsWith('@example.com', 'Only @example.com emails allowed'),
});
```

### Error Formatting

```typescript
/**
 * Format Zod errors for API responses
 */

import { ZodError } from 'zod';

export const formatZodError = (error: ZodError) => {
  return {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    errors: error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
};

// Usage in API route
try {
  const validated = CreateBookingSchema.parse(input);
} catch (error) {
  if (error instanceof ZodError) {
    return c.json(formatZodError(error), 400);
  }
  throw error;
}
```

## Next Steps

- **[Creating Schemas](./creating-schemas.md)**: Full entity schema tutorial
- **[Composition](./composition.md)**: Advanced schema composition
- **[Enums Guide](./enums.md)**: Working with enumerations
- **[Testing Guide](./testing.md)**: Testing validation logic

## Related Documentation

- **[Portal](../portal.md)**: Package overview
- **[Quick Start](../quick-start.md)**: Get started quickly
- **[Schema Reference](../api/schema-reference.md)**: Complete API docs
