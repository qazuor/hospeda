/**
 * AccommodationOccupancyList — read-only occupancy table for the admin
 * accommodation detail page (HOS-43 Phase 1, spec section 9).
 *
 * Renders every occupied day for an accommodation as a compact table
 * (date / origin badge / note). No editing affordances — this is a staff
 * read-only view, gated server-side by `ACCOMMODATION_OCCUPANCY_VIEW`.
 */

import { type TranslationKey, useTranslations } from '@repo/i18n';
import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
import { formatCalendarDate } from '@repo/utils';
import { Badge } from '@/components/ui/badge';
import { useAccommodationOccupancyQuery } from '../hooks/useAccommodationOccupancyQuery';

/** Props for {@link AccommodationOccupancyList}. */
export interface AccommodationOccupancyListProps {
    /** UUID of the accommodation whose occupancy calendar is displayed. */
    readonly accommodationId: string;
}

/** Maps each occupancy `source` to its i18n label key. */
const SOURCE_LABEL_KEYS: Record<OccupancySourceEnum, TranslationKey> = {
    [OccupancySourceEnum.MANUAL]: 'admin-pages.accommodations.occupancy.sourceLabels.MANUAL',
    [OccupancySourceEnum.GOOGLE_CALENDAR]:
        'admin-pages.accommodations.occupancy.sourceLabels.GOOGLE_CALENDAR',
    [OccupancySourceEnum.AIRBNB]: 'admin-pages.accommodations.occupancy.sourceLabels.AIRBNB',
    [OccupancySourceEnum.BOOKING]: 'admin-pages.accommodations.occupancy.sourceLabels.BOOKING',
    [OccupancySourceEnum.OTHER]: 'admin-pages.accommodations.occupancy.sourceLabels.OTHER'
};

/**
 * Manual (host-toggled) rows get the neutral "secondary" badge; every synced
 * source (Phase 2/3) gets "outline" so operators can spot external-origin
 * rows at a glance.
 */
function getSourceBadgeVariant(source: OccupancySourceEnum): 'secondary' | 'outline' {
    return source === OccupancySourceEnum.MANUAL ? 'secondary' : 'outline';
}

/**
 * Formats a plain `YYYY-MM-DD` occupancy date for display.
 *
 * The DB column is a timezone-less Postgres `date`, so the day must not be
 * read through the viewer's own timezone — that would shift it backward for
 * anyone west of UTC (e.g. Argentina, UTC-3). This file used to pin
 * `timeZone: 'UTC'` by hand, which was correct; it now delegates so the rule
 * lives in one place. Four screens got it wrong while this one had it right,
 * and nothing connected them (smoke agosto 2026, H-09/H-63/H-73/H-84).
 */
function formatOccupancyDate(date: string, locale: string): string {
    return formatCalendarDate({ value: date, locale, options: { dateStyle: 'medium' } }) ?? '—';
}

export function AccommodationOccupancyList({ accommodationId }: AccommodationOccupancyListProps) {
    const { t, locale } = useTranslations();
    const {
        data: occupancy = [],
        isLoading,
        isError
    } = useAccommodationOccupancyQuery(accommodationId);

    if (isLoading) {
        return (
            <div
                className="space-y-3"
                data-testid="occupancy-loading"
            >
                {Array.from({ length: 4 }).map((_, i) => (
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholder
                        key={i}
                        className="h-10 animate-pulse rounded-md bg-muted"
                    />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div
                role="alert"
                className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
            >
                <p className="text-destructive text-sm">
                    {t('admin-pages.accommodations.occupancy.loadError')}
                </p>
            </div>
        );
    }

    if (occupancy.length === 0) {
        return (
            <p className="text-muted-foreground text-sm">
                {t('admin-pages.accommodations.occupancy.empty')}
            </p>
        );
    }

    const sortedOccupancy = sortOccupancyByDate(occupancy);

    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                        <th className="px-4 py-2 font-medium">
                            {t('admin-pages.accommodations.occupancy.columns.date')}
                        </th>
                        <th className="px-4 py-2 font-medium">
                            {t('admin-pages.accommodations.occupancy.columns.source')}
                        </th>
                        <th className="px-4 py-2 font-medium">
                            {t('admin-pages.accommodations.occupancy.columns.note')}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {sortedOccupancy.map((row) => (
                        <tr key={row.id}>
                            <td className="px-4 py-2 font-medium text-foreground">
                                {formatOccupancyDate(row.date, locale)}
                            </td>
                            <td className="px-4 py-2">
                                <Badge variant={getSourceBadgeVariant(row.source)}>
                                    {t(SOURCE_LABEL_KEYS[row.source])}
                                </Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                                {row.note ?? (
                                    <span className="italic">
                                        {t('admin-pages.accommodations.occupancy.noNote')}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Returns a new array of occupancy rows sorted ascending by `date`. */
function sortOccupancyByDate(occupancy: AccommodationOccupancy[]): AccommodationOccupancy[] {
    return [...occupancy].sort((a, b) => a.date.localeCompare(b.date));
}
