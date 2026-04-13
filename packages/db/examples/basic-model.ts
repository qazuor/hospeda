/**
 * Basic Model Example
 *
 * This file demonstrates the fundamentals of creating a model that extends BaseModel.
 * It shows basic CRUD operations, custom query methods, and simple business logic.
 *
 * Key Concepts:
 * - Extending BaseModel<T>
 * - Defining table and entityName
 * - Custom query methods
 * - Business logic methods
 * - Error handling
 * - Type safety
 *
 * @example
 * ```ts
 * import { ProductModel } from './basic-model';
 *
 * const productModel = new ProductModel();
 * const product = await productModel.findBySlug('wireless-mouse');
 * const inStock = await productModel.isInStock(product.id);
 * ```
 */

import { and, eq, gte, ilike, isNull, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
    boolean,
    integer,
    numeric,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { BaseModelImpl as BaseModel } from '../src/base/base.model';
import type * as schema from '../src/schemas/index.js';
import { buildWhereClause } from '../src/utils/drizzle-helpers';
import { DbError } from '../src/utils/error';
import { logError, logQuery } from '../src/utils/logger';

// ============================================================================
// 1. SCHEMA DEFINITION
// ============================================================================

/**
 * Product table schema
 *
 * Defines the structure of the products table with all necessary fields
 * including audit fields (createdAt, updatedAt, deletedAt) for soft delete support.
 */
export const productTable = pgTable('products', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    stock: integer('stock').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at')
});

// ============================================================================
// 2. TYPE DEFINITION
// ============================================================================

/**
 * Product type inferred from the schema
 *
 * Automatically maintains type safety between schema and application code.
 */
export type Product = typeof productTable.$inferSelect;

/**
 * Product creation input type
 *
 * Omits auto-generated fields (id, timestamps)
 */
export type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/**
 * Product update input type
 *
 * All fields optional except timestamps
 */
export type UpdateProductInput = Partial<
    Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
>;

// ============================================================================
// 3. MODEL CLASS
// ============================================================================

/**
 * Product Model
 *
 * Extends BaseModel to provide CRUD operations and adds custom methods
 * for product-specific queries and business logic.
 *
 * @extends BaseModel<Product>
 *
 * @example
 * ```ts
 * const productModel = new ProductModel();
 *
 * // Create product
 * const product = await productModel.create({
 *   name: 'Wireless Mouse',
 *   slug: 'wireless-mouse',
 *   price: '29.99',
 *   stock: 100,
 * });
 *
 * // Find by slug
 * const found = await productModel.findBySlug('wireless-mouse');
 *
 * // Check stock
 * const inStock = await productModel.isInStock(product.id);
 * ```
 */
export class ProductModel extends BaseModel<Product> {
    /**
     * The Drizzle table schema
     */
    protected table = productTable;

    /**
     * Entity name for logging and error context
     */
    protected entityName = 'product';

    /**
     * Returns the table name for dynamic queries
     */
    protected getTableName(): string {
        return 'products';
    }

    // ==========================================================================
    // CUSTOM QUERY METHODS
    // ==========================================================================

