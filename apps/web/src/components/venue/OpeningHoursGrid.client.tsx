/**
 * @file OpeningHoursGrid.client.tsx
 * @description Client island that highlights the current weekday after mount.
 * The initial state is empty to keep cached SSR markup hydration-safe. The day
 * is calculated once in the venue time zone; there is no midnight interval.
 */

import { useEffect, useState } from 'react';
import { todayIndexInZone, VENUE_OPEN_NOW_TIME_ZONE } from '@/lib/venue/open-now-in-zone';
import styles from './OpeningHoursGrid.module.css';

export interface OpeningHoursGridRow {
    readonly dayKey: string;
    readonly label: string;
    readonly hoursText: string;
    readonly isClosed: boolean;
}

interface OpeningHoursGridProps {
    readonly rows: readonly OpeningHoursGridRow[];
    readonly todayLabel: string;
    readonly dayIndexByKey: Readonly<Record<string, number>>;
}

/** Renders the weekly grid and marks today's row after client hydration. */
export function OpeningHoursGrid({ rows, todayLabel, dayIndexByKey }: OpeningHoursGridProps) {
    const [todayIndex, setTodayIndex] = useState<number | null>(null);

    useEffect(() => {
        setTodayIndex(todayIndexInZone({ now: new Date(), timeZone: VENUE_OPEN_NOW_TIME_ZONE }));
    }, []);

    return (
        <dl className={styles.grid}>
            {rows.map(({ dayKey, label, hoursText, isClosed }) => {
                const isToday = todayIndex !== null && dayIndexByKey[dayKey] === todayIndex;
                return (
                    <div
                        className={`${styles.row}${isToday ? ` ${styles.today}` : ''}${isClosed ? ` ${styles.closed}` : ''}`}
                        data-day={dayKey}
                        data-today={isToday ? 'true' : undefined}
                        key={dayKey}
                    >
                        <dt className={styles.day}>
                            {label}
                            {isToday && <span className={styles.todayBadge}>{todayLabel}</span>}
                        </dt>
                        <dd className={styles.time}>{hoursText}</dd>
                    </div>
                );
            })}
        </dl>
    );
}
