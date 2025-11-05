# Quick Start Guide - @repo/schemas

**Get productive with @repo/schemas in 5 minutes**

This guide walks you through the essential concepts and patterns using a real-world example from the Hospeda platform. By the end, you'll understand how to use schemas for validation, type inference, and integration with API routes, services, and forms.

## Prerequisites

- Basic TypeScript knowledge
- Familiarity with Zod concepts (schemas, validation)
- Understanding of the Hospeda monorepo structure

If you're new to Zod, check out the [Zod documentation](https://zod.dev/) first.

## What You'll Learn

1. Understanding existing schemas
2. Using CRUD schemas (create/update)
3. Query schemas (search/filter)
4. Type inference with `z.infer`
5. API validation with Hono
6. Service validation with safeParse
7. Form validation with React Hook Form

## Step 1: Understanding Existing Schemas

Let's start by exploring the User entity schemas. The User entity is a core part of Hospeda, representing platform users (guests, hosts, admins).

### Base Schema

The base schema defines the complete structure of a User:

```typescript
// packages/schemas/src/entities/user/user.schema.ts
import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema';
import { BaseLifecycleFields } from '../../common/lifecycle.schema';
import { RoleEnumSchema } from '../../enums/role.schema';

export const UserSchema = z.object({
  // Base fields from common schemas
  id: z.string().uuid(),
  ...BaseAuditFields,          // createdAt, updatedAt, deletedAt, createdBy, updatedBy
  ...BaseLifecycleFields,      // lifecycleState, publishedAt, archivedAt

  // User-specific fields
  slug: z.string().min(1),
  authProvider: z.enum(['clerk', 'google', 'facebook']).optional(),
  authProviderUserId: z.string().optional(),

  // Personal information
  displayName: z.string().min(2).max(50).optional(),
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  birthDate: z.date().optional(),

  // Contact
  email: z.string().email(),
  phone: z.string().optional(),

  // Role and permissions
  role: RoleEnumSchema,                           // 'user' | 'moderator' | 'admin'
  permissions: z.array(z.string()).default([])
});

// Type inference
export type User = z.infer<typeof UserSchema>;
```

**Key Points:**

- **Base fields**: Common fields like `id`, `createdAt`, `updatedAt` are spread from base schemas
- **Validation rules**: Each field has validation (min, max, email, uuid, etc.)
- **Optional fields**: Many fields are optional (`.optional()`)
- **Type inference**: `type User = z.infer<typeof UserSchema>` creates TypeScript type

### Importing Schemas

```typescript
// Import from package
import { UserSchema, type User } from '@repo/schemas';

// Or import specific variants
import {
  UserCreateInputSchema,
  UserUpdateInputSchema,
  UserSearchInputSchema,
  type UserCreateInput,
  type UserUpdateInput
} from '@repo/schemas';
```

## Step 2: Using CRUD Schemas

CRUD schemas are derived from the base schema and optimized for specific operations.

### Create Schema

The create schema omits auto-generated fields (id, timestamps):

```typescript
// packages/schemas/src/entities/user/user.crud.schema.ts
import { UserSchema } from './user.schema';
import { omittedSystemFieldsForActions } from '../../utils/utils';

export const UserCreateInputSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  createdBy: true,
  updatedBy: true
});

export type UserCreateInput = z.infer<typeof UserCreateInputSchema>;

// Response after creation includes all fields
export const UserCreateOutputSchema = UserSchema;
export type UserCreateOutput = z.infer<typeof UserCreateOutputSchema>;
```

**Usage Example:**

```typescript
import { UserCreateInputSchema, type UserCreateInput } from '@repo/schemas';

// Valid create data - no id, timestamps, or audit fields
const newUser: UserCreateInput = {
  slug: 'john-doe',
  email: 'john@example.com',
  displayName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  role: 'user',
  lifecycleState: 'draft'
};

// Validate
const result = UserCreateInputSchema.safeParse(newUser);

if (result.success) {
  console.log('Valid user data:', result.data);
  // Create user in database...
} else {
  console.error('Validation errors:', result.error.issues);
}
```

