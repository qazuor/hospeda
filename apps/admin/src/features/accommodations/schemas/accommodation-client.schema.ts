import { ClientStateExtensionSchema } from '@/shared/schemas';
import type { AccommodationUpdateInput } from '@repo/schemas';
import {
    AccommodationCreateInputSchema,
    AccommodationSchema,
    AccommodationUpdateInputSchema
} from '@repo/schemas';
import type { z } from 'zod';

/**
 * Accommodation schemas for admin client-side usage
 * Uses shared ClientStateExtensionSchema for consistent client state management
 */

export const AccommodationClientSchema = AccommodationSchema.extend(
    ClientStateExtensionSchema.shape
);

export const AccommodationEditSchema = AccommodationUpdateInputSchema.extend({
    slug: AccommodationCreateInputSchema.shape.slug
});

export const AccommodationViewSchema = AccommodationClientSchema;

export type AccommodationClient = z.infer<typeof AccommodationClientSchema>;

export type AccommodationEdit = AccommodationUpdateInput & {
    slug?: string;
};

export type AccommodationView = AccommodationClient;
export type AccommodationCore = AccommodationClient;
