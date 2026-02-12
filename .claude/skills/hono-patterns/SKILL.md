---
name: hono-patterns
description: Hono web framework patterns for middleware, routes, and validation. Use when building APIs with Hono, zValidator, or factory-based CRUD.
---

# Hono Framework Patterns

## Purpose

Provide patterns for building APIs with the Hono web framework, including middleware composition, route definitions, factory-based CRUD, request validation with zValidator, error handling, and testing strategies.

## App Setup

**Pattern**: Modular app with middleware chain

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { itemRoutes } from "./routes/items";
import { errorHandler } from "./middleware/error-handler";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use("*", cors());

// Route modules
app.route("/api/v1/items", itemRoutes);

// Global error handler
app.onError(errorHandler);

export { app };
```

## Route Definition

### Standard Routes with Validation

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const createItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  price: z.number().positive(),
});

const app = new Hono();

app.get("/", async (c) => {
  const items = await itemService.findAll();
  return c.json({ success: true, data: items });
});

app.get("/:id", async (c) => {
  const item = await itemService.findById(c.req.param("id"));
  if (!item) return c.json({ error: "Not found" }, 404);
  return c.json({ success: true, data: item });
});

app.post(
  "/",
  requireAuth,
  zValidator("json", createItemSchema),
  async (c) => {
    const data = c.req.valid("json");
    const actor = c.get("user");
    const item = await itemService.create({ data, actor });
    return c.json({ success: true, data: item }, 201);
  }
);

export { app as itemRoutes };
```

### CRUD Factory Pattern

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

interface CRUDRouteOptions<T> {
  service: {
    findAll: () => Promise<T[]>;
    findById: (id: string) => Promise<T | null>;
    create: (data: unknown) => Promise<T>;
    update: (id: string, data: unknown) => Promise<T>;
    delete: (id: string) => Promise<void>;
  };
  createSchema: z.ZodSchema;
  updateSchema: z.ZodSchema;
}

export function createCRUDRoute<T>(options: CRUDRouteOptions<T>) {
  const app = new Hono();
  const { service, createSchema, updateSchema } = options;

  app.get("/", async (c) => {
    const items = await service.findAll();
    return c.json({ data: items });
  });

  app.get("/:id", async (c) => {
    const item = await service.findById(c.req.param("id"));
    if (!item) return c.json({ error: "Not found" }, 404);
    return c.json({ data: item });
  });

  app.post("/", zValidator("json", createSchema), async (c) => {
    const data = c.req.valid("json");
    const item = await service.create(data);
    return c.json({ data: item }, 201);
  });

  app.put("/:id", zValidator("json", updateSchema), async (c) => {
    const item = await service.update(c.req.param("id"), c.req.valid("json"));
    return c.json({ data: item });
  });

  app.delete("/:id", async (c) => {
    await service.delete(c.req.param("id"));
    return c.body(null, 204);
  });

  return app;
}
```

## Middleware Patterns

### Authentication Middleware

```typescript
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  const user = await verifyToken(token);
  if (!user) {
    throw new HTTPException(401, { message: "Invalid token" });
  }
  c.set("user", user);
  await next();
};
```

### Validation Targets

```typescript
// Body validation
app.post("/", zValidator("json", createSchema), handler);

// Query string validation
app.get("/", zValidator("query", listQuerySchema), handler);

// URL parameter validation
app.get("/:id", zValidator("param", idParamSchema), handler);
```

### Error Handler

```typescript
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      { success: false, error: { message: err.message, code: err.status } },
      err.status
    );
  }
  console.error("Unhandled error:", err);
  return c.json(
    { success: false, error: { message: "Internal server error", code: 500 } },
    500
  );
};
```

## Response Helpers

```typescript
import type { Context } from "hono";

export function successResponse<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true, data }, status);
}

export function paginatedResponse<T>(
  c: Context,
  data: T[],
  pagination: { total: number; page: number; pageSize: number }
) {
  return c.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  });
}
```

## Testing

```typescript
import { describe, it, expect } from "vitest";
import { app } from "../app";

describe("Item Routes", () => {
  it("should return all items", async () => {
    const res = await app.request("/api/v1/items");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("should create item with valid data", async () => {
    const res = await app.request("/api/v1/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ title: "Test Item", price: 100 }),
    });
    expect(res.status).toBe(201);
  });

  it("should return 401 without auth", async () => {
    const res = await app.request("/api/v1/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    expect(res.status).toBe(401);
  });
});
```

## Best Practices

- Use `zValidator` for all request validation (body, query, params)
- Use `HTTPException` for structured error responses
- Keep route handlers thin; delegate business logic to service classes
- Use the CRUD factory pattern for standard resource endpoints
- Compose middleware in a reusable chain (auth, logging, CORS)
- Use `app.route()` for modular route composition
- Always include structured JSON error responses
- Test routes using Hono's built-in `app.request()` method
- Define Zod schemas in separate files for reuse across routes
- Use TypeScript generics in factory functions for full type safety
