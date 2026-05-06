/**
 * Helpers for EventService.
 * Add utility functions for events here (e.g., slug generation, date helpers, etc.).
 * Follows the pattern of other service helpers.
 */

import { EventModel, events as eventTable } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';
import type { SQL } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

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
