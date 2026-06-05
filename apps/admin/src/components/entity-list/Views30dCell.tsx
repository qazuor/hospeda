/**
 * Views30dCell — display-only cell showing the 30-day total view count for an entity.
 *
 * Renders one of four states:
 * - `'…'` (ellipsis, with pulse animation) while the batch request is in-flight.
 * - The numeric total once data is available (`'0'` for zero views — never blank).
 * - `'—'` (em dash) when the batch request fails.
 *
 * The column (and therefore this component) is only included in the table when
 * the calling entity config detects the user has ANALYTICS_VIEW permission.
 * Without that permission, the column is absent and no API call is made.
 *
 * @module Views30dCell
 */

import { type ViewsBatchEntityType, useViewsBatch } from '@/hooks/use-views-batch';

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
 * @param props - {@link Views30dCellProps}
 * @returns React element with the view count, loading placeholder, or error dash.
 */
export function Views30dCell({ entityId, entityType }: Views30dCellProps) {
    const { viewsMap, isLoading, isError } = useViewsBatch({
        entityType,
        entityIds: [entityId]
    });

    if (isLoading) {
        return <span className="animate-pulse text-muted-foreground">…</span>;
    }

    if (isError) {
        return <span className="text-muted-foreground">—</span>;
    }

    const total = viewsMap.get(entityId) ?? 0;
    return <span className="tabular-nums">{total}</span>;
}
