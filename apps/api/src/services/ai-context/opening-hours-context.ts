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
import { sanitizeOwnerDelimiters } from './owner-data-fence.js';

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
        .filter((shift) => typeof shift.open === 'string' && typeof shift.close === 'string')
        .map(
            (shift) =>
                `${sanitizeOwnerDelimiters(String(shift.open))}–${sanitizeOwnerDelimiters(String(shift.close))}`
        );
    return windows.length > 0 ? windows.join(', ') : null;
}

/** Resolves the owner's schedule notes to the locale, falling back to `es`, then `notes`. */
function resolveNotes(hours: Record<string, unknown>, locale: Locale): string | null {
    const i18n = isRecord(hours.notesI18n) ? hours.notesI18n : {};
    for (const candidate of [i18n[locale], i18n.es, hours.notes]) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
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
            if (!isRecord(day)) continue;
            const schedule = formatDay(day, closedLabel);
            if (!schedule) continue;
            const label =
                translateCatalogKey({ key: `${KEY_PREFIX}.${name}`, locale }).label ?? key;
            lines.push(`${label}: ${schedule}`);
        }
        return { lines, notes: resolveNotes(openingHours, locale) };
    }

    // Legacy flat map: `{ "lunes": "18:00-02:00" }`. Keys are owner-influenced in
    // principle, so both sides are sanitized.
    const lines: string[] = [];
    for (const [day, value] of Object.entries(openingHours)) {
        if (typeof value === 'string' && value.trim().length > 0) {
            lines.push(`${sanitizeOwnerDelimiters(day)}: ${sanitizeOwnerDelimiters(value)}`);
        }
    }
    return { lines, notes: null };
}