### Update Schema

The update schema makes all fields optional (partial) except immutable ones:

```typescript
export const UserUpdateInputSchema = UserSchema
  .omit({
    id: true,
    createdAt: true,
    createdBy: true
  })
  .partial();

export type UserUpdateInput = z.infer<typeof UserUpdateInputSchema>;
```

**Usage Example:**

```typescript
import { UserUpdateInputSchema, type UserUpdateInput } from '@repo/schemas';

// Update data - only fields you want to change
const updateData: UserUpdateInput = {
  displayName: 'John Updated',
  phone: '+5491123456789'
  // All other fields remain unchanged
};

// Validate
const result = UserUpdateInputSchema.safeParse(updateData);

if (result.success) {
  // Update user in database...
  await userModel.update(userId, result.data);
}
```

### Delete Schema

```typescript
export const UserDeleteInputSchema = z.object({
  id: z.string().uuid(),
  force: z.boolean().default(false) // true = hard delete, false = soft delete
});

export type UserDeleteInput = z.infer<typeof UserDeleteInputSchema>;

export const UserDeleteOutputSchema = z.object({
  success: z.boolean(),
  deletedAt: z.date().optional()
});
```

**Usage Example:**

```typescript
// Soft delete (default)
const softDelete = {
  id: 'user-uuid',
  force: false
};

// Hard delete (permanent)
const hardDelete = {
  id: 'user-uuid',
  force: true
};
```

## Step 3: Query Schemas

Query schemas handle search, filtering, and pagination.

### Search Schema

```typescript
// packages/schemas/src/entities/user/user.query.schema.ts
import { BaseSearchSchema } from '../../common/pagination.schema';
import { RoleEnumSchema } from '../../enums/role.schema';

export const UserSearchInputSchema = z.object({
  q: z.string().optional(),                    // Full-text search
  role: RoleEnumSchema.optional(),             // Filter by role
  email: z.string().email().optional(),        // Filter by email
  isActive: z.boolean().optional(),            // Filter active/inactive
  ...BaseSearchSchema.shape                    // page, pageSize, sortBy, sortOrder
});

export type UserSearchInput = z.infer<typeof UserSearchInputSchema>;
```

**Usage Example:**

```typescript
import { UserSearchInputSchema, type UserSearchInput } from '@repo/schemas';

// Search parameters
const searchParams: UserSearchInput = {
  q: 'john',           // Search for "john"
  role: 'user',        // Only users (not admins)
  isActive: true,      // Only active users
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

// Validate
const result = UserSearchInputSchema.safeParse(searchParams);

if (result.success) {
  const users = await userService.search(result.data);
  console.log(`Found ${users.pagination.total} users`);
}
```

### List Schema

For simpler lists without full-text search:

```typescript
export const UserListInputSchema = z.object({
  role: RoleEnumSchema.optional(),
  ...PaginationSchema.shape // page, pageSize
});
```

### Search Output Schema

```typescript
import { PaginationResultSchema } from '../../common/pagination.schema';

export const UserSearchResultSchema = UserSchema.extend({
  score: z.number().optional() // Search relevance score
});

export const UserSearchOutputSchema = PaginationResultSchema(
  UserSearchResultSchema
);

export type UserSearchOutput = z.infer<typeof UserSearchOutputSchema>;
```

**Output Structure:**

```typescript
{
  data: [
    {
      id: 'uuid',
      email: 'john@example.com',
      // ... other user fields
      score: 0.95 // Search relevance
    }
  ],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 45,
    totalPages: 3,
    hasNextPage: true,
    hasPreviousPage: false
  }
}
```

## Step 4: Type Inference

Type inference is the core of type safety in this package. Types are **automatically derived** from schemas.

### Basic Type Inference

