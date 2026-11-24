/**
 * @file use-occupancy-month.ts
 * @description The viewed month of the occupancy calendar and its rows
 * (HOS-43, split out of `CalendarSection` by HOS-2503).
 *
 * Navigation is forward-only: occupancy is future-facing, so the current month
 * is the floor. Rows are fetched for the viewed month on mount, on every
 * navigation and whenever {@link UseOccupancyMonthResult.reload} is called.
 * A date can carry several rows, one per source (HOS-162), so they are kept
 * grouped by date.
 */

import type { AccommodationOccupancy } from '@repo/schemas';
import {
    type Dispatch,
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';
import { accommodationOccupancyApi } from '@/lib/api/endpoints-protected';
import {
    addMonths,
    compareMonths,
    type DateKey,
    getStartOfMonth,
    toDateKey
} from '@/lib/calendar/occupancy-calendar-grid';
import { groupOccupancyRowsByDate } from '@/lib/calendar/occupancy-row-grouping';
import { webLogger } from '@/lib/logger';

/** Occupancy rows of the viewed month, grouped by date key. */
export type OccupancyByDate = Readonly<Record<DateKey, readonly AccommodationOccupancy[]>>;

/** Input of {@link useOccupancyMonth}. */
export interface UseOccupancyMonthInput {
    /** The accommodation whose occupancy is shown. */
    readonly accommodationId: string;
}

/** What {@link useOccupancyMonth} returns. */
export interface UseOccupancyMonthResult {
    /** First day of the month on screen. */
    readonly viewedMonth: Date;
    /** False on the current month: past months are never shown. */
    readonly canGoPrev: boolean;
    /** Rows of the viewed month, grouped by date. */
    readonly occupancyByDate: OccupancyByDate;
    /** Replaces the grouped rows (used after a batch mutation). */
    readonly setOccupancyByDate: Dispatch<SetStateAction<OccupancyByDate>>;
    /** True while the viewed month is being fetched. */
    readonly isLoading: boolean;
    /** True when the last fetch failed. */
    readonly loadError: boolean;
    /** Goes one month back, never before the current month. */
    readonly goPrev: () => void;
    /** Goes one month forward. */
    readonly goNext: () => void;
    /** Re-fetches the viewed month. */
    readonly reload: () => void;
}

/**
 * Holds the viewed month and fetches its occupancy rows.
 *
 * @param input - See {@link UseOccupancyMonthInput}.
 * @returns See {@link UseOccupancyMonthResult}.
 */
export function useOccupancyMonth({
    accommodationId
}: UseOccupancyMonthInput): UseOccupancyMonthResult {
    const [viewedMonth, setViewedMonth] = useState<Date>(() =>
        getStartOfMonth({ date: new Date() })
    );
    const minMonth = useMemo(() => getStartOfMonth({ date: new Date() }), []);
    const canGoPrev = compareMonths({ a: viewedMonth, b: minMonth }) > 0;

    const [occupancyByDate, setOccupancyByDate] = useState<OccupancyByDate>({});
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    // Bumped to force the viewed month to re-fetch.
    const [reloadKey, setReloadKey] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is an intentional manual refetch trigger (bumped after an edit/delete), not read inside the effect body
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setLoadError(false);

        const from = toDateKey({ date: viewedMonth });
        const to = toDateKey({ date: addMonths({ date: viewedMonth, delta: 1 }) });

        const load = async (): Promise<void> => {
            try {
                const result = await accommodationOccupancyApi.list({
                    id: accommodationId,
                    from,
                    to
                });
                if (cancelled) return;
                if (!result.ok) {
                    webLogger.warn('[CalendarSection] list failed:', result.error);
                    setLoadError(true);
                    setIsLoading(false);
                    return;
                }
                setOccupancyByDate(groupOccupancyRowsByDate({ rows: result.data.occupancy }));
                setIsLoading(false);
            } catch (err: unknown) {
                if (cancelled) return;
                webLogger.warn('[CalendarSection] list error:', err);
                setLoadError(true);
                setIsLoading(false);
            }
        };
        void load();

        return () => {
            cancelled = true;
        };
    }, [accommodationId, viewedMonth, reloadKey]);

    const goPrev = useCallback(() => {
        setViewedMonth((prev) => {
            const target = addMonths({ date: prev, delta: -1 });
            return compareMonths({ a: target, b: minMonth }) < 0 ? prev : target;
        });
    }, [minMonth]);

    const goNext = useCallback(() => {
        setViewedMonth((prev) => addMonths({ date: prev, delta: 1 }));
    }, []);

    const reload = useCallback(() => {
        setReloadKey((k) => k + 1);
    }, []);

    return {
        viewedMonth,
        canGoPrev,
        occupancyByDate,
        setOccupancyByDate,
        isLoading,
        loadError,
        goPrev,
        goNext,
        reload
    };
}
