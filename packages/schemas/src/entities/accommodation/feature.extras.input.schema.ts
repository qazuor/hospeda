import { z } from 'zod';
import { FeatureSchema } from './feature.schema';

// Inputs para Feature
export const NewFeatureInputSchema = FeatureSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true
});
export const UpdateFeatureInputSchema = NewFeatureInputSchema.partial();

// Filtros y ordenamiento
export const FeatureFilterInputSchema = z.object({
    name: z
        .string()
        .min(3, { message: 'zodError.feature.name.min' })
        .max(100, { message: 'zodError.feature.name.max' })
        .optional(),
    isBuiltin: z.boolean().optional(),
    q: z.string().optional()
});

export const FeatureSortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});

// Extras
export const FeatureSummarySchema = z.object({
    id: z.string(),
    name: z
        .string()
        .min(3, { message: 'zodError.feature.name.min' })
        .max(100, { message: 'zodError.feature.name.max' }),
    icon: z
        .string()
        .min(2, { message: 'zodError.feature.icon.min' })
        .max(100, { message: 'zodError.feature.icon.max' })
        .optional()
});
