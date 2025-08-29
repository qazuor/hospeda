/**
 * @file Accommodations Server Configuration
 *
 * This file defines the server-side configuration for accommodations entity
 * including schemas, permissions, and caching strategies.
 */

import { AccommodationTypeEnum, LifecycleStatusEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Simplified schemas that work with TanStack Start
 * Using enums from @repo/types for consistency
 */
const accommodationSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    type: z.nativeEnum(AccommodationTypeEnum),
    status: z.nativeEnum(LifecycleStatusEnum),
    capacity: z.number().int().min(1),
    pricePerNight: z.number().min(0),
    currency: z.string().length(3),
    createdAt: z.string(),
    updatedAt: z.string()
});

const createAccommodationSchema = accommodationSchema
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true
    })
    .extend({
        status: z.nativeEnum(LifecycleStatusEnum).default(LifecycleStatusEnum.DRAFT),
        currency: z.string().length(3).default('USD')
    });

const updateAccommodationSchema = createAccommodationSchema.partial();
const accommodationIdSchema = z.string().uuid();

/**
 * Export schemas for use in server functions
 */
export {
    accommodationIdSchema,
    accommodationSchema,
    createAccommodationSchema,
    updateAccommodationSchema
};

/**
 * TypeScript types derived from schemas
 */
export type Accommodation = z.infer<typeof accommodationSchema>;
export type CreateAccommodationData = z.infer<typeof createAccommodationSchema>;
export type UpdateAccommodationData = z.infer<typeof updateAccommodationSchema>;

/**
 * Server configuration for accommodations
 * Note: Generic server config is not used in the simple functions approach
 */
export const accommodationsConfig = {
    name: 'accommodation',
    endpoint: '/api/accommodations/:id',
    permissions: {
        create: ['accommodation:create', 'write'],
        read: ['accommodation:read', 'read'],
        update: ['accommodation:update', 'write'],
        delete: ['accommodation:delete', 'admin'],
        list: ['accommodation:list', 'read']
    },
    cache: {
        ttl: 5 * 60 * 1000, // 5 minutes
        tags: ['accommodations'],
        invalidateOn: ['create', 'update', 'delete']
    }
} as const;
