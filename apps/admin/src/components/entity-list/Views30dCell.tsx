/**
 * Views30dCell — display-only cell showing the 30-day total view count for an entity.
 *
 * Renders one of four states:
 * - `'…'` (ellipsis, with pulse animation) while the batch request is in-flight.
 * - The numeric total once data is available (`'0'` for zero views — never blank).
 * - `'—'` (em dash) when the batch request fails.
 * - Nothing (`null`) when the user lacks `ANALYTICS_VIEW` permission.
 *
 * The cell self-gates its fetch via `useHasPermission(ANALYTICS_VIEW)` so that
 * a future direct render (outside a permission-gated column factory) can never
 * fire the admin endpoint without the required permission. This mirrors the
 * pattern used by `EntityViewStatChips`.
 *
 * @module Views30dCell
 */

import { useHasPermission } from '@/hooks/use-user-permissions';
import { type ViewsBatchEntityType, useViewsBatch } from '@/hooks/use-views-batch';
import { PermissionEnum } from '@repo/schemas';

/** Props for {@link Views30dCell}. RO-RO pattern. */
export interface Views30dCellProps {
    /** UUID of the entity whose 30-day view total is shown. */
    readonly entityId: string;
    /** Entity type used as the `entityType` query param on the batch endpoint. */
    readonly entityType: ViewsBatchEntityType;
}

/**
 * Renders a single entity's 30-day total view count using the admin batch endpoint.
 *
 * Guards itself: if the current user lacks `ANALYTICS_VIEW` permission, nothing
 * is rendered and no API call is made (mirrors `EntityViewStatChips` AC-23).
 *
 * @param props - {@link Views30dCellProps}
 * @returns React element with the view count, loading placeholder, error dash, or null.
 */
export function Views30dCell({ entityId, entityType }: Views30dCellProps) {
    const hasAnalyticsView = useHasPermission(PermissionEnum.ANALYTICS_VIEW);

    const { viewsMap, isLoading, isError } = useViewsBatch({
        entityType,
        entityIds: [entityId],
        enabled: hasAnalyticsView
    });

    // No render + no fetch without ANALYTICS_VIEW (mirrors EntityViewStatChips AC-23)
    if (!hasAnalyticsView) {
        return null;
    }

    if (isLoading) {
        return <span className="animate-pulse text-muted-foreground">…</span>;
    }

    if (isError) {
        return <span className="text-muted-foreground">—</span>;
    }

    const total = viewsMap.get(entityId) ?? 0;
    return <span className="tabular-nums">{total}</span>;
}
