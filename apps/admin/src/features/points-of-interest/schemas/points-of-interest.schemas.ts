import { PointOfInterestListItemSchema as BasePointOfInterestListItemSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Admin Point Of Interest Schemas
 *
 * HOS-144: the admin list/columns need `hasOwnPage` (the own-page flag,
 * HOS-138), which the package's narrower public-facing
 * `PointOfInterestListItemSchema` omits. `nameI18n` (the v2 multilang display
 * name, HOS-138) and `lifecycleState` are BOTH already present on the base
 * schema, so they are inherited unchanged — the base `nameI18n` is
 * `PartialI18nTextSchema.nullish()`, which correctly accepts the es-only POI
 * catalog shape (`{ es, en: null, pt: null }`, HOS-142). This must NOT be
 * re-overridden with the strict `I18nTextSchema` (all locales required):
 * `createEntityApi` `safeParse`s the whole paginated response and throws on
 * the first failing row, so a strict `nameI18n` blanks the entire admin POI
 * list against real es-only data.
 *
 * HOS-143's admin `list`/`getById` routes call the base
 * `service.adminList()`/`getById()` (not the POI service's bespoke
 * `searchForList()`), so no `destinationCount` projection is available here
 * (spec §6.7 — flagged as HOS-143 follow-up OQ-3, not worked around here).
 */
export const PointOfInterestListItemSchema = BasePointOfInterestListItemSchema.extend({
    hasOwnPage: z.boolean().default(false)
});

/**
 * Type for point-of-interest list items with admin extensions.
 */
export type PointOfInterest = z.infer<typeof PointOfInterestListItemSchema>;
