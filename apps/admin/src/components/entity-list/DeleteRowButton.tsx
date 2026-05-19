/**
 * DeleteRowButton — reusable delete action with confirmation dialog.
 *
 * Wraps `DeleteConfirmDialog` with local open-state, mutation triggering, toast
 * feedback, and PermissionGate. Designed to drop into both:
 * - Row actions inside `widgetRenderer` of columns config
 * - Detail page action headers (use `variant="full"`)
 *
 * The hook factory pattern is intentional: each consumer passes its own
 * `useDelete*Mutation` (a top-level import, stable across renders), and the
 * component invokes it once per render. Rules of hooks remain satisfied
 * because the prop reference does not change between renders for a given
 * instance.
 */

import { PermissionGate } from '@/components/auth/PermissionGate';
import { DeleteConfirmDialog } from '@/components/entity-form/fields/DeleteConfirmDialog';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
import { DeleteIcon } from '@repo/icons';
import type { PermissionEnum } from '@repo/schemas';
import { useState } from 'react';

interface DeleteMutationLike {
    readonly mutateAsync: (id: string) => Promise<unknown>;
    readonly isPending: boolean;
}

export interface DeleteRowButtonProps {
    /** Entity ID to delete. */
    readonly entityId: string;
    /** Human-readable entity name shown in the confirmation copy. */
    readonly entityName: string;
    /**
     * Singular entity label (lowercase) used for toast + confirm message
     * interpolation. E.g. "usuario", "amenidad", "característica".
     */
    readonly entityLabel: string;
    /** Permission required to see the action. */
    readonly permission: PermissionEnum;
    /**
     * React hook factory returning the delete mutation. Must be a top-level
     * import (e.g. `useDeleteUserMutation`). The component invokes it once
     * per render.
     */
    readonly useDeleteMutation: () => DeleteMutationLike;
    /** Visual variant. `icon` for table rows, `full` for detail header. */
    readonly variant?: 'icon' | 'full';
    /**
     * Grammatical gender of the entity label, used to pick the correct success
     * message variant (es/pt have gendered past participles). Defaults to `'m'`.
     */
    readonly entityGender?: 'm' | 'f';
    /** Called after a successful deletion. Used by detail pages to navigate back. */
    readonly onDeleted?: () => void;
}

/**
 * Renders a destructive action button (icon or full) gated by `permission`,
 * showing a confirmation dialog and dispatching `useDeleteMutation` on confirm.
 */
export function DeleteRowButton({
    entityId,
    entityName,
    entityLabel,
    permission,
    useDeleteMutation,
    variant = 'icon',
    entityGender = 'm',
    onDeleted
}: DeleteRowButtonProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [open, setOpen] = useState(false);
    const mutation = useDeleteMutation();

    const handleConfirm = async () => {
        try {
            await mutation.mutateAsync(entityId);
            setOpen(false);
            const successKey =
                entityGender === 'f'
                    ? 'admin-entities.messages.deletedFeminine'
                    : 'admin-entities.messages.deleted';
            addToast({
                title: t('admin-entities.actions.delete'),
                message: t(successKey, { entity: entityLabel }),
                variant: 'success'
            });
            onDeleted?.();
        } catch (error) {
            adminLogger.error('[DeleteRowButton] Failed to delete', { entityId, error });
            setOpen(false);
            addToast({
                title: t('admin-entities.messages.error.delete', { entity: entityLabel }),
                message:
                    error instanceof Error
                        ? error.message
                        : t('admin-entities.messages.error.delete', { entity: entityLabel }),
                variant: 'error'
            });
        }
    };

    const ariaLabel = `${t('admin-entities.actions.delete')} ${entityName}`;

    return (
        <PermissionGate permissions={[permission]}>
            {variant === 'full' ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    disabled={mutation.isPending}
                    className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    aria-label={ariaLabel}
                >
                    <DeleteIcon size={16} />
                    {t('admin-entities.actions.delete')}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    disabled={mutation.isPending}
                    title={t('admin-entities.actions.delete')}
                    aria-label={ariaLabel}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                    <DeleteIcon size={16} />
                </button>
            )}
            <DeleteConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title={t('admin-entities.confirmations.delete.title', { entity: entityLabel })}
                description={t('admin-entities.confirmations.delete.message', {
                    entity: entityLabel
                })}
                cancelLabel={t('admin-entities.confirmations.delete.cancel')}
                confirmLabel={t('admin-entities.confirmations.delete.confirm')}
                onConfirm={handleConfirm}
            />
        </PermissionGate>
    );
}
