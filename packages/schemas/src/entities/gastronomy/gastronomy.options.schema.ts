/**
 * Gastronomy relation-selector lookup schema (SPEC-239).
 *
 * Gastronomy extends the shared `{ id, label, slug }` option item with `type`
 * and `destination` — matching the accommodation options pattern — so the
 * gastronomy selector can disambiguate listings in relation pickers.
 */
import { z } from 'zod';
import { EntityOptionsItemSchema } from '../../common/entity-options.schema.js';
import { GastronomyTypeEnumSchema } from '../../enums/index.js';

/**
 * Minimal destination descriptor embedded in a gastronomy option item.
 */
export const GastronomyOptionsDestinationSchema = z.object({
    /** Destination id (UUID). */
    id: z.string().describe('Destination id'),
    /** Destination display name. */
    name: z.string().describe('Destination name'),
    /** Destination slug. */
    slug: z.string().describe('Destination slug')
});

/**
 * Gastronomy option item: base `{ id, label, slug }` plus `type` and `destination`.
 */
export const GastronomyOptionsItemSchema = EntityOptionsItemSchema.extend({
    /** Gastronomy sub-type (RESTAURANT, BAR, CAFE, etc.). */
    type: GastronomyTypeEnumSchema.describe('Gastronomy type'),
    /** The gastronomy listing's destination, or null when unresolved. */
    destination: GastronomyOptionsDestinationSchema.nullable().describe(
        'Destination summary (id, name, slug)'
    )
});

/**
 * Type inferred from {@link GastronomyOptionsItemSchema}.
 */
export type GastronomyOptionsItem = z.infer<typeof GastronomyOptionsItemSchema>;

/**
 * Wrapper schema for the gastronomy `/options` response payload.
 */
export const GastronomyOptionsListSchema = z.object({
    items: z.array(GastronomyOptionsItemSchema).describe('Matching gastronomy options')
});

/**
 * Type inferred from {@link GastronomyOptionsListSchema}.
 */
export type GastronomyOptionsList = z.infer<typeof GastronomyOptionsListSchema>;