```typescript
import { z } from 'zod';

// Define schema
const userSchema = z.object({
  name: z.string(),
  age: z.number().min(18),
  email: z.string().email()
});

// Infer type
type User = z.infer<typeof userSchema>;

// Equivalent to:
// type User = {
//   name: string;
//   age: number;
//   email: string;
// }
```

### Inference from Derived Schemas

```typescript
const baseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email()
});

// Create schema - omits id
const createSchema = baseSchema.omit({ id: true });
type CreateInput = z.infer<typeof createSchema>;
// { name: string; email: string }

// Update schema - makes fields optional
const updateSchema = baseSchema.omit({ id: true }).partial();
type UpdateInput = z.infer<typeof updateSchema>;
// { name?: string; email?: string }
```

### Using Inferred Types

```typescript
import { UserCreateInputSchema, type UserCreateInput } from '@repo/schemas';

// Function parameter with inferred type
async function createUser(input: UserCreateInput): Promise<User> {
  // input is fully typed based on UserCreateInputSchema
  const validated = UserCreateInputSchema.parse(input);

  return userModel.create(validated);
}

// Usage
const newUser: UserCreateInput = {
  slug: 'jane-smith',
  email: 'jane@example.com',
  displayName: 'Jane Smith',
  role: 'user',
  lifecycleState: 'draft'
};

const user = await createUser(newUser);
```

### Array and Optional Types

```typescript
const schema = z.object({
  tags: z.array(z.string()),
  bio: z.string().optional(),
  metadata: z.record(z.unknown())
});

type Data = z.infer<typeof schema>;
// {
//   tags: string[];
//   bio?: string;
//   metadata: Record<string, unknown>;
// }
```

## Step 5: API Validation with Hono

Use schemas with Hono's `zValidator` middleware for automatic request validation.

### POST Endpoint (Create)

```typescript
// apps/api/src/routes/users.route.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  UserCreateInputSchema,
  UserCreateOutputSchema,
  type UserCreateInput,
  type UserCreateOutput
} from '@repo/schemas';
import { UserService } from '@repo/service-core';

const app = new Hono();

app.post(
  '/users',
  zValidator('json', UserCreateInputSchema), // Validates request body
  async (c) => {
    // c.req.valid('json') is typed as UserCreateInput
    const input: UserCreateInput = c.req.valid('json');

    const userService = new UserService(c.get('ctx'));
    const result = await userService.create({ input });

    if (result.success) {
      const output: UserCreateOutput = result.data;
      return c.json({ success: true, data: output }, 201);
    }

    return c.json({ success: false, error: result.error }, 400);
  }
);
```

**What Happens:**

1. `zValidator` validates the request body against `UserCreateInputSchema`
2. If validation fails, Hono returns 400 with validation errors
3. If validation succeeds, `c.req.valid('json')` is typed as `UserCreateInput`
4. No manual validation needed in handler!

### GET Endpoint (Search)

```typescript
app.get(
  '/users',
  zValidator('query', UserSearchInputSchema), // Validates query params
  async (c) => {
    const filters: UserSearchInput = c.req.valid('query');

    const userService = new UserService(c.get('ctx'));
    const result = await userService.search({ input: filters });

    if (result.success) {
      return c.json({ success: true, ...result.data });
    }

    return c.json({ success: false, error: result.error }, 400);
  }
);
```

**Example Request:**

```bash
GET /users?q=john&role=user&page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

### PUT Endpoint (Update)

```typescript
app.put(
  '/users/:id',
  zValidator('param', z.object({ id: z.string().uuid() })),
  zValidator('json', UserUpdateInputSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const input: UserUpdateInput = c.req.valid('json');

    const userService = new UserService(c.get('ctx'));
    const result = await userService.update({ id, input });

    if (result.success) {
      return c.json({ success: true, data: result.data });
    }

    return c.json({ success: false, error: result.error }, 400);
  }
);
```

## Step 6: Service Validation

Services should validate inputs even if they come from trusted sources (like API routes).

### Using safeParse (Recommended)

`safeParse` returns a result object instead of throwing:

```typescript
// packages/service-core/src/services/user/user.service.ts
import {
  UserCreateInputSchema,
  UserUpdateInputSchema,
  type UserCreateInput,
  type UserUpdateInput,
  type User
} from '@repo/schemas';
import { UserModel } from '@repo/db';
import type { Result } from '@repo/types';

