import { z } from 'zod';

/**
 * Schema Composition Utilities
 *
 * Simple utility functions for creating and manipulating schemas
 * without complex type constraints that cause issues.
 */

/**
 * Creates a base schema with common fields for all entities
 */
export const createBaseSchema = () => {
    return z.object({
        id: z.string().min(1, 'ID is required'),
        slug: z
            .string()
            .min(3, 'Slug must be at least 3 characters')
            .max(50, 'Slug must be at most 50 characters'),
        name: z
            .string()
            .min(3, 'Name must be at least 3 characters')
            .max(100, 'Name must be at most 100 characters'),
        summary: z
            .string()
            .min(10, 'Summary must be at least 10 characters')
            .max(300, 'Summary must be at most 300 characters'),
        description: z
            .string()
            .min(30, 'Description must be at least 30 characters')
            .max(2000, 'Description must be at most 2000 characters'),
        isFeatured: z.boolean().default(false),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
        createdById: z.string(),
        updatedById: z.string(),
        deletedAt: z.coerce.date().optional(),
        deletedById: z.string().optional()
    });
};

/**
 * Creates a schema for list items (minimal data)
 */
export const createListItemSchema = (baseSchema: z.ZodObject<z.ZodRawShape>) => {
    return baseSchema.pick({
        id: true,
        slug: true,
        name: true,
        summary: true,
        isFeatured: true,
        createdAt: true,
        updatedAt: true
    });
};

/**
 * Creates a schema for detail view (complete data)
 */
export const createDetailSchema = (baseSchema: z.ZodObject<z.ZodRawShape>) => {
    return baseSchema;
};

/**
 * Creates a schema for creation (omits server-generated fields)
 */
export const createCreateSchema = (baseSchema: z.ZodObject<z.ZodRawShape>) => {
    return baseSchema.omit({
        id: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        updatedById: true,
        deletedAt: true,
        deletedById: true
    });
};

/**
 * Creates a schema for updates (partial updates)
 */
export const createUpdateSchema = (baseSchema: z.ZodObject<z.ZodRawShape>) => {
    return createCreateSchema(baseSchema).partial();
};

/**
 * Creates a schema for search filters
 */
export const createSearchFiltersSchema = () => {
    return z.object({
        search: z.string().optional(),
        isFeatured: z.boolean().optional(),
        createdById: z.string().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional()
    });
};

/**
 * Creates a schema for search sorting
 */
export const createSearchSortSchema = () => {
    return z.object({
        sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'isFeatured']).optional(),
        order: z.enum(['asc', 'desc']).default('desc')
    });
};

/**
 * Creates a schema for pagination
 */
export const createPaginationSchema = () => {
    return z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).optional()
    });
};

/**
 * Creates a schema for entity stats
 */
export const createStatsSchema = () => {
    return z.object({
        total: z.number().int().min(0),
        active: z.number().int().min(0),
        inactive: z.number().int().min(0),
        deleted: z.number().int().min(0),
        featured: z.number().int().min(0),
        published: z.number().int().min(0),
        draft: z.number().int().min(0)
    });
};

/**
 * Creates a schema for entity summary
 */
export const createSummarySchema = () => {
    return z.object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        summary: z.string(),
        isFeatured: z.boolean(),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date()
    });
};

/**
 * Helper function to add common fields to a schema
 */
export const addCommonFields = (
    schema: z.ZodObject<z.ZodRawShape>,
    commonFields: Record<string, z.ZodTypeAny>
) => {
    return schema.extend(commonFields);
};

/**
 * Helper function to create a schema with SEO fields
 */
export const addSeoFields = (schema: z.ZodObject<z.ZodRawShape>) => {
    return schema.extend({
        seo: z
            .object({
                title: z.string().min(30).max(60).optional(),
                description: z.string().min(70).max(160).optional(),
                keywords: z.array(z.string()).optional()
            })
            .optional()
    });
};

/**
 * Helper function to create a schema with contact fields
 */
export const addContactFields = (schema: z.ZodObject<z.ZodRawShape>) => {
    return schema.extend({
        contact: z
            .object({
                email: z.string().email().optional(),
                phone: z.string().optional(),
                website: z.string().url().optional(),
                socialNetworks: z
                    .array(
                        z.object({
                            platform: z.string(),
                            url: z.string().url()
                        })
                    )
                    .optional()
            })
            .optional()
    });
};

/**
 * Helper function to create a schema with location fields
 */
export const addLocationFields = (schema: z.ZodObject<z.ZodRawShape>) => {
    return schema.extend({
        location: z
            .object({
                address: z.string().optional(),
                city: z.string().optional(),
                state: z.string().optional(),
                country: z.string().optional(),
                postalCode: z.string().optional(),
                coordinates: z
                    .object({
                        latitude: z.number().min(-90).max(90).optional(),
                        longitude: z.number().min(-180).max(180).optional()
                    })
                    .optional()
            })
            .optional()
    });
};

/**
 * Helper function to create a schema with media fields
 */
export const addMediaFields = (schema: z.ZodObject<z.ZodRawShape>) => {
    return schema.extend({
        media: z
            .object({
                featuredImage: z
                    .object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        alt: z.string().optional()
                    })
                    .optional(),
                gallery: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            alt: z.string().optional()
                        })
                    )
                    .optional()
            })
            .optional()
    });
};

/**
 * Helper function to create a schema with tags
 */
export const addTagsFields = (schema: z.ZodObject<z.ZodRawShape>) => {
    return schema.extend({
        tags: z.array(z.string()).optional()
    });
};

/**
 * Helper function to create a schema with FAQ fields
 */
export const addFaqFields = (schema: z.ZodObject<z.ZodRawShape>) => {
    return schema.extend({
        faqs: z
            .array(
                z.object({
                    id: z.string().uuid(),
                    question: z.string().min(10).max(200),
                    answer: z.string().min(10).max(1000),
                    order: z.number().int().min(0)
                })
            )
            .optional()
    });
};

/**
 * Helper function to create a schema with admin info fields
 */
export const addAdminFields = (schema: z.ZodObject<z.ZodRawShape>) => {
    return schema.extend({
        adminInfo: z
            .object({
                notes: z.string().optional(),
                internalTags: z.array(z.string()).optional(),
                priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
                assignedTo: z.string().optional(),
                dueDate: z.coerce.date().optional()
            })
            .optional()
    });
};
