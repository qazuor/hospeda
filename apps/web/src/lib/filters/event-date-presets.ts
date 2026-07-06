/**
 * @file event-date-presets.ts
 * @description Pure date-range helpers for the events "when" temporal
 * quick-filter (BETA-115: folded into the sidebar's `date` filter group as
 * preset pills instead of a standalone chip row —
 * `@/components/event/EventDateFilterChips.astro`, now retired).
 *
 * Two representations of the same semantics are exposed on purpose:
 *
 * - {@link computeWhenQueryBounds} — full-precision ISO datetime bounds,
 *   used to query the events API directly. Ported verbatim from the switch
 *   statement that used to be duplicated in both `eventos/index.astro` and
 *   `eventos/categoria/[category]/index.astro`.
 * - {@link computeEventDatePresetRange} — day-granularity ISO `YYYY-MM-DD`
 *   bounds, the representation understood by the sidebar's `date-range`
 *   filter group in `mode='bounds'` (see `DateRangeFilterConfig.presets`).
 * - {@link resolveWhenAliasParams} — the shared `sidebarInitialParams` alias
 *   builder used by both `eventos/index.astro` and
 *   `eventos/categoria/[category]/index.astro` to translate a legacy
 *   `?when=X` URL into the sidebar's hydrated
 *   `startDateAfter`/`startDateBefore` initial state on page load
 *   (back-compat for old shared/indexed links).
 *
 * All three take an explicit `now` so callers (and tests) can pin the
 * reference instant instead of depending on the real clock.
 */

/** Valid values for the (legacy, still URL-accepted) `when` quick-filter param. */
export type EventDateFilter = 'all' | 'today' | 'week' | 'month' | 'next60' | 'past';

/** Day-granularity ISO `YYYY-MM-DD` bounds. Empty string means "no bound". */
export interface EventDatePresetRange {
    readonly from: string;
    readonly to: string;
}

/** Full-precision ISO datetime bounds for querying the events API. `undefined` means "no bound". */
export interface EventDateQueryBounds {
    readonly startDateAfter: string | undefined;
    readonly startDateBefore: string | undefined;
}

/** All non-default `when` values (i.e. excluding `'all'`) — used to validate the URL param. */
export const EVENT_DATE_FILTER_VALUES: ReadonlyArray<EventDateFilter> = [
    'today',
    'week',
    'month',
    'next60',
    'past'
];

/**
 * Ordered temporal preset definitions — value, i18n key, and Spanish
 * fallback. Reused to build the sidebar's date-range preset pills (see
 * `buildEventsFilterGroups` in `./events-filter-groups`). Reuses the exact
 * `events.dateFilters.*` i18n keys the retired chip row used to read.
 */
export const EVENT_DATE_PRESET_DEFS: ReadonlyArray<{
    readonly value: EventDateFilter;
    readonly i18nKey: string;
    readonly fallback: string;
}> = [
    { value: 'all', i18nKey: 'events.dateFilters.all', fallback: 'Todos' },
    { value: 'today', i18nKey: 'events.dateFilters.today', fallback: 'Hoy' },
    { value: 'week', i18nKey: 'events.dateFilters.week', fallback: 'Esta semana' },
    { value: 'month', i18nKey: 'events.dateFilters.month', fallback: 'Este mes' },
    { value: 'next60', i18nKey: 'events.dateFilters.next60', fallback: 'Próximos 60 días' },
    { value: 'past', i18nKey: 'events.dateFilters.past', fallback: 'Pasados' }
];

/** Returns a copy of `date` at 00:00:00.000 local time. */
function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Returns a copy of `date` at 23:59:59.999 local time. */
function endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

/** Returns a date `days` after `startOfDay(date)`, at 23:59:59.999 local time. */
function daysAheadEndOfDay(date: Date, days: number): Date {
    const d = startOfDay(date);
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d;
}

