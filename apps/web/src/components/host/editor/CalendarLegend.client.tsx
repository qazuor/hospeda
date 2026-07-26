/**
 * @file CalendarLegend.client.tsx
 * @description Legend explaining the occupancy calendar's day-cell / event-bar
 * colors (`CalendarSection.client.tsx`, HOS-43 Phase 1).
 *
 * Split out of `CalendarSection.client.tsx` to keep that file under the
 * 500-line project limit — purely presentational, no state.
 *
 * The legend is DATA-DRIVEN (HOS-175): "Libre" always shows, but "Manual" and
 * each sync source only appear when the viewed month actually contains a row
 * from that source, so a host never sees "Sincronizado — Airbnb" for a
 * calendar they never connected.
 *
 * On narrow screens it collapses behind a toggle (HOS-316). The legend is a
 * reference, consulted once and then ignored, and on a phone it was taking
 * room from the grid it explains. The toggle is hidden on wider screens, where
 * the flat row costs nothing.
 */

import { ChevronDownIcon, GoogleIcon } from '@repo/icons';
import { OccupancySourceEnum } from '@repo/schemas';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

/** Props for CalendarLegend. */
export interface CalendarLegendProps {
    readonly t: TranslationFn;
    /** The occupancy sources actually present in the viewed month. */
    readonly presentSources: ReadonlySet<OccupancySourceEnum>;
}

/**
 * Legend explaining the free / manual / sync-source markers — showing only the
 * markers relevant to the viewed month (plus "Libre", always).
 */
export function CalendarLegend({ t, presentSources }: CalendarLegendProps) {
    const has = (source: OccupancySourceEnum) => presentSources.has(source);
    // Collapsed by default. CSS decides whether the toggle is shown at all, so
    // this state is inert on wider screens rather than hiding anything there.
    const [isExpanded, setIsExpanded] = useState(false);
    const title = t('host.properties.editor.calendar.legend.title', 'Referencias');

    return (
        <div
            className={styles.legend}
            data-expanded={isExpanded ? 'true' : 'false'}
        >
            <button
                type="button"
                className={styles.legendToggle}
                onClick={() => setIsExpanded((prev) => !prev)}
                aria-expanded={isExpanded}
            >
                {title}
                <ChevronDownIcon
                    size={14}
                    className={styles.legendToggleIcon}
                    aria-hidden="true"
                />
            </button>
            <span className={styles.legendTitle}>{title}</span>
            <div className={styles.legendItems}>
                <span className={styles.legendItem}>
                    <span className={cn(styles.legendDot, styles.dotFree)} />
                    {t('host.properties.editor.calendar.legend.free', 'Libre')}
                </span>
                {has(OccupancySourceEnum.MANUAL) && (
                    <span className={styles.legendItem}>
                        <span className={cn(styles.legendDot, styles.dotManual)} />
                        {t(
                            'host.properties.editor.calendar.legend.manual',
                            'Bloqueado manualmente'
                        )}
                    </span>
                )}
                {has(OccupancySourceEnum.GOOGLE_CALENDAR) && (
                    <span className={styles.legendItem}>
                        <GoogleIcon
                            size={12}
                            weight="regular"
                            aria-hidden="true"
                        />
                        {t(
                            'host.properties.editor.calendar.legend.google',
                            'Sincronizado — Google Calendar'
                        )}
                    </span>
                )}
                {has(OccupancySourceEnum.AIRBNB) && (
                    <span className={styles.legendItem}>
                        <span className={cn(styles.legendDot, styles.dotAirbnb)} />
                        {t(
                            'host.properties.editor.calendar.legend.airbnb',
                            'Sincronizado — Airbnb'
                        )}
                    </span>
                )}
                {has(OccupancySourceEnum.BOOKING) && (
                    <span className={styles.legendItem}>
                        <span className={cn(styles.legendDot, styles.dotBooking)} />
                        {t(
                            'host.properties.editor.calendar.legend.booking',
                            'Sincronizado — Booking.com'
                        )}
                    </span>
                )}
                {has(OccupancySourceEnum.OTHER) && (
                    <span className={styles.legendItem}>
                        <span className={cn(styles.legendDot, styles.dotOther)} />
                        {t(
                            'host.properties.editor.calendar.legend.other',
                            'Sincronizado — Otro calendario'
                        )}
                    </span>
                )}
            </div>
        </div>
    );
}
