import { LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

export const FeatureListItemSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
        isBuiltin: z.boolean().optional(),
        is_featured: z.boolean().optional(),
        accommodationCount: z.number().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough();

export type Feature = z.infer<typeof FeatureListItemSchema>;
