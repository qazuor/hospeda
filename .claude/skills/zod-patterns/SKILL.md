---
name: zod-patterns
description: Zod validation patterns and schema definitions. Use when implementing validation, type inference, custom validators, or form/API integration with Zod.
---

# Zod Patterns

## Purpose

Comprehensive reference for Zod validation patterns. Covers schema definitions, type inference, custom validators, error formatting, composable schemas, and integration with forms and APIs.

## Activation

Use this skill when the user asks about:

- Zod schema definitions or validation
- Runtime type validation in TypeScript
- Form validation with Zod
- API input/output validation
- Custom validators or error formatting
- Type inference from schemas

## Core Schema Patterns

### Primitives

```typescript
import { z } from "zod";

// Primitives
const str = z.string();
const num = z.number();
const bool = z.boolean();
const date = z.date();
const bigint = z.bigint();
const symbol = z.symbol();
const undef = z.undefined();
const nil = z.null();
const voidType = z.void();
const any = z.any();
const unknown = z.unknown();
const never = z.never();
```

### String Validations

```typescript
const StringSchema = z.string()
  .min(1, "Required")
  .max(255, "Too long")
  .email("Invalid email")
  .url("Invalid URL")
  .uuid("Invalid UUID")
  .cuid()
  .cuid2()
  .ulid()
  .regex(/^[a-z]+$/, "Lowercase only")
  .includes("@")
  .startsWith("https://")
  .endsWith(".com")
  .trim()                    // Transforms: trims whitespace
  .toLowerCase()             // Transforms: lowercases
  .toUpperCase();            // Transforms: uppercases

// Template literal types
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

// IP addresses
const ipv4 = z.string().ip({ version: "v4" });
const ipv6 = z.string().ip({ version: "v6" });

// Datetime
const datetime = z.string().datetime();                    // ISO 8601
const datetimeOffset = z.string().datetime({ offset: true });
```

### Number Validations

```typescript
const NumberSchema = z.number()
  .int("Must be integer")
  .positive("Must be positive")
  .nonnegative("Must be >= 0")
  .negative()
  .nonpositive()
  .min(0)
  .max(100)
  .multipleOf(5)
  .finite()
  .safe();                   // Number.MIN_SAFE_INTEGER to MAX_SAFE_INTEGER

// Coercion (convert string inputs to numbers)
const coercedNumber = z.coerce.number();    // "42" -> 42
const coercedBoolean = z.coerce.boolean();  // "true" -> true
const coercedDate = z.coerce.date();        // "2024-01-01" -> Date
const coercedString = z.coerce.string();    // 42 -> "42"
```

### Objects

```typescript
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
  role: z.enum(["admin", "user", "moderator"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type inference
type User = z.infer<typeof UserSchema>;
// { id: string; name: string; email: string; age?: number; role: "admin" | "user" | "moderator"; metadata?: Record<string, unknown> }

// Object utilities
const PartialUser = UserSchema.partial();                    // All fields optional
const RequiredUser = UserSchema.required();                  // All fields required
const PickedUser = UserSchema.pick({ name: true, email: true });
const OmittedUser = UserSchema.omit({ metadata: true });
const ExtendedUser = UserSchema.extend({ avatar: z.string().url() });
const MergedUser = UserSchema.merge(z.object({ avatar: z.string() }));

// Deep partial
const DeepPartialUser = UserSchema.deepPartial();

// Strict mode (reject unknown keys)
const StrictUser = z.strictObject({
  name: z.string(),
  email: z.string().email(),
});

// Passthrough (keep unknown keys)
const PassthroughUser = UserSchema.passthrough();

// Strip (remove unknown keys - default behavior)
const StrippedUser = UserSchema.strip();
```

### Arrays and Tuples

