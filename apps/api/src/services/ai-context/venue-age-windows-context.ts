/**
 * Resolves the venue minimum-age scope into explicit time windows for the
 * AI-chat context (HOS-2098, owner decision 10/11/2026).
 *
 * gpt-5.4-nano read "Rige desde las 00:00 hasta el cierre" as covering the
 * whole opening day, and no wording of the rules fixed it reliably. So the
 * arithmetic moved into code: this module takes the stored scope and the
 * venue's `openingHours` and prints, per opening day, which windows carry the
 * minimum age and which do not. The model only has to look a time up.
 *
 * ## The opening day
 *
 * A `from_time` scope runs "from `from` through closing, INCLUDING the hours
 * after midnight until the venue closes; only the hours of the same opening
 * day BEFORE `from` are outside it" (`VenueMinAgeScopeSchema`). To make "the
 * same opening day" computable, an opening day runs from
 * {@link OPENING_DAY_START_MINUTES} (06:00) to 06:00 of the next calendar day:
 *
 * - a clock time before 06:00 belongs to the NIGHT of the opening day, so it
 *   sits after 23:59 on the opening-day axis. That is why a scope of 00:00 is
 *   midnight (the END of the evening), never the start of the day, and why a
 *   Friday shift stored as 00:30–05:30 is a late-night shift;
 * - a shift whose close is earlier than its open runs past midnight.
 *
 * Times are wall-clock times in the venue's own timezone (the one stored in
 * `openingHours.timezone`); nothing is converted, so the timezone never moves a
 * window.
 *
 * ## Conservative by construction
 *
 * A window is printed as having no minimum age ONLY when it was computed from
 * a readable shift and lies before the scope time. Everything else falls back
 * to "the minimum age applies at every hour": an `all_day` or unset scope, no
 * or unreadable opening hours, the legacy flat hours map, a day without
 * information, a day with one malformed shift. This module never invents a
 * free window.
 *
 * @module apps/api/services/ai-context/venue-age-windows-context
 */

import type { Locale } from '@repo/i18n';
import { translateCatalogKey } from './listing-labels.js';
import { fenceOwnerValue } from './owner-data-fence.js';

/** Minutes in a day. */
const DAY_MINUTES = 1440;

/** Where an opening day starts: clock times before 06:00 belong to the previous night. */
export const OPENING_DAY_START_MINUTES = 360;

/** Validated `HH:mm` shape (00:00–23:59). */
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Bold label of the resolved block; Spanish like every other label of the context. */
export const AGE_WINDOWS_LABEL = '**Edad mínima por horario y sector**';

/** Weekday keys of `OpeningHoursSchema.days` and their i18n day names, in display order. */
const DAY_KEYS = [
    ['mon', 'monday'],
    ['tue', 'tuesday'],
    ['wed', 'wednesday'],
    ['thu', 'thursday'],
    ['fri', 'friday'],
    ['sat', 'saturday'],
    ['sun', 'sunday']
] as const;

/** One window on the opening-day axis, in minutes from 00:00 of the opening day. */
interface AxisWindow {
    readonly start: number;
    readonly end: number;
    readonly covered: boolean;
}

/** The locale-specific wording of the resolved lines. */
interface AgeWindowPhrases {
    readonly heading: string;
    readonly free: string;
    readonly covered: (age: number) => string;
    readonly everyHour: (age: number) => string;
    readonly hoursUnusable: (age: number) => string;
    readonly dayWithoutInfo: (day: string, age: number) => string;
    readonly areaCovered: (area: string, age: number) => string;
    readonly areaElsewhere: string;
    readonly range: (start: string, end: string) => string;
    readonly afterMidnight: string;
    readonly midnight: string;
    readonly endAfterMidnight: string;
}

