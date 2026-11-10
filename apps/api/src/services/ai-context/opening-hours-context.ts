/**
 * Renders a listing's `opening_hours` JSONB for the AI-chat context (HOS-2095).
 *
 * The column's real shape is `OpeningHoursSchema` from `@repo/schemas`:
 * `{ timezone, days: { mon: { closed, shifts: [{ open, close }] }, … }, notes?,
 * notesI18n? }`. The venue assembler used to iterate the top-level keys and keep
 * only string values, so for every real row it rendered `timezone:
 * America/Argentina/Buenos_Aires` and NOT ONE opening hour — the bot could not
 * answer "¿a qué hora abren?". This module reads the real shape, labels the
 * days with the same `venue.detail.openingHours.*` keys the public page uses,
 * and still accepts the legacy flat `{ day: "18:00-02:00" }` map.
 *
 * Day labels and shift times are closed values (validated `HH:mm`), so they
 * render unfenced; the owner's free-text `notes` are returned SEPARATELY so the
 * caller fences them like any other owner text.
 *
 * @module apps/api/services/ai-context/opening-hours-context
 */

import type { Locale } from '@repo/i18n';
import { translateCatalogKey } from './listing-labels.js';
import { sanitizeOwnerDelimiters, truncateAtWord } from './owner-data-fence.js';

/** Validated `HH:mm` shape; anything else is dropped, never rendered (HOS-2095 review). */
const HH_MM = /^\d{2}:\d{2}$/;

/** Cap on the owner's free-text schedule notes (the schema leaves them unbounded). */
const NOTES_MAX_CHARS = 500;

/**
 * Phrase for a day the schedule does not inform. Written in Spanish like the
 * rest of the block's own scaffolding; it exists so the model never reads a
 * missing day as "closed".
 */
const DAY_NOT_INFORMED = 'sin información';

/** Top-level keys of the real shape that are never a day in the legacy flat map. */
const NON_DAY_KEYS: ReadonlySet<string> = new Set(['timezone', 'notes', 'notesI18n', 'days']);

/** Weekday keys of `OpeningHoursSchema.days`, in display order. */
const DAY_KEYS = [
    ['mon', 'monday'],
    ['tue', 'tuesday'],
    ['wed', 'wednesday'],
    ['thu', 'thursday'],
    ['fri', 'friday'],
    ['sat', 'saturday'],
    ['sun', 'sunday']
] as const;

/** Translation key prefix shared with the public venue page. */
const KEY_PREFIX = 'venue.detail.openingHours';

/** Narrows an unknown value to a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Renders one `DaySchedule` as "Cerrado" or "12:00–15:00, 20:00–00:00". */
function formatDay(day: Record<string, unknown>, closedLabel: string): string | null {
    if (day.closed === true) return closedLabel;
    const shifts = Array.isArray(day.shifts) ? day.shifts : [];
    const windows = shifts
        .filter(isRecord)
        .filter(
            (shift) =>
                typeof shift.open === 'string' &&
                typeof shift.close === 'string' &&
                HH_MM.test(shift.open) &&
                HH_MM.test(shift.close)
        )
        .map((shift) => `${String(shift.open)}–${String(shift.close)}`);
    return windows.length > 0 ? windows.join(', ') : null;
}

/** Resolves the owner's schedule notes to the locale, falling back to `es`, then `notes`. */
function resolveNotes(hours: Record<string, unknown>, locale: Locale): string | null {
    const i18n = isRecord(hours.notesI18n) ? hours.notesI18n : {};
    for (const candidate of [i18n[locale], i18n.es, hours.notes]) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return truncateAtWord(candidate.trim(), NOTES_MAX_CHARS);
        }
    }
    return null;
}

/**
 * Builds the opening-hours lines.
 *
 * @param input.openingHours - The raw JSONB value.
 * @param input.locale - Page locale for the day labels.
 * @returns `{ lines, notes }`: one `Día: horario` line per readable day, and the
 *   owner's free-text notes (UNSANITIZED and unfenced — the caller fences them),
 *   or `null`.
 */
export function buildOpeningHoursLines({
    openingHours,
    locale
}: {
    readonly openingHours: unknown;
    readonly locale: Locale;
}): { readonly lines: readonly string[]; readonly notes: string | null } {
    if (!isRecord(openingHours)) return { lines: [], notes: null };

    if (isRecord(openingHours.days)) {
        const days = openingHours.days;
        const closedLabel =
            translateCatalogKey({ key: `${KEY_PREFIX}.closed`, locale }).label ?? 'Cerrado';
        const lines: string[] = [];
        for (const [key, name] of DAY_KEYS) {
            const day = days[key];
            // A missing day, or one with no valid shift, is stated as NOT INFORMED:
            // omitting it would let the model read the gap as "closed".
            const schedule = isRecord(day) ? formatDay(day, closedLabel) : null;
            const label =
                translateCatalogKey({ key: `${KEY_PREFIX}.${name}`, locale }).label ?? key;
            lines.push(`${label}: ${schedule ?? DAY_NOT_INFORMED}`);
        }
        return { lines, notes: resolveNotes(openingHours, locale) };
    }

    // Legacy flat map: `{ "lunes": "18:00-02:00" }`. Keys are owner-influenced in
    // principle, so both sides are sanitized. The real shape's own keys are
    // skipped (HOS-2095 review): a row with `timezone`/`notes` but no `days`
    // used to re-render the timezone and put the owner's notes OUTSIDE the fence.
    // Notes always travel in `notes`, which the caller fences.
    const lines: string[] = [];
    for (const [day, value] of Object.entries(openingHours)) {
        if (NON_DAY_KEYS.has(day)) continue;
        if (typeof value === 'string' && value.trim().length > 0) {
            lines.push(
                `${sanitizeOwnerDelimiters(day)}: ${truncateAtWord(sanitizeOwnerDelimiters(value), 120)}`
            );
        }
    }
    return { lines, notes: resolveNotes(openingHours, locale) };
}
