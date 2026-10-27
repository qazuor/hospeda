import { destinations } from '@repo/db';
import { type SQL, sql } from 'drizzle-orm';

/**
 * Location filters accepted by the destination search schemas.
 * Each value is matched against the same-named key of the `location` JSONB column.
 */
export interface DestinationLocationFilters {
    readonly state?: string;
    readonly city?: string;
}

/**
 * There is deliberately NO `country` key (HOS-1921). The HTTP schema demanded ISO-2
 * ("AR") while stored `location.country` is a name ("Argentina"), so the filter could
 * never match. Do not re-add it without a consumer and an agreed representation.
 */
const LOCATION_KEYS = ['state', 'city'] as const;

/**
 * Builds the WHERE conditions for the `state` / `city` filters (HOS-1899).
 *
 * `destinations` has no such columns: the values live inside the `location` JSONB
 * column. Putting them in the `where` record handed to `buildWhereClause` is wrong
 * twice over: it skips them with a warning when other keys are present (the filter is
 * silently ignored) and throws "all keys unknown" when they are the only keys (HTTP 500).
 * They are therefore passed as `additionalConditions`, which `findAll` and `count` apply
 * identically so totals and items agree.
 *
 * The comparison is case-insensitive and trims the input; blank values add no condition.
 * Both sides are lowercased by Postgres (`lower(...) = lower(...)`) so they cannot diverge
 * the way JS and Postgres lowercasing do under some collations. Matching is
 * ACCENT-SENSITIVE: `?city=colon` does not match "Colón".
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
        conditions.push(sql`lower(${destinations.location}->>${key}) = lower(${value})`);
    }
    return conditions;
}

/**
 * In-memory twin of {@link buildDestinationLocationConditions}, for code paths that
 * filter an already-loaded list (the `ancestorId` branch of destination search).
 * Same semantics: trimmed, case-insensitive, accent-sensitive, blank values ignored.
 *
 * @param input - The destination `location` JSON and the filters to apply.
 * @returns `true` when every non-blank filter equals its `location` key.
 */
export function matchesDestinationLocation({
    location,
    filters
}: {
    readonly location: unknown;
    readonly filters: DestinationLocationFilters;
}): boolean {
    const record = (location ?? {}) as Record<string, unknown>;
    return LOCATION_KEYS.every((key) => {
        const wanted = filters[key]?.trim();
        if (!wanted) return true;
        const actual = record[key];
        return typeof actual === 'string' && actual.toLowerCase() === wanted.toLowerCase();
    });
}
