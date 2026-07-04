/**
 * @file DashboardDateRangeFilter.tsx
 * @description Date-range filter for the social pipeline dashboard (HOS-66 T-009).
 *
 * Two independent date inputs (from/to) driving `useSocialDashboard`'s optional
 * `dateFrom`/`dateTo` filters (HOS-66 T-005/T-007). Each bound clears
 * independently to `undefined`; a reset button clears both at once and is
 * only rendered while at least one bound is active.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { RotateCcwIcon } from '@repo/icons';

/** Props for {@link DashboardDateRangeFilter}. */
export interface DashboardDateRangeFilterProps {
    /** Current from-bound value as ISO YYYY-MM-DD, or undefined when not set. */
    readonly dateFrom: string | undefined;
    /** Current to-bound value as ISO YYYY-MM-DD, or undefined when not set. */
    readonly dateTo: string | undefined;
    /** Called with the new from-bound, or undefined to clear it. */
    readonly onChangeDateFrom: (value: string | undefined) => void;
    /** Called with the new to-bound, or undefined to clear it. */
    readonly onChangeDateTo: (value: string | undefined) => void;
}

/**
 * Date-range filter control for the social dashboard.
 *
 * @param props - {@link DashboardDateRangeFilterProps}
 */
export function DashboardDateRangeFilter({
    dateFrom,
    dateTo,
    onChangeDateFrom,
    onChangeDateTo
}: DashboardDateRangeFilterProps) {
    const { t } = useTranslations();
    const isActive = dateFrom !== undefined || dateTo !== undefined;

    const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim();
        onChangeDateFrom(val === '' ? undefined : val);
    };

    const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim();
        onChangeDateTo(val === '' ? undefined : val);
    };

    const handleReset = () => {
        onChangeDateFrom(undefined);
        onChangeDateTo(undefined);
    };

    return (
        <div
            className="flex items-end gap-3"
            data-testid="dashboard-date-range-filter"
        >
            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor="dashboard-date-from"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.dashboard.filters.from')}
                </label>
                <Input
                    id="dashboard-date-from"
                    data-testid="dashboard-date-from"
                    type="date"
                    className="w-40"
                    value={dateFrom ?? ''}
                    onChange={handleFromChange}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor="dashboard-date-to"
                    className="text-muted-foreground text-xs"
                >
                    {t('social.dashboard.filters.to')}
                </label>
                <Input
                    id="dashboard-date-to"
                    data-testid="dashboard-date-to"
                    type="date"
                    className="w-40"
                    value={dateTo ?? ''}
                    onChange={handleToChange}
                />
            </div>
            {isActive && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-testid="dashboard-date-reset"
                    onClick={handleReset}
                    className="gap-1.5"
                >
                    <RotateCcwIcon className="h-3.5 w-3.5" />
                    {t('social.dashboard.filters.reset')}
                </Button>
            )}
        </div>
    );
}
