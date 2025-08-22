import { ClientTypeEnum, LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Sponsor (PostSponsor) list item schema for admin interface
 */
export const SponsorListItemSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        type: z.nativeEnum(ClientTypeEnum).optional(),
        description: z.string().optional(),
        contact: z
            .object({
                email: z.string().email().nullable().optional(),
                phone: z.string().nullable().optional(),
                website: z.string().url().nullable().optional()
            })
            .nullable()
            .optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough();

export const SponsorListItemClientSchema = SponsorListItemSchema;

export type Sponsor = z.infer<typeof SponsorListItemSchema>;
