/**
 * @file CalendarMonthHeader.client.tsx
 * @description Month navigation of the occupancy calendar: previous, the
 * month label and next (HOS-43, split out of `CalendarSection` by HOS-2503).
 */

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@repo/icons';
import type { JSX } from 'react';
import { formatMonthYearLabel } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

/** Props of {@link CalendarMonthHeader}. */
export interface CalendarMonthHeaderProps {
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    /** First day of the month on screen. */
    readonly viewedMonth: Date;
    /** False on the current month: the previous button is disabled. */
    readonly canGoPrev: boolean;
    readonly onPrev: () => void;
    readonly onNext: () => void;
}

/**
 * Previous / month label / next.
 *
 * @param props - See {@link CalendarMonthHeaderProps}.
 * @returns The navigation row.
 */
export function CalendarMonthHeader({
    locale,
    t,
    viewedMonth,
    canGoPrev,
    onPrev,
    onNext
}: CalendarMonthHeaderProps): JSX.Element {
    return (
        <div className={styles.monthHeader}>
            <button
                type="button"
                className={styles.navButton}
                onClick={onPrev}
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
                {formatMonthYearLabel({ date: viewedMonth, locale })}
            </span>
            <button
                type="button"
                className={styles.navButton}
                onClick={onNext}
                aria-label={t('host.properties.editor.calendar.nextMonth', 'Mes siguiente')}
            >
                <ChevronRightIcon
                    size={18}
                    weight="regular"
                    aria-hidden="true"
                />
            </button>
        </div>
    );
}
