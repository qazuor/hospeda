/**
 * CommerceLeadStatusBadge
 *
 * Maps a `CommerceLeadStatus` value to a colour-coded Shadcn `Badge` with an
 * i18n label.  Keeps all status → variant mapping in one place.
 */

import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import type { CommerceLeadStatus } from '@repo/schemas';

/** Props for `CommerceLeadStatusBadge`. */
export type CommerceLeadStatusBadgeProps = {
    /** The workflow status of the commerce lead. */
    readonly status: CommerceLeadStatus;
};

/**
 * Renders a colour-coded badge for a commerce-lead status.
 *
 * @param props - `{ status }`.
 * @returns A Shadcn `<Badge>` element.
 *
 * @example
 * ```tsx
 * <CommerceLeadStatusBadge status="pending" />
 * ```
 */
export function CommerceLeadStatusBadge({ status }: CommerceLeadStatusBadgeProps) {
    const { t } = useTranslations();

    const variantMap: Record<
        CommerceLeadStatus,
        'default' | 'secondary' | 'destructive' | 'outline'
    > = {
        pending: 'outline',
        reviewing: 'secondary',
        approved: 'default',
        rejected: 'destructive'
    };

    const labelKeyMap: Record<CommerceLeadStatus, string> = {
        pending: 'admin-entities.commerceLeads.status.pending',
        reviewing: 'admin-entities.commerceLeads.status.reviewing',
        approved: 'admin-entities.commerceLeads.status.approved',
        rejected: 'admin-entities.commerceLeads.status.rejected'
    };

    return (
        <Badge variant={variantMap[status]}>
            {t(labelKeyMap[status] as Parameters<typeof t>[0])}
        </Badge>
    );
}
