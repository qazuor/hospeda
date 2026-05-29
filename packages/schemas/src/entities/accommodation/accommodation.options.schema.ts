/**
 * Accommodation relation-selector lookup schema (SPEC-169 §5.5 / decision D4).
 *
 * Accommodation extends the shared `{ id, label, slug }` option item with `type`
 * and `destination` (OQ3 / D4), because the accommodation selector needs those two
 * fields to disambiguate listings in the picker. No admin/private/pricing fields.
 */
import { z } from 'zod';
import { EntityOptionsItemSchema } from '../../common/entity-options.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/index.js';

/**
 * Minimal destination descriptor embedded in an accommodation option item.
 */
export const AccommodationOptionsDestinationSchema = z.object({
    /** Destination id (UUID). */
    id: z.string().describe('Destination id'),
    /** Destination display name. */
    name: z.string().describe('Destination name'),
    /** Destination slug. */
    slug: z.string().describe('Destination slug')
});

/**
 * Accommodation option item: base `{ id, label, slug }` plus `type` and `destination`.
 */
export const AccommodationOptionsItemSchema = EntityOptionsItemSchema.extend({
    /** Accommodation type (HOTEL, APARTMENT, etc). */
    type: AccommodationTypeEnumSchema.describe('Accommodation type'),
    /** The accommodation's destination, or null when unresolved. */
    destination: AccommodationOptionsDestinationSchema.nullable().describe(
        'Destination summary (id, name, slug)'
    )
});

/**
 * Type inferred from {@link AccommodationOptionsItemSchema}.
 */
export type AccommodationOptionsItem = z.infer<typeof AccommodationOptionsItemSchema>;

/**
 * Wrapper schema for the accommodation `/options` response payload.
 */
export const AccommodationOptionsListSchema = z.object({
    items: z.array(AccommodationOptionsItemSchema).describe('Matching accommodation options')
});

/**
 * Type inferred from {@link AccommodationOptionsListSchema}.
 */
export type AccommodationOptionsList = z.infer<typeof AccommodationOptionsListSchema>;
