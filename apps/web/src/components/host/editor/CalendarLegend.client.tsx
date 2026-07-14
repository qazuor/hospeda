/**
 * @file CalendarLegend.client.tsx
 * @description Static legend explaining the occupancy calendar's day-cell
 * colors/icons (`CalendarSection.client.tsx`, HOS-43 Phase 1).
 *
 * Split out of `CalendarSection.client.tsx` to keep that file under the
 * 500-line project limit — purely presentational, no state.
 */

import { GoogleIcon } from '@repo/icons';
import { cn } from '@/lib/cn';
import type { TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

/** Props for CalendarLegend. */
export interface CalendarLegendProps {
    readonly t: TranslationFn;
}

/** Legend row explaining free / manual / Google / Airbnb / Booking day markers. */
export function CalendarLegend({ t }: CalendarLegendProps) {
    return (
        <div className={styles.legend}>
            <span className={styles.legendTitle}>
                {t('host.properties.editor.calendar.legend.title', 'Referencias')}
            </span>
            <span className={styles.legendItem}>
                <span className={cn(styles.legendDot, styles.dotFree)} />
                {t('host.properties.editor.calendar.legend.free', 'Libre')}
            </span>
            <span className={styles.legendItem}>
                <span className={cn(styles.legendDot, styles.dotManual)} />
                {t('host.properties.editor.calendar.legend.manual', 'Bloqueado manualmente')}
            </span>
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
            <span className={styles.legendItem}>
                <span className={cn(styles.legendDot, styles.dotAirbnb)} />
                {t('host.properties.editor.calendar.legend.airbnb', 'Sincronizado — Airbnb')}
            </span>
            <span className={styles.legendItem}>
                <span className={cn(styles.legendDot, styles.dotBooking)} />
                {t('host.properties.editor.calendar.legend.booking', 'Sincronizado — Booking.com')}
            </span>
        </div>
    );
}
