/**
 * Relations Example
 *
 * This file demonstrates working with related entities using Drizzle ORM relations.
 * It shows one-to-many, many-to-one, and many-to-many relationships.
 *
 * Key Concepts:
 * - Defining foreign keys
 * - Setting up relations
 * - Loading related data
 * - Many-to-many with junction tables
 * - Nested relation queries
 * - Type-safe relation access
 *
 * @example
 * ```ts
 * import { ProductModel } from './with-relations';
 *
 * const productModel = new ProductModel();
 *
 * // Load product with its category
 * const product = await productModel.findWithCategory({
 *   productId: 'product-uuid'
 * });
 *
 * console.log(product.category.name); // "Electronics"
 * ```
 */

import { relations } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
    boolean,
    integer,
    numeric,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { BaseModel } from '../src/base/base.model';
import type * as schema from '../src/schemas/index.js';
import { DbError } from '../src/utils/error';
import { logError, logQuery } from '../src/utils/logger';

// ============================================================================
// 1. TABLE SCHEMAS WITH RELATIONS
// ============================================================================

/**
 * Category table schema
 *
 * Categories organize products into groups (e.g., Electronics, Clothing)
 */
export const categoryTable = pgTable('categories', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

/**
 * Product table schema with category foreign key
 *
 * Each product belongs to one category (many-to-one relationship)
 */
export const productTable = pgTable('products_with_relations', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    stock: integer('stock').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    // Foreign key to category
    categoryId: uuid('category_id')
        .notNull()
        .references(() => categoryTable.id, { onDelete: 'restrict' }),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

/**
 * Review table schema
 *
 * Customers can write reviews for products (one-to-many relationship)
 */
export const reviewTable = pgTable('reviews', {
    id: uuid('id').defaultRandom().primaryKey(),
    // Foreign key to product
    productId: uuid('product_id')
        .notNull()
        .references(() => productTable.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(), // 1-5
    title: varchar('title', { length: 255 }),
    comment: text('comment'),
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

/**
 * Tag table schema
 *
 * Tags are labels that can be applied to multiple products
 * (many-to-many relationship via junction table)
 */
export const tagTable = pgTable('tags', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

/**
 * Product-Tag junction table
 *
 * Implements many-to-many relationship between products and tags
 */
export const productTagTable = pgTable(
    'product_tags',
    {
        productId: uuid('product_id')
            .notNull()
            .references(() => productTable.id, { onDelete: 'cascade' }),
        tagId: uuid('tag_id')
            .notNull()
            .references(() => tagTable.id, { onDelete: 'cascade' }),
        // When this relationship was created
        createdAt: timestamp('created_at').defaultNow().notNull()
    },
    (table) => ({
        // Composite primary key
        pk: primaryKey({ columns: [table.productId, table.tagId] })
    })
);

// ============================================================================
// 2. RELATION DEFINITIONS
// ============================================================================

/**
 * Category relations
 *
 * A category has many products
 */
export const categoryRelations = relations(categoryTable, ({ many }) => ({
    products: many(productTable)
}));

/**
 * Product relations
 *
 * A product:
 * - Belongs to one category (many-to-one)
 * - Has many reviews (one-to-many)
 * - Has many tags through junction table (many-to-many)
 */
export const productRelations = relations(productTable, ({ one, many }) => ({
    // Many-to-one: product → category
    category: one(categoryTable, {
        fields: [productTable.categoryId],
        references: [categoryTable.id]
    }),
    // One-to-many: product → reviews
    reviews: many(reviewTable),
    // Many-to-many: product → tags (through junction)
    productTags: many(productTagTable)
}));

/**
 * Review relations
 *
 * A review belongs to one product
 */
export const reviewRelations = relations(reviewTable, ({ one }) => ({
    product: one(productTable, {
        fields: [reviewTable.productId],
        references: [productTable.id]
    })
}));

/**
 * Tag relations
 *
 * A tag can be applied to many products through junction table
 */
export const tagRelations = relations(tagTable, ({ many }) => ({
    productTags: many(productTagTable)
}));

/**
 * Product-Tag junction relations
 *
 * Links products and tags bidirectionally
 */
export const productTagRelations = relations(productTagTable, ({ one }) => ({
    product: one(productTable, {
        fields: [productTagTable.productId],
        references: [productTable.id]
    }),
    tag: one(tagTable, {
        fields: [productTagTable.tagId],
        references: [tagTable.id]
    })
}));

// ============================================================================
// 3. TYPE DEFINITIONS
// ============================================================================

export type Category = typeof categoryTable.$inferSelect;
export type Product = typeof productTable.$inferSelect;
export type Review = typeof reviewTable.$inferSelect;
export type Tag = typeof tagTable.$inferSelect;
export type ProductTag = typeof productTagTable.$inferSelect;

/**
 * Product with relations
 */
export type ProductWithCategory = Product & {
    category: Category;
};

export type ProductWithReviews = Product & {
    reviews: Review[];
};

export type ProductWithTags = Product & {
    productTags: Array<ProductTag & { tag: Tag }>;
};

export type ProductWithAll = Product & {
    category: Category;
    reviews: Review[];
    productTags: Array<ProductTag & { tag: Tag }>;
};

// ============================================================================
// 4. MODEL CLASSES WITH RELATION METHODS
// ============================================================================

/**
 * Product Model with relation loading
 *
 * Extends BaseModel and adds methods to load related entities
 */
export class ProductModel extends BaseModel<Product> {
    protected table = productTable;
    protected entityName = 'product';

    protected getTableName(): string {
        return 'products_with_relations';
    }

    /**
     * Find a product with its category
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to product with category or null
     *
     * @example
     * ```ts
     * const product = await productModel.findWithCategory({
     *   productId: 'product-uuid'
     * });
     *
     * console.log(product.name); // "Wireless Mouse"
     * console.log(product.category.name); // "Electronics"
     * ```
     */
    async findWithCategory(input: {
        productId: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<ProductWithCategory | null> {
        const { productId, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db.query.products_with_relations.findFirst({
                where: (fields, { eq, isNull, and }) =>
                    and(eq(fields.id, productId), isNull(fields.deletedAt)),
                with: {
                    category: true
                }
            });

            logQuery(this.entityName, 'findWithCategory', { productId }, result);
            return (result as ProductWithCategory) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithCategory', { productId }, err);
            throw new DbError(this.entityName, 'findWithCategory', { productId }, err.message);
        }
    }

    /**
     * Find a product with all its reviews
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to product with reviews or null
     *
     * @example
     * ```ts
     * const product = await productModel.findWithReviews({
     *   productId: 'product-uuid'
     * });
     *
     * console.log(product.reviews.length); // 15
     * product.reviews.forEach(review => {
     *   console.log(`${review.rating}/5 - ${review.title}`);
     * });
     * ```
     */
    async findWithReviews(input: {
        productId: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<ProductWithReviews | null> {
        const { productId, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db.query.products_with_relations.findFirst({
                where: (fields, { eq, isNull, and }) =>
                    and(eq(fields.id, productId), isNull(fields.deletedAt)),
                with: {
                    reviews: {
                        where: (fields, { isNull }) => isNull(fields.deletedAt),
                        orderBy: (fields, { desc }) => [desc(fields.createdAt)]
                    }
                }
            });

            logQuery(this.entityName, 'findWithReviews', { productId }, result);
            return (result as ProductWithReviews) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithReviews', { productId }, err);
            throw new DbError(this.entityName, 'findWithReviews', { productId }, err.message);
        }
    }

    /**
     * Find a product with its tags (many-to-many)
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to product with tags or null
     *
     * @example
     * ```ts
     * const product = await productModel.findWithTags({
     *   productId: 'product-uuid'
     * });
     *
     * product.productTags.forEach(pt => {
     *   console.log(pt.tag.name); // "wireless", "ergonomic", "gaming"
     * });
     * ```
     */
    async findWithTags(input: {
        productId: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<ProductWithTags | null> {
        const { productId, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db.query.products_with_relations.findFirst({
                where: (fields, { eq, isNull, and }) =>
                    and(eq(fields.id, productId), isNull(fields.deletedAt)),
                with: {
                    productTags: {
                        with: {
                            tag: true
                        }
                    }
                }
            });

            logQuery(this.entityName, 'findWithTags', { productId }, result);
            return (result as ProductWithTags) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithTags', { productId }, err);
            throw new DbError(this.entityName, 'findWithTags', { productId }, err.message);
        }
    }

    /**
     * Find a product with all relations loaded
     *
     * Loads category, reviews, and tags in a single query
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to product with all relations or null
     *
     * @example
     * ```ts
     * const product = await productModel.findWithAll({
     *   productId: 'product-uuid'
     * });
     *
     * console.log(product.category.name); // "Electronics"
     * console.log(product.reviews.length); // 15
     * console.log(product.productTags.length); // 3
     * ```
     */
    async findWithAll(input: {
        productId: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<ProductWithAll | null> {
        const { productId, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db.query.products_with_relations.findFirst({
                where: (fields, { eq, isNull, and }) =>
                    and(eq(fields.id, productId), isNull(fields.deletedAt)),
                with: {
                    category: true,
                    reviews: {
                        where: (fields, { isNull }) => isNull(fields.deletedAt),
                        orderBy: (fields, { desc }) => [desc(fields.createdAt)]
                    },
                    productTags: {
                        with: {
                            tag: true
                        }
                    }
                }
            });

            logQuery(this.entityName, 'findWithAll', { productId }, result);
            return (result as ProductWithAll) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithAll', { productId }, err);
            throw new DbError(this.entityName, 'findWithAll', { productId }, err.message);
        }
    }

    /**
     * Add tags to a product (many-to-many relationship)
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.tagIds - Array of tag IDs to add
     * @param input.tx - Optional transaction client
     * @returns Promise resolving when tags are added
     *
     * @example
     * ```ts
     * await productModel.addTags({
     *   productId: 'product-uuid',
     *   tagIds: ['tag-1', 'tag-2', 'tag-3']
     * });
     * ```
     */
    async addTags(input: {
        productId: string;
        tagIds: string[];
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<void> {
        const { productId, tagIds, tx } = input;
        const db = this.getClient(tx);

        try {
            // Create junction table entries
            const values = tagIds.map((tagId) => ({
                productId,
                tagId
            }));

            await db.insert(productTagTable).values(values).onConflictDoNothing();

            logQuery(this.entityName, 'addTags', { productId, tagIds }, values);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'addTags', { productId, tagIds }, err);
            throw new DbError(this.entityName, 'addTags', { productId, tagIds }, err.message);
        }
    }

    /**
     * Remove tags from a product
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.tagIds - Array of tag IDs to remove
     * @param input.tx - Optional transaction client
     * @returns Promise resolving when tags are removed
     *
     * @example
     * ```ts
     * await productModel.removeTags({
     *   productId: 'product-uuid',
     *   tagIds: ['tag-1']
     * });
     * ```
     */
    async removeTags(input: {
        productId: string;
        tagIds: string[];
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<void> {
        const { productId, tagIds, tx } = input;
        const db = this.getClient(tx);

        try {
            await db.delete(productTagTable).where(
                and(
                    eq(productTagTable.productId, productId),
                    eq(productTagTable.tagId, tagIds[0]) // Simplified for example
                )
            );

            logQuery(this.entityName, 'removeTags', { productId, tagIds }, null);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'removeTags', { productId, tagIds }, err);
            throw new DbError(this.entityName, 'removeTags', { productId, tagIds }, err.message);
        }
    }
}

/**
 * Category Model with relation loading
 */
export class CategoryModel extends BaseModel<Category> {
    protected table = categoryTable;
    protected entityName = 'category';

    protected getTableName(): string {
        return 'categories';
    }

    /**
     * Find a category with all its products
     *
     * @param input - Query input
     * @param input.categoryId - The category ID
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to category with products or null
     *
     * @example
     * ```ts
     * const category = await categoryModel.findWithProducts({
     *   categoryId: 'category-uuid'
     * });
     *
     * console.log(category.name); // "Electronics"
     * console.log(category.products.length); // 42
     * ```
     */
    async findWithProducts(input: {
        categoryId: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<(Category & { products: Product[] }) | null> {
        const { categoryId, tx } = input;
        const db = this.getClient(tx);

        try {
            const result = await db.query.categories.findFirst({
                where: (fields, { eq, isNull, and }) =>
                    and(eq(fields.id, categoryId), isNull(fields.deletedAt)),
                with: {
                    products: {
                        where: (fields, { isNull }) => isNull(fields.deletedAt),
                        orderBy: (fields, { asc }) => [asc(fields.name)]
                    }
                }
            });

            logQuery(this.entityName, 'findWithProducts', { categoryId }, result);
            return (result as Category & { products: Product[] }) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findWithProducts', { categoryId }, err);
            throw new DbError(this.entityName, 'findWithProducts', { categoryId }, err.message);
        }
    }
}

// ============================================================================
// 5. SINGLETON INSTANCES
// ============================================================================

export const productModel = new ProductModel();
export const categoryModel = new CategoryModel();

// ============================================================================
// 6. USAGE EXAMPLES
// ============================================================================

/**
 * USAGE EXAMPLES
 *
 * ============================================================================
 * EXAMPLE 1: Loading single relation (many-to-one)
 * ============================================================================
 *
 * ```ts
 * const product = await productModel.findWithCategory({
 *   productId: 'product-uuid'
 * });
 *
 * if (product) {
 *   console.log(`Product: ${product.name}`);
 *   console.log(`Category: ${product.category.name}`);
 *   console.log(`Price: $${product.price}`);
 * }
 * ```
 *
 * ============================================================================
 * EXAMPLE 2: Loading one-to-many relation
 * ============================================================================
 *
 * ```ts
 * const product = await productModel.findWithReviews({
 *   productId: 'product-uuid'
 * });
 *
 * if (product) {
 *   const avgRating = product.reviews.reduce((sum, r) => sum + r.rating, 0) /
 *     product.reviews.length;
 *
 *   console.log(`Average rating: ${avgRating.toFixed(1)}/5`);
 *   console.log(`Total reviews: ${product.reviews.length}`);
 *
 *   product.reviews.slice(0, 3).forEach(review => {
 *     console.log(`- ${review.title}: ${review.rating}/5`);
 *   });
 * }
 * ```
 *
 * ============================================================================
 * EXAMPLE 3: Loading many-to-many relation
 * ============================================================================
 *
 * ```ts
 * const product = await productModel.findWithTags({
 *   productId: 'product-uuid'
 * });
 *
 * if (product) {
 *   const tagNames = product.productTags.map(pt => pt.tag.name);
 *   console.log(`Tags: ${tagNames.join(', ')}`);
 * }
 * ```
 *
 * ============================================================================
 * EXAMPLE 4: Loading all relations at once
 * ============================================================================
 *
 * ```ts
 * const product = await productModel.findWithAll({
 *   productId: 'product-uuid'
 * });
 *
 * if (product) {
 *   console.log('Product Details:');
 *   console.log(`- Name: ${product.name}`);
 *   console.log(`- Category: ${product.category.name}`);
 *   console.log(`- Reviews: ${product.reviews.length}`);
 *   console.log(`- Tags: ${product.productTags.length}`);
 * }
 * ```
 *
 * ============================================================================
 * EXAMPLE 5: Managing many-to-many relationships
 * ============================================================================
 *
 * ```ts
 * const productId = 'product-uuid';
 * const tagIds = ['tag-1', 'tag-2', 'tag-3'];
 *
 * // Add tags to product
 * await productModel.addTags({ productId, tagIds });
 *
 * // Verify tags were added
 * const withTags = await productModel.findWithTags({ productId });
 * console.log(`Product now has ${withTags?.productTags.length} tags`);
 *
 * // Remove a tag
 * await productModel.removeTags({
 *   productId,
 *   tagIds: ['tag-1']
 * });
 * ```
 *
 * ============================================================================
 * EXAMPLE 6: Reverse relationship (category → products)
 * ============================================================================
 *
 * ```ts
 * const category = await categoryModel.findWithProducts({
 *   categoryId: 'category-uuid'
 * });
 *
 * if (category) {
 *   console.log(`Category: ${category.name}`);
 *   console.log(`Total products: ${category.products.length}`);
 *
 *   category.products.forEach(product => {
 *     console.log(`- ${product.name}: $${product.price}`);
 *   });
 * }
 * ```
 */
