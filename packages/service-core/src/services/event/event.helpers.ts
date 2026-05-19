/**
 * Helpers for EventService.
 * Add utility functions for events here (e.g., slug generation, date helpers, etc.).
 * Follows the pattern of other service helpers.
 */

import { EventModel, events as eventTable } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';
import type { SQL } from 'drizzle-orm';
import { and, isNull, or, sql } from 'drizzle-orm';

/**
 * Builds raw SQL conditions for the JSONB `date` column of the events table
 * from optional `startDateAfter`/`startDateBefore`/`endDateAfter`/`endDateBefore`
 * filters. The `date` column stores `{ start, end, ... }` per EventDateSchema,
 * so date range queries must extract `date->>'start'` / `date->>'end'` and
 * cast them to `timestamptz` to compare against ISO 8601 strings.
 *
 * Returns an empty array when no date filters are present, so callers can
 * safely spread/concat the result without further checks.
 *
 * @param input - Optional date range filters as ISO 8601 strings or Date objects
 * @returns Array of Drizzle `SQL` conditions ready to add to a `WHERE` clause
 */
export function buildEventDateConditions(input: {
    readonly startDateAfter?: string | Date;
    readonly startDateBefore?: string | Date;
    readonly endDateAfter?: string | Date;
    readonly endDateBefore?: string | Date;
}): SQL[] {
    const conditions: SQL[] = [];
    const { startDateAfter, startDateBefore, endDateAfter, endDateBefore } = input;

    if (startDateAfter) {
        conditions.push(sql`(${eventTable.date}->>'start')::timestamptz >= ${startDateAfter}`);
    }
    if (startDateBefore) {
        conditions.push(sql`(${eventTable.date}->>'start')::timestamptz <= ${startDateBefore}`);
    }
    if (endDateAfter) {
        conditions.push(sql`(${eventTable.date}->>'end')::timestamptz >= ${endDateAfter}`);
    }
    if (endDateBefore) {
        conditions.push(sql`(${eventTable.date}->>'end')::timestamptz <= ${endDateBefore}`);
    }

    return conditions;
}

/**
 * Builds raw SQL conditions for the JSONB `pricing` column of the events table
 * from `isFree`, `minPrice`, `maxPrice`, `price`, and `currency` filters. The
 * `pricing` column stores `{ isFree, price?, currency?, ... }` per
 * EventPriceSchema, so these queries must extract nested keys with `->>`.
 *
 * - `isFree`: matches events whose `pricing.isFree` equals the requested value.
 *   Rows with NULL `pricing` are excluded (strict semantics).
 * - `minPrice`/`maxPrice`/`price`: compare against `pricing.price` as numeric.
 *   Rows with NULL `pricing` are excluded; rows with `isFree=true` (no `price`
 *   key) are treated as price = 0 via COALESCE so the range still includes
 *   them when 0 falls inside the bounds.
 * - `currency`: matches `pricing.currency` exactly.
 * - `includeUnpriced`: when true AND at least one price filter is active, the
 *   final clause is wrapped so rows with `pricing IS NULL` are also returned
 *   alongside the matching rows. No-op when no price filter is active.
 *
 * Returns an empty array when no price filters are present, so callers can
 * safely spread/concat the result.
 *
 * @param input - Optional price filters from the search schema
 * @returns Array of Drizzle `SQL` conditions ready to add to a `WHERE` clause
 */
export function buildEventPriceConditions(input: {
    readonly isFree?: boolean;
    readonly minPrice?: number;
    readonly maxPrice?: number;
    readonly price?: number;
    readonly currency?: string;
    readonly includeUnpriced?: boolean;
}): SQL[] {
    const conditions: SQL[] = [];
    const { isFree, minPrice, maxPrice, price, currency, includeUnpriced } = input;

    if (isFree !== undefined) {
        conditions.push(
            sql`${eventTable.pricing} IS NOT NULL AND (${eventTable.pricing}->>'isFree')::boolean = ${isFree}`
        );
    }
    if (minPrice !== undefined) {
        conditions.push(
            sql`${eventTable.pricing} IS NOT NULL AND COALESCE((${eventTable.pricing}->>'price')::numeric, 0) >= ${minPrice}`
        );
    }
    if (maxPrice !== undefined) {
        conditions.push(
            sql`${eventTable.pricing} IS NOT NULL AND COALESCE((${eventTable.pricing}->>'price')::numeric, 0) <= ${maxPrice}`
        );
    }
    if (price !== undefined) {
        conditions.push(
            sql`${eventTable.pricing} IS NOT NULL AND (${eventTable.pricing}->>'price')::numeric = ${price}`
        );
    }
    if (currency !== undefined) {
        conditions.push(
            sql`${eventTable.pricing} IS NOT NULL AND ${eventTable.pricing}->>'currency' = ${currency}`
        );
    }

    if (includeUnpriced === true && conditions.length > 0) {
        const combined = and(...conditions);
        if (combined) {
            return [or(combined, isNull(eventTable.pricing)) as SQL];
        }
    }

    return conditions;
}

/**
 * Generates a unique slug for an event based on category, name, and date.start.
 * Combines these fields, slugifies, and ensures uniqueness in the database.
 *
 * @param category - The event category (string or enum value)
 * @param name - The event name
 * @param dateStart - The event start date (Date or string)
 * @returns Promise resolving to a unique slug string
 */
export async function generateEventSlug(
    category: string,
    name: string,
    dateStart: Date | string
): Promise<string> {
    const dateStr =
        typeof dateStart === 'string'
            ? dateStart.split('T')[0]
            : dateStart.toISOString().split('T')[0];
    const baseString = `${category} ${name} ${dateStr}`;
    const model = new EventModel();
    return createUniqueSlug(baseString, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