export class UserService {
  private model: UserModel;

  constructor() {
    this.model = new UserModel();
  }

  async create(input: { input: unknown }): Promise<Result<User>> {
    // Validate input
    const validation = UserCreateInputSchema.safeParse(input.input);

    if (!validation.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user data',
          details: validation.error.issues
        }
      };
    }

    // validation.data is typed as UserCreateInput
    const data: UserCreateInput = validation.data;

    try {
      const user = await this.model.create(data);

      return {
        success: true,
        data: user
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to create user'
        }
      };
    }
  }

  async update(input: { id: string; input: unknown }): Promise<Result<User>> {
    // Validate update input
    const validation = UserUpdateInputSchema.safeParse(input.input);

    if (!validation.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update data',
          details: validation.error.issues
        }
      };
    }

    const data: UserUpdateInput = validation.data;

    try {
      const user = await this.model.update(input.id, data);

      if (!user) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found'
          }
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to update user'
        }
      };
    }
  }
}
```

### Using parse (Throws on Error)

Use `parse` when you want exceptions:

```typescript
async create(input: { input: unknown }): Promise<User> {
  // Throws ZodError if validation fails
  const data = UserCreateInputSchema.parse(input.input);

  return this.model.create(data);
}
```

**When to use each:**

- **`safeParse`**: Service layer, when you want to return errors gracefully
- **`parse`**: Internal utilities, when you want exceptions to propagate

## Step 7: Form Validation with React Hook Form

Use `zodResolver` to integrate schemas with React Hook Form.

### Installation

```bash
pnpm add react-hook-form @hookform/resolvers
```

### Basic Form

```typescript
// apps/web/src/components/forms/UserCreateForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  UserCreateInputSchema,
  type UserCreateInput
} from '@repo/schemas';

