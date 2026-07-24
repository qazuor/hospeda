/**
 * AllianceLeadStatusBadge
 *
 * Maps an `AllianceLeadStatus` value to a colour-coded Shadcn `Badge` with an
 * i18n label. Keeps all status → variant mapping in one place.
 */

import type { AllianceLeadStatus } from '@repo/schemas';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';

/** Props for `AllianceLeadStatusBadge`. */
export type AllianceLeadStatusBadgeProps = {
    /** The workflow status of the alliance lead. */
    readonly status: AllianceLeadStatus;
};

/**
 * Renders a colour-coded badge for an alliance-lead status.
 *
 * @param props - `{ status }`.
 * @returns A Shadcn `<Badge>` element.
 *
 * @example
 * ```tsx
 * <AllianceLeadStatusBadge status="pending" />
 * ```
 */
export function AllianceLeadStatusBadge({ status }: AllianceLeadStatusBadgeProps) {
    const { t } = useTranslations();

    const variantMap: Record<
        AllianceLeadStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        pending: 'outline',
        reviewing: 'secondary',
        approved: 'default',
        rejected: 'destructive'
    };

    const labelKeyMap: Record<AllianceLeadStatus, string> = {
        pending: 'admin-entities.allianceLeads.status.pending',
        reviewing: 'admin-entities.allianceLeads.status.reviewing',
        approved: 'admin-entities.allianceLeads.status.approved',
        rejected: 'admin-entities.allianceLeads.status.rejected'
    };

    return (
        <Badge variant={variantMap[status]}>
            {t(labelKeyMap[status] as Parameters<typeof t>[0])}
        </Badge>
    );
}
