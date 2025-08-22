import { LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

export const AmenityListItemSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        type: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        isBuiltin: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        accommodationCount: z.number().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough();

export type Amenity = z.infer<typeof AmenityListItemSchema>;