```typescript
const TagsSchema = z.array(z.string())
  .min(1, "At least one tag")
  .max(10, "Max 10 tags")
  .nonempty("Cannot be empty");       // Guarantees [T, ...T[]]

type Tags = z.infer<typeof TagsSchema>;
// [string, ...string[]]

const TupleSchema = z.tuple([
  z.string(),    // name
  z.number(),    // age
  z.boolean(),   // active
]);

// Tuple with rest
const ArgsSchema = z.tuple([z.string()]).rest(z.number());
// [string, ...number[]]
```

### Unions and Discriminated Unions

```typescript
// Simple union
const StringOrNumber = z.union([z.string(), z.number()]);
// or
const StringOrNumber2 = z.string().or(z.number());

// Discriminated union (more efficient, better errors)
const EventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("click"),
    x: z.number(),
    y: z.number(),
  }),
  z.object({
    type: z.literal("keypress"),
    key: z.string(),
  }),
  z.object({
    type: z.literal("scroll"),
    direction: z.enum(["up", "down"]),
    delta: z.number(),
  }),
]);

type Event = z.infer<typeof EventSchema>;
```

### Enums

```typescript
// Zod enum
const RoleEnum = z.enum(["admin", "user", "moderator"]);
type Role = z.infer<typeof RoleEnum>;  // "admin" | "user" | "moderator"

// Access values
RoleEnum.options;  // ["admin", "user", "moderator"]
RoleEnum.enum;     // { admin: "admin", user: "user", moderator: "moderator" }

// Native enum
enum Direction {
  Up = "UP",
  Down = "DOWN",
}
const DirectionSchema = z.nativeEnum(Direction);
```

## Advanced Patterns

### Transforms

```typescript
// Transform input to different output
const SlugSchema = z.string()
  .transform((val) => val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));

const CentsSchema = z.number()
  .transform((dollars) => Math.round(dollars * 100));

// Parse string to number
const NumberFromString = z.string()
  .transform((val) => parseInt(val, 10))
  .pipe(z.number().int().positive());

// Chain input/output types
type SlugInput = z.input<typeof SlugSchema>;    // string
type SlugOutput = z.output<typeof SlugSchema>;   // string (transformed)
```

### Refinements

```typescript
// Simple refinement
const PasswordSchema = z.string()
  .min(8)
  .refine((val) => /[A-Z]/.test(val), {
    message: "Must contain uppercase letter",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Must contain number",
  })
  .refine((val) => /[!@#$%^&*]/.test(val), {
    message: "Must contain special character",
  });

// Superrefine for complex validation with custom error paths
const FormSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
  }
});
```

### Recursive Schemas

```typescript
// File system tree
interface TreeNode {
  name: string;
  children?: TreeNode[];
}

const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    children: z.array(TreeNodeSchema).optional(),
  })
);

// JSON type
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonSchema),
    z.record(JsonSchema),
  ])
);
```

### Preprocess and Pipeline

```typescript
// Preprocess: transform before validation
const NumberInput = z.preprocess(
  (val) => (typeof val === "string" ? parseInt(val, 10) : val),
  z.number().int().positive()
);

// Pipeline: chain schemas (input -> transform -> validate)
const TrimmedEmail = z.string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().email());
```

### Branded Types

```typescript
const UserId = z.string().uuid().brand<"UserId">();
const OrderId = z.string().uuid().brand<"OrderId">();

type UserId = z.infer<typeof UserId>;
type OrderId = z.infer<typeof OrderId>;

function getUser(id: UserId) { /* ... */ }

const userId = UserId.parse("550e8400-e29b-41d4-a716-446655440000");
getUser(userId);       // OK
// getUser(orderId);   // Type error - branded types are not interchangeable
```

## Composable Schema Patterns

### Schema Factories

```typescript
// Reusable pagination schema
function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive().max(100),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  });
}

const PaginatedUsers = paginatedSchema(UserSchema);
type PaginatedUsers = z.infer<typeof PaginatedUsers>;

// Reusable API response wrapper
function apiResponse<T extends z.ZodType>(dataSchema: T) {
  return z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.array(z.string()).optional(),
      }),
    }),
  ]);
}
```

### Schema Composition

