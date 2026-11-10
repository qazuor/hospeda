/**
 * @file venue-business-line-filter.ts
 * @description WHERE-clause builder that restricts venue listings to those
 * carrying one business line.
 *
 * HOS-1787 leaf 7.1 adds the business-line filter to the admin listings
 * (`VenueAdminSearchSchema.businessLine`). The column is `text[]`, so the
 * generic admin search builder — which compares scalar columns with `eq` —
 * cannot express it. This builder lives in `@repo/db`, next to
 * `venue-catalog-filters.ts`, for two reasons.
 *
 * ## Why here and not in `utils/`
 *
 * It imports a dbschema module, and a dbschema calls `pgTable(...)` at
 * module-load time. Every module in `src/utils/` imports zero dbschemas; dozens
 * of suites mock `drizzle-orm` wholesale, so pulling a schema graph into the
 * utils barrel makes those suites die on import. `models/` already imports
 * dbschemas, so this adds no coupling that was not already there. The same
 * docblock in `venue-catalog-filters.ts` explains the invariant in full.
 *
 * ## Why the service composes it, not the model
 *
 * `VenueService._executeAdminSearch` receives the `additionalConditions`
 * escape hatch from the base class. Exporting the builder keeps the raw SQL
 * inside `@repo/db` instead of leaking a `drizzle-orm` template into
 * `service-core`, matching `buildVenueCatalogConditions`.
 *
 * ## Containment, not equality
 *
 * A listing carries one or more lines of its vertical, so "has this line" is
 * membership, not equality. `@>` uses the `venues_business_lines_gin_idx`
 * GIN index, while `= 'food'` cannot be indexed at all and is wrong for a
 * listing that also carries `nightlife`.
 */
import { arrayContains, type SQL } from 'drizzle-orm';
import { venues } from '../../schemas/venue/venue.dbschema.ts';

/**
 * Build a WHERE clause restricting venue listings to those carrying the
 * requested business line.
 *
 * @param params.businessLine - The business line to require. Absent means no
 *   filter, preserving the callers that never send one.
 * @returns A SQL condition suitable for `additionalConditions`, or `undefined`
 *   when no line was requested.
 */
export function buildVenueBusinessLineCondition({
    businessLine
}: {
    readonly businessLine?: string;
}): SQL | undefined {
    if (businessLine === undefined) return undefined;
    return arrayContains(venues.businessLines, [businessLine]);
}
