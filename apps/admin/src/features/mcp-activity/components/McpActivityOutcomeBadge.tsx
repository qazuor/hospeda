/**
 * McpActivityOutcomeBadge (HOS-2349)
 *
 * The result of one assistant tool call: success -> success, denied ->
 * secondary, error -> destructive. The label comes translated from the caller.
 */

import type { McpActivityOutcome } from '@repo/schemas';
import { Badge } from '@/components/ui/badge';

/** Props for {@link McpActivityOutcomeBadge}. */
export interface McpActivityOutcomeBadgeProps {
    /** The recorded outcome. */
    readonly outcome: McpActivityOutcome;
    /** The translated label of that outcome. */
    readonly label: string;
}

/** Badge variant of each outcome. */
const VARIANT_BY_OUTCOME = {
    success: 'success',
    denied: 'secondary',
    error: 'destructive'
} as const satisfies Record<McpActivityOutcome, 'success' | 'secondary' | 'destructive'>;

/**
 * Renders the outcome badge of an activity row.
 *
 * @param props - Component props.
 */
export function McpActivityOutcomeBadge({ outcome, label }: McpActivityOutcomeBadgeProps) {
    return (
        <Badge
            variant={VARIANT_BY_OUTCOME[outcome]}
            data-testid="mcp-activity-cell-outcome"
        >
            {label}
        </Badge>
    );
}
