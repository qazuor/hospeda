/**
 * CreateProviderButton
 *
 * «Crear proveedor» retry for an approved `service_provider` lead whose
 * directory listing does not exist (HOS-2339). Calls the dedicated
 * `POST .../provision` endpoint (never re-sends the approval email) and toasts
 * the outcome. Renders nothing unless the lead needs a provider and the actor
 * holds ALLIANCE_LEAD_MANAGE.
 */

import { type AllianceLead, PermissionEnum } from '@repo/schemas';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslations } from '@/hooks/use-translations';
import { useHasPermission } from '@/hooks/use-user-permissions';
import { useProvisionAllianceLeadMutation } from '../hooks/useAllianceLeads';
import { resolveRetryToast } from '../provisioning-toast';
import { canRetryProvisioning } from './AllianceLeadProvisioningBadge';

/** Props for `CreateProviderButton`. */
export type CreateProviderButtonProps = {
    readonly lead: AllianceLead;
};

/**
 * Retry button for a missing provider.
 *
 * @param props - `{ lead }`.
 */
export function CreateProviderButton({ lead }: CreateProviderButtonProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const canManage = useHasPermission(PermissionEnum.ALLIANCE_LEAD_MANAGE);
    const provision = useProvisionAllianceLeadMutation();

    if (!canManage || !canRetryProvisioning(lead)) return null;

    const handleProvision = async () => {
        try {
            const result = await provision.mutateAsync({ id: lead.id });
            const toast = resolveRetryToast({ provisioning: result.provisioning });
            addToast({
                variant: toast.variant,
                message: t(toast.messageKey as Parameters<typeof t>[0])
            });
        } catch {
            addToast({
                variant: 'error',
                message: t('admin-entities.allianceLeads.provision.error')
            });
        }
    };

    return (
        <Button
            size="sm"
            variant="outline"
            onClick={handleProvision}
            disabled={provision.isPending}
        >
            {provision.isPending
                ? t('admin-entities.allianceLeads.actions.creatingProvider')
                : t('admin-entities.allianceLeads.actions.createProvider')}
        </Button>
    );
}
