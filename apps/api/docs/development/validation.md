# Request Validation

Request validation patterns using Zod schemas in the Hospeda API.

---

## Overview

All API endpoints use **Zod** for request validation. Validation happens automatically in route factories, ensuring type safety from request to response.

**Benefits:**

- Type-safe request handling
- Automatic error responses
- Consistent validation across endpoints
- TypeScript type inference
- Clear validation error messages

---

## Validation Flow

```text
Client Request
    ↓
Route Factory
    ↓
Zod Schema Validation
    ↓
✅ Valid → Handler
    ↓
Response

❌ Invalid → 400 Error Response
```

---

## Schema Definition

### Basic Schema

```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  age: z.number().int().positive().optional()
});

export type CreateUser = z.infer<typeof createUserSchema>;
```

### With Refinements

```typescript
export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
}).refine(
  (data) => new Date(data.endDate) > new Date(data.startDate),
  { message: 'End date must be after start date' }
);
```

### With Transformations

```typescript
export const searchSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional()
});
```

---

## Route Factory Integration

### Automatic Validation

```typescript
import { createOpenApiRoute } from '../../utils/route-factory';
import { createUserSchema, userSchema } from '@repo/schemas';

export const createUserRoute = createOpenApiRoute({
  method: 'post',
  path: '/',
  summary: 'Create user',
  tags: ['Users'],
  requestBody: createUserSchema,  // ← Validation happens here
  responseSchema: userSchema,
  handler: async (c, params, body) => {
    // body is already validated and typed!
    const { name, email, age } = body;
    // ...
  }
});
```

### Path Parameters

```typescript
export const getUserRoute = createOpenApiRoute({
  method: 'get',
  path: '/:id',
  summary: 'Get user',
  tags: ['Users'],
  requestParams: {
    id: z.string().uuid()  // ← Path validation
  },
  responseSchema: userSchema,
  handler: async (c, params) => {
    const { id } = params;  // Validated UUID
    // ...
  }
});
```

### Query Parameters

```typescript
export const searchUsersRoute = createOpenApiRoute({
  method: 'get',
  path: '/search',
  summary: 'Search users',
  tags: ['Users'],
  requestQuery: {
    email: z.string().email().optional(),
    role: z.enum(['admin', 'user']).optional(),
    isActive: z.coerce.boolean().optional()
  },
  responseSchema: z.array(userSchema),
  handler: async (c, params, body, query) => {
    const { email, role, isActive } = query;  // All validated
    // ...
  }
});
```

---

## Common Validation Patterns

### String Validation

```typescript
// Required string
name: z.string().min(1)

// With length limits
name: z.string().min(1).max(200)

// Email
email: z.string().email()

// URL
website: z.string().url()

// UUID
id: z.string().uuid()

// Enum/Literal
status: z.enum(['active', 'inactive'])
role: z.literal('admin')

// Regex pattern
slug: z.string().regex(/^[a-z0-9-]+$/)

// Trim whitespace
name: z.string().trim()

// Transform to lowercase
email: z.string().email().toLowerCase()
```

### Number Validation

```typescript
// Integer
age: z.number().int()

// Positive
price: z.number().positive()

// Range
rating: z.number().min(1).max(5)

// Coerce from string
page: z.coerce.number().int().positive()

// With default
pageSize: z.coerce.number().default(10)
```

### Boolean Validation

```typescript
// Boolean
isActive: z.boolean()

// Coerce from string ('true', 'false', '1', '0')
isActive: z.coerce.boolean()

// Optional with default
isPublished: z.boolean().default(false)
```

### Date Validation

```typescript
// ISO datetime string
createdAt: z.string().datetime()

// Date object
startDate: z.date()

// Transform string to Date
date: z.string().transform(val => new Date(val))
```

### Array Validation

```typescript
// Array of strings
tags: z.array(z.string())

// With length constraints
tags: z.array(z.string()).min(1).max(10)

// Array of objects
items: z.array(z.object({
  id: z.string(),
  quantity: z.number()
}))

// Non-empty array
ids: z.array(z.string().uuid()).nonempty()
```

### Object Validation