export function UserCreateForm() {
  const form = useForm<UserCreateInput>({
    resolver: zodResolver(UserCreateInputSchema),
    defaultValues: {
      slug: '',
      email: '',
      displayName: '',
      firstName: '',
      lastName: '',
      role: 'user',
      lifecycleState: 'draft',
      permissions: []
    }
  });

  const onSubmit = form.handleSubmit(async (data: UserCreateInput) => {
    // data is already validated and typed
    console.log('Valid data:', data);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        console.log('User created successfully!');
        form.reset();
      } else {
        const error = await response.json();
        console.error('Failed to create user:', error);
      }
    } catch (error) {
      console.error('Network error:', error);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-sm font-medium">
          Username (Slug)
        </label>
        <input
          id="slug"
          type="text"
          {...form.register('slug')}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
        {form.formState.errors.slug && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.slug.message}
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...form.register('email')}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
        {form.formState.errors.email && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      {/* Display Name */}
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display Name
        </label>
        <input
          id="displayName"
          type="text"
          {...form.register('displayName')}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
        {form.formState.errors.displayName && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.displayName.message}
          </p>
        )}
      </div>

      {/* First Name */}
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium">
          First Name
        </label>
        <input
          id="firstName"
          type="text"
          {...form.register('firstName')}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
        {form.formState.errors.firstName && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.firstName.message}
          </p>
        )}
      </div>

      {/* Last Name */}
      <div>
        <label htmlFor="lastName" className="block text-sm font-medium">
          Last Name
        </label>
        <input
          id="lastName"
          type="text"
          {...form.register('lastName')}
          className="mt-1 block w-full rounded-md border-gray-300"
        />
        {form.formState.errors.lastName && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.lastName.message}
          </p>
        )}
      </div>

      {/* Role */}
      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          {...form.register('role')}
          className="mt-1 block w-full rounded-md border-gray-300"
        >
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
        {form.formState.errors.role && (
          <p className="mt-1 text-sm text-red-600">
            {form.formState.errors.role.message}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
      >
        {form.formState.isSubmitting ? 'Creating...' : 'Create User'}
      </button>

      {/* Form Errors Summary */}
      {Object.keys(form.formState.errors).length > 0 && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Please fix the following errors:
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-red-700">
            {Object.entries(form.formState.errors).map(([field, error]) => (
              <li key={field}>
                {field}: {error?.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
```

**Key Benefits:**

- **Automatic validation**: Form validates on submit and field blur
- **Type safety**: Form data typed as `UserCreateInput`
- **Error handling**: Validation errors automatically displayed
- **Re-validation**: Fields re-validate as user types

### Update Form

For update forms, use the update schema:

```typescript
import { UserUpdateInputSchema, type UserUpdateInput } from '@repo/schemas';

export function UserUpdateForm({ user }: { user: User }) {
  const form = useForm<UserUpdateInput>({
    resolver: zodResolver(UserUpdateInputSchema),
    defaultValues: {
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone
    }
  });

  const onSubmit = form.handleSubmit(async (data: UserUpdateInput) => {
    const response = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      console.log('User updated successfully!');
    }
  });

  return (
    <form onSubmit={onSubmit}>
      {/* Form fields... */}
    </form>
  );
}
```

## Validation Error Handling

### API Error Response

When validation fails in Hono:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "code": "too_small",
        "minimum": 2,
        "type": "string",
        "inclusive": true,
        "exact": false,
        "message": "String must contain at least 2 character(s)",
        "path": ["displayName"]
      },
      {
        "validation": "email",
        "code": "invalid_string",
        "message": "Invalid email",
        "path": ["email"]
      }
    ]
  }
}
```

### Service Error Response

When validation fails in service:

```typescript
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid user data',
    details: [
      {
        code: 'too_small',
        path: ['displayName'],
        message: 'String must contain at least 2 character(s)'
      }
    ]
  }
}
```

### Form Error Display

Errors are automatically mapped to form fields:

```typescript
// Access field-specific errors
form.formState.errors.displayName?.message

// Access all errors
Object.entries(form.formState.errors).map(([field, error]) => ({
  field,
  message: error?.message
}))
```

## Next Steps

Now that you understand the basics:

1. **Explore more entities**: Check out [Schema Reference](./api/schema-reference.md) for all available schemas
2. **Advanced types**: Read [Type Inference Guide](./api/type-inference.md) for complex type patterns
3. **Custom validation**: Learn about [Custom Validators](./api/validators.md) and refinements
4. **Testing**: Write tests for your schemas following [Testing Standards](../../CLAUDE.md#testing-standards)

## Common Patterns Summary

### API Route Pattern

```typescript
app.post(
  '/entity',
  zValidator('json', CreateSchema),
  async (c) => {
    const data = c.req.valid('json');
    const result = await service.create({ input: data });
    return c.json({ success: true, data: result.data });
  }
);
```

### Service Pattern

```typescript
async create(input: { input: unknown }): Promise<Result<Entity>> {
  const validation = CreateSchema.safeParse(input.input);
  if (!validation.success) {
    return { success: false, error: { ... } };
  }
  return this.model.create(validation.data);
}
```

### Form Pattern

```typescript
const form = useForm<CreateInput>({
  resolver: zodResolver(CreateSchema)
});

const onSubmit = form.handleSubmit(async (data) => {
  // data is validated and typed
});
```

## Need Help?

- **Package Documentation**: [Main README](./README.md)
- **Schema Reference**: [API Reference](./api/schema-reference.md)
- **Type Issues**: [Type Inference Guide](./api/type-inference.md)
- **Custom Validators**: [Validators Guide](./api/validators.md)