    /**
     * Find a product by its unique slug
     *
     * Slugs are URL-friendly identifiers (e.g., "wireless-mouse")
     *
     * @param input - Query input
     * @param input.slug - The product slug
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to the product or null if not found
     *
     * @example
     * ```ts
     * const product = await productModel.findBySlug({
     *   slug: 'wireless-mouse'
     * });
     *
     * if (product) {
     *   console.log(product.name); // "Wireless Mouse"
     * }
     * ```
     */
    async findBySlug(input: {
        slug: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Product | null> {
        const { slug, tx } = input;
        const db = this.getClient(tx);

        try {
            const whereClause = and(eq(productTable.slug, slug), isNull(productTable.deletedAt));

            const result = await db.select().from(productTable).where(whereClause).limit(1);

            logQuery(this.entityName, 'findBySlug', { slug }, result);
            return (result[0] as Product) ?? null;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findBySlug', { slug }, err);
            throw new DbError(this.entityName, 'findBySlug', { slug }, err.message);
        }
    }

    /**
     * Find all active products
     *
     * Returns only products that are active and not soft-deleted
     *
     * @param input - Query input
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to array of active products
     *
     * @example
     * ```ts
     * const activeProducts = await productModel.findActive({});
     * console.log(activeProducts.length); // e.g., 42
     * ```
     */
    async findActive(input: {
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Product[]> {
        const { tx } = input;
        const db = this.getClient(tx);

        try {
            const whereClause = and(
                eq(productTable.isActive, true),
                isNull(productTable.deletedAt)
            );

            const result = await db
                .select()
                .from(productTable)
                .where(whereClause)
                .orderBy(productTable.name);

            logQuery(this.entityName, 'findActive', {}, result);
            return result as Product[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findActive', {}, err);
            throw new DbError(this.entityName, 'findActive', {}, err.message);
        }
    }

    /**
     * Find products within a price range
     *
     * @param input - Query input
     * @param input.minPrice - Minimum price (inclusive)
     * @param input.maxPrice - Maximum price (inclusive)
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to array of products
     *
     * @example
     * ```ts
     * // Find products between $20 and $50
     * const products = await productModel.findByPriceRange({
     *   minPrice: 20,
     *   maxPrice: 50
     * });
     * ```
     */
    async findByPriceRange(input: {
        minPrice: number;
        maxPrice: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Product[]> {
        const { minPrice, maxPrice, tx } = input;
        const db = this.getClient(tx);

        try {
            // Convert numbers to strings for numeric comparison
            const minPriceStr = minPrice.toString();
            const maxPriceStr = maxPrice.toString();

            const whereClause = and(
                gte(productTable.price, minPriceStr),
                lte(productTable.price, maxPriceStr),
                isNull(productTable.deletedAt)
            );

            const result = await db
                .select()
                .from(productTable)
                .where(whereClause)
                .orderBy(productTable.price);

            logQuery(this.entityName, 'findByPriceRange', { minPrice, maxPrice }, result);
            return result as Product[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'findByPriceRange', { minPrice, maxPrice }, err);
            throw new DbError(
                this.entityName,
                'findByPriceRange',
                { minPrice, maxPrice },
                err.message
            );
        }
    }

    /**
     * Search products by name (case-insensitive partial match)
     *
     * Uses ILIKE for PostgreSQL case-insensitive pattern matching
     *
     * @param input - Query input
     * @param input.query - Search query string
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to array of matching products
     *
     * @example
     * ```ts
     * // Find all products with "mouse" in the name
     * const results = await productModel.searchByName({
     *   query: 'mouse'
     * });
     * // Returns: ["Wireless Mouse", "Gaming Mouse", "Mouse Pad"]
     * ```
     */
    async searchByName(input: {
        query: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Product[]> {
        const { query, tx } = input;
        const db = this.getClient(tx);

        try {
            const whereClause = and(
                ilike(productTable.name, `%${query}%`),
                isNull(productTable.deletedAt)
            );

            const result = await db
                .select()
                .from(productTable)
                .where(whereClause)
                .orderBy(productTable.name);

            logQuery(this.entityName, 'searchByName', { query }, result);
            return result as Product[];
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'searchByName', { query }, err);
            throw new DbError(this.entityName, 'searchByName', { query }, err.message);
        }
    }

    // ==========================================================================
    // BUSINESS LOGIC METHODS
    // ==========================================================================

    /**
     * Check if a product is in stock
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to true if product has stock
     *
     * @example
     * ```ts
     * const inStock = await productModel.isInStock({
     *   productId: 'product-uuid'
     * });
     *
     * if (inStock) {
     *   console.log('Product available for purchase');
     * }
     * ```
     */
    async isInStock(input: {
        productId: string;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<boolean> {
        const { productId, tx } = input;

        try {
            const product = await this.findById(productId, tx);
            const inStock = product !== null && product.stock > 0 && product.isActive;

            logQuery(this.entityName, 'isInStock', { productId }, { inStock });
            return inStock;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'isInStock', { productId }, err);
            throw new DbError(this.entityName, 'isInStock', { productId }, err.message);
        }
    }

    /**
     * Decrement product stock
     *
     * Reduces the stock quantity by the specified amount.
     * Throws error if insufficient stock.
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.quantity - Quantity to decrement
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to the updated product
     * @throws {DbError} If insufficient stock or product not found
     *
     * @example
     * ```ts
     * // Reduce stock by 5 units
     * const updated = await productModel.decrementStock({
     *   productId: 'product-uuid',
     *   quantity: 5
     * });
     *
     * console.log(updated.stock); // Previous stock - 5
     * ```
     */
    async decrementStock(input: {
        productId: string;
        quantity: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Product> {
        const { productId, quantity, tx } = input;
        const db = this.getClient(tx);

        try {
            // Check current stock
            const product = await this.findById(productId, tx);
            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            if (product.stock < quantity) {
                throw new Error(
                    `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
                );
            }

            // Decrement stock using SQL to avoid race conditions
            const whereClause = buildWhereClause({ id: productId }, this.table as unknown);

            const result = await db
                .update(productTable)
                .set({
                    stock: sql`${productTable.stock} - ${quantity}`,
                    updatedAt: new Date()
                })
                .where(whereClause)
                .returning();

            logQuery(this.entityName, 'decrementStock', { productId, quantity }, result);

            if (!result[0]) {
                throw new Error('Stock decrement failed');
            }

            return result[0] as Product;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'decrementStock', { productId, quantity }, err);
            throw new DbError(
                this.entityName,
                'decrementStock',
                { productId, quantity },
                err.message
            );
        }
    }

    /**
     * Increment product stock
     *
     * Increases the stock quantity by the specified amount.
     *
     * @param input - Query input
     * @param input.productId - The product ID
     * @param input.quantity - Quantity to increment
     * @param input.tx - Optional transaction client
     * @returns Promise resolving to the updated product
     * @throws {DbError} If product not found
     *
     * @example
     * ```ts
     * // Add 10 units to stock
     * const updated = await productModel.incrementStock({
     *   productId: 'product-uuid',
     *   quantity: 10
     * });
     *
     * console.log(updated.stock); // Previous stock + 10
     * ```
     */
    async incrementStock(input: {
        productId: string;
        quantity: number;
        tx?: NodePgDatabase<typeof schema>;
    }): Promise<Product> {
        const { productId, quantity, tx } = input;
        const db = this.getClient(tx);

        try {
            // Verify product exists
            const product = await this.findById(productId, tx);
            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            // Increment stock using SQL to avoid race conditions
            const whereClause = buildWhereClause({ id: productId }, this.table as unknown);

            const result = await db
                .update(productTable)
                .set({
                    stock: sql`${productTable.stock} + ${quantity}`,
                    updatedAt: new Date()
                })
                .where(whereClause)
                .returning();

            logQuery(this.entityName, 'incrementStock', { productId, quantity }, result);

            if (!result[0]) {
                throw new Error('Stock increment failed');
            }

            return result[0] as Product;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logError(this.entityName, 'incrementStock', { productId, quantity }, err);
            throw new DbError(
                this.entityName,
                'incrementStock',
                { productId, quantity },
                err.message
            );
        }
    }
}

// ============================================================================
// 4. SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance for convenience
 *
 * Use this for simple operations. Create new instances if you need
 * different configurations or multiple concurrent operations.
 */
export const productModel = new ProductModel();

// ============================================================================
// 5. USAGE EXAMPLES
// ============================================================================

/**
 * USAGE EXAMPLES
 *
 * These examples demonstrate common patterns for working with the ProductModel.
 * All examples assume the database has been initialized with initializeDb().
 *
 * ============================================================================
 * EXAMPLE 1: Create a new product
 * ============================================================================
 *
 * ```ts
 * import { productModel } from './basic-model';
 *
 * const newProduct = await productModel.create({
 *   name: 'Wireless Gaming Mouse',
 *   slug: 'wireless-gaming-mouse',
 *   description: 'High-precision wireless mouse with RGB lighting',
 *   price: '49.99',
 *   stock: 50,
 *   isActive: true,
 * });
 *
 * console.log(newProduct.id); // Auto-generated UUID
 * console.log(newProduct.createdAt); // Auto-generated timestamp
 * ```
 *
 * ============================================================================
 * EXAMPLE 2: Find products by various criteria
 * ============================================================================
 *
 * ```ts
 * // Find by ID
 * const product = await productModel.findById('product-uuid');
 *
 * // Find by slug
 * const bySlug = await productModel.findBySlug({ slug: 'wireless-gaming-mouse' });
 *
 * // Find all active products
 * const activeProducts = await productModel.findActive({});
 *
 * // Find by price range
 * const affordable = await productModel.findByPriceRange({
 *   minPrice: 10,
 *   maxPrice: 50
 * });
 *
 * // Search by name
 * const mouseProducts = await productModel.searchByName({ query: 'mouse' });
 * ```
 *
 * ============================================================================
 * EXAMPLE 3: Update a product
 * ============================================================================
 *
 * ```ts
 * const updated = await productModel.update(
 *   { id: 'product-uuid' },
 *   {
 *     price: '39.99',
 *     stock: 75,
 *   }
 * );
 *
 * console.log(updated?.price); // '39.99'
 * console.log(updated?.updatedAt); // Auto-updated timestamp
 * ```
 *
 * ============================================================================
 * EXAMPLE 4: Stock management
 * ============================================================================
 *
 * ```ts
 * // Check if product is in stock
 * const inStock = await productModel.isInStock({ productId: 'product-uuid' });
 *
 * if (inStock) {
 *   // Decrement stock (e.g., after purchase)
 *   await productModel.decrementStock({
 *     productId: 'product-uuid',
 *     quantity: 1
 *   });
 * }
 *
 * // Increment stock (e.g., after restocking)
 * await productModel.incrementStock({
 *   productId: 'product-uuid',
 *   quantity: 25
 * });
 * ```
 *
 * ============================================================================
 * EXAMPLE 5: Soft delete and restore
 * ============================================================================
 *
 * ```ts
 * // Soft delete (sets deletedAt)
 * await productModel.softDelete({ id: 'product-uuid' });
 *
 * // Product is now excluded from queries
 * const notFound = await productModel.findById('product-uuid'); // null
 *
 * // Restore the product
 * await productModel.restore({ id: 'product-uuid' });
 *
 * // Product is now available again
 * const restored = await productModel.findById('product-uuid'); // Product
 * ```
 *
 * ============================================================================
 * EXAMPLE 6: Pagination
 * ============================================================================
 *
 * ```ts
 * // Using inherited findAll method with pagination
 * const page1 = await productModel.findAll(
 *   { isActive: true },
 *   { page: 1, pageSize: 10 }
 * );
 *
 * console.log(page1.items.length); // 10 (or less)
 * console.log(page1.total); // Total count of active products
 * ```
 *
 * ============================================================================
 * EXAMPLE 7: Transaction support
 * ============================================================================
 *
 * ```ts
 * import { getDb } from '@repo/db';
 *
 * const db = getDb();
 *
 * await db.transaction(async (trx) => {
 *   // All operations within transaction
 *   const product = await productModel.create(
 *     {
 *       name: 'New Product',
 *       slug: 'new-product',
 *       price: '29.99',
 *       stock: 10,
 *     },
 *     trx
 *   );
 *
 *   await productModel.decrementStock(
 *     { productId: product.id, quantity: 1 },
 *     trx
 *   );
 *
 *   // If any operation fails, entire transaction rolls back
 * });
 * ```
 */
