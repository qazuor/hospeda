import { z } from 'zod';

export const CreateFeatureSchema = z
    .object({
        name: z.string().min(2),
        description: z.string().optional(),
        icon: z.string().optional(),
        isBuiltin: z.boolean().optional(),
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional(),
        isFeatured: z.boolean().optional().default(false)
    })
    .strict();

export const UpdateFeatureSchema = CreateFeatureSchema.partial().strict();

export const SearchFeatureSchema = z
    .object({
        name: z.string().optional(),
        slug: z.string().optional(),
        isFeatured: z.boolean().optional(),
        isBuiltin: z.boolean().optional()
    })
    .strict();

export const AddFeatureToAccommodationInputSchema = z
    .object({
        accommodationId: z.string().min(1, 'Accommodation ID is required'),
        featureId: z.string().min(1, 'Feature ID is required'),
        hostReWriteName: z.string().min(3).max(100).optional().nullable(),
        comments: z.string().min(5).max(300).optional().nullable()
    })
    .strict();

export const RemoveFeatureFromAccommodationInputSchema = z
    .object({
        accommodationId: z.string().min(1, 'Accommodation ID is required'),
        featureId: z.string().min(1, 'Feature ID is required')
    })
    .strict();

export const GetFeaturesForAccommodationSchema = z
    .object({
        accommodationId: z.string().min(1, 'Accommodation ID is required')
    })
    .strict();

export const GetAccommodationsByFeatureSchema = z
    .object({
        featureId: z.string().min(1, 'Feature ID is required')
    })
    .strict();
