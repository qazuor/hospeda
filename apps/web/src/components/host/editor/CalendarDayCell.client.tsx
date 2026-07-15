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
    /**
     * The date's PRIMARY occupancy row, if any (undefined = free). When a
     * date carries rows from multiple sources (HOS-162), the caller has
     * already resolved this to the highest-priority one
     * (`resolvePrimaryOccupancyRow`, `MANUAL > GOOGLE_CALENDAR > AIRBNB >
     * BOOKING > OTHER`) — this component only ever renders one row per day.
     */
    readonly row: AccommodationOccupancy | undefined;
    /** Whether this date is strictly before today — occupancy is future-facing. */
    readonly isPast: boolean;
    /** Whether this date is part of the currently-confirmed selection. */
    readonly isSelected: boolean;
    /** Whether this date is the pending range start (first click, awaiting the second). */
    readonly isPending: boolean;
    /**
     * Bar-layout mode (HOS-162 prototype): occupancy is drawn as spanning
     * event bars overlaid on the week, so the cell suppresses its own occupied
     * background + source dot and renders the number top-left to leave room for
     * the bars. Interaction (togglable MANUAL / free, disabled sync / past) is
     * unchanged. Defaults to `false` (legacy per-day dot rendering).
     */
    readonly barMode?: boolean;
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
    barMode = false,
    onSelect
}: CalendarDayCellProps) {
    // A date is occupied if it has ANY row (HOS-162: multiple rows per date
    // are possible; presence, not `isBlocked`, is the occupied signal —
    // `row` is already the caller-resolved primary row for the date).
    const isOccupied = Boolean(row);
    const isSyncOrigin = isOccupied && row?.source !== OccupancySourceEnum.MANUAL;
    // HOS-175 interaction model: cell click/hover only marks FREE days as
    // occupied. Occupied days (manual OR sync) are never togglable from the
    // cell — an existing event is edited/removed by clicking its bar instead
    // (CalendarSection opens the edit dialog). Past days are always inert.
    const isDisabled = isOccupied || isPast;

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
                barMode && styles.dayBarMode,
                // In bar mode the spanning bars carry the occupied/source
                // signal, so suppress the per-cell occupied bg + dashed sync
                // border to avoid a double indicator.
                !barMode && isOccupied && styles.dayOccupied,
                !barMode && isSyncOrigin && styles.daySync,
                isSelected && styles.daySelected,
                isPending && styles.dayPending,
                isPast && styles.dayPast
            )}
            onClick={() => !isDisabled && onSelect(dateKey)}
            disabled={isDisabled}
            aria-label={ariaLabel}
        >
            <span className={styles.dayNumber}>{date.getDate()}</span>
            {!barMode && isSyncOrigin && row && (
                <span
                    className={cn(styles.sourceDot, sourceDotClass(row.source))}
                    aria-hidden="true"
                />
            )}
        </button>
    );
}
