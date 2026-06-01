/**
 * Confirmation dialogs for the destructive plan actions (SPEC-168).
 *
 * - {@link SoftDeleteConfirmDialog} surfaces the plan's live subscriber count
 *   before a soft-delete so the admin understands the impact.
 * - {@link HardDeleteConfirmDialog} warns that a permanent delete cannot be
 *   undone.
 *
 * Both replace the previous native `window.confirm` flow and use the shared
 * shadcn AlertDialog primitives.
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
import { useTranslations } from '@/hooks/use-translations';
import type { ParsedPlanRecord } from '../types';

interface PlanConfirmDialogProps {
    /** The plan pending confirmation, or null when the dialog is closed. */
    readonly plan: ParsedPlanRecord | null;
    /** Called when the dialog is dismissed without confirming. */
    readonly onCancel: () => void;
    /** Called when the destructive action is confirmed. */
    readonly onConfirm: () => void;
}

/**
 * Soft-delete confirmation dialog. Interpolates the plan's
 * `activeSubscriptionCount` into the confirmation copy via the `{count}` token.
 */
export function SoftDeleteConfirmDialog({ plan, onCancel, onConfirm }: PlanConfirmDialogProps) {
    const { t } = useTranslations();

    return (
        <AlertDialog
            open={plan != null}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin-billing.plans.actionDelete')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin-billing.plans.confirmSoftDeleteWithCount', {
                            count: plan?.activeSubscriptionCount ?? 0
                        })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        {t('admin-billing.plans.dialog.cancelButton')}
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>
                        {t('admin-billing.plans.actionDelete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * Permanent-delete confirmation dialog. Warns the action is irreversible.
 */
export function HardDeleteConfirmDialog({ plan, onCancel, onConfirm }: PlanConfirmDialogProps) {
    const { t } = useTranslations();

    return (
        <AlertDialog
            open={plan != null}
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('admin-billing.plans.actionHardDelete')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('admin-billing.plans.confirmHardDelete')}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>
                        {t('admin-billing.plans.dialog.cancelButton')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {t('admin-billing.plans.actionHardDelete')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
