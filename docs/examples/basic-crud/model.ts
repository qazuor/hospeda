import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { BaseModel } from '@repo/db/base';
import { getDb } from '@repo/db/client';
import type { Category } from './schema';
import { DbError } from '@repo/db/utils/error';
import { logError, logQuery } from '@repo/db/utils/logger';
import { LifecycleStatusPgEnum } from '@repo/db/schemas/enums.dbschema';

/**
 * Drizzle Table Schema Definition
 *
 * This defines the database table structure using Drizzle ORM.
 * Notice how it mirrors the Zod schema but with Drizzle-specific syntax.
 */
export const categories = pgTable(
  'categories',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Business fields
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    icon: text('icon'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    // Lifecycle
    lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id'),
    updatedById: uuid('updated_by_id'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id')
  },
  (table) => ({
    // Indexes for common queries
    slug_idx: index('categories_slug_idx').on(table.slug),
    active_idx: index('categories_active_idx').on(table.isActive),
    lifecycle_idx: index('categories_lifecycle_idx').on(table.lifecycleState),
    sort_idx: index('categories_sort_idx').on(table.sortOrder)
  })
);

/**
 * Define relations (if needed)
 *
 * Example: If categories have items, you would define that here:
 *
 * export const categoriesRelations = relations(categories, ({ many }) => ({
 *   items: many(items)
 * }));
 */

/**
 * Category Model Class
 *
 * Extends BaseModel to inherit standard CRUD operations.
 * Add custom methods specific to Category entity here.
 */
export class CategoryModel extends BaseModel<Category> {
  /**
   * The Drizzle table schema
   */
  protected table = categories;

  /**
   * The entity name for logging and error handling
   */
  protected entityName = 'category';

  /**
   * Required for findAllWithRelations implementation
   */
  protected getTableName(): string {
    return 'categories';
  }

  /**
   * Find a category by its slug
   *
   * @param slug - The category slug
   * @returns Promise resolving to the category or null
   *
   * @example
   * ```typescript
   * const categoryModel = new CategoryModel();
   * const category = await categoryModel.findBySlug('outdoor-activities');
   * if (category) {
   *   console.log(category.name); // 'Outdoor Activities'
   * }
   * ```
   */
  async findBySlug(slug: string): Promise<Category | null> {
    try {
      const result = await this.findOne({ slug });
      logQuery(this.entityName, 'findBySlug', { slug }, result);
      return result;
    } catch (error) {
      logError(this.entityName, 'findBySlug', { slug }, error as Error);
      throw new DbError(this.entityName, 'findBySlug', { slug }, (error as Error).message);
    }
  }

  /**
   * Find categories by name (partial match)
   *
   * @param name - The name to search for
   * @returns Promise resolving to array of matching categories
   *
   * @example
   * ```typescript
   * const categories = await categoryModel.findByName('outdoor');
   * // Returns all categories with 'outdoor' in the name
   * ```
   */
  async findByName(name: string): Promise<Category[]> {
    const db = getDb();
    try {
      // Use Drizzle's query builder for more complex queries
      const result = await db
        .select()
        .from(this.table)
        .where((fields, { ilike }) => ilike(fields.name, `%${name}%`));

      logQuery(this.entityName, 'findByName', { name }, result);
      return result as Category[];
    } catch (error) {
      logError(this.entityName, 'findByName', { name }, error as Error);
      throw new DbError(this.entityName, 'findByName', { name }, (error as Error).message);
    }
  }

  /**
   * Find all active categories ordered by sort order
   *
   * @returns Promise resolving to array of active categories
   *
   * @example
   * ```typescript
   * const activeCategories = await categoryModel.findAllActive();
   * // Returns categories with isActive=true, sorted by sortOrder
   * ```
   */
  async findAllActive(): Promise<Category[]> {
    const db = getDb();
    try {
      const result = await db
        .select()
        .from(this.table)
        .where((fields, { eq }) => eq(fields.isActive, true))
        .orderBy((fields, { asc }) => asc(fields.sortOrder));

      logQuery(this.entityName, 'findAllActive', {}, result);
      return result as Category[];
    } catch (error) {
      logError(this.entityName, 'findAllActive', {}, error as Error);
      throw new DbError(this.entityName, 'findAllActive', {}, (error as Error).message);
    }
  }

  /**
   * Update category sort order
   *
   * @param id - Category ID
   * @param sortOrder - New sort order
   * @returns Promise resolving to updated category
   *
   * @example
   * ```typescript
   * await categoryModel.updateSortOrder('category-id', 5);
   * ```
   */
  async updateSortOrder(id: string, sortOrder: number): Promise<Category | null> {
    try {
      const result = await this.update({ id }, { sortOrder });
      logQuery(this.entityName, 'updateSortOrder', { id, sortOrder }, result);
      return result;
    } catch (error) {
      logError(this.entityName, 'updateSortOrder', { id, sortOrder }, error as Error);
      throw new DbError(
        this.entityName,
        'updateSortOrder',
        { id, sortOrder },
        (error as Error).message
      );
    }
  }

  /**
   * Count active categories
   *
   * @returns Promise resolving to count of active categories
   *
   * @example
   * ```typescript
   * const count = await categoryModel.countActive();
   * console.log(`There are ${count} active categories`);
   * ```
   */
  async countActive(): Promise<number> {
    try {
      const count = await this.count({ isActive: true });
      logQuery(this.entityName, 'countActive', {}, count);
      return count;
    } catch (error) {
      logError(this.entityName, 'countActive', {}, error as Error);
      throw new DbError(this.entityName, 'countActive', {}, (error as Error).message);
    }
  }
}

/**
 * Export singleton instance for convenience
 * This allows importing and using the model without creating instances
 */
export const categoryModel = new CategoryModel();
