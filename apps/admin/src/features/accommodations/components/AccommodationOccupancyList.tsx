/**
 * AccommodationOccupancyList — read-only occupancy table for the admin
 * accommodation detail page (HOS-43 Phase 1, spec section 9).
 *
 * Renders every occupied day for an accommodation as a compact table
 * (date / origin badge / note). No editing affordances — this is a staff
 * read-only view, gated server-side by `ACCOMMODATION_OCCUPANCY_VIEW`.
 */

import { formatDate, type TranslationKey, useTranslations } from '@repo/i18n';
import type { AccommodationOccupancy } from '@repo/schemas';
import { OccupancySourceEnum } from '@repo/schemas';
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
 * The DB column is a timezone-less Postgres `date`, so parsing/formatting
 * MUST stay in UTC end-to-end — passing the raw string through
 * `Intl.DateTimeFormat` without pinning `timeZone: 'UTC'` would shift the
 * displayed day backward for any viewer west of UTC (e.g. Argentina, UTC-3).
 */
function formatOccupancyDate(date: string, locale: string): string {
    return formatDate({
        date,
        locale,
        options: { dateStyle: 'medium', timeZone: 'UTC' }
    });
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
