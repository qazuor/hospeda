import {
    PointOfInterestListItemSchema as BasePointOfInterestListItemSchema,
    I18nTextSchema
} from '@repo/schemas';
import { z } from 'zod';

/**
 * Admin Point Of Interest Schemas
 *
 * HOS-144: the admin list/columns need two fields the package's narrower
 * public-facing `PointOfInterestListItemSchema` omits — `nameI18n` (the v2
 * multilang display name, HOS-138) and `hasOwnPage` (the own-page flag,
 * HOS-138). `lifecycleState` is already present on the base schema (unlike
 * attractions/amenities/destinations, POI has no separate
 * visibility/moderationState concept — see the package's
 * `PointOfInterestSchema`).
 *
 * HOS-143's admin `list`/`getById` routes call the base
 * `service.adminList()`/`getById()` (not the POI service's bespoke
 * `searchForList()`), so no `destinationCount` projection is available here
 * (spec §6.7 — flagged as HOS-143 follow-up OQ-3, not worked around here).
 */
export const PointOfInterestListItemSchema = BasePointOfInterestListItemSchema.extend({
    nameI18n: I18nTextSchema.nullish(),
    hasOwnPage: z.boolean().default(false)
});

/**
 * Type for point-of-interest list items with admin extensions.
 */
export type PointOfInterest = z.infer<typeof PointOfInterestListItemSchema>;
