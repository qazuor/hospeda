# Schema Testing Guide

Comprehensive guide to testing Zod schemas in Hospeda.

## Table of Contents

- [Overview](#overview)
- [Testing Setup](#testing-setup)
- [Testing Patterns](#testing-patterns)
  - [Basic Validation Tests](#basic-validation-tests)
  - [CRUD Schema Tests](#crud-schema-tests)
  - [Query Schema Tests](#query-schema-tests)
  - [Cross-Field Validation Tests](#cross-field-validation-tests)
  - [Error Message Tests](#error-message-tests)
  - [Type Inference Tests](#type-inference-tests)
  - [Integration Tests](#integration-tests)
  - [Performance Tests](#performance-tests)
- [Test Organization](#test-organization)
- [Test Fixtures](#test-fixtures)
- [Coverage Requirements](#coverage-requirements)
- [Best Practices](#best-practices)

## Overview

Testing schemas ensures:

- **Validation Logic Works**: Schemas accept valid data and reject invalid data
- **Error Messages Are Clear**: Users understand what went wrong
- **Business Rules Are Enforced**: Complex validations work correctly
- **No Regressions**: Changes don't break existing functionality
- **90%+ Coverage**: All code paths are tested

### Testing Philosophy

- **Test Behavior, Not Implementation**: Focus on what the schema does
- **AAA Pattern**: Arrange, Act, Assert
- **One Assertion Per Test**: Clear, focused tests
- **Descriptive Names**: Test names describe what they test

## Testing Setup

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.test.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

### Test File Structure

```text
packages/schemas/
├── src/
│   ├── entities/
│   │   ├── accommodation/
│   │   │   ├── base.ts
│   │   │   ├── create.ts
│   │   │   └── query.ts
├── test/
│   ├── entities/
│   │   ├── accommodation/
│   │   │   ├── base.test.ts
│   │   │   ├── create.test.ts
│   │   │   └── query.test.ts
│   ├── fixtures/
│   │   ├── accommodation.fixtures.ts
│   │   └── user.fixtures.ts
│   └── helpers/
│       └── test-utils.ts
```

## Testing Patterns

### Basic Validation Tests

Test that schemas accept valid data and reject invalid data.

```typescript
/**
 * Basic validation tests for AccommodationSchema
 */

import { describe, it, expect } from 'vitest';
import { BaseAccommodationSchema } from '../../../src/entities/accommodation/base';

describe('BaseAccommodationSchema', () => {
  describe('valid data', () => {
    it('should accept complete valid accommodation', () => {
      // Arrange
      const validAccommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Beautiful Beach House',
        slug: 'beautiful-beach-house',
        description: 'A stunning beach house with amazing ocean views and modern amenities.',
        status: 'published',
        pricePerNight: 150,
        maxGuests: 6,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Act
      const result = BaseAccommodationSchema.safeParse(validAccommodation);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject(validAccommodation);
      }
    });

    it('should accept accommodation with minimum required fields', () => {
      const minimalAccommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Beach House',
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: 100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(minimalAccommodation);

      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const accommodationWithoutDefaults = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Beach House',
        slug: 'beach-house',
        description: 'A beach house.',
        pricePerNight: 100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(accommodationWithoutDefaults);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('draft'); // Default value
      }
    });
  });

  describe('invalid data', () => {
    it('should reject accommodation with invalid UUID', () => {
      const invalidAccommodation = {
        id: 'not-a-uuid',
        title: 'Beach House',
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: 100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(invalidAccommodation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['id']);
        expect(result.error.issues[0].message).toContain('uuid');
      }
    });

    it('should reject accommodation with empty title', () => {
      const invalidAccommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: '',
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: 100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(invalidAccommodation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['title']);
      }
    });

    it('should reject accommodation with negative price', () => {
      const invalidAccommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Beach House',
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: -100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(invalidAccommodation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['pricePerNight']);
        expect(result.error.issues[0].message).toContain('positive');
      }
    });

    it('should reject accommodation with zero guests', () => {
      const invalidAccommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Beach House',
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: 100,
        maxGuests: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(invalidAccommodation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['maxGuests']);
      }
    });

    it('should reject accommodation with invalid status', () => {
      const invalidAccommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Beach House',
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'invalid_status',
        pricePerNight: 100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(invalidAccommodation);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['status']);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle very long titles within limit', () => {
      const accommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'A'.repeat(200), // Max length
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: 100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(accommodation);

      expect(result.success).toBe(true);
    });

    it('should reject titles exceeding max length', () => {
      const accommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'A'.repeat(201), // Over max length
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: 100,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(accommodation);

      expect(result.success).toBe(false);
    });

    it('should handle maximum safe integer for price', () => {
      const accommodation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Beach House',
        slug: 'beach-house',
        description: 'A beach house.',
        status: 'draft',
        pricePerNight: Number.MAX_SAFE_INTEGER,
        maxGuests: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = BaseAccommodationSchema.safeParse(accommodation);

      expect(result.success).toBe(true);
    });
  });
});
```

### CRUD Schema Tests

Test create, update, and delete schema variants.

```typescript
/**
 * CRUD schema tests
 */

import { describe, it, expect } from 'vitest';
import {
  CreateAccommodationSchema,
  UpdateAccommodationSchema,
} from '../../../src/entities/accommodation';

describe('CreateAccommodationSchema', () => {
  it('should accept valid creation data', () => {
    const createData = {
      title: 'New Beach House',
      slug: 'new-beach-house',
      description: 'A new beach house with modern amenities.',
      pricePerNight: 150,
      maxGuests: 6,
    };

    const result = CreateAccommodationSchema.safeParse(createData);

    expect(result.success).toBe(true);
  });

  it('should not require id or timestamps', () => {
    const createData = {
      title: 'New Beach House',
      slug: 'new-beach-house',
      description: 'A new beach house.',
      pricePerNight: 150,
      maxGuests: 6,
      // No id, createdAt, updatedAt
    };

    const result = CreateAccommodationSchema.safeParse(createData);

    expect(result.success).toBe(true);
  });

  it('should reject creation data with id', () => {
    const createData = {
      id: '123e4567-e89b-12d3-a456-426614174000', // Should not be present
      title: 'New Beach House',
      slug: 'new-beach-house',
      description: 'A new beach house.',
      pricePerNight: 150,
      maxGuests: 6,
    };

    const result = CreateAccommodationSchema.safeParse(createData);

    expect(result.success).toBe(false);
  });

  it('should apply default status for new accommodations', () => {
    const createData = {
      title: 'New Beach House',
      slug: 'new-beach-house',
      description: 'A new beach house.',
      pricePerNight: 150,
      maxGuests: 6,
    };

    const result = CreateAccommodationSchema.safeParse(createData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('draft');
    }
  });
});

describe('UpdateAccommodationSchema', () => {
  it('should accept partial update data', () => {
    const updateData = {
      title: 'Updated Title',
    };

    const result = UpdateAccommodationSchema.safeParse(updateData);

    expect(result.success).toBe(true);
  });

  it('should accept updating multiple fields', () => {
    const updateData = {
      title: 'Updated Title',
      description: 'Updated description with more details.',
      pricePerNight: 175,
    };

    const result = UpdateAccommodationSchema.safeParse(updateData);

    expect(result.success).toBe(true);
  });

  it('should accept empty update (no changes)', () => {
    const updateData = {};

    const result = UpdateAccommodationSchema.safeParse(updateData);

    expect(result.success).toBe(true);
  });

  it('should not allow updating id', () => {
    const updateData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Updated Title',
    };

    const result = UpdateAccommodationSchema.safeParse(updateData);

    expect(result.success).toBe(false);
  });

  it('should not allow updating createdAt', () => {
    const updateData = {
      createdAt: new Date(),
      title: 'Updated Title',
    };

    const result = UpdateAccommodationSchema.safeParse(updateData);

    expect(result.success).toBe(false);
  });

  it('should validate updated fields', () => {
    const updateData = {
      pricePerNight: -100, // Invalid: negative price
    };

    const result = UpdateAccommodationSchema.safeParse(updateData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['pricePerNight']);
    }
  });
});
```

### Query Schema Tests

Test search and filter schemas.

```typescript
/**
 * Query schema tests
 */

import { describe, it, expect } from 'vitest';
import { SearchAccommodationSchema } from '../../../src/entities/accommodation/query';

describe('SearchAccommodationSchema', () => {
  it('should accept empty search (all results)', () => {
    const searchQuery = {};

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1); // Default
      expect(result.data.pageSize).toBe(20); // Default
    }
  });

  it('should accept text search query', () => {
    const searchQuery = {
      q: 'beach house',
    };

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(true);
  });

  it('should accept filters', () => {
    const searchQuery = {
      city: 'Buenos Aires',
      minPrice: 100,
      maxPrice: 200,
      minGuests: 2,
    };

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(true);
  });

  it('should accept pagination params', () => {
    const searchQuery = {
      page: 2,
      pageSize: 50,
    };

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.pageSize).toBe(50);
    }
  });

  it('should coerce string numbers to numbers', () => {
    const searchQuery = {
      page: '3' as any,
      pageSize: '25' as any,
      minPrice: '100' as any,
    };

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.pageSize).toBe(25);
      expect(result.data.minPrice).toBe(100);
    }
  });

  it('should reject invalid page number', () => {
    const searchQuery = {
      page: 0, // Must be >= 1
    };

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['page']);
    }
  });

  it('should reject page size over limit', () => {
    const searchQuery = {
      pageSize: 200, // Max 100
    };

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['pageSize']);
    }
  });

  it('should reject minPrice > maxPrice', () => {
    const searchQuery = {
      minPrice: 200,
      maxPrice: 100,
    };

    const result = SearchAccommodationSchema.safeParse(searchQuery);

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((issue) =>
        issue.path.includes('maxPrice')
      );
      expect(error).toBeDefined();
    }
  });
});
```

### Cross-Field Validation Tests

Test schemas with complex business rules.

```typescript
/**
 * Cross-field validation tests
 */

import { describe, it, expect } from 'vitest';
import { CreateBookingSchema } from '../../../src/entities/booking/create';

describe('CreateBookingSchema - Cross-field validation', () => {
  const baseBooking = {
    accommodationId: '123e4567-e89b-12d3-a456-426614174000',
    userId: '123e4567-e89b-12d3-a456-426614174001',
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
    guests: 2,
    paymentMethod: 'credit_card' as const,
  };

  it('should accept valid booking with proper dates', () => {
    const result = CreateBookingSchema.safeParse(baseBooking);

    expect(result.success).toBe(true);
  });

  it('should reject checkOut before checkIn', () => {
    const invalidBooking = {
      ...baseBooking,
      checkIn: new Date('2024-06-10'),
      checkOut: new Date('2024-06-05'),
    };

    const result = CreateBookingSchema.safeParse(invalidBooking);

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((issue) =>
        issue.message.includes('after check-in')
      );
      expect(error).toBeDefined();
    }
  });

  it('should reject checkIn in the past', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const invalidBooking = {
      ...baseBooking,
      checkIn: yesterday,
      checkOut: new Date('2024-06-05'),
    };

    const result = CreateBookingSchema.safeParse(invalidBooking);

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((issue) =>
        issue.message.includes('past')
      );
      expect(error).toBeDefined();
    }
  });

  it('should reject booking over 365 nights', () => {
    const checkIn = new Date('2024-06-01');
    const checkOut = new Date('2025-07-01'); // Over 365 days

    const invalidBooking = {
      ...baseBooking,
      checkIn,
      checkOut,
    };

    const result = CreateBookingSchema.safeParse(invalidBooking);

    expect(result.success).toBe(false);
  });

  it('should accept exactly 1 night booking', () => {
    const validBooking = {
      ...baseBooking,
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-02'),
    };

    const result = CreateBookingSchema.safeParse(validBooking);

    expect(result.success).toBe(true);
  });
});
```

### Error Message Tests

Test that error messages are clear and helpful.

```typescript
/**
 * Error message tests
 */

import { describe, it, expect } from 'vitest';
import { CreateUserSchema } from '../../../src/entities/user/create';

describe('CreateUserSchema - Error messages', () => {
  it('should provide clear error for invalid email', () => {
    const invalidUser = {
      email: 'not-an-email',
      name: 'John Doe',
      password: 'Password123!',
      passwordConfirmation: 'Password123!',
      terms: true,
    };

    const result = CreateUserSchema.safeParse(invalidUser);

    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.issues.find((issue) =>
        issue.path.includes('email')
      );
      expect(emailError?.message).toContain('email');
    }
  });

  it('should provide clear error for weak password', () => {
    const invalidUser = {
      email: 'john@example.com',
      name: 'John Doe',
      password: 'weak',
      passwordConfirmation: 'weak',
      terms: true,
    };

    const result = CreateUserSchema.safeParse(invalidUser);

    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordErrors = result.error.issues.filter((issue) =>
        issue.path.includes('password')
      );
      expect(passwordErrors.length).toBeGreaterThan(0);
      expect(passwordErrors.some((err) => err.message.includes('8 characters'))).toBe(true);
    }
  });

  it('should provide clear error for password mismatch', () => {
    const invalidUser = {
      email: 'john@example.com',
      name: 'John Doe',
      password: 'Password123!',
      passwordConfirmation: 'Different123!',
      terms: true,
    };

    const result = CreateUserSchema.safeParse(invalidUser);

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((issue) =>
        issue.message.includes('do not match')
      );
      expect(error).toBeDefined();
      expect(error?.path).toEqual(['passwordConfirmation']);
    }
  });

  it('should provide clear error for missing terms acceptance', () => {
    const invalidUser = {
      email: 'john@example.com',
      name: 'John Doe',
      password: 'Password123!',
      passwordConfirmation: 'Password123!',
      terms: false,
    };

    const result = CreateUserSchema.safeParse(invalidUser);

    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find((issue) =>
        issue.path.includes('terms')
      );
      expect(error?.message).toContain('accept');
    }
  });
});
```

### Type Inference Tests

Test that TypeScript types are correctly inferred.

```typescript
/**
 * Type inference tests
 *
 * These tests validate compile-time type safety
 */

import { describe, it, expectTypeOf } from 'vitest';
import {
  BaseAccommodationSchema,
  CreateAccommodationSchema,
  UpdateAccommodationSchema,
  type AccommodationType,
  type CreateAccommodationInput,
  type UpdateAccommodationInput,
} from '../../../src/entities/accommodation';

describe('Accommodation Type Inference', () => {
  it('should infer correct type from BaseAccommodationSchema', () => {
    type Inferred = typeof BaseAccommodationSchema._type;

    expectTypeOf<Inferred>().toEqualTypeOf<AccommodationType>();
  });

  it('should infer required fields for create', () => {
    type Inferred = typeof CreateAccommodationSchema._type;

    expectTypeOf<Inferred>().toMatchTypeOf<{
      title: string;
      slug: string;
      description: string;
      pricePerNight: number;
      maxGuests: number;
    }>();
  });

  it('should infer optional fields for update', () => {
    type Inferred = typeof UpdateAccommodationSchema._type;

    expectTypeOf<Inferred>().toMatchTypeOf<{
      title?: string;
      description?: string;
      pricePerNight?: number;
    }>();
  });

  it('should not include id in create schema type', () => {
    type Inferred = typeof CreateAccommodationSchema._type;

    // @ts-expect-error - id should not be in create type
    const test: Inferred = {
      id: '123',
      title: 'Test',
      slug: 'test',
      description: 'Test',
      pricePerNight: 100,
      maxGuests: 2,
    };
  });
});
```

### Integration Tests

Test schemas in real-world scenarios with API routes and services.

```typescript
/**
 * Integration tests with Hono API
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CreateAccommodationSchema } from '../../../src/entities/accommodation';

describe('Schema Integration with Hono', () => {
  const app = new Hono();

  app.post(
    '/accommodations',
    zValidator('json', CreateAccommodationSchema),
    async (c) => {
      const data = c.req.valid('json');
      return c.json({ success: true, data });
    }
  );

  it('should validate valid request body', async () => {
    const validBody = {
      title: 'Beach House',
      slug: 'beach-house',
      description: 'A beautiful beach house.',
      pricePerNight: 150,
      maxGuests: 6,
    };

    const response = await app.request('/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validBody),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('should reject invalid request body', async () => {
    const invalidBody = {
      title: '',
      slug: 'beach-house',
      description: 'Short',
      pricePerNight: -100,
      maxGuests: 0,
    };

    const response = await app.request('/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidBody),
    });

    expect(response.status).toBe(400);
  });
});
```

### Performance Tests

Test validation performance with large datasets.

```typescript
/**
 * Performance tests
 */

import { describe, it, expect } from 'vitest';
import { SearchAccommodationSchema } from '../../../src/entities/accommodation/query';

describe('Schema Performance', () => {
  it('should validate 1000 search queries in reasonable time', () => {
    const queries = Array.from({ length: 1000 }, (_, i) => ({
      q: `query ${i}`,
      city: 'Buenos Aires',
      minPrice: 100,
      maxPrice: 200,
      page: i + 1,
    }));

    const start = performance.now();

    queries.forEach((query) => {
      SearchAccommodationSchema.parse(query);
    });

    const end = performance.now();
    const duration = end - start;

    // Should complete in under 100ms
    expect(duration).toBeLessThan(100);
  });

  it('should handle large arrays efficiently', () => {
    const largeArray = Array.from({ length: 100 }, (_, i) => `amenity-${i}`);

    const data = {
      amenities: largeArray,
    };

    const schema = z.object({
      amenities: z.array(z.string()).max(100),
    });

    const start = performance.now();
    schema.parse(data);
    const end = performance.now();

    expect(end - start).toBeLessThan(10);
  });
});
```

## Test Organization

### Grouping Tests

```typescript
describe('AccommodationSchema', () => {
  describe('validation', () => {
    describe('title field', () => {
      it('should accept valid titles', () => {});
      it('should reject empty titles', () => {});
      it('should reject titles over max length', () => {});
    });

    describe('price field', () => {
      it('should accept positive prices', () => {});
      it('should reject negative prices', () => {});
      it('should reject zero price', () => {});
    });
  });

  describe('business rules', () => {
    it('should enforce minimum nights', () => {});
    it('should enforce maximum guests', () => {});
  });
});
```

## Test Fixtures

Create reusable test data.

```typescript
/**
 * test/fixtures/accommodation.fixtures.ts
 */

export const validAccommodation = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Beautiful Beach House',
  slug: 'beautiful-beach-house',
  description: 'A stunning beach house with amazing views.',
  status: 'published' as const,
  pricePerNight: 150,
  maxGuests: 6,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const createValidAccommodation = (
  overrides: Partial<typeof validAccommodation> = {}
) => ({
  ...validAccommodation,
  ...overrides,
});

// Usage in tests
import { createValidAccommodation } from '../../fixtures/accommodation.fixtures';

it('should accept valid accommodation', () => {
  const accommodation = createValidAccommodation({
    title: 'Custom Title',
  });

  const result = BaseAccommodationSchema.safeParse(accommodation);
  expect(result.success).toBe(true);
});
```

## Coverage Requirements

### 90%+ Coverage Target

```bash
# Run tests with coverage
pnpm test:coverage

# Coverage report
File                  | % Stmts | % Branch | % Funcs | % Lines
----------------------|---------|----------|---------|--------
base.ts              |     100 |      100 |     100 |     100
create.ts            |     100 |      100 |     100 |     100
update.ts            |      95 |       90 |     100 |      95
query.ts             |     100 |      100 |     100 |     100
----------------------|---------|----------|---------|--------
All files            |    98.5 |     95.2 |     100 |    98.5
```

### What to Test

- ✅ All validation rules
- ✅ All refinements
- ✅ Default values
- ✅ Optional fields
- ✅ Error messages
- ✅ Edge cases
- ✅ Type inference

### What Not to Test

- ❌ Zod internals
- ❌ Third-party library code
- ❌ Type definitions (use expectTypeOf instead)

## Best Practices

1. **Use `safeParse()` in tests** - Better error inspection
2. **Test both success and failure** - Comprehensive coverage
3. **Use descriptive test names** - "should reject empty title"
4. **One assertion per test** - Clear failures
5. **Use fixtures** - Reusable test data
6. **Test error messages** - User-facing strings
7. **Test edge cases** - Boundaries and limits
8. **Keep tests fast** - Avoid async when possible
9. **Test type inference** - Use expectTypeOf
10. **Organize logically** - Group related tests

## Next Steps

- **[Creating Schemas](./creating-schemas.md)**: Learn to create testable schemas
- **[Validation Patterns](./validation-patterns.md)**: Advanced validation techniques
- **[Composition](./composition.md)**: Test composed schemas
- **[Enums Guide](./enums.md)**: Test enum validations

## Related Documentation

- **[Portal](../portal.md)**: Package overview
- **[Quick Start](../quick-start.md)**: Get started quickly
- **[Schema Reference](../api/schema-reference.md)**: Complete API docs
