/**
 * AllianceLeadProvisioningBadge
 *
 * Persistent «Proveedor no creado» marker for an approved `service_provider`
 * lead whose directory listing does not exist (HOS-2339). Derived state: it
 * needs no column, so it survives reloads and shows for every admin.
 */

import type { AllianceLead } from '@repo/schemas';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { hasProvisionableData, type ProvisionableLeadFields } from '../lead-provisionable';

/**
 * Whether an approved lead still needs its provider created.
 *
 * The single predicate shared by the badge, the retry button and the tests.
 *
 * @param lead - The lead row.
 * @returns `true` for an approved `service_provider` lead with no provisioned listing.
 */
export function needsProvider(
    lead: Pick<AllianceLead, 'status' | 'kind' | 'provisionedHostTradeId'>
) {
    return (
        lead.status === 'approved' &&
        lead.kind === 'service_provider' &&
        !lead.provisionedHostTradeId
    );
}

type RetryableLead = Pick<AllianceLead, 'status' | 'kind' | 'provisionedHostTradeId'> &
    ProvisionableLeadFields;

/**
 * Whether the «Crear proveedor» retry can succeed: the lead needs a provider
 * AND carries the typed data automatic provisioning requires. Linking a
 * hand-made listing, or dismissing the badge, is out of scope (HOS-2339).
 *
 * @param lead - The lead row.
 */
export function canRetryProvisioning(lead: RetryableLead) {
    return needsProvider(lead) && hasProvisionableData(lead);
}

/** Props for `AllianceLeadProvisioningBadge`. */
export type AllianceLeadProvisioningBadgeProps = {
    /** The lead the badge is for. Renders nothing when it needs no provider. */
    readonly lead: RetryableLead;
};

/**
 * Renders the «Proveedor no creado» badge, or nothing. The text is the
 * accessible name, so the state is never conveyed by colour alone.
 *
 * @param props - `{ lead }`.
 */
export function AllianceLeadProvisioningBadge({ lead }: AllianceLeadProvisioningBadgeProps) {
    const { t } = useTranslations();
    if (!needsProvider(lead)) return null;
    return (
        <Badge
            variant={hasProvisionableData(lead) ? 'destructive' : 'outline'}
            data-testid="provider-not-created-badge"
        >
            {t('admin-entities.allianceLeads.badge.providerNotCreated')}
        </Badge>
    );
}
