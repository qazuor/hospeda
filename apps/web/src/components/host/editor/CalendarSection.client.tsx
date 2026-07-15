/**
 * @file CalendarSection.client.tsx
 * @description Occupancy calendar section for the accommodation editor
 * (HOS-43 Phase 1).
 *
 * Renders a monthly grid, starting at the current month, with forward-only
 * navigation (occupancy is future-facing — past months are never shown).
 * The host marks days occupied/free with a "click start, click end" range
 * interaction (documented below) and applies the change via the batch
 * endpoint. Sync-sourced days (Google Calendar / Airbnb / Booking, Phase 2/3)
 * render as occupied with their origin but are never togglable from this UI
 * (US-3) — only `source=MANUAL` rows can be created/removed here.
 *
 * Interaction model — "click start, click end" (not click-drag):
 * 1. Click a day with no pending selection -> it becomes the pending range
 *    start (highlighted).
 * 2. Click any other day (or the same day again, for a single-day
 *    selection) -> the inclusive range between the two is selected and an
 *    action bar appears with "Block" / "Free up" / "Cancel".
 * 3. Clicking a day again while a confirmed selection is showing starts a
 *    fresh selection (implicit cancel-and-restart) — there is no separate
 *    "locked" state to reason about.
 *
 * Click-drag was considered and rejected: it requires tracking pointer
 * move across many small cells (fragile on touch), has no natural keyboard
 * equivalent, and is harder to drive from tests. Click-start/click-end works
 * identically with mouse, touch, and keyboard (Enter/Space on a focused
 * cell), and a single day is just a range collapsed to one cell.
 *
 * Source-scoped occupancy (HOS-162 Phase 3): a date can carry MULTIPLE rows
 * (one per source — unique index `(accommodationId, date, source)`). Rows are
 * grouped by date and a single "primary" row is resolved per date by source
 * priority — see `lib/calendar/occupancy-row-grouping.ts`.
 */

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import type { AccommodationOccupancy } from '@repo/schemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accommodationOccupancyApi } from '@/lib/api/endpoints-protected';
import {
    buildOccupancyEvents,
    layoutWeekBars,
    MAX_VISIBLE_LANES,
    type OccupancyEvent,
    resolveWeekOverflow
} from '@/lib/calendar/occupancy-bar-layout';
import {
    addMonths,
    buildDateRangeKeys,
    buildMonthGrid,
    compareMonths,
    type DateKey,
    getStartOfMonth,
    toDateKey
} from '@/lib/calendar/occupancy-calendar-grid';
import {
    groupOccupancyRowsByDate,
    resolvePrimaryOccupancyRow
} from '@/lib/calendar/occupancy-row-grouping';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { CalendarDayCell, sourceFallbackLabel, sourceKeySuffix } from './CalendarDayCell.client';
import { CalendarLegend } from './CalendarLegend.client';
import styles from './CalendarSection.module.css';
import { CalendarSyncLauncher } from './CalendarSyncLauncher.client';
import {
    OccupancyEventEditDialog,
    type OccupancyEventEditSave
} from './OccupancyEventEditDialog.client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for CalendarSection. */
export interface CalendarSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

// ---------------------------------------------------------------------------
// Bar helpers (HOS-162 prototype — spanning event bars)
// ---------------------------------------------------------------------------

/** CSS-module class for an event bar, keyed by occupancy source. */
function barSourceClass(source: OccupancyEvent['source']): string {
    switch (sourceKeySuffix(source)) {
        case 'google':
            return styles.barGoogle;
        case 'airbnb':
            return styles.barAirbnb;
        case 'booking':
            return styles.barBooking;
        case 'other':
            return styles.barOther;
        default:
            return styles.barManual;
    }
}

/**
 * The text shown inside an event bar: the event's own title (prototype: the
 * `note` stand-in for a future persisted `event_title`) when present, else a
 * per-provider fallback label so Airbnb/Booking feeds that expose no useful
 * `SUMMARY` still read as "<Provider>".
 */
function barLabel({
    event,
    t
}: {
    readonly event: OccupancyEvent;
    readonly t: TranslationFn;
}): string {
    const title = event.title?.trim();
    if (title) return title;
    return t(
        `host.properties.editor.calendar.source.${sourceKeySuffix(event.source)}`,
        sourceFallbackLabel(event.source)
    );
}

