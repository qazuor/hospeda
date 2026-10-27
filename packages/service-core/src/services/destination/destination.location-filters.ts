import { destinations } from '@repo/db';
import { type SQL, sql } from 'drizzle-orm';

/**
 * Location filters accepted by the destination search schemas.
 * Each value is matched against the same-named key of the `location` JSONB column.
 */
export interface DestinationLocationFilters {
    readonly country?: string;
    readonly state?: string;
    readonly city?: string;
}

const LOCATION_KEYS = ['country', 'state', 'city'] as const;

/**
 * Builds the WHERE conditions for the `country` / `state` / `city` filters (HOS-1899).
 *
 * `destinations` has no such columns: the values live inside the `location` JSONB
 * column. Putting them in the `where` record handed to `buildWhereClause` is wrong
 * twice over: it skips them with a warning when other keys are present (the filter is
 * silently ignored) and throws "all keys unknown" when they are the only keys (HTTP 500).
 * They are therefore passed as `additionalConditions`, which `findAll` and `count` apply
 * identically so totals and items agree.
 *
 * The comparison is case-insensitive and trims the input; blank values add no condition.
 *
 * @param filters - The location filters from the validated search input.
 * @returns One SQL condition per non-blank filter (empty when none apply).
 */
export function buildDestinationLocationConditions(
    filters: DestinationLocationFilters
): readonly SQL[] {
    const conditions: SQL[] = [];
    for (const key of LOCATION_KEYS) {
        const value = filters[key]?.trim();
        if (!value) continue;
        conditions.push(sql`lower(${destinations.location}->>${key}) = ${value.toLowerCase()}`);
    }
    return conditions;
}
