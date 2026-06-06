/**
 * EntityViewStatChips — four read-only chips showing 7d/30d unique and total
 * view counts for a single entity on admin detail pages.
 *
 * States:
 * - **Loading**: animated skeleton pills while either window request is in-flight.
 * - **Zero**: renders "0" chips — chips are never hidden when the entity has no views.
 * - **Error**: renders "—" chips — minimal indication that stats are unavailable.
 * - **No permission**: renders nothing AND fires no API call when the user lacks
 *   `ANALYTICS_VIEW`.
 *
 * AC-17, AC-18, AC-19, AC-20, AC-21, AC-22 (view-mode only — enforced by the
 * section config's `modes: ['view']`), AC-23.
 *
 * @module EntityViewStatChips
 */

import { type UseEntityViewStatsResult, useEntityViewStats } from '@/hooks/use-entity-view-stats';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import type { ViewsBatchEntityType } from '@/hooks/use-views-batch';
import type { TranslationKey } from '@repo/i18n';
import { PermissionEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Internal chip primitive
// ---------------------------------------------------------------------------

interface ChipProps {
    /** Primary label (e.g. "Únicos" or "Totales"). */
    readonly label: string;
    /** Window prefix shown before the label (e.g. "7d"). */
    readonly window: '7d' | '30d';
    /** Numeric value. Null renders "—". */
    readonly value: number | null;
    /** Accessible description for screen readers. */
    readonly ariaLabel: string;
    /** Whether to show a loading skeleton instead of the value. */
    readonly loading: boolean;
}

function Chip({ label, window: win, value, ariaLabel, loading }: ChipProps) {
    const chipValue = loading ? null : value;

    return (
        <div
            aria-label={ariaLabel}
            className="flex flex-col items-center rounded-md border bg-muted/40 px-3 py-2 text-sm"
        >
            <span className="font-medium text-muted-foreground text-xs">
                {win} {label}
            </span>
            {loading ? (
                <span
                    aria-hidden="true"
                    className="mt-1 h-5 w-10 animate-pulse rounded bg-muted"
                />
            ) : (
                <span className="mt-1 font-semibold tabular-nums">
                    {chipValue === null ? '—' : String(chipValue)}
                </span>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Chip group
// ---------------------------------------------------------------------------

interface ChipGroupProps {
    readonly stats: UseEntityViewStatsResult;
}

function ChipGroup({ stats }: ChipGroupProps) {
    const { t } = useTranslations();

    const uniqueLabel = t('admin-entities.detail.viewStats.chips.unique' as TranslationKey);
    const totalLabel = t('admin-entities.detail.viewStats.chips.total' as TranslationKey);

    const buildAriaUnique = (win: '7d' | '30d', count: number | null) => {
        if (count === null) return '';
        return t('admin-entities.detail.viewStats.chips.ariaUnique' as TranslationKey, {
            window: win,
            count: String(count)
        });
    };

    const buildAriaTotal = (win: '7d' | '30d', count: number | null) => {
        if (count === null) return '';
        return t('admin-entities.detail.viewStats.chips.ariaTotal' as TranslationKey, {
            window: win,
            count: String(count)
        });
    };

    const isLoading = stats.isLoading;

    const get7dUnique = () => {
        if (isLoading) return null;
        if (stats.isError) return null;
        return stats.stats7d?.unique ?? 0;
    };

    const get7dTotal = () => {
        if (isLoading) return null;
        if (stats.isError) return null;
        return stats.stats7d?.total ?? 0;
    };

    const get30dUnique = () => {
        if (isLoading) return null;
        if (stats.isError) return null;
        return stats.stats30d?.unique ?? 0;
    };

    const get30dTotal = () => {
        if (isLoading) return null;
        if (stats.isError) return null;
        return stats.stats30d?.total ?? 0;
    };

    const chips: ReadonlyArray<{
        id: string;
        window: '7d' | '30d';
        label: string;
        value: number | null;
        ariaLabel: string;
    }> = [
        {
            id: '7d-unique',
            window: '7d',
            label: uniqueLabel,
            value: get7dUnique(),
            ariaLabel: buildAriaUnique('7d', get7dUnique())
        },
        {
            id: '7d-total',
            window: '7d',
            label: totalLabel,
            value: get7dTotal(),
            ariaLabel: buildAriaTotal('7d', get7dTotal())
        },
        {
            id: '30d-unique',
            window: '30d',
            label: uniqueLabel,
            value: get30dUnique(),
            ariaLabel: buildAriaUnique('30d', get30dUnique())
        },
        {
            id: '30d-total',
            window: '30d',
            label: totalLabel,
            value: get30dTotal(),
            ariaLabel: buildAriaTotal('30d', get30dTotal())
        }
    ];

    return (
        <div className="flex flex-wrap gap-3">
            {chips.map((chip) => (
                <Chip
                    key={chip.id}
                    label={chip.label}
                    window={chip.window}
                    value={chip.value}
                    ariaLabel={chip.ariaLabel}
                    loading={isLoading}
                />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/** Props for {@link EntityViewStatChips}. RO-RO pattern. */
export interface EntityViewStatChipsProps {
    /** UUID of the entity whose view stats are shown. */
    readonly entityId: string;
    /** Entity type used as the `entityType` query param on the batch endpoint. */
    readonly entityType: ViewsBatchEntityType;
}

/**
 * Renders four stat chips (7d unique, 7d total, 30d unique, 30d total)
 * for a single entity on the admin detail view page.
 *
 * Guards itself: if the current user lacks `ANALYTICS_VIEW` permission,
 * nothing is rendered and no API call is made.
 *
 * @param props - {@link EntityViewStatChipsProps}
 * @returns Chip group or null when the user has no permission.
 *
 * @example
 * ```tsx
 * <EntityViewStatChips entityId={id} entityType="ACCOMMODATION" />
 * ```
 */
export function EntityViewStatChips({ entityId, entityType }: EntityViewStatChipsProps) {
    const { t } = useTranslations();
    const hasAnalyticsView = useHasPermission(PermissionEnum.ANALYTICS_VIEW);

    const stats = useEntityViewStats({
        entityId,
        entityType,
        enabled: hasAnalyticsView
    });

    // AC-23: no render + no fetch without ANALYTICS_VIEW
    if (!hasAnalyticsView) {
        return null;
    }

    return (
        <section
            aria-label={t('admin-entities.detail.viewStats.sectionTitle' as TranslationKey)}
            className="space-y-2"
        >
            <h3 className="font-medium text-muted-foreground text-sm">
                {t('admin-entities.detail.viewStats.sectionTitle' as TranslationKey)}
            </h3>
            <ChipGroup stats={stats} />
        </section>
    );
}
