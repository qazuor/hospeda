/**
 * Experience relation-selector lookup schema (SPEC-240).
 *
 * Experience extends the shared `{ id, label, slug }` option item with `type`
 * and `destination` — matching the gastronomy options pattern — so the
 * experience selector can disambiguate listings in relation pickers.
 */
import { z } from 'zod';
import { EntityOptionsItemSchema } from '../../common/entity-options.schema.js';
import { ExperienceTypeEnumSchema } from '../../enums/index.js';

/**
 * Minimal destination descriptor embedded in an experience option item.
 */
export const ExperienceOptionsDestinationSchema = z.object({
    /** Destination id (UUID). */
    id: z.string().describe('Destination id'),
    /** Destination display name. */
    name: z.string().describe('Destination name'),
    /** Destination slug. */
    slug: z.string().describe('Destination slug')
});

/**
 * Experience option item: base `{ id, label, slug }` plus `type` and `destination`.
 */
export const ExperienceOptionsItemSchema = EntityOptionsItemSchema.extend({
    /** Experience sub-type (CAR_RENTAL, TOUR_GUIDE, EXCURSION, etc.). */
    type: ExperienceTypeEnumSchema.describe('Experience type'),
    /** The experience listing's destination, or null when unresolved. */
    destination: ExperienceOptionsDestinationSchema.nullable().describe(
        'Destination summary (id, name, slug)'
    )
});

/**
 * Type inferred from {@link ExperienceOptionsItemSchema}.
 */
export type ExperienceOptionsItem = z.infer<typeof ExperienceOptionsItemSchema>;

/**
 * Wrapper schema for the experience `/options` response payload.
 */
export const ExperienceOptionsListSchema = z.object({
    items: z.array(ExperienceOptionsItemSchema).describe('Matching experience options')
});

/**
 * Type inferred from {@link ExperienceOptionsListSchema}.
 */
export type ExperienceOptionsList = z.infer<typeof ExperienceOptionsListSchema>;
