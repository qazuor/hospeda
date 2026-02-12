---
name: drizzle-patterns
description: Drizzle ORM patterns for schema, relations, queries, and migrations. Use when building database layers with Drizzle on PostgreSQL.
---

# Drizzle ORM Patterns

## Purpose

Provide patterns for database operations with Drizzle ORM, including schema definition, relations, type inference, CRUD queries, pagination, transactions, migrations, and testing strategies for PostgreSQL databases.

## Schema Definition

### Tables with Indexes and Constraints

```typescript
import {
  pgTable, uuid, varchar, text, timestamp, integer,
  index, check, primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  emailIdx: index("idx_users_email").on(table.email),
}));

export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  price: integer("price").notNull(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  authorIdx: index("idx_items_author").on(table.authorId),
  statusIdx: index("idx_items_status").on(table.status),
  priceCheck: check("check_price_positive", sql`${table.price} > 0`),
}));

// Many-to-many junction table
export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
});

export const itemTags = pgTable("item_tags", {
  itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}));
```

### Relations

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  author: one(users, {
    fields: [items.authorId],
    references: [users.id],
  }),
  tags: many(itemTags),
}));

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, { fields: [itemTags.itemId], references: [items.id] }),
  tag: one(tags, { fields: [itemTags.tagId], references: [tags.id] }),
}));
```

### Type Inference

```typescript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
```

## Query Patterns

### Basic CRUD

```typescript
import { eq, and, isNull, desc, sql } from "drizzle-orm";

// Create
const [newItem] = await db
  .insert(items)
  .values({ title: "New Item", price: 100, authorId: userId })
  .returning();

// Read one with relations
const item = await db.query.items.findFirst({
  where: eq(items.id, itemId),
  with: { author: true, tags: { with: { tag: true } } },
});

// Read many with filters
const activeItems = await db.query.items.findMany({
  where: and(eq(items.status, "active"), isNull(items.deletedAt)),
  orderBy: [desc(items.createdAt)],
  limit: 10,
});

// Update
const [updated] = await db
  .update(items)
  .set({ title: "Updated Title", updatedAt: new Date() })
  .where(eq(items.id, itemId))
  .returning();

// Soft delete
await db
  .update(items)
  .set({ deletedAt: new Date() })
  .where(eq(items.id, itemId));
```

### Pagination

```typescript
async function findPaginated(input: {
  page: number;
  pageSize: number;
  status?: string;
}) {
  const { page, pageSize, status } = input;
  const offset = (page - 1) * pageSize;

  const conditions = [isNull(items.deletedAt)];
  if (status) conditions.push(eq(items.status, status));

  const [results, [{ count }]] = await Promise.all([
    db.query.items.findMany({
      where: and(...conditions),
      limit: pageSize,
      offset,
      orderBy: [desc(items.createdAt)],
      with: { author: true },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(and(...conditions)),
  ]);

  return {
    data: results,
    pagination: {
      total: Number(count),
      page,
      pageSize,
      totalPages: Math.ceil(Number(count) / pageSize),
    },
  };
}
```

### Transactions

```typescript
const result = await db.transaction(async (tx) => {
  const [item] = await tx
    .insert(items)
    .values({ title: "New", price: 100, authorId: userId })
    .returning();

  await tx.insert(itemTags).values(
    tagIds.map((tagId) => ({ itemId: item.id, tagId }))
  );

  return item;
});
```

## Database Client Setup

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
export type Database = typeof db;
```

## Migrations

```bash
# Generate migration from schema changes
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate

# Push schema directly (development only)
pnpm drizzle-kit push
```

## Model Class Pattern

```typescript
export class ItemModel {
  constructor(private db: Database) {}

  async findById(id: string) {
    return this.db.query.items.findFirst({
      where: and(eq(items.id, id), isNull(items.deletedAt)),
      with: { author: true },
    });
  }

  async create(data: NewItem) {
    const [item] = await this.db.insert(items).values(data).returning();
    return item;
  }

  async update(id: string, data: Partial<NewItem>) {
    const [item] = await this.db
      .update(items)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return item;
  }

  async softDelete(id: string) {
    const [item] = await this.db
      .update(items)
      .set({ deletedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return item;
  }
}
```

## Testing

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../schema";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const db = drizzle(pool, { schema });

describe("ItemModel", () => {
  beforeEach(async () => {
    await db.delete(schema.items);
  });
  afterAll(async () => {
    await pool.end();
  });

  it("should create and retrieve an item", async () => {
    const [item] = await db
      .insert(schema.items)
      .values({ title: "Test", price: 100, authorId: testUserId })
      .returning();
    expect(item.id).toBeDefined();
    expect(item.title).toBe("Test");
  });
});
```

## Best Practices

- Use `$inferSelect` and `$inferInsert` for type inference instead of manually defining types
- Define `relations()` for type-safe joins with the query API
- Use `returning()` to get inserted or updated rows without a separate query
- Add indexes on frequently queried and filtered columns
- Use transactions for multi-step operations that must be atomic
- Implement soft delete with a `deletedAt` column and filter with `isNull()`
- Separate schema definitions, relations, and query logic into distinct files
- Use the Model class pattern for encapsulating domain-specific queries
- Run `drizzle-kit generate` for production migrations, `push` only in development
- Always run count queries in parallel with data queries for pagination
