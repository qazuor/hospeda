# Relations

Complete guide to defining and working with relations in Drizzle ORM for the Hospeda project.

## Introduction

Relations define how tables are connected in your database. Drizzle ORM provides:

- **Type-safe relations**: Fully typed relation queries
- **Eager loading**: Load related data efficiently
- **Nested relations**: Query relations of relations
- **Flexible syntax**: Support for all relation types

## Relation Types

### One-to-One

Each record in Table A relates to exactly one record in Table B.

**Example**: User has one Profile

```text
users          profiles
┌────┬───────┐  ┌────┬────────┬────────┐
│ id │ name  │  │ id │userId  │ bio    │
├────┼───────┤  ├────┼────────┼────────┤
│ 1  │ Alice │  │ 1  │ 1      │ ...    │
│ 2  │ Bob   │  │ 2  │ 2      │ ...    │
└────┴───────┘  └────┴────────┴────────┘
        ↓                ↓
        └────────────────┘ (one-to-one)
```

### One-to-Many

One record in Table A relates to many records in Table B.

**Example**: Category has many Products

```text
categories        products
┌────┬──────────┐  ┌────┬────────────┬───────────┐
│ id │ name     │  │ id │categoryId  │ name      │
├────┼──────────┤  ├────┼────────────┼───────────┤
│ 1  │ Books    │  │ 1  │ 1          │ Novel     │
│ 2  │ Tech     │  │ 2  │ 1          │ Magazine  │
└────┴──────────┘  │ 3  │ 2          │ Laptop    │
        ↓           └────┴────────────┴───────────┘
        └──────────────┘ (one-to-many)
```

### Many-to-One

Inverse of one-to-many from the child's perspective.

**Example**: Product belongs to Category

```text
products              categories
┌────┬───────────┬──────────┐  ┌────┬────────┐
│ id │categoryId │ name     │  │ id │ name   │
├────┼───────────┼──────────┤  ├────┼────────┤
│ 1  │ 1         │ Novel    │  │ 1  │ Books  │
│ 2  │ 1         │ Magazine │  │ 2  │ Tech   │
│ 3  │ 2         │ Laptop   │  └────┴────────┘
└────┴───────────┴──────────┘         ↑
        └──────────────────────────────┘ (many-to-one)
```

### Many-to-Many

Many records in Table A relate to many records in Table B through a junction table.

**Example**: Products have many Tags, Tags have many Products

```text
products        r_product_tags          tags
┌────┬───────┐  ┌──────────┬────────┐  ┌────┬────────┐
│ id │ name  │  │productId │ tagId  │  │ id │ name   │
├────┼───────┤  ├──────────┼────────┤  ├────┼────────┤
│ 1  │ Novel │  │ 1        │ 1      │  │ 1  │ New    │
│ 2  │ Laptop│  │ 1        │ 2      │  │ 2  │ Sale   │
└────┴───────┘  │ 2        │ 3      │  │ 3  │ Tech   │
     ↓          └──────────┴────────┘  └────┴────────┘
     └────────────────┴───────────────────┘ (many-to-many)
```

## Defining Relations

### One-to-One Example

```typescript
import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Users table
export const users: ReturnType<typeof pgTable> = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Profiles table
export const profiles: ReturnType<typeof pgTable> = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()  // One-to-one: unique constraint
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// User relations (has one profile)
export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId]
  })
}));

// Profile relations (belongs to one user)
export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id]
  })
}));
```

### One-to-Many Example

```typescript
import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

// Categories table
export const categories: ReturnType<typeof pgTable> = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Products table
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Category relations (has many products)
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products)
}));

// Product relations (belongs to one category)
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  })
}));
```

### Many-to-Many Example

```typescript
import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';

// Products table
export const products: ReturnType<typeof pgTable> = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Tags table
export const tags: ReturnType<typeof pgTable> = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Junction table (many-to-many)
export const rProductTags: ReturnType<typeof pgTable> = pgTable(
  'r_product_tags',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.tagId] })
  })
);

// Product relations
export const productsRelations = relations(products, ({ many }) => ({
  tags: many(rProductTags)
}));

// Tag relations
export const tagsRelations = relations(tags, ({ many }) => ({
  products: many(rProductTags)
}));

// Junction table relations (connects both sides)
export const rProductTagsRelations = relations(rProductTags, ({ one }) => ({
  product: one(products, {
    fields: [rProductTags.productId],
    references: [products.id]
  }),
  tag: one(tags, {
    fields: [rProductTags.tagId],
    references: [tags.id]
  })
}));
```

## Relation Syntax

### relations() Function

```typescript
export const usersRelations = relations(
  users,           // Source table
  ({ one, many }) => ({  // Helpers
    // Define relations here
  })
);
```

### one() Helper

For one-to-one and many-to-one relations:

```typescript
one(targetTable, {
  fields: [sourceTable.foreignKey],
  references: [targetTable.primaryKey]
})
```

**Example:**

```typescript
// Product belongs to one category
category: one(categories, {
  fields: [products.categoryId],
  references: [categories.id]
})
```

