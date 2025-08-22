import { LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

export const AttractionListItemSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
        isBuiltin: z.boolean().optional(),
        destinationCount: z.number().optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough();

export type Attraction = z.infer<typeof AttractionListItemSchema>;
