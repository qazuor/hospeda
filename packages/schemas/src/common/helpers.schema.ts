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
/** Fields automatically managed by the system that should be excluded from create inputs */
const SYSTEM_MANAGED_FIELDS = {
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true
} as const;

type SystemManagedKeys = keyof typeof SYSTEM_MANAGED_FIELDS;

// Zod v4's .omit() method has a strict generic constraint that prevents passing a mask
// with keys that TypeScript cannot statically prove exist in the generic shape T.
// We use z.util.omit() which performs the same runtime operation without the strict
// generic type constraint, then cast the result to preserve proper typing.
export const NewEntityInputSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
    z.util.omit(schema, SYSTEM_MANAGED_FIELDS) as z.ZodObject<Omit<T, SystemManagedKeys>>;
