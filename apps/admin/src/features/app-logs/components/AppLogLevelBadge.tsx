/**
 * AppLogLevelBadge
 *
 * Renders a styled badge for an app log level value.
 * WARN → amber/yellow styling, ERROR → destructive (red).
 */

import type { AppLogEntryLevel } from '@repo/schemas';
import { Badge } from '@/components/ui/badge';

/** Props for AppLogLevelBadge */
export interface AppLogLevelBadgeProps {
    /** The log level to display */
    readonly level: AppLogEntryLevel;
}

/**
 * Renders a badge for a log level with appropriate color semantics.
 *
 * @param props - Component props.
 */
export function AppLogLevelBadge({ level }: AppLogLevelBadgeProps) {
    if (level === 'ERROR') {
        return <Badge variant="destructive">ERROR</Badge>;
    }
    // WARN — use a yellow/amber inline style since shadcn badge has no warning variant
    return (
        <Badge
            variant="outline"
            className="border-yellow-400 bg-yellow-50 text-yellow-800"
        >
            WARN
        </Badge>
    );
}
