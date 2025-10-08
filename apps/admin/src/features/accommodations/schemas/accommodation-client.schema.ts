import type { Accommodation, AccommodationUpdateInput } from '@repo/schemas';
import {
    AccommodationCreateInputSchema,
    AccommodationSchema,
    AccommodationUpdateInputSchema
} from '@repo/schemas';
import { z } from 'zod';

/**
 * MIGRATION NOTE: This file previously contained 136 lines of duplicated schema definitions.
 * Now using @repo/schemas as single source of truth with admin-specific extensions.
 */

export const AccommodationClientSchema = AccommodationSchema.extend({
    _isDirty: z.boolean().optional(),
    _hasUnsavedChanges: z.boolean().optional(),
    _isNew: z.boolean().optional()
});

export const AccommodationEditSchema = AccommodationUpdateInputSchema.extend({
    slug: AccommodationCreateInputSchema.shape.slug
});

export const AccommodationViewSchema = AccommodationClientSchema;

export type AccommodationClient = Accommodation & {
    _isDirty?: boolean;
    _hasUnsavedChanges?: boolean;
    _isNew?: boolean;
};

export type AccommodationEdit = AccommodationUpdateInput & {
    slug?: string;
};

export type AccommodationView = AccommodationClient;
export type AccommodationCore = AccommodationClient;