```typescript
// Base schemas for mixing
const TimestampFields = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const SoftDeleteFields = z.object({
  deletedAt: z.string().datetime().nullable(),
  isDeleted: z.boolean().default(false),
});

const IdField = z.object({
  id: z.string().uuid(),
});

// Compose into domain schemas
const PostSchema = IdField
  .merge(TimestampFields)
  .merge(SoftDeleteFields)
  .extend({
    title: z.string().min(1).max(200),
    body: z.string().min(1),
    authorId: z.string().uuid(),
    status: z.enum(["draft", "published", "archived"]),
    tags: z.array(z.string()).default([]),
  });

// Create/Update variants
const CreatePostSchema = PostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  isDeleted: true,
});

const UpdatePostSchema = CreatePostSchema.partial();
```

## Error Formatting

### Custom Error Map

```typescript
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.expected === "string") {
        return { message: "This field must be text" };
      }
      break;
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: `Must be at least ${issue.minimum} characters` };
      }
      break;
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `Must be at most ${issue.maximum} characters` };
      }
      break;
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);
```

### Formatted Errors for Forms

```typescript
const result = UserSchema.safeParse(formData);

if (!result.success) {
  // Flat list of errors
  const flat = result.error.flatten();
  // { formErrors: string[], fieldErrors: { name?: string[], email?: string[] } }

  // Formatted (nested) errors
  const formatted = result.error.format();
  // { name: { _errors: string[] }, email: { _errors: string[] } }

  // Custom formatting
  const issues = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}
```

## Form Validation Integration

### React Hook Form + Zod

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const LoginSchema = z.object({
  email: z.string().min(1, "Required").email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
  rememberMe: z.boolean().default(false),
});

type LoginForm = z.infer<typeof LoginSchema>;

function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = (data: LoginForm) => {
    // data is fully typed and validated
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} />
      {errors.email && <span>{errors.email.message}</span>}

      <input type="password" {...register("password")} />
      {errors.password && <span>{errors.password.message}</span>}

      <input type="checkbox" {...register("rememberMe")} />

      <button type="submit">Login</button>
    </form>
  );
}
```

### Server Action Validation (Next.js)

```typescript
"use server";

import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(5000),
});

export async function submitContact(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  };

  const result = ContactSchema.safeParse(raw);
  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  // result.data is typed and validated
  await saveContact(result.data);
  return { success: true };
}
```

## API Validation Patterns

### Express/Fastify Middleware

```typescript
import { z } from "zod";
import { Request, Response, NextFunction } from "express";

function validate<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
    }

    req.validated = result.data;
    next();
  };
}

// Usage
const CreateUserRequest = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  query: z.object({}),
  params: z.object({}),
});

app.post("/users", validate(CreateUserRequest), (req, res) => {
  const { name, email } = req.validated.body;
  // ...
});
```

### tRPC Integration

```typescript
import { z } from "zod";
import { router, publicProcedure } from "./trpc";

export const userRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.user.findUnique({ where: { id: input.id } });
    }),

  create: publicProcedure
    .input(CreateUserSchema)
    .mutation(async ({ input }) => {
      return db.user.create({ data: input });
    }),

  list: publicProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      limit: z.number().int().positive().max(100).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      // input is typed and validated
    }),
});
```

## Best Practices

1. **Define schemas once, derive types** - Use `z.infer<typeof Schema>` instead of writing types separately
2. **Use `safeParse` in production** - Never use `.parse()` unless you want to throw; prefer `.safeParse()` for graceful error handling
3. **Compose small schemas** - Build complex schemas from small, reusable pieces
4. **Use branded types** for domain identifiers to prevent accidental misuse
5. **Use `z.coerce`** for external input (form data, query params, env vars)
6. **Use discriminated unions** instead of plain unions for better error messages
7. **Set default values** with `.default()` to handle optional fields gracefully
8. **Use `.transform()`** to normalize data at the schema level (trim, lowercase, etc.)
9. **Keep error messages user-friendly** - Always pass readable messages to validation methods
10. **Export both schema and type** from shared packages for reuse