/** Wording per locale. "sin edad mínima informada" is what the rules key "sí" on. */
const PHRASES: Readonly<Record<Locale, AgeWindowPhrases>> = {
    es: {
        heading: `${AGE_WINDOWS_LABEL} (ya calculado a partir de los horarios y del alcance):`,
        free: 'sin edad mínima informada',
        covered: (age) => `edad mínima ${age}`,
        everyHour: (age) =>
            `Todos los días, a toda hora (mediodía, tarde y noche) y en todo el local: edad mínima ${age}`,
        hoursUnusable: (age) =>
            `Todos los días, a toda hora y en todo el local: edad mínima ${age} (los horarios cargados no permiten calcular otra cosa)`,
        dayWithoutInfo: (day, age) =>
            `${day}, horario sin información, a toda hora: edad mínima ${age}`,
        areaCovered: (area, age) => `En ${area}, a toda hora: edad mínima ${age}`,
        areaElsewhere: 'En el resto del local y en otras actividades: sin edad mínima informada',
        range: (start, end) => `de ${start} a ${end}`,
        afterMidnight: 'pasada la medianoche',
        midnight: '00:00 (medianoche)',
        endAfterMidnight: 'pasada la medianoche'
    },
    en: {
        heading: `${AGE_WINDOWS_LABEL} (already computed from the opening hours and the scope):`,
        free: 'no minimum age stated',
        covered: (age) => `minimum age ${age}`,
        everyHour: (age) =>
            `Every day, at every hour (midday, afternoon and night) and in the whole venue: minimum age ${age}`,
        hoursUnusable: (age) =>
            `Every day, at every hour and in the whole venue: minimum age ${age} (the saved opening hours do not allow computing anything else)`,
        dayWithoutInfo: (day, age) =>
            `${day}, hours not informed, at every hour: minimum age ${age}`,
        areaCovered: (area, age) => `In ${area}, at every hour: minimum age ${age}`,
        areaElsewhere: 'In the rest of the venue and in other activities: no minimum age stated',
        range: (start, end) => `from ${start} to ${end}`,
        afterMidnight: 'after midnight',
        midnight: '00:00 (midnight)',
        endAfterMidnight: 'after midnight'
    },
    pt: {
        heading: `${AGE_WINDOWS_LABEL} (já calculado a partir dos horários e do alcance):`,
        free: 'sem idade mínima informada',
        covered: (age) => `idade mínima ${age}`,
        everyHour: (age) =>
            `Todos os dias, a qualquer hora (meio-dia, tarde e noite) e em todo o local: idade mínima ${age}`,
        hoursUnusable: (age) =>
            `Todos os dias, a qualquer hora e em todo o local: idade mínima ${age} (os horários cadastrados não permitem calcular outra coisa)`,
        dayWithoutInfo: (day, age) =>
            `${day}, horário sem informação, a qualquer hora: idade mínima ${age}`,
        areaCovered: (area, age) => `Em ${area}, a qualquer hora: idade mínima ${age}`,
        areaElsewhere: 'No resto do local e em outras atividades: sem idade mínima informada',
        range: (start, end) => `das ${start} às ${end}`,
        afterMidnight: 'depois da meia-noite',
        midnight: '00:00 (meia-noite)',
        endAfterMidnight: 'depois da meia-noite'
    }
};

/** Narrows an unknown value to a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `HH:mm` → minutes since 00:00. The caller has validated the shape. */
function toMinutes(value: string): number {
    const [hours, minutes] = value.split(':');
    return Number(hours) * 60 + Number(minutes);
}

