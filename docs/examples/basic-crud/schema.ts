import { z } from 'zod';
import { CategoryIdSchema, UserIdSchema } from '../../common/id.schema';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema';

/**
 * Category Schema - Example Entity for Basic CRUD Operations
 *
 * This demonstrates the complete schema structure for a simple entity
 * following Hospeda's schema patterns.
 */

// ============================================================================
// BASE SCHEMA
// ============================================================================

/**
 * Complete category entity schema with all fields
 */
export const CategorySchema = z.object({
  // Unique identifier
  id: CategoryIdSchema,

  // Audit fields (automatically managed)
  createdAt: z.coerce.date({
    message: 'zodError.common.createdAt.required'
  }),
  updatedAt: z.coerce.date({
    message: 'zodError.common.updatedAt.required'
  }),
  createdById: UserIdSchema,
  updatedById: UserIdSchema,
  deletedAt: z.coerce
    .date({
      message: 'zodError.common.deletedAt.required'
    })
    .optional(),
  deletedById: UserIdSchema.optional(),

  // Lifecycle field
  lifecycleState: LifecycleStatusEnumSchema,

  // Business fields
  name: z
    .string({
      message: 'zodError.category.name.required'
    })
    .min(2, { message: 'zodError.category.name.min' })
    .max(100, { message: 'zodError.category.name.max' })
    .trim(),

  slug: z
    .string({
      message: 'zodError.category.slug.required'
    })
    .min(1, { message: 'zodError.category.slug.min' })
    .max(100, { message: 'zodError.category.slug.max' })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'zodError.category.slug.pattern'
    }),

  description: z
    .string({
      message: 'zodError.category.description.required'
    })
    .min(10, { message: 'zodError.category.description.min' })
    .max(500, { message: 'zodError.category.description.max' })
    .optional(),

  icon: z
    .string({
      message: 'zodError.category.icon.required'
    })
    .min(1, { message: 'zodError.category.icon.min' })
    .max(50, { message: 'zodError.category.icon.max' })
    .optional(),

  isActive: z
    .boolean({
      message: 'zodError.category.isActive.required'
    })
    .default(true),

  sortOrder: z
    .number({
      message: 'zodError.category.sortOrder.required'
    })
    .int({ message: 'zodError.category.sortOrder.int' })
    .min(0, { message: 'zodError.category.sortOrder.min' })
    .default(0)
});

/**
 * Infer TypeScript type from schema
 * This is the recommended pattern - types come from schemas, not separate files
 */
export type Category = z.infer<typeof CategorySchema>;

// ============================================================================
// CREATE SCHEMA
// ============================================================================

/**
 * Schema for creating a new category
 * Omits auto-generated fields (id, timestamps, audit fields)
 */
export const CategoryCreateInputSchema = CategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  deletedById: true
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateInputSchema>;

/**
 * Example of validating create input:
 *
 * ```typescript
 * const input = {
 *   name: 'Outdoor Activities',
 *   slug: 'outdoor-activities',
 *   description: 'Activities for outdoor enthusiasts',
 *   icon: '🏕️',
 *   isActive: true,
 *   lifecycleState: 'ACTIVE',
 *   sortOrder: 0
 * };
 *
 * const result = CategoryCreateInputSchema.safeParse(input);
 * if (result.success) {
 *   // input is valid
 *   const validData = result.data;
 * } else {
 *   // validation errors
 *   console.error(result.error);
 * }
 * ```
 */

// ============================================================================
// UPDATE SCHEMA
// ============================================================================

/**
 * Schema for updating a category
 * All fields are optional (partial update)
 * Omits id and audit fields
 */
export const CategoryUpdateInputSchema = CategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
  deletedAt: true,
  deletedById: true
}).partial();

export type CategoryUpdateInput = z.infer<typeof CategoryUpdateInputSchema>;

/**
 * Example of validating update input:
 *
 * ```typescript
 * const updateInput = {
 *   name: 'Updated Category Name',
 *   isActive: false
 * };
 *
 * const result = CategoryUpdateInputSchema.safeParse(updateInput);
 * ```
 */

// ============================================================================
// SEARCH/FILTER SCHEMA
// ============================================================================

/**
 * Schema for searching/filtering categories
 * Used for list and search endpoints
 */
export const CategorySearchInputSchema = z.object({
  // Text search
  q: z
    .string({
      message: 'zodError.category.search.q.required'
    })
    .min(1, { message: 'zodError.category.search.q.min' })
    .optional(),

  // Filter by slug
  slug: z
    .string({
      message: 'zodError.category.search.slug.required'
    })
    .optional(),

  // Filter by active status
  isActive: z
    .boolean({
      message: 'zodError.category.search.isActive.required'
    })
    .optional(),

  // Filter by lifecycle state
  lifecycleState: LifecycleStatusEnumSchema.optional(),

  // Pagination
  page: z
    .number({
      message: 'zodError.common.pagination.page.required'
    })
    .int({ message: 'zodError.common.pagination.page.int' })
    .min(1, { message: 'zodError.common.pagination.page.min' })
    .default(1),

  pageSize: z
    .number({
      message: 'zodError.common.pagination.pageSize.required'
    })
    .int({ message: 'zodError.common.pagination.pageSize.int' })
    .min(1, { message: 'zodError.common.pagination.pageSize.min' })
    .max(100, { message: 'zodError.common.pagination.pageSize.max' })
    .default(20)
});

export type CategorySearchInput = z.infer<typeof CategorySearchInputSchema>;

/**
 * Example of using search schema:
 *
 * ```typescript
 * const searchParams = {
 *   q: 'outdoor',
 *   isActive: true,
 *   page: 1,
 *   pageSize: 10
 * };
 *
 * const result = CategorySearchInputSchema.safeParse(searchParams);
 * ```
 */

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Schema for single category response
 */
export const CategoryResponseSchema = CategorySchema;

export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;

/**
 * Schema for paginated category list response
 */
export const CategoryListResponseSchema = z.object({
  items: z.array(CategorySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalPages: z.number().int().min(0)
});

export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;
