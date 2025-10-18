import { z } from 'zod';
import { LifecycleStatusEnumSchema } from '../enums/lifecycle-state.schema.js';
import { ModerationStatusEnumSchema } from '../enums/moderation-status.schema.js';
import { VisibilityEnumSchema } from '../enums/visibility.schema.js';
import { AdminInfoSchema } from './admin.schema.js';
import { UserIdSchema } from './id.schema.js';
import { SeoSchema } from './seo.schema.js';

/* ---------------------------------------- */
/*           Helper Composition Schemas     */
/* ---------------------------------------- */

export const WithAuditSchema = z.object({
    createdAt: z.date(),
    updatedAt: z.date(),
    createdById: UserIdSchema,
    updatedById: UserIdSchema,
    deletedAt: z.date().optional(),
    deletedById: UserIdSchema.optional()
});
export type WithAudit = z.infer<typeof WithAuditSchema>;

export const WithReviewStateSchema = z.object({
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});
export type WithReviewState = z.infer<typeof WithReviewStateSchema>;

/**
 * Helper function to create averageRating field that handles both string and number inputs
 * PostgreSQL numeric fields are returned as strings by the driver
 */
export const createAverageRatingField = (
    options: { optional?: boolean; default?: number } = {}
) => {
    const baseSchema = z
        .union([z.string(), z.number()]) // Accept both string and number from DB
        .transform((val) => (typeof val === 'string' ? Number.parseFloat(val) : val)) // Convert string to number
        .pipe(z.number().min(0).max(5));

    if (options.default !== undefined) {
        return options.optional
            ? baseSchema.default(options.default).optional()
            : baseSchema.default(options.default);
    }

    return options.optional ? baseSchema.optional() : baseSchema;
};

export const WithModerationStateSchema = z.object({
    moderationState: ModerationStatusEnumSchema
});
export type WithModerationState = z.infer<typeof WithModerationStateSchema>;

export const WithLifecycleStateSchema = z.object({
    lifecycleState: LifecycleStatusEnumSchema
});
export type WithLifecycleState = z.infer<typeof WithLifecycleStateSchema>;

export const WithVisibilitySchema = z.object({
    visibility: VisibilityEnumSchema
});
export type WithVisibility = z.infer<typeof WithVisibilitySchema>;

export const WithAdminInfoSchema = z.object({
    adminInfo: AdminInfoSchema.optional()
});
export type WithAdminInfo = z.infer<typeof WithAdminInfoSchema>;

export const WithSeoSchema = z.object({
    seo: SeoSchema.optional()
});
export type WithSeo = z.infer<typeof WithSeoSchema>;

/**
 * Standard count response schema for internal service methods
 */
export const CountResponseSchema = z.object({
    count: z.number().int().min(0)
});
export type CountResponse = z.infer<typeof CountResponseSchema>;

/* ---------------------------------------- */
/*         Generic Utility Schemas          */
/* ---------------------------------------- */

/**
 * Schema for partial entity updates (all fields optional)
 */
export const PartialEntitySchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
    schema.partial();

/**
 * Schema for new entity input (excludes system-managed fields)
 */
export const NewEntityInputSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
    schema.omit({
        id: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        createdById: true,
        updatedById: true,
        deletedById: true
    });