/** Minutes → `HH:mm`, wrapping at 24 h. */
function toClock(minutes: number): string {
    const wrapped = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
    const mm = String(wrapped % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

/**
 * Places a clock time on the opening-day axis: before 06:00 it belongs to the
 * night, after 23:59.
 */
function toAxis(clockMinutes: number): number {
    return clockMinutes < OPENING_DAY_START_MINUTES ? clockMinutes + DAY_MINUTES : clockMinutes;
}

/**
 * Splits one shift into opening-day-axis segments.
 *
 * The shift is first laid out on a 48 h clock (close earlier than open runs
 * past midnight). Its part before 06:00 of the opening day is moved to the
 * night; the rest keeps its position (a part past 24:00 already sits after
 * the evening).
 */
function shiftToAxisSegments(open: number, close: number): Array<{ start: number; end: number }> {
    const end = close > open ? close : close + DAY_MINUTES;
    const segments: Array<{ start: number; end: number }> = [];
    if (open < OPENING_DAY_START_MINUTES) {
        const earlyEnd = Math.min(end, OPENING_DAY_START_MINUTES);
        segments.push({ start: toAxis(open), end: earlyEnd + DAY_MINUTES });
        if (end > OPENING_DAY_START_MINUTES) {
            segments.push({ start: OPENING_DAY_START_MINUTES, end });
        }
    } else {
        segments.push({ start: open, end });
    }
    return segments;
}

/** Reads the valid shifts of one day, or `null` when the day is not readable. */
function readShifts(
    day: unknown
):
    | { readonly closed: true }
    | { readonly closed: false; readonly shifts: Array<[number, number]> }
    | null {
    if (!isRecord(day)) return null;
    if (day.closed === true) return { closed: true };
    const raw = Array.isArray(day.shifts) ? day.shifts : [];
    const shifts: Array<[number, number]> = [];
    for (const shift of raw) {
        // One malformed shift makes the whole day unreadable: dropping it could
        // turn a covered hour into a gap the model reads as free.
        if (
            !isRecord(shift) ||
            typeof shift.open !== 'string' ||
            typeof shift.close !== 'string' ||
            !HH_MM.test(shift.open) ||
            !HH_MM.test(shift.close) ||
            shift.open === shift.close
        ) {
            return null;
        }
        shifts.push([toMinutes(shift.open), toMinutes(shift.close)]);
    }
    return shifts.length > 0 ? { closed: false, shifts } : null;
}

/** Cuts the day's shifts at the scope time and merges touching windows of the same kind. */
function dayWindows(shifts: ReadonlyArray<[number, number]>, scopeAxis: number): AxisWindow[] {
    const windows: AxisWindow[] = [];
    for (const [open, close] of shifts) {
        for (const segment of shiftToAxisSegments(open, close)) {
            if (segment.start < scopeAxis) {
                windows.push({
                    start: segment.start,
                    end: Math.min(segment.end, scopeAxis),
                    covered: false
                });
            }
            if (segment.end > scopeAxis) {
                windows.push({
                    start: Math.max(segment.start, scopeAxis),
                    end: segment.end,
                    covered: true
                });
            }
        }
    }
    windows.sort((a, b) => a.start - b.start || Number(a.covered) - Number(b.covered));
    const merged: AxisWindow[] = [];
    for (const window of windows) {
        const last = merged[merged.length - 1];
        if (last && last.covered === window.covered && window.start <= last.end) {
            merged[merged.length - 1] = { ...last, end: Math.max(last.end, window.end) };
        } else {
            merged.push(window);
        }
    }
    return merged;
}

/** Renders one axis window as "Sábado de 21:00 a 00:00 (medianoche)". */
function formatWindow(day: string, window: AxisWindow, phrases: AgeWindowPhrases): string {
    if (window.start >= DAY_MINUTES) {
        return `${day}, ${phrases.afterMidnight}, ${phrases.range(toClock(window.start), toClock(window.end))}`;
    }
    let end: string;
    if (window.end === DAY_MINUTES) {
        end = phrases.midnight;
    } else if (window.end > DAY_MINUTES) {
        end = `${toClock(window.end)} (${phrases.endAfterMidnight})`;
    } else {
        end = toClock(window.end);
    }
    return `${day} ${phrases.range(toClock(window.start), end)}`;
}

/** The scope as this module consumes it: the resolved kind plus its raw data. */
export interface AgeWindowsScope {
    readonly kind: 'all_day' | 'from_time' | 'area';
    /** `HH:mm` of a `from_time` scope, otherwise `null`. */
    readonly from: string | null;
    /** Owner-authored area of an `area` scope (unfenced), otherwise `null`. */
    readonly area: string | null;
}

/**
 * Builds the resolved minimum-age lines (HOS-2098).
 *
 * PURE and RO-RO. The first line is the {@link AGE_WINDOWS_LABEL} heading; the
 * rest are `- ` list items in the page locale.
 *
 * @param input.minAge - The venue's minimum age.
 * @param input.scope - The resolved scope (`all_day` also covers an unset one).
 * @param input.openingHours - The raw `opening_hours` JSONB value.
 * @param input.locale - Page locale for the wording and the day names.
 * @returns `{ lines }`, ready to append to the context block.
 */
export function buildVenueAgeWindowLines({
    minAge,
    scope,
    openingHours,
    locale
}: {
    readonly minAge: number;
    readonly scope: AgeWindowsScope;
    readonly openingHours: unknown;
    readonly locale: Locale;
}): { readonly lines: readonly string[] } {
    const phrases = PHRASES[locale] ?? PHRASES.es;
    const lines: string[] = [phrases.heading];

    if (scope.kind === 'area' && scope.area !== null) {
        lines.push(`- ${phrases.areaCovered(fenceOwnerValue(scope.area), minAge)}`);
        lines.push(`- ${phrases.areaElsewhere}`);
        return { lines };
    }

    if (scope.kind !== 'from_time' || scope.from === null || !HH_MM.test(scope.from)) {
        lines.push(`- ${phrases.everyHour(minAge)}`);
        return { lines };
    }

    const days = isRecord(openingHours) && isRecord(openingHours.days) ? openingHours.days : null;
    if (days === null) {
        lines.push(`- ${phrases.hoursUnusable(minAge)}`);
        return { lines };
    }

    const scopeAxis = toAxis(toMinutes(scope.from));
    const dayLines: string[] = [];
    let anyOpenDay = false;
    for (const [key, name] of DAY_KEYS) {
        const label =
            translateCatalogKey({ key: `venue.detail.openingHours.${name}`, locale }).label ?? key;
        const schedule = readShifts(days[key]);
        if (schedule === null) {
            dayLines.push(`- ${phrases.dayWithoutInfo(label, minAge)}`);
            continue;
        }
        if (schedule.closed) continue;
        anyOpenDay = true;
        for (const window of dayWindows(schedule.shifts, scopeAxis)) {
            const status = window.covered ? phrases.covered(minAge) : phrases.free;
            dayLines.push(`- ${formatWindow(label, window, phrases)}: ${status}`);
        }
    }

    if (!anyOpenDay) {
        lines.push(`- ${phrases.hoursUnusable(minAge)}`);
        return { lines };
    }
    lines.push(...dayLines);
    return { lines };
}
