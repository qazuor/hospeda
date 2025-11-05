# Relations Guide

Complete guide to defining, loading, and querying relations in `@repo/db` using Drizzle ORM.

## Table of Contents

- [Overview](#overview)
- [Defining Relations](#defining-relations)
  - [Drizzle Relations Syntax](#drizzle-relations-syntax)
  - [One-to-One Relations](#one-to-one-relations)
  - [One-to-Many Relations](#one-to-many-relations)
  - [Many-to-Many Relations](#many-to-many-relations)
  - [Self-Referencing Relations](#self-referencing-relations)
- [Foreign Keys](#foreign-keys)
  - [Setting Up Foreign Keys](#setting-up-foreign-keys)
  - [Cascade Actions](#cascade-actions)
  - [Nullable vs Required](#nullable-vs-required)
- [Querying Relations](#querying-relations)
  - [Loading Single Relations](#loading-single-relations)
  - [Loading Multiple Relations](#loading-multiple-relations)
  - [Nested Relations](#nested-relations)
  - [Selective Loading](#selective-loading)
- [Performance](#performance)
  - [N+1 Problem](#n1-problem)
  - [Eager vs Lazy Loading](#eager-vs-lazy-loading)
  - [Optimizing Relation Queries](#optimizing-relation-queries)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

Relations define how entities are connected in your database. Drizzle ORM provides a type-safe way to define and query relations between tables.

**Relation Types:**

- **One-to-One**: Each entity has exactly one related entity
- **One-to-Many**: One entity has many related entities
- **Many-to-Many**: Multiple entities relate to multiple entities (requires junction table)
- **Self-Referencing**: Entity relates to itself (e.g., category parent/children)

**Benefits:**

- Type-safe relation access
- Automatic JOIN queries
- Nested relation loading
- Prevents N+1 query problems

---

## Defining Relations

### Drizzle Relations Syntax

Relations are defined separately from table schemas using the `relations()` function.

**File Structure:**

```
schemas/
  product/
    product.dbschema.ts      # Table definition
    index.ts                 # Exports table + relations
  category/
    category.dbschema.ts
    index.ts
  review/
    review.dbschema.ts
    index.ts
```

**Basic Pattern:**

```typescript
// schemas/product/product.dbschema.ts
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  categoryId: uuid('category_id').notNull(),
  // Foreign key reference
});

// Define relations
import { relations } from 'drizzle-orm';
import { categories } from '../category/category.dbschema';
import { reviews } from '../review/review.dbschema';

export const productsRelations = relations(products, ({ one, many }) => ({
  // One-to-one or Many-to-one
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),

  // One-to-many
  reviews: many(reviews),
}));
```

---

### One-to-One Relations

Each entity has exactly one related entity.

**Example: User ↔ Profile**

```typescript
// schemas/user/user.dbschema.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  // ... other fields
});

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
}));

// schemas/user/user_profile.dbschema.ts
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique(),  // Unique constraint for 1:1
  bio: text('bio'),
  avatar: text('avatar'),
  // ... other fields
});

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));
```

**Usage:**

```typescript
const user = await userModel.findWithRelations(
  { email: 'user@example.com' },
  { profile: true }
);

console.log(user?.profile.bio);
console.log(user?.profile.avatar);
```

---

### One-to-Many Relations

One entity has many related entities.

**Example: Product ↔ Reviews**

```typescript
// schemas/product/product.dbschema.ts
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // ... other fields
});

export const productsRelations = relations(products, ({ many }) => ({
  reviews: many(reviews),
}));

// schemas/review/review.dbschema.ts
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  authorId: uuid('author_id').notNull(),
  // ... other fields
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  author: one(users, {
    fields: [reviews.authorId],
    references: [users.id],
  }),
}));
```

**Usage:**

```typescript
// Load product with all reviews
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  { reviews: true }
);

console.log(`Reviews: ${product?.reviews.length}`);
for (const review of product?.reviews || []) {
  console.log(`${review.rating}/5 - ${review.comment}`);
}

// Load review with product
const review = await reviewModel.findWithRelations(
  { id: 'review-uuid' },
  { product: true, author: true }
);

console.log(review?.product.name);
console.log(review?.author.name);
```

---

### Many-to-Many Relations

Multiple entities relate to multiple entities through a junction table.

**Example: Product ↔ Tags**

```typescript
// schemas/product/product.dbschema.ts
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
});

export const productsRelations = relations(products, ({ many }) => ({
  productTags: many(productTags),
}));

// schemas/tag/tag.dbschema.ts
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
});

export const tagsRelations = relations(tags, ({ many }) => ({
  productTags: many(productTags),
}));

// schemas/junction/product_tag.dbschema.ts (junction table)
export const productTags = pgTable(
  'product_tags',
  {
    productId: uuid('product_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    // Composite primary key
    pk: primaryKey({ columns: [table.productId, table.tagId] }),
  })
);

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, {
    fields: [productTags.productId],
    references: [products.id],
  }),
  tag: one(tags, {
    fields: [productTags.tagId],
    references: [tags.id],
  }),
}));
```

**Usage:**

```typescript
// Load product with tags
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  {
    productTags: {
      tag: true,  // Load tag through junction
    },
  }
);

// Access tags
for (const pt of product?.productTags || []) {
  console.log(pt.tag.name);
}

// Better: Create helper method
export class ProductModel extends BaseModel<Product> {
  async findWithTags(id: string) {
    const result = await this.findWithRelations(
      { id },
      {
        productTags: {
          tag: true,
        },
      }
    );

    if (!result) return null;

    // Transform to simpler structure
    return {
      ...result,
      tags: result.productTags.map(pt => pt.tag),
    };
  }
}

// Usage
const product = await productModel.findWithTags('product-uuid');
console.log(product?.tags);  // Direct tag array
```

**Alternative: Direct Many-to-Many (if junction table has no extra fields):**

```typescript
// If you don't need timestamps or other fields in junction table
export const productsRelations = relations(products, ({ many }) => ({
  tags: many(tags),  // Direct relation
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  products: many(products),
}));

// Usage - simpler
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  { tags: true }
);

console.log(product?.tags);  // Direct tag array
```

---

### Self-Referencing Relations

Entity relates to itself, typically for hierarchical data.

**Example: Category Tree**

```typescript
// schemas/category/category.dbschema.ts
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  parentId: uuid('parent_id'),  // Nullable - root categories have no parent
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  // Parent relation (many-to-one)
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryHierarchy',
  }),

  // Children relation (one-to-many)
  children: many(categories, {
    relationName: 'categoryHierarchy',
  }),
}));
```

> **Note:** Use `relationName` to distinguish between multiple relations to the same table.

**Usage:**

```typescript
// Load category with parent
const category = await categoryModel.findWithRelations(
  { slug: 'smartphones' },
  { parent: true }
);

console.log(category?.parent?.name);  // "Electronics"

// Load category with children
const category = await categoryModel.findWithRelations(
  { slug: 'electronics' },
  { children: true }
);

console.log(`Subcategories: ${category?.children.length}`);
for (const child of category?.children || []) {
  console.log(`- ${child.name}`);
}

// Load full tree (parent + children)
const category = await categoryModel.findWithRelations(
  { slug: 'smartphones' },
  {
    parent: true,
    children: true,
  }
);

console.log('Parent:', category?.parent?.name);
console.log('Siblings:', category?.parent?.children.length);
console.log('Children:', category?.children.length);
```

**Building Category Tree:**

```typescript
export class CategoryModel extends BaseModel<Category> {
  async getCategoryTree(rootSlug: string, depth: number = 2) {
    // Load root with nested children
    const relations = this.buildNestedRelations(depth);

    const root = await this.findWithRelations(
      { slug: rootSlug },
      relations
    );

    return root;
  }

  private buildNestedRelations(depth: number): Record<string, unknown> {
    if (depth === 0) return {};

    return {
      children: depth > 1 ? this.buildNestedRelations(depth - 1) : true,
    };
  }
}

// Usage
const tree = await categoryModel.getCategoryTree('electronics', 3);
// Loads electronics -> level 1 children -> level 2 children -> level 3 children
```

---

## Foreign Keys

### Setting Up Foreign Keys

Foreign keys enforce referential integrity at the database level.

**Syntax:**

```typescript
import { pgTable, uuid, text } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),

  // Foreign key to categories table
  categoryId: uuid('category_id')
    .notNull()
    .references(() => categories.id, {
      onDelete: 'restrict',  // Prevent deletion if products exist
      onUpdate: 'cascade',   // Update if category ID changes
    }),

  // Foreign key to users table
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, {
      onDelete: 'restrict',
    }),
});
```

---

### Cascade Actions

Control what happens when referenced entity is deleted or updated.

**Options:**

| Action | Description |
|--------|-------------|
| `restrict` | Prevent deletion if referenced (default) |
| `cascade` | Delete related entities too |
| `set null` | Set foreign key to null |
| `set default` | Set foreign key to default value |
| `no action` | Same as restrict |

**Examples:**

```typescript
// Example 1: Restrict deletion
categoryId: uuid('category_id')
  .notNull()
  .references(() => categories.id, { onDelete: 'restrict' }),
// Cannot delete category if products exist

// Example 2: Cascade deletion
authorId: uuid('author_id')
  .notNull()
  .references(() => users.id, { onDelete: 'cascade' }),
// Delete all reviews when user is deleted

// Example 3: Set null on deletion
updatedById: uuid('updated_by_id')
  .references(() => users.id, { onDelete: 'set null' }),
// Set updatedById to null when user is deleted (keeps audit trail)
```

**Accommodation Example (from codebase):**

```typescript
export const accommodations = pgTable('accommodations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Cannot delete owner if accommodations exist
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),

  // Cannot delete destination if accommodations exist
  destinationId: uuid('destination_id')
    .notNull()
    .references(() => destinations.id, { onDelete: 'restrict' }),

  // Set to null if user deleted (keep audit trail)
  createdById: uuid('created_by_id')
    .references(() => users.id, { onDelete: 'set null' }),

  updatedById: uuid('updated_by_id')
    .references(() => users.id, { onDelete: 'set null' }),

  deletedById: uuid('deleted_by_id')
    .references(() => users.id, { onDelete: 'set null' }),
});
```

---

### Nullable vs Required

**Required Foreign Key:**

```typescript
categoryId: uuid('category_id')
  .notNull()
  .references(() => categories.id),
// Product MUST have a category
```

**Optional Foreign Key:**

```typescript
parentId: uuid('parent_id')
  .references(() => categories.id),
// Category MAY have a parent (nullable for root categories)
```

---

## Querying Relations

### Loading Single Relations

Load a single entity with its relations.

```typescript
// Load product with category
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  { category: true }
);

console.log(product?.name);
console.log(product?.category.name);

// Load multiple relations
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  {
    category: true,
    reviews: true,
    tags: true,
  }
);
```

---

### Loading Multiple Relations

Load multiple entities with relations.

```typescript
// Load all products with category
const { items } = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true },
  { page: 1, pageSize: 20 }
);

for (const product of items) {
  console.log(`${product.name} - ${product.category.name}`);
}
```

---

### Nested Relations

Load relations of relations (multi-level).

```typescript
// Load product -> category -> parent category
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  {
    category: {
      parent: true,
    },
  }
);

console.log(product?.name);                    // "Smartphone X"
console.log(product?.category.name);           // "Smartphones"
console.log(product?.category.parent?.name);   // "Electronics"

// Load product -> reviews -> author
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  {
    reviews: {
      author: true,
    },
  }
);

for (const review of product?.reviews || []) {
  console.log(`${review.rating}/5 by ${review.author.name}`);
}

// Multiple levels
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  {
    category: {
      parent: {
        parent: true,  // 3 levels deep
      },
    },
    reviews: {
      author: {
        profile: true,
      },
    },
  }
);
```

---

### Selective Loading

Load only the relations you need to optimize performance.

```typescript
// ❌ Loading everything (slow)
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  {
    category: true,
    reviews: true,
    tags: true,
    images: true,
    variants: true,
  }
);

// ✅ Load only what's needed
const product = await productModel.findWithRelations(
  { id: 'product-uuid' },
  { category: true }  // Only category for product card
);

// ✅ Load different relations for different views
// Product card - minimal relations
const cardData = await productModel.findWithRelations(
  { id: 'product-uuid' },
  { category: true }
);

// Product detail page - more relations
const detailData = await productModel.findWithRelations(
  { id: 'product-uuid' },
  {
    category: true,
    reviews: {
      author: true,
    },
    tags: true,
  }
);
```

---

## Performance

### N+1 Problem

The N+1 problem occurs when you query for N entities, then make N additional queries to load relations.

**Problem:**

```typescript
// ❌ N+1 queries - very slow!
const { items } = await productModel.findAll({ isActive: true });
// 1 query to get products

for (const product of items) {
  const category = await categoryModel.findById(product.categoryId);
  // N queries - one per product!
  console.log(`${product.name} - ${category.name}`);
}

// Total: 1 + N queries (if 100 products = 101 queries!)
```

**Solution:**

```typescript
// ✅ Single query with JOIN
const { items } = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true }
);

for (const product of items) {
  console.log(`${product.name} - ${product.category.name}`);
}

// Total: 1 query with JOIN
```

---

### Eager vs Lazy Loading

**Eager Loading** (recommended):

Load relations upfront in a single query.

```typescript
// Eager load - relations loaded immediately
const product = await productModel.findWithRelations(
  { id: 'uuid' },
  { category: true, reviews: true }
);

// Relations available immediately, no additional queries
console.log(product?.category.name);
console.log(product?.reviews.length);
```

**Lazy Loading** (avoid):

Load relations on-demand with separate queries.

```typescript
// Lazy load - separate queries for each relation
const product = await productModel.findById('uuid');

// Additional query
const category = await categoryModel.findById(product.categoryId);

// Additional query
const reviews = await reviewModel.findAll({ productId: product.id });

// Total: 3 queries
```

> **Best Practice:** Use eager loading with `findWithRelations()` to avoid N+1 problems.

---

### Optimizing Relation Queries

**1. Load Only Needed Relations:**

```typescript
// ✅ Minimal relations
const products = await productModel.findAllWithRelations(
  { category: true },
  {},
  { page: 1, pageSize: 20 }
);

// ❌ Loading everything
const products = await productModel.findAllWithRelations(
  { category: true, reviews: true, tags: true, images: true },
  {},
  { page: 1, pageSize: 20 }
);
```

**2. Use Pagination:**

```typescript
// ✅ Paginated with relations
const products = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true },
  { page: 1, pageSize: 20 }
);

// ❌ All records with relations
const products = await productModel.findAllWithRelations(
  { category: true },
  { isActive: true }
);
// Could load thousands of records!
```

**3. Index Foreign Keys:**

```sql
-- Add indexes on foreign key columns
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_author_id ON reviews(author_id);
```

**4. Limit Nested Depth:**

```typescript
// ✅ 2 levels max
const product = await productModel.findWithRelations(
  { id: 'uuid' },
  {
    reviews: {
      author: true,
    },
  }
);

// ❌ Deep nesting (slow)
const product = await productModel.findWithRelations(
  { id: 'uuid' },
  {
    category: {
      parent: {
        parent: {
          parent: true,
        },
      },
    },
  }
);
```

---

## Best Practices

### 1. Define Relations in Both Directions

```typescript
// ✅ Bidirectional relations
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

// Now you can query from either side
const product = await productModel.findWithRelations(
  { id: 'uuid' },
  { category: true }
);

const category = await categoryModel.findWithRelations(
  { id: 'uuid' },
  { products: true }
);
```

### 2. Use Descriptive Relation Names

```typescript
// ✅ Clear relation names
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { ... }),
  owner: one(users, { ... }),
  createdBy: one(users, { ... }),
}));

// ❌ Ambiguous names
export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { ... }),
  user: one(users, { ... }),      // Which user?
  user2: one(users, { ... }),     // Not clear!
}));
```

### 3. Use relationName for Self-References

```typescript
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryHierarchy',  // Required!
  }),
  children: many(categories, {
    relationName: 'categoryHierarchy',  // Must match
  }),
}));
```

### 4. Choose Cascade Actions Carefully

```typescript
// ✅ Restrict for important relations
ownerId: uuid('owner_id')
  .notNull()
  .references(() => users.id, { onDelete: 'restrict' }),
// Cannot delete user if they own products

// ✅ Cascade for dependent data
authorId: uuid('author_id')
  .notNull()
  .references(() => users.id, { onDelete: 'cascade' }),
// Delete comments when user is deleted

// ✅ Set null for audit fields
createdById: uuid('created_by_id')
  .references(() => users.id, { onDelete: 'set null' }),
// Keep audit trail even if user deleted
```

### 5. Eager Load Relations to Avoid N+1

```typescript
// ✅ Eager load
const products = await productModel.findAllWithRelations(
  { category: true },
  {}
);

// ❌ N+1 problem
const { items } = await productModel.findAll({});
for (const product of items) {
  const category = await categoryModel.findById(product.categoryId);
}
```

### 6. Create Helper Methods for Complex Relations

```typescript
export class ProductModel extends BaseModel<Product> {
  /**
   * Load product with all common relations
   */
  async findWithDetails(id: string) {
    return this.findWithRelations(
      { id },
      {
        category: true,
        reviews: {
          author: true,
        },
        tags: true,
      }
    );
  }

  /**
   * Load minimal data for product cards
   */
  async findForCard(id: string) {
    return this.findWithRelations(
      { id },
      { category: true }
    );
  }
}
```

---

## Examples

### Product with Category and Reviews

```typescript
// Define schemas
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  categoryId: uuid('category_id').notNull(),
});

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
});

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull(),
  authorId: uuid('author_id').notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment'),
});

// Define relations
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  author: one(users, {
    fields: [reviews.authorId],
    references: [users.id],
  }),
}));

// Usage
const product = await productModel.findWithRelations(
  { slug: 'smartphone-x' },
  {
    category: true,
    reviews: {
      author: true,
    },
  }
);

console.log(product?.name);
console.log(product?.category.name);
console.log(`Reviews: ${product?.reviews.length}`);

for (const review of product?.reviews || []) {
  console.log(`${review.rating}/5 by ${review.author.name}`);
  console.log(review.comment);
}
```

### Accommodation with Destination (from codebase)

```typescript
// Real example from Hospeda codebase
const accommodation = await accommodationModel.findWithRelations(
  { id: 'acc-uuid' },
  {
    destination: true,
    reviews: true,
    amenities: true,
    features: true,
  }
);

console.log(accommodation?.name);
console.log(accommodation?.destination.name);
console.log(`Reviews: ${accommodation?.reviews.length}`);
console.log(`Rating: ${accommodation?.averageRating}`);
```

### Category Tree

```typescript
// Load full category tree
const electronics = await categoryModel.findWithRelations(
  { slug: 'electronics' },
  {
    parent: true,
    children: {
      children: true,  // 2 levels of children
    },
  }
);

console.log('Category:', electronics?.name);
console.log('Parent:', electronics?.parent?.name);
console.log('Subcategories:');

for (const child of electronics?.children || []) {
  console.log(`- ${child.name}`);

  for (const grandchild of child.children || []) {
    console.log(`  - ${grandchild.name}`);
  }
}
```

---

## See Also

- [BaseModel API Reference](./BaseModel.md) - Complete BaseModel documentation
- [Query Methods Guide](./query-methods.md) - Advanced querying
- [Quick Start Guide](../quick-start.md) - Getting started

---

*Last updated: 2025-11-05*