/** Splits a flat grid-cell list into consecutive weeks of 7 cells each. */
function chunkWeeks(cells: readonly (Date | null)[]): readonly (readonly (Date | null)[])[] {
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Occupancy calendar section.
 *
 * Fetches occupancy rows for the currently-viewed month on mount and on
 * every month navigation. Mutations always go through the batch endpoint —
 * a single day is simply a one-element date list, so there is only one
 * mutation code path to reason about and test.
 */
export function CalendarSection({ locale, accommodationId }: CalendarSectionProps) {
    const { t, tPlural } = createTranslations(locale);

    // --- Month being viewed ---
    const [viewedMonth, setViewedMonth] = useState<Date>(() =>
        getStartOfMonth({ date: new Date() })
    );
    const minMonth = useMemo(() => getStartOfMonth({ date: new Date() }), []);
    const canGoPrev = compareMonths({ a: viewedMonth, b: minMonth }) > 0;

    // --- Occupancy data for the viewed month, grouped by date (HOS-162: a
    //     date may carry multiple rows, one per source) ---
    const [occupancyByDate, setOccupancyByDate] = useState<
        Readonly<Record<DateKey, readonly AccommodationOccupancy[]>>
    >({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // --- Range selection state ---
    const [pendingStart, setPendingStart] = useState<DateKey | null>(null);
    const [selection, setSelection] = useState<readonly DateKey[] | null>(null);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // --- Manual-event edit dialog (HOS-175) ---
    const [editingEvent, setEditingEvent] = useState<OccupancyEvent | null>(null);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    // Bumped after any mutation to force the viewed month to re-fetch.
    const [reloadKey, setReloadKey] = useState(0);

    // --- Fetch occupancy for the viewed month ---
    // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is an intentional manual refetch trigger (bumped after an edit/delete), not read inside the effect body
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setLoadError(false);

        const from = toDateKey({ date: viewedMonth });
        const to = toDateKey({ date: addMonths({ date: viewedMonth, delta: 1 }) });

        accommodationOccupancyApi
            .list({ id: accommodationId, from, to })
            .then((result) => {
                if (cancelled) return;
                if (!result.ok) {
                    webLogger.warn('[CalendarSection] list failed:', result.error);
                    setLoadError(true);
                    setIsLoading(false);
                    return;
                }
                setOccupancyByDate(groupOccupancyRowsByDate({ rows: result.data.occupancy }));
                setIsLoading(false);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                webLogger.warn('[CalendarSection] list error:', err);
                setLoadError(true);
                setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [accommodationId, viewedMonth, reloadKey]);

    // --- Month navigation ---

    const handlePrevMonth = useCallback(() => {
        setViewedMonth((prev) => {
            const target = addMonths({ date: prev, delta: -1 });
            return compareMonths({ a: target, b: minMonth }) < 0 ? prev : target;
        });
    }, [minMonth]);

    const handleNextMonth = useCallback(() => {
        setViewedMonth((prev) => addMonths({ date: prev, delta: 1 }));
    }, []);

    // --- Range selection ---

    const handleDayClick = useCallback(
        (dateKey: DateKey) => {
            setSubmitError(null);
            if (pendingStart) {
                setSelection(buildDateRangeKeys({ startKey: pendingStart, endKey: dateKey }));
                setPendingStart(null);
            } else {
                setSelection(null);
                setPendingStart(dateKey);
            }
        },
        [pendingStart]
    );

    const handleCancelSelection = useCallback(() => {
        setPendingStart(null);
        setSelection(null);
        setNote('');
        setSubmitError(null);
    }, []);

    const handleApply = useCallback(
        async (isBlocked: boolean) => {
            if (!selection || selection.length === 0) return;

            setIsSubmitting(true);
            setSubmitError(null);

            const result = await accommodationOccupancyApi.batchToggle({
                id: accommodationId,
                dates: selection,
                isBlocked,
                note: isBlocked && note.trim() ? note.trim() : undefined
            });

            if (result.ok) {
                // Response covers EVERY row (any source) for the requested
                // dates, so delete-then-repopulate per date stays accurate.
                const grouped = groupOccupancyRowsByDate({ rows: result.data.occupancy });
                setOccupancyByDate((prev) => {
                    const next = { ...prev };
                    for (const dateKey of selection) {
                        delete next[dateKey];
                    }
                    return { ...next, ...grouped };
                });
                setSelection(null);
                setPendingStart(null);
                setNote('');
            } else {
                setSubmitError(
                    result.error.message ||
                        t(
                            'host.properties.editor.calendar.applyError',
                            'No pudimos actualizar el calendario. Intentá de nuevo.'
                        )
                );
            }
            setIsSubmitting(false);
        },
        [selection, accommodationId, note, t]
    );

    // --- Manual-event edit / delete ---

    const handleEditSave = useCallback(
        async ({ newStartDate, newEndDate, note: newNote }: OccupancyEventEditSave) => {
            if (!editingEvent) return;
            setEditSubmitting(true);
            setEditError(null);

            const result = await accommodationOccupancyApi.updateEvent({
                id: accommodationId,
                oldStartDate: editingEvent.startKey,
                oldEndDate: editingEvent.endKey,
                newStartDate,
                newEndDate,
                note: newNote
            });

            if (result.ok) {
                setEditingEvent(null);
                setReloadKey((k) => k + 1);
            } else {
                setEditError(
                    result.error.message ||
                        t(
                            'host.properties.editor.calendar.editEvent.saveError',
                            'No pudimos guardar los cambios. Intentá de nuevo.'
                        )
                );
            }
            setEditSubmitting(false);
        },
        [editingEvent, accommodationId, t]
    );

    const handleEditDelete = useCallback(async () => {
        if (!editingEvent) return;
        setEditSubmitting(true);
        setEditError(null);

        // Deleting a manual event = unblocking its full date range (only the
        // MANUAL rows are removed server-side; any sync rows are left in place).
        const result = await accommodationOccupancyApi.batchToggle({
            id: accommodationId,
            dates: buildDateRangeKeys({
                startKey: editingEvent.startKey,
                endKey: editingEvent.endKey
            }),
            isBlocked: false
        });

        if (result.ok) {
            setEditingEvent(null);
            setReloadKey((k) => k + 1);
        } else {
            setEditError(
                result.error.message ||
                    t(
                        'host.properties.editor.calendar.editEvent.deleteError',
                        'No pudimos eliminar el bloqueo. Intentá de nuevo.'
                    )
            );
        }
        setEditSubmitting(false);
    }, [editingEvent, accommodationId, t]);

    const handleEditClose = useCallback(() => {
        setEditingEvent(null);
        setEditError(null);
    }, []);

    // --- Derived rendering data ---

    const gridCells = useMemo(() => buildMonthGrid({ month: viewedMonth }), [viewedMonth]);
    const weeks = useMemo(() => chunkWeeks(gridCells), [gridCells]);
    // Collapse the per-date occupancy rows into multi-day event spans for the
    // bar layout (HOS-162 prototype).
    const occupancyEvents = useMemo(
        () => buildOccupancyEvents({ rows: Object.values(occupancyByDate).flat() }),
        [occupancyByDate]
    );
    const todayKey = useMemo(() => toDateKey({ date: new Date() }), []);
    const monthLabel = formatDate({
        date: viewedMonth,
        locale,
        options: { month: 'long', year: 'numeric' }
    });
    const weekdayLabels = useMemo(() => {
        // A Monday-first reference week (2024-01-01 is a Monday) used purely
        // to derive locale-correct short weekday labels via Intl.
        return Array.from({ length: 7 }, (_, i) =>
            formatDate({ date: new Date(2024, 0, 1 + i), locale, options: { weekday: 'short' } })
        );
    }, [locale]);
    const hasAnyOccupiedDayInMonth = Object.keys(occupancyByDate).length > 0;
    // Which occupancy sources actually appear this month — drives the legend so
    // it never lists a sync source the host never connected (HOS-175).
    const presentSources = useMemo(
        () =>
            new Set(
                Object.values(occupancyByDate)
                    .flat()
                    .map((r) => r.source)
            ),
        [occupancyByDate]
    );

    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
                {t('host.properties.editor.calendar.title', 'Calendario de ocupación')}
            </h3>
            <p className={styles.sectionDescription}>
                {t(
                    'host.properties.editor.calendar.description',
                    'Marcá los días en los que tu alojamiento está ocupado. Esas fechas no aparecerán disponibles en las búsquedas.'
                )}
            </p>

            {/*
             * External calendar sync, collapsed behind a button that opens the
             * connect/sync panel in a modal (CalendarSyncLauncher). The button
             * is ALWAYS shown; the launcher itself checks the
             * can_sync_external_calendar entitlement and opens an upgrade nudge
             * instead of the panel when the plan lacks it (HOS-175).
             */}
            <CalendarSyncLauncher
                locale={locale}
                accommodationId={accommodationId}
            />

            <div className={styles.monthHeader}>
                <button
                    type="button"
                    className={styles.navButton}
                    onClick={handlePrevMonth}
                    disabled={!canGoPrev}
                    aria-label={t('host.properties.editor.calendar.prevMonth', 'Mes anterior')}
                >
                    <ChevronLeftIcon
                        size={18}
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>
                <span className={styles.monthLabel}>
                    <CalendarIcon
                        size={16}
                        weight="regular"
                        aria-hidden="true"
                    />
                    {monthLabel}
                </span>
                <button
                    type="button"
                    className={styles.navButton}
                    onClick={handleNextMonth}
                    aria-label={t('host.properties.editor.calendar.nextMonth', 'Mes siguiente')}
                >
                    <ChevronRightIcon
                        size={18}
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>
            </div>

            {loadError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {t(
                        'host.properties.editor.calendar.loadError',
                        'No pudimos cargar el calendario. Intentá de nuevo.'
                    )}
                </div>
            )}

            {isLoading ? (
                <p className={styles.loading}>
                    {t('host.properties.editor.calendar.loading', 'Cargando calendario...')}
                </p>
            ) : (
                <>
                    <div
                        className={styles.weekdays}
                        aria-hidden="true"
                    >
                        {weekdayLabels.map((label, i) => (
                            <span
                                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-item static weekday header, never reordered
                                key={i}
                            >
                                {label}
                            </span>
                        ))}
                    </div>

                    {/*
                     * Deliberately no `role="grid"` here: ARIA `grid` is a
                     * composite widget role that requires roving-tabindex
                     * arrow-key navigation between cells (WAI-ARIA APG). This
                     * calendar's cells are independently-focusable native
                     * `<button>`s (plain Tab order) — claiming `grid` without
                     * implementing its interaction contract would be a false
                     * accessibility promise, not an improvement.
                     */}
                    <div className={styles.grid}>
                        {weeks.map((week, weekIndex) => {
                            const { segments, laneCount } = layoutWeekBars({
                                week,
                                events: occupancyEvents
                            });
                            const { visibleSegments, overflowByColumn } = resolveWeekOverflow({
                                segments,
                                laneCount
                            });
                            return (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed month grid, weeks never reordered
                                    key={`week-${weekIndex}`}
                                    className={styles.week}
                                >
                                    <div className={styles.weekDays}>
                                        {week.map((date, dayIndex) => {
                                            if (!date) {
                                                return (
                                                    <div
                                                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length padding cells
                                                        key={`pad-${weekIndex}-${dayIndex}`}
                                                        className={styles.pad}
                                                        aria-hidden="true"
                                                    />
                                                );
                                            }
                                            const dateKey = toDateKey({ date });
                                            const row = resolvePrimaryOccupancyRow({
                                                rows: occupancyByDate[dateKey] ?? []
                                            });
                                            return (
                                                <CalendarDayCell
                                                    key={dateKey}
                                                    date={date}
                                                    dateKey={dateKey}
                                                    locale={locale}
                                                    t={t}
                                                    row={row}
                                                    isPast={dateKey < todayKey}
                                                    isSelected={
                                                        selection?.includes(dateKey) ?? false
                                                    }
                                                    isPending={pendingStart === dateKey}
                                                    barMode
                                                    onSelect={handleDayClick}
                                                />
                                            );
                                        })}
                                    </div>
                                    {segments.length > 0 && (
                                        <div className={styles.weekBars}>
                                            {visibleSegments.map((segment) => {
                                                const insetStart = segment.isStart ? 3 : 0;
                                                const insetEnd = segment.isEnd ? 3 : 0;
                                                const label = barLabel({ event: segment.event, t });
                                                // Only MANUAL events are editable — their bar is a
                                                // real button that opens the edit dialog; sync bars
                                                // stay decorative (their occupancy is announced by
                                                // the disabled day cell's aria-label).
                                                const isManualBar =
                                                    sourceKeySuffix(segment.event.source) ===
                                                    'manual';
                                                const barClass = cn(
                                                    styles.bar,
                                                    barSourceClass(segment.event.source),
                                                    segment.isStart && styles.barStart,
                                                    segment.isEnd && styles.barEnd,
                                                    isManualBar && styles.barButton
                                                );
                                                const barStyle = {
                                                    left: `calc(${segment.colStart} / 7 * 100% + ${insetStart}px)`,
                                                    width: `calc(${segment.span} / 7 * 100% - ${insetStart + insetEnd}px)`,
                                                    top: `calc(${segment.lane} * (var(--bar-height) + var(--bar-gap)))`
                                                };
                                                const key = `${segment.event.source}-${segment.event.startKey}-${segment.lane}-${segment.colStart}`;

                                                return isManualBar ? (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        className={barClass}
                                                        style={barStyle}
                                                        onClick={() =>
                                                            setEditingEvent(segment.event)
                                                        }
                                                        aria-label={`${t(
                                                            'host.properties.editor.calendar.editEvent.title',
                                                            'Editar bloqueo'
                                                        )}: ${label}`}
                                                    >
                                                        {segment.showLabel && (
                                                            <span className={styles.barLabel}>
                                                                {label}
                                                            </span>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <div
                                                        key={key}
                                                        className={barClass}
                                                        style={barStyle}
                                                        title={label}
                                                        aria-hidden="true"
                                                    >
                                                        {segment.showLabel && (
                                                            <span className={styles.barLabel}>
                                                                {label}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {overflowByColumn.map((count, col) =>
                                                count > 0 ? (
                                                    <div
                                                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-column week, index IS the day column
                                                        key={`more-${col}`}
                                                        className={styles.barMore}
                                                        style={{
                                                            left: `calc(${col} / 7 * 100% + 3px)`,
                                                            width: `calc(1 / 7 * 100% - 6px)`,
                                                            top: `calc(${MAX_VISIBLE_LANES - 1} * (var(--bar-height) + var(--bar-gap)))`
                                                        }}
                                                        title={t(
                                                            'host.properties.editor.calendar.moreEvents',
                                                            '+{{count}} más',
                                                            { count }
                                                        )}
                                                        aria-hidden="true"
                                                    >
                                                        {t(
                                                            'host.properties.editor.calendar.moreEventsShort',
                                                            '+{{count}}',
                                                            { count }
                                                        )}
                                                    </div>
                                                ) : null
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {!hasAnyOccupiedDayInMonth && (
                        <p className={styles.emptyHint}>
                            {t(
                                'host.properties.editor.calendar.emptyMonth',
                                'Ningún día bloqueado este mes'
                            )}
                        </p>
                    )}
                </>
            )}

            {pendingStart && !selection && (
                <p className={styles.hint}>
                    {t(
                        'host.properties.editor.calendar.rangeHint',
                        'Hacé clic en otro día para completar el rango, o clic de nuevo en el mismo día para elegir solo esa fecha.'
                    )}
                </p>
            )}

            {selection && selection.length > 0 && (
                <section
                    className={styles.actionBar}
                    aria-label={tPlural(
                        'host.properties.editor.calendar.selectionCount',
                        selection.length
                    )}
                >
                    <p className={styles.selectionCount}>
                        {tPlural(
                            'host.properties.editor.calendar.selectionCount',
                            selection.length
                        )}
                    </p>

                    <label
                        className={styles.noteField}
                        htmlFor="calendar-note"
                    >
                        <span>
                            {t('host.properties.editor.calendar.noteLabel', 'Nota (opcional)')}
                        </span>
                        <input
                            id="calendar-note"
                            type="text"
                            className={styles.noteInput}
                            value={note}
                            maxLength={500}
                            placeholder={t(
                                'host.properties.editor.calendar.notePlaceholder',
                                'Ej: reservado fuera de la plataforma'
                            )}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </label>

                    <div className={styles.actionButtons}>
                        <button
                            type="button"
                            className={styles.blockButton}
                            onClick={() => handleApply(true)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? t(
                                      'host.properties.editor.calendar.blockingAction',
                                      'Bloqueando...'
                                  )
                                : t('host.properties.editor.calendar.blockAction', 'Bloquear')}
                        </button>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={handleCancelSelection}
                            disabled={isSubmitting}
                        >
                            {t(
                                'host.properties.editor.calendar.cancelSelection',
                                'Cancelar selección'
                            )}
                        </button>
                    </div>

                    {submitError && (
                        <div
                            className={styles.error}
                            role="alert"
                        >
                            {submitError}
                        </div>
                    )}
                </section>
            )}

            <CalendarLegend
                t={t}
                presentSources={presentSources}
            />

            <OccupancyEventEditDialog
                isOpen={editingEvent !== null}
                t={t}
                event={editingEvent}
                isSubmitting={editSubmitting}
                error={editError}
                onSave={handleEditSave}
                onDelete={handleEditDelete}
                onClose={handleEditClose}
            />
        </div>
    );
}
