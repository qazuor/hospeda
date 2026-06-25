/**
 * AuditSeverityBadge
 *
 * Renders a styled badge for an audit/security log severity value.
 * critical -> destructive (red), info -> neutral outline.
 */
import { Badge } from '@/components/ui/badge';
import type { AuditLogSeverity } from '@repo/schemas';

/** Props for AuditSeverityBadge */
export interface AuditSeverityBadgeProps {
    /** The severity to display */
    readonly severity: AuditLogSeverity;
}

/**
 * Renders a badge for an audit severity with appropriate color semantics.
 *
 * @param props - Component props.
 */
export function AuditSeverityBadge({ severity }: AuditSeverityBadgeProps) {
    if (severity === 'critical') {
        return <Badge variant="destructive">CRITICAL</Badge>;
    }
    return <Badge variant="outline">INFO</Badge>;
}