### many() Helper

For one-to-many relations:

```typescript
many(targetTable)
```

**Example:**

```typescript
// Category has many products
products: many(products)
```

> **Note**: `many()` only takes the target table. The foreign key is inferred from the inverse relation.

## Foreign Keys

### Setup in Schema

Foreign keys establish database-level constraints:

```typescript
// Add foreign key column
categoryId: uuid('category_id')
  .notNull()
  .references(() => categories.id, {
    onDelete: 'restrict'  // Cascade action
  })
```

### Cascade Actions

**restrict** (default):

```typescript
references(() => categories.id, { onDelete: 'restrict' })
// Prevents deleting category if products exist
```

**cascade**:

```typescript
references(() => categories.id, { onDelete: 'cascade' })
// Deletes all products when category is deleted
```

**set null**:

```typescript
references(() => categories.id, { onDelete: 'set null' })
// Sets categoryId to NULL when category is deleted
```

**set default**:

```typescript
references(() => categories.id, { onDelete: 'set default' })
// Sets categoryId to default value when category is deleted
```

**no action**:

```typescript
references(() => categories.id, { onDelete: 'no action' })
// Similar to restrict
```

### Link to Relations

Foreign keys in schema must match relation definitions:

```typescript
// Schema: Foreign key
categoryId: uuid('category_id')
  .notNull()
  .references(() => categories.id)

// Relations: Must reference same columns
category: one(categories, {
  fields: [products.categoryId],  // Match FK column
  references: [categories.id]     // Match referenced column
})
```

## Querying Relations

### Using findWithRelations (BaseModel)

```typescript
import { productModel } from '@repo/db';

// Load product with category
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  { category: true }
);

console.log(product?.category.name); // Category name
```

### Using findAllWithRelations (BaseModel)

```typescript
// Load all products with relations
const { items, total } = await productModel.findAllWithRelations(
  { category: true, tags: true },
  { isActive: true },
  { page: 1, pageSize: 20 }
);

for (const product of items) {
  console.log(product.category.name);
  console.log(product.tags.map(t => t.tag.name));
}
```

### Nested Relations

Load relations of relations:

```typescript
// Product with category and category's owner
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  {
    category: {
      owner: true
    }
  }
);

console.log(product?.category.owner.email);
```

### Multiple Relations

```typescript
// Load multiple relations
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  {
    category: true,
    owner: true,
    reviews: true,
    tags: true
  }
);
```

### Selective Loading

Load only needed relations:

```typescript
// Only load category (efficient)
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  { category: true }
);

// Load all relations (slower)
const productFull = await productModel.findWithRelations(
  { id: 'product-id' },
  {
    category: true,
    owner: true,
    reviews: true,
    tags: true
  }
);
```

## Performance Tips

### N+1 Query Problem

**❌ Bad: N+1 queries**

```typescript
// Loads products
const products = await productModel.findAll({});

// Loads category for each product (N queries!)
for (const product of products.items) {
  const category = await categoryModel.findById(product.categoryId);
  console.log(category?.name);
}
// Total: 1 + N queries
```

**✅ Good: Eager loading**

```typescript
// Loads products with categories in 1 query
const { items } = await productModel.findAllWithRelations(
  { category: true }
);

for (const product of items) {
  console.log(product.category.name);
}
// Total: 1 query
```

### Selective Loading

**❌ Bad: Load all relations**

```typescript
// Loads everything (slow)
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  {
    category: true,
    owner: true,
    reviews: true,
    tags: true,
    images: true
  }
);
```

**✅ Good: Load only needed relations**

```typescript
// Loads only category (fast)
const product = await productModel.findWithRelations(
  { id: 'product-id' },
  { category: true }
);
```

### Pagination with Relations

```typescript
// Efficient pagination with relations
const result = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true },
  { page: 1, pageSize: 20 }
);

console.log(`Loaded ${result.items.length} of ${result.total}`);
```

### Indexes on Foreign Keys

Always index foreign key columns:

```typescript
export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id)
  },
  (table) => ({
    // Index for efficient joins
    categoryIdIdx: index('products_categoryId_idx').on(table.categoryId)
  })
);
```

## Complex Relation Patterns

### Self-Referencing Relations

Tables that reference themselves:

```typescript
// Categories with parent-child hierarchy
export const categories: ReturnType<typeof pgTable> = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id)
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  // Parent category
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'parent'
  }),

  // Child categories
  children: many(categories, {
    relationName: 'parent'
  })
}));
```

### Polymorphic Relations

One table relating to multiple tables:

```typescript
// Comments can be on products, posts, or events
export const comments: ReturnType<typeof pgTable> = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),

  // Polymorphic fields
  entityType: text('entity_type').notNull(),  // 'product', 'post', 'event'
  entityId: uuid('entity_id').notNull()
});

// Query polymorphic relations
const productComments = await db
  .select()
  .from(comments)
  .where(
    and(
      eq(comments.entityType, 'product'),
      eq(comments.entityId, productId)
    )
  );
```

