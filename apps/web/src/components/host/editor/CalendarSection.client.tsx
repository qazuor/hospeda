/**
 * @file CalendarSection.client.tsx
 * @description Occupancy calendar section for the accommodation editor
 * (HOS-43 Phase 1).
 *
 * Renders a monthly grid, starting at the current month, with forward-only
 * navigation (occupancy is future-facing — past months are never shown).
 * The host marks days occupied with a "click start, click end" range
 * interaction (see `use-occupancy-selection.ts`) and applies the change via
 * the batch endpoint. Sync-sourced days (Google Calendar / Airbnb / Booking,
 * Phase 2/3) render as occupied with their origin but are never togglable
 * from this UI (US-3) — only `source=MANUAL` rows can be created/removed here.
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
 *
 * HOS-2503 split the component: month data (`use-occupancy-month`), selection
 * and edits (`use-occupancy-selection`), navigation (`CalendarMonthHeader`),
 * the grid (`CalendarMonthGrid`) and the range bar (`CalendarSelectionBar`).
 */

import { useCallback, useMemo } from 'react';
import { toDateKey } from '@/lib/calendar/occupancy-calendar-grid';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { sourceFallbackLabel, sourceKeySuffix } from './CalendarDayCell.client';
import { CalendarLegend } from './CalendarLegend.client';
import { CalendarMonthGrid } from './CalendarMonthGrid.client';
import { CalendarMonthHeader } from './CalendarMonthHeader.client';
import styles from './CalendarSection.module.css';
import { CalendarSelectionBar } from './CalendarSelectionBar.client';
import { CalendarSyncLauncher } from './CalendarSyncLauncher.client';
import { OccupancyEventDetailsDialog } from './OccupancyEventDetailsDialog.client';
import { OccupancyEventEditDialog } from './OccupancyEventEditDialog.client';
import { useOccupancyMonth } from './use-occupancy-month';
import { useOccupancySelection } from './use-occupancy-selection';

/** Props for CalendarSection. */
export interface CalendarSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

/**
 * Occupancy calendar section.
 *
 * Fetches occupancy rows for the currently-viewed month on mount and on
 * every month navigation. Mutations always go through the batch endpoint.
 */
export function CalendarSection({ locale, accommodationId }: CalendarSectionProps) {
    const { t, tPlural } = createTranslations(locale);
    const month = useOccupancyMonth({ accommodationId });
    const selection = useOccupancySelection({
        accommodationId,
        t,
        setOccupancyByDate: month.setOccupancyByDate,
        reload: month.reload
    });
    const { occupancyByDate } = month;

    const todayKey = useMemo(() => toDateKey({ date: new Date() }), []);
    /**
     * Formats a `YYYY-MM-DD` occupancy key for display.
     *
     * Parsed as local noon rather than through `new Date('YYYY-MM-DD')`, which
     * JS reads as UTC midnight — in Argentina (UTC-3) that renders as the
     * PREVIOUS day, which on a calendar telling a host why a specific day is
     * blocked would be the one error nobody would forgive.
     */
    const formatOccupancyDateKey = useCallback(
        (dateKey: string): string => {
            const [year, monthNumber, day] = dateKey.split('-').map(Number);
            if (!year || !monthNumber || !day) return dateKey;
            return formatDate({
                date: new Date(year, monthNumber - 1, day, 12),
                locale,
                options: { day: 'numeric', month: 'long', year: 'numeric' }
            });
        },
        [locale]
    );

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
    const { viewingEvent } = selection;

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

            <CalendarMonthHeader
                locale={locale}
                t={t}
                viewedMonth={month.viewedMonth}
                canGoPrev={month.canGoPrev}
                onPrev={month.goPrev}
                onNext={month.goNext}
            />

            {month.loadError && (
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

            {month.isLoading ? (
                <p className={styles.loading}>
                    {t('host.properties.editor.calendar.loading', 'Cargando calendario...')}
                </p>
            ) : (
                <>
                    <CalendarMonthGrid
                        locale={locale}
                        t={t}
                        viewedMonth={month.viewedMonth}
                        occupancyByDate={occupancyByDate}
                        todayKey={todayKey}
                        selection={selection.selection}
                        pendingStart={selection.pendingStart}
                        onSelectDay={selection.handleDayClick}
                        onEditEvent={selection.setEditingEvent}
                        onViewEvent={selection.setViewingEvent}
                    />

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

            {selection.pendingStart && !selection.selection && (
                <p className={styles.hint}>
                    {t(
                        'host.properties.editor.calendar.rangeHint',
                        'Hacé clic en otro día para completar el rango, o clic de nuevo en el mismo día para elegir solo esa fecha.'
                    )}
                </p>
            )}

            {selection.selection && selection.selection.length > 0 && (
                <CalendarSelectionBar
                    t={t}
                    tPlural={tPlural}
                    count={selection.selection.length}
                    note={selection.note}
                    onNoteChange={selection.setNote}
                    isSubmitting={selection.isSubmitting}
                    submitError={selection.submitError}
                    onBlock={() => void selection.handleApply(true)}
                    onCancel={selection.handleCancelSelection}
                />
            )}

            <CalendarLegend
                t={t}
                presentSources={presentSources}
            />

            <OccupancyEventEditDialog
                isOpen={selection.editingEvent !== null}
                t={t}
                event={selection.editingEvent}
                minDate={todayKey}
                isSubmitting={selection.editSubmitting}
                error={selection.editError}
                onSave={selection.handleEditSave}
                onDelete={selection.handleEditDelete}
                onClose={selection.handleEditClose}
            />

            <OccupancyEventDetailsDialog
                isOpen={viewingEvent !== null}
                t={t}
                event={
                    viewingEvent
                        ? {
                              startKey: viewingEvent.startKey,
                              endKey: viewingEvent.endKey,
                              title: viewingEvent.title,
                              sourceLabel: t(
                                  `host.properties.editor.calendar.source.${sourceKeySuffix(viewingEvent.source)}`,
                                  sourceFallbackLabel(viewingEvent.source)
                              )
                          }
                        : null
                }
                formatDateKey={formatOccupancyDateKey}
                onClose={() => selection.setViewingEvent(null)}
            />
        </div>
    );
}