```typescript
// Nested object
address: z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string()
})

// Optional nested object
metadata: z.object({
  source: z.string(),
  campaign: z.string()
}).optional()

// Partial object (all fields optional)
updateData: z.object({
  name: z.string(),
  email: z.string()
}).partial()

// Pick specific fields
pick: userSchema.pick({ name: true, email: true })

// Omit specific fields
omit: userSchema.omit({ id: true, createdAt: true })
```

### Optional & Nullable

```typescript
// Optional (can be undefined)
description: z.string().optional()

// Nullable (can be null)
deletedAt: z.string().nullable()

// Optional and nullable
notes: z.string().optional().nullable()

// Optional with default
status: z.string().optional().default('pending')
```

---

## Advanced Patterns

### Conditional Validation

```typescript
const schema = z.object({
  type: z.enum(['individual', 'company']),
  name: z.string(),
  taxId: z.string().optional()
}).refine(
  (data) => data.type !== 'company' || data.taxId,
  {
    message: 'Tax ID required for companies',
    path: ['taxId']
  }
);
```

### Cross-Field Validation

```typescript
const rangeSchema = z.object({
  minPrice: z.number(),
  maxPrice: z.number()
}).refine(
  (data) => data.maxPrice > data.minPrice,
  { message: 'Max price must be greater than min price' }
);
```

### Union Types

```typescript
// String or number
id: z.union([z.string(), z.number()])

// Discriminated union
const responseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('success'), data: z.any() }),
  z.object({ type: z.literal('error'), message: z.string() })
]);
```

### Custom Validators

```typescript
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain uppercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain a number'
  );
```

---

## Error Handling

### Validation Error Response

When validation fails, API returns:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "age",
        "message": "Must be a positive number"
      }
    ]
  }
}
```

### Custom Error Messages

```typescript
const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  age: z.number({
    required_error: 'Age is required',
    invalid_type_error: 'Age must be a number'
  }).positive('Age must be positive')
});
```

---

## Testing Validation

```typescript
import { describe, it, expect } from 'vitest';
import { createUserSchema } from '@repo/schemas';

describe('createUserSchema', () => {
  it('should validate valid user', () => {
    const result = createUserSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    });
    
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid email', () => {
    const result = createUserSchema.safeParse({
      name: 'John Doe',
      email: 'invalid-email'
    });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['email']);
    }
  });
  
  it('should reject negative age', () => {
    const result = createUserSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      age: -5
    });
    
    expect(result.success).toBe(false);
  });
});
```

---

## Best Practices

### Schema Organization

```typescript
// ✅ Good - Reusable schemas in @repo/schemas
import { createUserSchema } from '@repo/schemas';

// ❌ Bad - Inline schemas in routes
requestBody: z.object({ name: z.string() })
```

### Type Inference

```typescript
// ✅ Good - Infer types from schemas
export type CreateUser = z.infer<typeof createUserSchema>;

// ❌ Bad - Separate type definitions
export type CreateUser = {
  name: string;
  email: string;
};
```

### Error Messages

```typescript
// ✅ Good - Clear, user-friendly messages
email: z.string().email('Please enter a valid email address')

// ❌ Bad - Generic messages
email: z.string().email()
```

### Schema Composition

```typescript
// ✅ Good - Compose schemas
export const createUserSchema = baseUserSchema.omit({ id: true });
export const updateUserSchema = baseUserSchema.partial();

// ❌ Bad - Duplicate schemas
export const createUserSchema = z.object({ ... });
export const updateUserSchema = z.object({ ... });
```

---

## Troubleshooting

### Error: Type mismatch

**Cause**: Schema doesn't match TypeScript type

**Solution**: Use `z.infer<typeof schema>` for types

### Error: Validation always fails

**Cause**: Wrong schema type or coercion needed

**Solution**: Check if you need `z.coerce` for query params

### Error: Custom validation not working

**Cause**: `.refine()` returns falsy value

**Solution**: Ensure refinement returns boolean

---

## Next Steps

- [Route Factories](route-factories.md) - Using validation in routes
- [Response Factory](response-factory.md) - Response patterns
- [Creating Endpoints](creating-endpoints.md) - Complete tutorial

---

⬅️ Back to [Development Guide](README.md)
