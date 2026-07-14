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
 */

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import type { AccommodationOccupancy } from '@repo/schemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accommodationOccupancyApi } from '@/lib/api/endpoints-protected';
import {
    addMonths,
    buildDateRangeKeys,
    buildMonthGrid,
    compareMonths,
    type DateKey,
    getStartOfMonth,
    toDateKey
} from '@/lib/calendar/occupancy-calendar-grid';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { CalendarDayCell } from './CalendarDayCell.client';
import { CalendarLegend } from './CalendarLegend.client';
import styles from './CalendarSection.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for CalendarSection. */
export interface CalendarSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
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

    // --- Occupancy data for the viewed month ---
    const [occupancyByDate, setOccupancyByDate] = useState<
        Readonly<Record<DateKey, AccommodationOccupancy>>
    >({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    // --- Range selection state ---
    const [pendingStart, setPendingStart] = useState<DateKey | null>(null);
    const [selection, setSelection] = useState<readonly DateKey[] | null>(null);
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // --- Fetch occupancy for the viewed month ---
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
                const next: Record<DateKey, AccommodationOccupancy> = {};
                for (const row of result.data.occupancy) {
                    next[row.date] = row;
                }
                setOccupancyByDate(next);
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
    }, [accommodationId, viewedMonth]);

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
                setOccupancyByDate((prev) => {
                    const next = { ...prev };
                    for (const dateKey of selection) {
                        delete next[dateKey];
                    }
                    for (const row of result.data.occupancy) {
                        next[row.date] = row;
                    }
                    return next;
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

    // --- Derived rendering data ---

    const gridCells = useMemo(() => buildMonthGrid({ month: viewedMonth }), [viewedMonth]);
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
                        {gridCells.map((date, i) => {
                            if (!date) {
                                return (
                                    <div
                                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length padding cells, never reordered
                                        key={`pad-${i}`}
                                        className={styles.pad}
                                        aria-hidden="true"
                                    />
                                );
                            }

                            const dateKey = toDateKey({ date });
                            const row = occupancyByDate[dateKey];
                            const isPast = dateKey < todayKey;
                            const isSelected = selection?.includes(dateKey) ?? false;
                            const isPending = pendingStart === dateKey;

                            return (
                                <CalendarDayCell
                                    key={dateKey}
                                    date={date}
                                    dateKey={dateKey}
                                    locale={locale}
                                    t={t}
                                    row={row}
                                    isPast={isPast}
                                    isSelected={isSelected}
                                    isPending={isPending}
                                    onSelect={handleDayClick}
                                />
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
                            className={styles.unblockButton}
                            onClick={() => handleApply(false)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? t(
                                      'host.properties.editor.calendar.unblockingAction',
                                      'Liberando...'
                                  )
                                : t('host.properties.editor.calendar.unblockAction', 'Liberar')}
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

            <CalendarLegend t={t} />
        </div>
    );
}
