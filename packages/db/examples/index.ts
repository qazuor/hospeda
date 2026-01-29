/**
 * @repo/db Examples Index
 *
 * This file provides a convenient index for importing example models and utilities.
 * These are for learning and reference purposes - adapt patterns to your needs.
 *
 * @example
 * ```ts
 * // Import specific example
 * import { ProductModel } from '@repo/db/examples';
 *
 * // Or import from specific file
 * import { OrderModel } from '@repo/db/examples/complex-queries';
 * ```
 */

// ============================================================================
// BASIC MODEL EXAMPLES
// ============================================================================

/**
 * Basic Model - Fundamental patterns
 *
 * - BaseModel extension
 * - Basic CRUD operations
 * - Custom query methods
 * - Simple business logic
 */
export {
    ProductModel,
    productModel,
    productTable,
    type Product,
    type CreateProductInput,
    type UpdateProductInput
} from './basic-model';

// ============================================================================
// RELATIONS EXAMPLES
// ============================================================================

/**
 * Relations - Working with related entities
 *
 * - Foreign keys and relations
 * - One-to-many, many-to-one, many-to-many
 * - Loading related data
 * - Junction tables
 */
export {
    ProductModel as ProductWithRelationsModel,
    productModel as productWithRelationsModel,
    CategoryModel,
    categoryModel,
    productTable as productRelationsTable,
    categoryTable,
    reviewTable,
    tagTable,
    productTagTable,
    type Product as ProductWithRelations,
    type Category,
    type Review,
    type Tag,
    type ProductTag,
    type ProductWithCategory,
    type ProductWithReviews,
    type ProductWithTags,
    type ProductWithAll
} from './with-relations';

// ============================================================================
// COMPLEX QUERIES EXAMPLES
// ============================================================================

/**
 * Complex Queries - Advanced querying patterns
 *
 * - Dynamic query building
 * - Aggregations and statistics
 * - Multiple pagination strategies
 * - Transaction handling
 */
export {
    OrderModel,
    orderModel,
    orderTable,
    orderLineTable,
    customerTable,
    orderStatusEnum,
    type Order,
    type OrderLine,
    type Customer,
    type OrderStatus,
    type OrderSearchFilters,
    type OrderStats,
    type PaginatedResult,
    type CursorResult
} from './complex-queries';

// ============================================================================
// ADVANCED PATTERNS EXAMPLES
// ============================================================================

/**
 * Advanced Patterns - Optimization and advanced techniques
 *
 * - Full-text search
 * - Batch operations
 * - Caching strategies
 * - Performance optimizations
 * - Lifecycle hooks
 */
export {
    PostModel,
    postModel,
    SimpleCache,
    postTable as postAdvancedTable,
    userTable,
    commentTable as commentAdvancedTable,
    type Post,
    type User,
    type Comment,
    type BatchResult
} from './advanced-patterns';

// ============================================================================
// QUICK REFERENCE GUIDE
// ============================================================================

/**
 * QUICK REFERENCE GUIDE
 *
 * Choose the example that matches your needs:
 *
 * 1. **basic-model.ts** - Start here if you're new to BaseModel
 *    - Simple CRUD operations
 *    - Custom query methods
 *    - Basic business logic
 *    - Error handling patterns
 *
 * 2. **with-relations.ts** - Learn about relationships
 *    - Foreign key setup
 *    - One-to-many, many-to-one, many-to-many
 *    - Loading related data
 *    - Junction table management
 *
 * 3. **complex-queries.ts** - Advanced querying
 *    - Dynamic filters
 *    - Aggregations (COUNT, SUM, AVG)
 *    - Pagination strategies
 *    - Multi-table transactions
 *
 * 4. **advanced-patterns.ts** - Optimization techniques
 *    - Full-text search
 *    - Batch operations
 *    - Caching layer
 *    - Performance optimizations
 *    - Lifecycle hooks
 *
 * USAGE EXAMPLES:
 *
 * ```ts
 * // Basic model usage
 * import { ProductModel } from '@repo/db/examples';
 * const productModel = new ProductModel();
 * const product = await productModel.findBySlug({ slug: 'my-product' });
 *
 * // Relations
 * import { ProductModel as ProductWithRelations } from '@repo/db/examples/with-relations';
 * const product = await productModel.findWithCategory({ productId: 'uuid' });
 *
 * // Complex queries
 * import { OrderModel } from '@repo/db/examples/complex-queries';
 * const orders = await orderModel.searchOrders({
 *   filters: { status: 'pending', minTotal: 100 }
 * });
 *
 * // Advanced patterns
 * import { PostModel } from '@repo/db/examples/advanced-patterns';
 * const posts = await postModel.fullTextSearch({
 *   query: 'typescript database'
 * });
 * ```
 *
 * BEST PRACTICES:
 *
 * 1. Always extend BaseModel<T>
 * 2. Use RO-RO pattern (Receive Object, Return Object)
 * 3. Include comprehensive error handling
 * 4. Add JSDoc comments
 * 5. Use transactions for multi-step operations
 * 6. Implement proper type safety
 * 7. Add indexes for common queries
 * 8. Test thoroughly (90%+ coverage)
 *
 * COMMON PATTERNS:
 *
 * ```ts
 * // Model structure
 * export class MyModel extends BaseModel<MyEntity> {
 *   protected table = myTable;
 *   protected entityName = 'myEntity';
 *
 *   protected getTableName(): string {
 *     return 'my_entities';
 *   }
 *
 *   // Custom methods...
 * }
 *
 * // Error handling
 * try {
 *   const result = await this.someMethod(input);
 *   logQuery(this.entityName, 'someMethod', input, result);
 *   return result;
 * } catch (error) {
 *   const err = error instanceof Error ? error : new Error(String(error));
 *   logError(this.entityName, 'someMethod', input, err);
 *   throw new DbError(this.entityName, 'someMethod', input, err.message);
 * }
 *
 * // Transactions
 * const db = getDb();
 * await db.transaction(async (trx) => {
 *   const entity1 = await model1.create(data1, trx);
 *   const entity2 = await model2.create(data2, trx);
 *   return { entity1, entity2 };
 * });
 * ```
 *
 * MIGRATION PATH:
 *
 * 1. Start with basic-model.ts
 * 2. Add relations from with-relations.ts
 * 3. Implement complex queries from complex-queries.ts
 * 4. Optimize with advanced-patterns.ts
 *
 * For more details, see:
 * - README.md in this directory
 * - ../CLAUDE.md for package documentation
 * - ../../.claude/docs/standards/ for project standards
 */
