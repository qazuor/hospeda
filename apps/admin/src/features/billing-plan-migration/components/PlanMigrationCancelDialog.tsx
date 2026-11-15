import type { TranslationKey } from '@repo/i18n';
import type { PlanMigrationDetail } from '@repo/schemas';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors/api-error';
import { useCancelPlanMigration } from '../hooks/usePlanMigrationReads';

/** Confirms cancellation effects before changing any migration scope row. */
export function PlanMigrationCancelDialog({ detail }: { readonly detail: PlanMigrationDetail }) {
    const { t } = useTranslations();
    const tr = (key: string, values?: Record<string, string | number>) =>
        t(`admin-pages.planMigration.${key}` as TranslationKey, values);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cancel = useCancelPlanMigration();
    const confirm = async () => {
        setError(null);
        try {
            await cancel.mutateAsync({ id: detail.id });
            setOpen(false);
        } catch (reason) {
            const code = isApiError(reason) ? String(reason.code) : '';
            setError(
                code === 'PLAN_MIGRATION_ALREADY_CANCELLED' || code === 'PLAN_MIGRATION_NOT_FOUND'
                    ? tr(`errors.${code}`)
                    : tr('errors.generic')
            );
        }
    };
    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
        >
            <AlertDialogTrigger asChild>
                <Button
                    data-testid="plan-migration-cancel"
                    type="button"
                    variant="destructive"
                    disabled={detail.cancelledAt !== null}
                >
                    {tr('cancel.action')}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{tr('cancel.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {tr('cancel.description', {
                            restored: detail.counts.PENDIENTE + detail.counts.PARA_RESOLVER,
                            started: detail.counts.APLICADA
                        })}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error ? <p role="alert">{error}</p> : null}
                <AlertDialogFooter>
                    <AlertDialogCancel>{tr('cancel.dismiss')}</AlertDialogCancel>
                    <AlertDialogAction
                        data-testid="plan-migration-cancel-confirm"
                        disabled={cancel.isPending}
                        onClick={(event) => {
                            event.preventDefault();
                            void confirm();
                        }}
                    >
                        {tr('cancel.confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
