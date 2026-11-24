/**
 * @file CalendarMonthGrid.client.tsx
 * @description The month grid of the occupancy calendar: weekday header, one
 * row per week and the spanning event bars over each week (HOS-43 / HOS-162,
 * split out of `CalendarSection` by HOS-2503).
 *
 * The grid is a «keep distinct» pattern (HOS-2416 R-5): its structure and its
 * mobile behaviour are deliberate, so this file only moved, it was not
 * redesigned.
 */

import type { JSX } from 'react';
import { useMemo } from 'react';
import {
    buildOccupancyEvents,
    layoutWeekBars,
    MAX_VISIBLE_LANES,
    type OccupancyEvent,
    resolveWeekOverflow
} from '@/lib/calendar/occupancy-bar-layout';
import { buildMonthGrid, type DateKey, toDateKey } from '@/lib/calendar/occupancy-calendar-grid';
import { resolvePrimaryOccupancyRow } from '@/lib/calendar/occupancy-row-grouping';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { CalendarDayCell, sourceFallbackLabel, sourceKeySuffix } from './CalendarDayCell.client';
import styles from './CalendarSection.module.css';
import type { OccupancyByDate } from './use-occupancy-month';

/** Props of {@link CalendarMonthGrid}. */
export interface CalendarMonthGridProps {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    /** First day of the month on screen. */
    readonly viewedMonth: Date;
    /** Rows of the viewed month, grouped by date. */
    readonly occupancyByDate: OccupancyByDate;
    /** Today, as a date key: earlier days render as past. */
    readonly todayKey: DateKey;
    /** Days of the confirmed selection, if any. */
    readonly selection: readonly DateKey[] | null;
    /** The pending range start, if any. */
    readonly pendingStart: DateKey | null;
    /** A free day was clicked. */
    readonly onSelectDay: (dateKey: DateKey) => void;
    /** A manual event bar was clicked: open the edit dialog. */
    readonly onEditEvent: (event: OccupancyEvent) => void;
    /** A sync event bar was clicked: open the read-only detail dialog. */
    readonly onViewEvent: (event: OccupancyEvent) => void;
}

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
 * The text shown inside an event bar: the event's own title when present,
 * else a per-provider fallback label so Airbnb/Booking feeds that expose no
 * useful `SUMMARY` still read as "<Provider>".
 */
export function barLabel({
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

/**
 * The month grid with its event bars.
 *
 * @param props - See {@link CalendarMonthGridProps}.
 * @returns The weekday header followed by the week rows.
 */
export function CalendarMonthGrid({
    locale,
    t,
    viewedMonth,
    occupancyByDate,
    todayKey,
    selection,
    pendingStart,
    onSelectDay,
    onEditEvent,
    onViewEvent
}: CalendarMonthGridProps): JSX.Element {
    const weeks = useMemo(() => chunkWeeks(buildMonthGrid({ month: viewedMonth })), [viewedMonth]);
    // Collapse the per-date occupancy rows into multi-day event spans for the
    // bar layout (HOS-162 prototype).
    const occupancyEvents = useMemo(
        () => buildOccupancyEvents({ rows: Object.values(occupancyByDate).flat() }),
        [occupancyByDate]
    );
    const weekdayLabels = useMemo(() => {
        // A Monday-first reference week (2024-01-01 is a Monday) used purely
        // to derive locale-correct short weekday labels via Intl.
        return Array.from({ length: 7 }, (_, i) =>
            formatDate({ date: new Date(2024, 0, 1 + i), locale, options: { weekday: 'short' } })
        );
    }, [locale]);

    return (
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
             * Deliberately no `role="grid"` here: ARIA `grid` is a composite
             * widget role that requires roving-tabindex arrow-key navigation
             * between cells (WAI-ARIA APG). This calendar's cells are
             * independently-focusable native `<button>`s (plain Tab order) —
             * claiming `grid` without implementing its interaction contract
             * would be a false accessibility promise, not an improvement.
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
                                            isSelected={selection?.includes(dateKey) ?? false}
                                            isPending={pendingStart === dateKey}
                                            barMode
                                            onSelect={onSelectDay}
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
                                        // EVERY bar is a button. A MANUAL one opens the edit
                                        // dialog; a sync one opens the read-only detail dialog
                                        // explaining where the block came from (H-131).
                                        const isManualBar =
                                            sourceKeySuffix(segment.event.source) === 'manual';
                                        const barClass = cn(
                                            styles.bar,
                                            barSourceClass(segment.event.source),
                                            segment.isStart && styles.barStart,
                                            segment.isEnd && styles.barEnd,
                                            styles.barButton
                                        );
                                        const barActionLabel = isManualBar
                                            ? t(
                                                  'host.properties.editor.calendar.editEvent.title',
                                                  'Editar bloqueo'
                                              )
                                            : t(
                                                  'host.properties.editor.calendar.eventDetails.title',
                                                  'Día bloqueado'
                                              );
                                        // Positions are computed per segment, so they can only
                                        // be expressed inline.
                                        const barStyle = {
                                            left: `calc(${segment.colStart} / 7 * 100% + ${insetStart}px)`,
                                            width: `calc(${segment.span} / 7 * 100% - ${insetStart + insetEnd}px)`,
                                            top: `calc(${segment.lane} * (var(--bar-height) + var(--bar-gap)))`
                                        };
                                        const key = `${segment.event.source}-${segment.event.startKey}-${segment.lane}-${segment.colStart}`;

                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                className={barClass}
                                                style={barStyle}
                                                title={label}
                                                onClick={() =>
                                                    isManualBar
                                                        ? onEditEvent(segment.event)
                                                        : onViewEvent(segment.event)
                                                }
                                                // A multi-week event emits one focusable button
                                                // per week, all opening the same dialog.
                                                // Continuation segments get a disambiguated
                                                // label, and none is hidden from AT, so an event
                                                // whose start-week segment lands in the "+N"
                                                // overflow band is still reachable.
                                                aria-label={
                                                    segment.isStart
                                                        ? `${barActionLabel}: ${label}`
                                                        : `${barActionLabel}: ${label} (${t(
                                                              'host.properties.editor.calendar.editEvent.continues',
                                                              'continúa'
                                                          )})`
                                                }
                                            >
                                                {segment.showLabel && (
                                                    <span className={styles.barLabel}>{label}</span>
                                                )}
                                            </button>
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
        </>
    );
}
