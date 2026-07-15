/**
 * @file CalendarDayCell.client.tsx
 * @description A single day button for the occupancy calendar grid
 * (`CalendarSection.client.tsx`, HOS-43 Phase 1).
 *
 * Split out of `CalendarSection.client.tsx` to keep that file under the
 * 500-line project limit and to make the per-day rendering rules (free vs.
 * occupied vs. sync-origin vs. past vs. selected) independently testable.
 */

import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './CalendarSection.module.css';

// ---------------------------------------------------------------------------
// Source label helpers
// ---------------------------------------------------------------------------

/** Maps an occupancy source to its i18n sub-key suffix under `calendar.source.*`. */
export function sourceKeySuffix(
    source: OccupancySourceEnum
): 'manual' | 'google' | 'airbnb' | 'booking' | 'other' {
    switch (source) {
        case OccupancySourceEnum.GOOGLE_CALENDAR:
            return 'google';
        case OccupancySourceEnum.AIRBNB:
            return 'airbnb';
        case OccupancySourceEnum.BOOKING:
            return 'booking';
        case OccupancySourceEnum.OTHER:
            return 'other';
        default:
            return 'manual';
    }
}

/**
 * Spanish fallback label for a source, used as the `t()` fallback so a
 * missing translation never surfaces the raw enum value (e.g.
 * `GOOGLE_CALENDAR`) to the host.
 */
export function sourceFallbackLabel(source: OccupancySourceEnum): string {
    switch (source) {
        case OccupancySourceEnum.GOOGLE_CALENDAR:
            return 'Google Calendar';
        case OccupancySourceEnum.AIRBNB:
            return 'Airbnb';
        case OccupancySourceEnum.BOOKING:
            return 'Booking.com';
        case OccupancySourceEnum.OTHER:
            return 'Otro calendario';
        default:
            return 'Manual';
    }
}

/** CSS module class for a sync source's dot indicator. */
function sourceDotClass(source: OccupancySourceEnum): string {
    switch (source) {
        case OccupancySourceEnum.GOOGLE_CALENDAR:
            return styles.dotGoogle;
        case OccupancySourceEnum.AIRBNB:
            return styles.dotAirbnb;
        case OccupancySourceEnum.BOOKING:
            return styles.dotBooking;
        case OccupancySourceEnum.OTHER:
            return styles.dotOther;
        default:
            return styles.dotManual;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Props for CalendarDayCell. */
export interface CalendarDayCellProps {
    readonly date: Date;
    readonly dateKey: string;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    /** The occupancy row for this date, if any (undefined = free). */
    readonly row: AccommodationOccupancy | undefined;
    /** Whether this date is strictly before today — occupancy is future-facing. */
    readonly isPast: boolean;
    /** Whether this date is part of the currently-confirmed selection. */
    readonly isSelected: boolean;
    /** Whether this date is the pending range start (first click, awaiting the second). */
    readonly isPending: boolean;
    readonly onSelect: (dateKey: string) => void;
}

/**
 * A single day cell in the occupancy calendar grid.
 *
 * Free and `MANUAL`-occupied days are togglable buttons; sync-sourced days
 * (Google Calendar / Airbnb / Booking) and past days are rendered `disabled`
 * — occupancy is future-facing and sync rows are read-only from this UI
 * (US-3).
 */
export function CalendarDayCell({
    date,
    dateKey,
    locale,
    t,
    row,
    isPast,
    isSelected,
    isPending,
    onSelect
}: CalendarDayCellProps) {
    const isOccupied = Boolean(row?.isBlocked);
    const isManual = row?.source === OccupancySourceEnum.MANUAL;
    const isSyncOrigin = Boolean(row) && !isManual;
    const isDisabled = isSyncOrigin || isPast;

    const statusLabel = row
        ? `${t('host.properties.editor.calendar.statusOccupied', 'Ocupado')} — ${t(
              `host.properties.editor.calendar.source.${sourceKeySuffix(row.source)}`,
              sourceFallbackLabel(row.source)
          )}`
        : t('host.properties.editor.calendar.statusFree', 'Libre');
    const ariaLabel = `${formatDate({
        date,
        locale,
        options: { day: 'numeric', month: 'long', year: 'numeric' }
    })} — ${statusLabel}`;

    return (
        <button
            type="button"
            className={cn(
                styles.day,
                isOccupied && styles.dayOccupied,
                isSyncOrigin && styles.daySync,
                isSelected && styles.daySelected,
                isPending && styles.dayPending,
                isPast && styles.dayPast
            )}
            onClick={() => !isDisabled && onSelect(dateKey)}
            disabled={isDisabled}
            aria-pressed={isManual ? isOccupied : undefined}
            aria-label={ariaLabel}
        >
            <span className={styles.dayNumber}>{date.getDate()}</span>
            {isSyncOrigin && row && (
                <span
                    className={cn(styles.sourceDot, sourceDotClass(row.source))}
                    aria-hidden="true"
                />
            )}
        </button>
    );
}
