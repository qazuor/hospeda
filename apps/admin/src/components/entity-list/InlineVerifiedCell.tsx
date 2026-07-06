/**
 * InlineVerifiedCell — accommodation-specific inline editable "Verificado"
 * (isVerified) cell (SPEC-291).
 *
 * Renders a Radix `Switch` gated by `permission`. Toggling POSTs
 * `{ isVerified }` to the dedicated `POST /accommodations/:id/verify` admin
 * endpoint via {@link useVerifyAccommodationMutation}, then surfaces a
 * success/error toast. Users lacking the permission see the read-only
 * `BooleanCell`.
 *
 * Unlike {@link InlineFeaturedCell}, this is NOT entity-generic: verification
 * is accommodation-only (server-managed `isVerified`/`verifiedAt`/`verifiedById`
 * columns, set exclusively by the dedicated verify endpoint), so the mutation
 * hook is imported directly rather than injected.
 */

import type { PermissionEnum } from '@repo/schemas';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { BooleanCell } from '@/components/table/cells/BooleanCell';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/ToastProvider';
import { useVerifyAccommodationMutation } from '@/features/accommodations/hooks/useAccommodationQuery';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';

/**
 * Props for {@link InlineVerifiedCell}. RO-RO pattern.
 */
export interface InlineVerifiedCellProps {
    /** Accommodation ID being edited (passed to the verify mutation). */
    readonly entityId: string;
    /** Human-readable accommodation name, interpolated into the success toast. */
    readonly entityName: string;
    /** Current verified state. */
    readonly checked: boolean;
    /** Permission required to edit. Without it the cell is read-only. */
    readonly permission: PermissionEnum;
}

/**
 * Inline editable verified toggle for the accommodations list.
 */
export function InlineVerifiedCell({
    entityId,
    entityName,
    checked,
    permission
}: InlineVerifiedCellProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const mutation = useVerifyAccommodationMutation(entityId);

    const handleChange = async (next: boolean) => {
        try {
            await mutation.mutateAsync({ isVerified: next });
            addToast({
                message: t(
                    next
                        ? 'admin-entities.messages.verifiedOn'
                        : 'admin-entities.messages.verifiedOff',
                    { name: entityName }
                ),
                variant: 'success'
            });
        } catch (error) {
            adminLogger.error('[InlineVerifiedCell] Failed to toggle isVerified', {
                id: entityId,
                error
            });
            addToast({
                message: t('admin-entities.messages.error.update', {
                    entity: t('admin-entities.entities.accommodation.singular')
                }),
                variant: 'error'
            });
        }
    };

    return (
        <PermissionGate
            permissions={[permission]}
            fallback={<BooleanCell value={checked} />}
        >
            <div className="flex items-center">
                <Switch
                    checked={checked}
                    disabled={mutation.isPending}
                    onCheckedChange={handleChange}
                    aria-label={t('admin-entities.columns.verified')}
                    className="scale-75"
                />
            </div>
        </PermissionGate>
    );
}
