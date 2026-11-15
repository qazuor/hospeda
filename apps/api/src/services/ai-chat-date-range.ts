/**
 * Date-range filter of the chat read surfaces (HOS-2075): the owner panel and
 * the staff view share it.
 *
 * Days arrive as `YYYY-MM-DD` (UTC). `from` is the start of that day, `to` is
 * INCLUSIVE, so the upper bound is the start of the next day (exclusive). A
 * `from` older than the retention horizon is an error, never a silently empty
 * result: the owner would read "no questions" for rows that were purged.
 *
 * @module apps/api/services/ai-chat-date-range
 */

import { AI_LISTING_QUESTIONS_RETENTION_MONTHS } from '@repo/schemas';

/** Resolved bounds; absent means unbounded on that side. */
export interface ChatDateRange {
    readonly lowerBound?: Date;
    readonly upperExclusive?: Date;
}

/** Output of {@link resolveChatDateRange}. */
export type ResolveChatDateRangeOutput =
    | { readonly ok: true; readonly range: ChatDateRange }
    | { readonly ok: false; readonly message: string };

/**
 * The start of the retention horizon relative to `now`.
 *
 * @param input - The reference instant.
 * @returns `{ cutoff }`, {@link AI_LISTING_QUESTIONS_RETENTION_MONTHS} months earlier.
 */
export function retentionCutoff(input: { readonly now: Date }): { readonly cutoff: Date } {
    const cutoff = new Date(input.now.getTime());
    cutoff.setUTCMonth(cutoff.getUTCMonth() - AI_LISTING_QUESTIONS_RETENTION_MONTHS);
    return { cutoff };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Turns the two optional days into instants, or explains why they are invalid.
 *
 * @param input.from - First day to include, `YYYY-MM-DD`.
 * @param input.to - Last day to include (inclusive), `YYYY-MM-DD`.
 * @param input.now - Reference instant for the horizon (injectable).
 * @returns `{ ok: true, range }` or `{ ok: false, message }`.
 */
export function resolveChatDateRange(input: {
    readonly from?: string;
    readonly to?: string;
    readonly now?: Date;
}): ResolveChatDateRangeOutput {
    if (input.from !== undefined && input.to !== undefined && input.from > input.to) {
        return { ok: false, message: 'from must be on or before to' };
    }
    const now = input.now ?? new Date();
    const latestTo = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);
    if (input.to !== undefined && input.to > latestTo) {
        // Also keeps `to` + 1 day a well-formed timestamp (year 9999 overflows to a 6-digit year).
        return { ok: false, message: 'to cannot be in the future' };
    }
    const lowerBound =
        input.from === undefined ? undefined : new Date(`${input.from}T00:00:00.000Z`);
    const upperExclusive =
        input.to === undefined
            ? undefined
            : new Date(new Date(`${input.to}T00:00:00.000Z`).getTime() + DAY_MS);
    const { cutoff } = retentionCutoff({ now });
    if (lowerBound !== undefined && lowerBound < startOfDay({ date: cutoff })) {
        return { ok: false, message: 'from is older than the 12 month retention horizon' };
    }
    return { ok: true, range: { lowerBound, upperExclusive } };
}

function startOfDay(input: { readonly date: Date }): Date {
    return new Date(
        Date.UTC(input.date.getUTCFullYear(), input.date.getUTCMonth(), input.date.getUTCDate())
    );
}