> **Note**: Drizzle doesn't have built-in polymorphic relation syntax. Handle these manually.

### Through Relations (Has Many Through)

Access related records through intermediate table:

```typescript
// Authors -> Books -> Reviews
// Access all reviews for an author through their books

// Not directly supported, query manually:
const authorReviews = await db
  .select({
    review: reviews,
    book: books
  })
  .from(reviews)
  .innerJoin(books, eq(reviews.bookId, books.id))
  .where(eq(books.authorId, authorId));
```

## Best Practices

### 1. Always Define Both Sides

```typescript
// ✅ Good: Both sides defined
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products)
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  })
}));

// ❌ Bad: Only one side
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  })
}));
// Missing categoriesRelations!
```

### 2. Use Cascade Actions Wisely

```typescript
// ✅ Good: Restrict for critical data
ownerId: uuid('owner_id')
  .notNull()
  .references(() => users.id, { onDelete: 'restrict' })

// ✅ Good: Cascade for dependent data
productId: uuid('product_id')
  .notNull()
  .references(() => products.id, { onDelete: 'cascade' })

// ❌ Bad: Cascade for critical data
ownerId: uuid('owner_id')
  .notNull()
  .references(() => users.id, { onDelete: 'cascade' })
// Deleting user would delete all their products!
```

### 3. Name Relations Clearly

```typescript
// ✅ Good: Clear names
category: one(categories, { /* ... */ })
owner: one(users, { /* ... */ })
reviews: many(productReviews)

// ❌ Bad: Ambiguous names
cat: one(categories, { /* ... */ })
user: one(users, { /* ... */ })
data: many(productReviews)
```

### 4. Export Relations

```typescript
// packages/db/src/schemas/catalog/index.ts
export {
  products,
  productsRelations,
  categories,
  categoriesRelations
} from './product.dbschema';
```

### 5. Index Foreign Keys

```typescript
// ✅ Good: Indexed foreign keys
export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id)
  },
  (table) => ({
    categoryIdIdx: index('products_categoryId_idx').on(table.categoryId)
  })
);
```

## Complete Example

Full Product model with relations:

```typescript
// packages/db/src/schemas/catalog/product.dbschema.ts
import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema';
import { categories } from './category.dbschema';

// Products table
export const products: ReturnType<typeof pgTable> = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description').notNull(),
    price: integer('price').notNull(),
    stock: integer('stock').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),

    // Foreign keys
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (table) => ({
    categoryIdIdx: index('products_categoryId_idx').on(table.categoryId),
    ownerIdIdx: index('products_ownerId_idx').on(table.ownerId)
  })
);

// Reviews table
export const productReviews: ReturnType<typeof pgTable> = pgTable('product_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Tags table
export const tags: ReturnType<typeof pgTable> = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// Junction table
export const rProductTags: ReturnType<typeof pgTable> = pgTable(
  'r_product_tags',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.tagId] })
  })
);

// Relations
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  owner: one(users, {
    fields: [products.ownerId],
    references: [users.id]
  }),
  reviews: many(productReviews),
  tags: many(rProductTags)
}));

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
  product: one(products, {
    fields: [productReviews.productId],
    references: [products.id]
  }),
  author: one(users, {
    fields: [productReviews.authorId],
    references: [users.id]
  })
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  products: many(rProductTags)
}));

export const rProductTagsRelations = relations(rProductTags, ({ one }) => ({
  product: one(products, {
    fields: [rProductTags.productId],
    references: [products.id]
  }),
  tag: one(tags, {
    fields: [rProductTags.tagId],
    references: [tags.id]
  })
}));
```

## Troubleshooting

### Error: "Cannot find relation"

Ensure both sides of relation are defined and exported:

```typescript
// Export both table and relations
export { products, productsRelations } from './product.dbschema';
export { categories, categoriesRelations } from './category.dbschema';
```

### Type Errors with Relations

Ensure `fields` and `references` match:

```typescript
// ✅ Correct: Types match
category: one(categories, {
  fields: [products.categoryId],  // UUID
  references: [categories.id]     // UUID
})

// ❌ Wrong: Type mismatch
category: one(categories, {
  fields: [products.categoryId],  // UUID
  references: [categories.name]   // TEXT - wrong!
})
```

### Relations Not Loading

Check that you're using the correct model method:

```typescript
// ❌ Wrong: findById doesn't load relations
const product = await productModel.findById('id');
console.log(product?.category); // undefined

// ✅ Correct: Use findWithRelations
const product = await productModel.findWithRelations(
  { id: 'id' },
  { category: true }
);
console.log(product?.category); // Loaded
```

## Related Guides

- [Drizzle Schemas](./drizzle-schemas.md) - Define schemas with foreign keys
- [Creating Models](./creating-models.md) - Use relations in models
- [Optimization](./optimization.md) - Optimize relation queries

## Additional Resources

- [Drizzle Relations Documentation](https://orm.drizzle.team/docs/rqb#relations)
- [Database Normalization](https://en.wikipedia.org/wiki/Database_normalization)
