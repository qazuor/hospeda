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
 */

import { GoogleIcon } from '@repo/icons';
import { OccupancySourceEnum } from '@repo/schemas';
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

    return (
        <div className={styles.legend}>
            <span className={styles.legendTitle}>
                {t('host.properties.editor.calendar.legend.title', 'Referencias')}
            </span>
            <span className={styles.legendItem}>
                <span className={cn(styles.legendDot, styles.dotFree)} />
                {t('host.properties.editor.calendar.legend.free', 'Libre')}
            </span>
            {has(OccupancySourceEnum.MANUAL) && (
                <span className={styles.legendItem}>
                    <span className={cn(styles.legendDot, styles.dotManual)} />
                    {t('host.properties.editor.calendar.legend.manual', 'Bloqueado manualmente')}
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
                    {t('host.properties.editor.calendar.legend.airbnb', 'Sincronizado — Airbnb')}
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
    );
}
