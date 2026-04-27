/**
 * Destination Reference Schemas
 *
 * Lightweight projections of the destination entity used as relations in
 * other entities' API responses. The full DestinationSchema carries media,
 * reviews, attractions, and aggregate counts that are unnecessary when
 * destinations appear as a foreign-key context (e.g. `cityDestination` on
 * an accommodation card).
 *
 * @see SPEC-095 — single source of truth for accommodation/eventLocation
 * geography.
 */
import type { z } from 'zod';
import { DestinationSchema } from './destination.schema.js';

/**
 * CityDestinationRefSchema — minimal city projection for response embedding.
 *
 * Picks the fields needed to render city name, breadcrumb, and SEO links
 * without bloating the wire payload. Used as the `cityDestination` field on
 * accommodation and eventLocation responses.
 */
export const CityDestinationRefSchema = DestinationSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    destinationType: true,
    level: true,
    path: true,
    pathIds: true
});

/**
 * Inferred TypeScript type for a CityDestinationRef projection.
 */
export type CityDestinationRef = z.infer<typeof CityDestinationRefSchema>;