/** Format a Date as ISO `YYYY-MM-DD` in local time (no TZ shift). */
function toIsoDay(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Full-precision ISO datetime bounds for a `when` value. Used directly as
 * `startDateAfter`/`startDateBefore` on the events API query — mirrors the
 * original `EventDateFilterChips`-era switch statement exactly:
 * `today` = [startOfDay, endOfDay]; `week`/`month`/`next60` = [startOfDay,
 * +N days end-of-day]; `past` = [undefined, startOfDay] (only an upper
 * bound); `all` = [undefined, undefined].
 */
export function computeWhenQueryBounds({
    when,
    now = new Date()
}: {
    readonly when: EventDateFilter;
    readonly now?: Date;
}): EventDateQueryBounds {
    switch (when) {
        case 'today':
            return {
                startDateAfter: startOfDay(now).toISOString(),
                startDateBefore: endOfDay(now).toISOString()
            };
        case 'week':
            return {
                startDateAfter: startOfDay(now).toISOString(),
                startDateBefore: daysAheadEndOfDay(now, 7).toISOString()
            };
        case 'month':
            return {
                startDateAfter: startOfDay(now).toISOString(),
                startDateBefore: daysAheadEndOfDay(now, 30).toISOString()
            };
        case 'next60':
            return {
                startDateAfter: startOfDay(now).toISOString(),
                startDateBefore: daysAheadEndOfDay(now, 60).toISOString()
            };
        case 'past':
            return { startDateAfter: undefined, startDateBefore: startOfDay(now).toISOString() };
        default:
            return { startDateAfter: undefined, startDateBefore: undefined };
    }
}

/**
 * Day-granularity ISO `YYYY-MM-DD` bounds for a `when` value.
 *
 * `past` resolves its upper bound to YESTERDAY (not today): the sidebar's
 * `date-range` filter widens a bounds-mode `to` value to `${to}T23:59:59`
 * before it reaches the API (see `eventos/index.astro`), so anchoring on
 * yesterday reproduces the exact same cutoff as
 * {@link computeWhenQueryBounds}'s `startOfDay(now)` — today's events stay
 * excluded from "Pasados", matching the original chip-row semantics.
 */
export function computeEventDatePresetRange({
    when,
    now = new Date()
}: {
    readonly when: EventDateFilter;
    readonly now?: Date;
}): EventDatePresetRange {
    switch (when) {
        case 'today':
            return { from: toIsoDay(now), to: toIsoDay(now) };
        case 'week':
            return { from: toIsoDay(now), to: toIsoDay(daysAheadEndOfDay(now, 7)) };
        case 'month':
            return { from: toIsoDay(now), to: toIsoDay(daysAheadEndOfDay(now, 30)) };
        case 'next60':
            return { from: toIsoDay(now), to: toIsoDay(daysAheadEndOfDay(now, 60)) };
        case 'past': {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            return { from: '', to: toIsoDay(yesterday) };
        }
        default:
            return { from: '', to: '' };
    }
}

/** Partial alias params — only the bound(s) that should be written into `sidebarInitialParams`. */
export type WhenAliasParams = Partial<Record<'startDateAfter' | 'startDateBefore', string>>;

/**
 * Resolves the `sidebarInitialParams` entries a legacy `?when=X` URL should
 * seed on page load — the shared implementation behind the back-compat alias
 * in both `eventos/index.astro` and `eventos/categoria/[category]/index.astro`
 * (previously copy-pasted in both files).
 *
 * Only produces an alias when there is no ALREADY-explicit sidebar date
 * selection (`hasExplicitBounds`) and `when` isn't the no-op `'all'` — in
 * either of those cases the sidebar's own state must win, so this returns an
 * empty object (no override). Otherwise resolves the same day-granularity
 * `YYYY-MM-DD` bounds {@link computeEventDatePresetRange} uses for the preset
 * pills, so the matching pill lights up as active on hydration.
 */
export function resolveWhenAliasParams({
    when,
    now = new Date(),
    hasExplicitBounds
}: {
    readonly when: EventDateFilter;
    readonly now?: Date;
    readonly hasExplicitBounds: boolean;
}): WhenAliasParams {
    if (hasExplicitBounds || when === 'all') return {};

    const range = computeEventDatePresetRange({ when, now });
    const alias: { startDateAfter?: string; startDateBefore?: string } = {};
    if (range.from) alias.startDateAfter = range.from;
    if (range.to) alias.startDateBefore = range.to;
    return alias;
}
