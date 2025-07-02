/**
 * Helpers for EventService.
 * Add utility functions for events here (e.g., slug generation, date helpers, etc.).
 * Follows the pattern of other service helpers.
 */

import { EventModel } from '@repo/db';
import { createUniqueSlug } from '@repo/utils';

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
