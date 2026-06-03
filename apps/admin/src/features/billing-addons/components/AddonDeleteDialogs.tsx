/**
 * Confirmation dialogs for the destructive addon catalog actions (SPEC-192 T-021).
 *
 * - {@link AddonSoftDeleteConfirmDialog} confirms a soft-delete.
 * - {@link AddonHardDeleteConfirmDialog} warns that a permanent delete cannot be undone
 *   and will be blocked if the addon is referenced by purchase records.
 *
 * Both use the shared shadcn AlertDialog primitives, mirroring PlanDeleteDialogs.tsx.
 * The `t` function is passed as a prop to avoid TypeScript strict key checking
 * (consistent with how billing-plans dialogs work in practice).
 */
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import type { ParsedAddonRecord } from '../types';

interface AddonConfirmDialogProps {
    /** The addon pending confirmation, or null when the dialog is closed. */
    readonly addon: ParsedAddonRecord | null;
    /** Called when the dialog is dismissed without confirming. */
    readonly onCancel: () => void;
    /** Called when the destructive action is confirmed. */
    readonly onConfirm: () => void;
    /** Translation function (typed as string to support arbitrary i18n keys). */
    readonly t: (key: string) => string;
}

/**
 * Soft-delete confirmation dialog for addon catalog entries.
 */
export function AddonSoftDeleteConfirmDialog({
    addon,
    onCancel,
    onConfirm,
    t
}: AddonConfirmDialogProps) {
    return (
        <AlertDialog
            open={addon != null}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t('admin-billing.addons.catalog.actionDelete')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin-billing.addons.catalog.confirmSoftDelete')}{' '}
                        <strong>{addon?.name}</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        {t('admin-billing.common.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        {t('admin-billing.addons.catalog.actionDelete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Permanent-delete confirmation dialog for addon catalog entries.
 * Warns the action is irreversible and will be blocked if the addon has purchases.
 */
export function AddonHardDeleteConfirmDialog({
    addon,
    onCancel,
    onConfirm,
    t
}: AddonConfirmDialogProps) {
    return (
        <AlertDialog
            open={addon != null}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t('admin-billing.addons.catalog.actionHardDelete')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin-billing.addons.catalog.confirmHardDelete')}{' '}
                        <strong>{addon?.name}</strong>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        {t('admin-billing.common.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {t('admin-billing.addons.catalog.actionHardDelete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
