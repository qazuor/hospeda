# Type Inference Guide - @repo/schemas

**Master type inference with z.infer for complete type safety**

This guide explains how to use Zod's `z.infer` utility to automatically derive TypeScript types from validation schemas. Understanding type inference is essential for getting the most out of the `@repo/schemas` package.

## Table of Contents

- [What is Type Inference](#what-is-type-inference)
- [Basic Type Inference](#basic-type-inference)
- [Inference from Derived Schemas](#inference-from-derived-schemas)
- [Inference from Composed Schemas](#inference-from-composed-schemas)
- [Working with Optional/Nullable Types](#working-with-optionalnullable-types)
- [Array and Record Type Inference](#array-and-record-type-inference)
- [Enum Type Inference](#enum-type-inference)
- [Advanced Patterns](#advanced-patterns)
- [Common Pitfalls](#common-pitfalls)
- [Best Practices](#best-practices)

## What is Type Inference

Type inference allows TypeScript to automatically determine types based on schema definitions. With Zod's `z.infer`, you define validation rules once in a schema, and TypeScript types are automatically generated.

### Traditional Approach (Without Schemas)

```typescript
// ❌ Define types manually
type User = {
  id: string;
  name: string;
  email: string;
  age: number;
};

// ❌ Then validate manually
function validateUser(data: unknown): User {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid user');
  }
  // ... lots of manual validation
  return data as User;
}
```

**Problems:**

- Types and validation logic are separate (easy to get out of sync)
- Manual validation is error-prone
- Changes require updating both types and validation

### Schema-First Approach (With Zod)

```typescript
// ✅ Define schema with validation
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().min(18).max(120)
});

// ✅ Infer type from schema
type User = z.infer<typeof userSchema>;

// ✅ Validation is automatic
const result = userSchema.safeParse(data);
if (result.success) {
  const user: User = result.data; // Fully typed!
}
```

**Benefits:**

- Single source of truth for structure AND validation
- Types automatically match validation rules
- Changes to schema automatically update types
- Runtime validation with compile-time types

## Basic Type Inference

### Simple Object Schema

```typescript
import { z } from 'zod';

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  inStock: z.boolean()
});

type Product = z.infer<typeof productSchema>;

// Inferred type:
// type Product = {
//   id: string;
//   name: string;
//   price: number;
//   inStock: boolean;
// }
```

### With Optional Fields

```typescript
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),  // Optional field
  bio: z.string().optional()     // Optional field
});

type User = z.infer<typeof userSchema>;

// Inferred type:
// type User = {
//   id: string;
//   name: string;
//   email: string;
//   phone?: string;      // Optional property
//   bio?: string;        // Optional property
// }
```

### With Nullable Fields

```typescript
const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  publishedAt: z.date().nullable()  // Can be null
});

type Post = z.infer<typeof postSchema>;

// Inferred type:
// type Post = {
//   id: string;
//   title: string;
//   content: string;
//   publishedAt: Date | null;  // Union with null
// }
```

### With Default Values

```typescript
const settingsSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
  notifications: z.boolean().default(true),
  pageSize: z.number().default(10)
});

type Settings = z.infer<typeof settingsSchema>;

// Inferred type:
// type Settings = {
//   theme: 'light' | 'dark';
//   notifications: boolean;
//   pageSize: number;
// }
// Note: Default values don't affect the type, but are used during parsing
```

## Inference from Derived Schemas

### Omit - Removing Fields

```typescript
const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
  createdAt: z.date(),
  updatedAt: z.date()
});

// Omit sensitive and auto-generated fields
const userPublicSchema = userSchema.omit({
  password: true,
  createdAt: true,
  updatedAt: true
});

type User = z.infer<typeof userSchema>;
// { id: string; email: string; password: string; createdAt: Date; updatedAt: Date }

type UserPublic = z.infer<typeof userPublicSchema>;
// { id: string; email: string }
```

**Real-world example from @repo/schemas:**

```typescript
import { UserSchema } from '@repo/schemas';

// Create schema omits system fields
const UserCreateInputSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true
});

type UserCreateInput = z.infer<typeof UserCreateInputSchema>;
// User without id, createdAt, updatedAt, deletedAt
```

### Pick - Selecting Fields

```typescript
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  address: z.string(),
  phone: z.string()
});

// Pick only essential fields
const userSummarySchema = userSchema.pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true
});

type UserSummary = z.infer<typeof userSummarySchema>;
// { id: string; email: string; firstName: string; lastName: string }
```

### Partial - Making All Fields Optional

```typescript
const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string()
});

// All fields become optional
const userUpdateSchema = userSchema.partial();

type UserUpdate = z.infer<typeof userUpdateSchema>;
// { id?: string; name?: string; email?: string }
```

**Common update pattern:**

```typescript
// Update schema: omit immutable fields, then make partial
const userUpdateSchema = userSchema
  .omit({ id: true, createdAt: true })
  .partial();

type UserUpdate = z.infer<typeof userUpdateSchema>;
// { name?: string; email?: string; updatedAt?: Date }
```

### Required - Making All Fields Required

```typescript
const optionalSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional()
});

const requiredSchema = optionalSchema.required();

type RequiredData = z.infer<typeof requiredSchema>;
// { name: string; email: string; phone: string }
```

## Inference from Composed Schemas

### Extend - Adding New Fields

```typescript
const baseSchema = z.object({
  id: z.string(),
  name: z.string()
});

const extendedSchema = baseSchema.extend({
  email: z.string().email(),
  age: z.number()
});

type Base = z.infer<typeof baseSchema>;
// { id: string; name: string }

type Extended = z.infer<typeof extendedSchema>;
// { id: string; name: string; email: string; age: number }
```

**Real-world example:**

```typescript
import { AccommodationSchema, DestinationSchema } from '@repo/schemas';

// Extend accommodation with destination data
const AccommodationWithDestinationSchema = AccommodationSchema.extend({
  destination: DestinationSchema
});

type AccommodationWithDestination = z.infer<typeof AccommodationWithDestinationSchema>;
// Accommodation & { destination: Destination }
```

### Merge - Combining Schemas

```typescript
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string()
});

const contactSchema = z.object({
  email: z.string().email(),
  phone: z.string()
});

const userSchema = z.object({
  id: z.string(),
  name: z.string()
});

// Merge all three schemas
const fullUserSchema = userSchema
  .merge(addressSchema)
  .merge(contactSchema);

type FullUser = z.infer<typeof fullUserSchema>;
// {
//   id: string;
//   name: string;
//   street: string;
//   city: string;
//   zipCode: string;
//   email: string;
//   phone: string;
// }
```

### Intersection - Combining with &

```typescript
const personSchema = z.object({
  name: z.string(),
  age: z.number()
});

const employeeSchema = z.object({
  employeeId: z.string(),
  department: z.string()
});

const employeePersonSchema = z.intersection(
  personSchema,
  employeeSchema
);

type EmployeePerson = z.infer<typeof employeePersonSchema>;
// { name: string; age: number } & { employeeId: string; department: string }
```

## Working with Optional/Nullable Types

### Optional vs Nullable vs Nullish

```typescript
// Optional: field may be undefined
const optionalSchema = z.object({
  value: z.string().optional()
});
type Optional = z.infer<typeof optionalSchema>;
// { value?: string }

// Nullable: field may be null
const nullableSchema = z.object({
  value: z.string().nullable()
});
type Nullable = z.infer<typeof nullableSchema>;
// { value: string | null }

// Nullish: field may be undefined or null
const nullishSchema = z.object({
  value: z.string().nullish()
});
type Nullish = z.infer<typeof nullishSchema>;
// { value?: string | null }
```

### Handling Optional Chains

```typescript
const userSchema = z.object({
  id: z.string(),
  profile: z.object({
    bio: z.string().optional(),
    avatar: z.string().optional()
  }).optional()
});

type User = z.infer<typeof userSchema>;
// {
//   id: string;
//   profile?: {
//     bio?: string;
//     avatar?: string;
//   }
// }

// Safe access with optional chaining
function getUserBio(user: User): string | undefined {
  return user.profile?.bio;
}
```

## Array and Record Type Inference

### Array Types

```typescript
const tagsSchema = z.array(z.string());

type Tags = z.infer<typeof tagsSchema>;
// string[]
```

```typescript
const usersSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string()
  })
);

type Users = z.infer<typeof usersSchema>;
// Array<{ id: string; name: string }>
```

### Array with Min/Max

```typescript
const coordinatesSchema = z.array(z.number()).min(2).max(2);

type Coordinates = z.infer<typeof coordinatesSchema>;
// number[]  // Note: min/max don't affect type, only validation
```

### Record Types

```typescript
const metadataSchema = z.record(z.string(), z.number());

type Metadata = z.infer<typeof metadataSchema>;
// Record<string, number>
```

```typescript
const settingsSchema = z.record(
  z.enum(['theme', 'locale', 'timezone']),
  z.string()
);

type Settings = z.infer<typeof settingsSchema>;
// Record<'theme' | 'locale' | 'timezone', string>
```

### Unknown Records

```typescript
const dynamicDataSchema = z.record(z.unknown());

type DynamicData = z.infer<typeof dynamicDataSchema>;
// Record<string, unknown>
```

## Enum Type Inference

### Zod Enum

```typescript
const roleSchema = z.enum(['user', 'admin', 'moderator']);

type Role = z.infer<typeof roleSchema>;
// 'user' | 'admin' | 'moderator'
```

**Real-world example:**

```typescript
import { RoleEnumSchema, type RoleEnum } from '@repo/schemas';

// RoleEnum is:
// 'user' | 'moderator' | 'admin' | 'super_admin'

function hasAdminAccess(role: RoleEnum): boolean {
  return role === 'admin' || role === 'super_admin';
}
```

### Native Enum

```typescript
enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue'
}

const colorSchema = z.nativeEnum(Color);

type ColorType = z.infer<typeof colorSchema>;
// Color
```

### Discriminated Union

```typescript
const shapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('circle'),
    radius: z.number()
  }),
  z.object({
    type: z.literal('rectangle'),
    width: z.number(),
    height: z.number()
  })
]);

type Shape = z.infer<typeof shapeSchema>;
// { type: 'circle'; radius: number } | { type: 'rectangle'; width: number; height: number }

// Type narrowing works!
function getArea(shape: Shape): number {
  switch (shape.type) {
    case 'circle':
      return Math.PI * shape.radius ** 2;  // TS knows radius exists
    case 'rectangle':
      return shape.width * shape.height;   // TS knows width/height exist
  }
}
```

## Advanced Patterns

### Recursive Types

```typescript
type Category = {
  id: string;
  name: string;
  children: Category[];
};

const categorySchema: z.ZodType<Category> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    children: z.array(categorySchema)
  })
);

type InferredCategory = z.infer<typeof categorySchema>;
// Same as Category type above
```

### Generic Schemas

```typescript
function createPaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number()
    })
  });
}

const userSchema = z.object({
  id: z.string(),
  name: z.string()
});

const paginatedUsersSchema = createPaginatedSchema(userSchema);

type PaginatedUsers = z.infer<typeof paginatedUsersSchema>;
// {
//   data: Array<{ id: string; name: string }>;
//   pagination: { page: number; pageSize: number; total: number };
// }
```

**Real-world example from @repo/schemas:**

```typescript
import { PaginationResultSchema } from '@repo/schemas';

// Generic pagination wrapper
const userPaginationSchema = PaginationResultSchema(UserSchema);

type UserPagination = z.infer<typeof userPaginationSchema>;
// {
//   data: User[];
//   pagination: { page: number; pageSize: number; total: number; ... };
// }
```

### Transform Types

```typescript
const dateStringSchema = z.string().transform((str) => new Date(str));

type DateString = z.infer<typeof dateStringSchema>;
// Date  // Note: Inferred type is the OUTPUT of transform
```

```typescript
const trimmedSchema = z.string().transform((str) => str.trim());

type Trimmed = z.infer<typeof trimmedSchema>;
// string
```

### Preprocess Types

```typescript
const numberFromStringSchema = z.preprocess(
  (val) => (typeof val === 'string' ? parseFloat(val) : val),
  z.number()
);

type NumberFromString = z.infer<typeof numberFromStringSchema>;
// number
```

### Branded Types

```typescript
const userIdSchema = z.string().uuid().brand('UserId');

type UserId = z.infer<typeof userIdSchema>;
// string & { __brand: 'UserId' }

// Type safety: can't mix branded types
const postIdSchema = z.string().uuid().brand('PostId');
type PostId = z.infer<typeof postIdSchema>;

function getUser(id: UserId): void { /* ... */ }
function getPost(id: PostId): void { /* ... */ }

declare const userId: UserId;
declare const postId: PostId;

getUser(userId);  // ✅ OK
getUser(postId);  // ❌ Error: Type mismatch
```

## Common Pitfalls

### Pitfall 1: Not Using `typeof`

```typescript
const userSchema = z.object({
  name: z.string()
});

// ❌ WRONG: Missing typeof
type User = z.infer<userSchema>;
//                   ~~~~~~~~~~
// Error: 'userSchema' refers to a value, but is being used as a type

// ✅ CORRECT: Use typeof
type User = z.infer<typeof userSchema>;
```

### Pitfall 2: Inferring Before Schema is Complete

```typescript
// ❌ WRONG: Type inferred before extend
const baseSchema = z.object({ id: z.string() });
type Base = z.infer<typeof baseSchema>;

const extendedSchema = baseSchema.extend({ name: z.string() });
// Base type doesn't include 'name'

// ✅ CORRECT: Infer after all modifications
const baseSchema = z.object({ id: z.string() });
const extendedSchema = baseSchema.extend({ name: z.string() });
type Extended = z.infer<typeof extendedSchema>;
// { id: string; name: string }
```

### Pitfall 3: Confusing Input vs Output Types

```typescript
const dateSchema = z.string().transform((str) => new Date(str));

// Input type (what you pass to parse)
type Input = z.input<typeof dateSchema>;
// string

// Output type (what you get after parse)
type Output = z.infer<typeof dateSchema>;
// Date

// z.infer always gives you the OUTPUT type
```

### Pitfall 4: Losing Type Safety with `any`

```typescript
// ❌ WRONG: Using any loses type safety
const schema = z.object({
  data: z.any()
});

type Data = z.infer<typeof schema>;
// { data: any }  // Lost type safety!

// ✅ CORRECT: Use unknown and validate
const schema = z.object({
  data: z.unknown()
});

type Data = z.infer<typeof schema>;
// { data: unknown }  // Must be type-guarded
```

### Pitfall 5: Not Exporting Types

```typescript
// ❌ WRONG: Only exporting schema
export const UserSchema = z.object({ ... });
// Users must write: type User = z.infer<typeof UserSchema>

// ✅ CORRECT: Export both schema and type
export const UserSchema = z.object({ ... });
export type User = z.infer<typeof UserSchema>;
// Users can import: import { UserSchema, type User } from '...'
```

## Best Practices

### 1. Always Export Inferred Types

```typescript
// ✅ Export schema AND type
export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number()
});

export type Product = z.infer<typeof ProductSchema>;
```

### 2. Use Type Aliases for Clarity

```typescript
// ✅ Clear naming
export const ProductCreateInputSchema = ProductSchema.omit({ id: true });
export type ProductCreateInput = z.infer<typeof ProductCreateInputSchema>;

export const ProductUpdateInputSchema = ProductSchema.partial();
export type ProductUpdateInput = z.infer<typeof ProductUpdateInputSchema>;
```

### 3. Leverage Utility Types

```typescript
// Create reusable type utilities
export type Paginated<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

// Use with inferred types
type PaginatedProducts = Paginated<Product>;
```

### 4. Document Complex Inferences

```typescript
/**
 * User type with all authentication and profile fields.
 * Inferred from UserSchema which includes:
 * - Base auth fields (email, password)
 * - Profile fields (name, bio, avatar)
 * - Audit fields (createdAt, updatedAt)
 */
export type User = z.infer<typeof UserSchema>;
```

### 5. Use Type Guards with Inferred Types

```typescript
import { UserSchema, type User } from '@repo/schemas';

function isUser(value: unknown): value is User {
  return UserSchema.safeParse(value).success;
}

// Usage
if (isUser(data)) {
  // TypeScript knows data is User here
  console.log(data.email);
}
```

### 6. Combine with Utility Types

```typescript
export type User = z.infer<typeof UserSchema>;

// Create derived types
export type UserKeys = keyof User;
export type UserValues = User[keyof User];
export type PartialUser = Partial<User>;
export type RequiredUser = Required<User>;
export type ReadonlyUser = Readonly<User>;
```

### 7. Use Input/Output Types When Needed

```typescript
const transformSchema = z.string().transform((str) => parseInt(str, 10));

// Input type (string)
type Input = z.input<typeof transformSchema>;

// Output type (number)
type Output = z.infer<typeof transformSchema>;

function parseNumber(input: Input): Output {
  return transformSchema.parse(input);
}
```

## Real-World Examples

### API Route with Type Inference

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  ProductCreateInputSchema,
  ProductCreateOutputSchema,
  type ProductCreateInput,
  type ProductCreateOutput
} from '@repo/schemas';

const app = new Hono();

app.post(
  '/products',
  zValidator('json', ProductCreateInputSchema),
  async (c) => {
    // input is inferred as ProductCreateInput
    const input: ProductCreateInput = c.req.valid('json');

    const product: ProductCreateOutput = await createProduct(input);

    return c.json({ success: true, data: product });
  }
);
```

### Service with Type Inference

```typescript
import {
  UserCreateInputSchema,
  UserUpdateInputSchema,
  type UserCreateInput,
  type UserUpdateInput,
  type User
} from '@repo/schemas';

export class UserService {
  async create(input: { input: unknown }): Promise<Result<User>> {
    const validation = UserCreateInputSchema.safeParse(input.input);

    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    // validation.data is inferred as UserCreateInput
    const data: UserCreateInput = validation.data;

    const user: User = await this.model.create(data);

    return { success: true, data: user };
  }
}
```

### Form with Type Inference

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ProductCreateInputSchema,
  type ProductCreateInput
} from '@repo/schemas';

export function ProductForm() {
  const form = useForm<ProductCreateInput>({
    resolver: zodResolver(ProductCreateInputSchema)
  });

  // data is inferred as ProductCreateInput
  const onSubmit = form.handleSubmit(async (data: ProductCreateInput) => {
    await createProduct(data);
  });

  return <form onSubmit={onSubmit}>{/* ... */}</form>;
}
```

## Related Documentation

- **[Quick Start Guide](../quick-start.md)**: Get started with schemas
- **[Schema Reference](./schema-reference.md)**: All available schemas
- **[Validators Guide](./validators.md)**: Custom validation rules
- **[Main Documentation](../README.md)**: Package overview

## Further Reading

- [Zod Documentation - Type Inference](https://zod.dev/?id=type-inference)
- [TypeScript Handbook - Type Inference](https://www.typescriptlang.org/docs/handbook/type-inference.html)
