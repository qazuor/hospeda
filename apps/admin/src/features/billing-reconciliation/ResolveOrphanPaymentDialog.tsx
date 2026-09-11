import type { ApiErrorShape } from '@repo/i18n';
import { ResolveOrphanPaymentRequestSchema } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { translateAdminApiError } from '@/lib/errors';
import type { useResolveOrphanPaymentMutation } from './hooks';
import type { OrphanQueueItem, OrphanQueueResolution } from './types';
import { formatArsFromCents, getQueueFlowLabel, getQueueReasonLabel } from './utils';

/** The shortest note the API will accept — mirrored so the button can gate on it. */
const MIN_NOTE_LENGTH = 10;

/**
 * Props for {@link ResolveOrphanPaymentDialog}.
 */
export interface ResolveOrphanPaymentDialogProps {
    readonly item: OrphanQueueItem | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly resolveMutation: ReturnType<typeof useResolveOrphanPaymentMutation>;
    readonly addToast: ReturnType<typeof useToast>['addToast'];
}

/**
 * Verdict dialog for one queued orphan payment (HOS-1001).
 *
 * Records what a human decided about a charge the platform took and could not
 * book. Two things it deliberately does NOT do:
 *
 * - **It does not book the payment itself.** Backfilling the ledger row is the
 *   neighbouring `POST /backfill-payment` verb, which needs the MercadoPago
 *   payment looked up and a local subscription named explicitly. Collapsing the
 *   two would let "I looked at this" write money.
 * - **It offers no way back to `unresolved`.** Reopening a triaged payment is a
 *   decision with consequences of its own; the resolution union has two members
 *   and the API refuses a third.
 *
 * The note is required and non-trivial for the same reason the sibling rescue
 * verbs require one: the ids record WHICH payment was closed and nothing at all
 * about whether the customer was made whole.
 */
export function ResolveOrphanPaymentDialog({
    item,
    open,
    onOpenChange,
    resolveMutation,
    addToast
}: ResolveOrphanPaymentDialogProps) {
    const { t, locale } = useTranslations();
    const form = useForm({
        defaultValues: {
            resolution: 'resolved' as OrphanQueueResolution,
            note: ''
        },
        onSubmit: async ({ value }) => {
            if (!item) return;

            const validated = ResolveOrphanPaymentRequestSchema.safeParse({
                orphanPaymentId: item.id,
                resolution: value.resolution,
                note: value.note
            });
            if (!validated.success) return;

            try {
                await resolveMutation.mutateAsync(validated.data);
                addToast({
                    message: t('admin-billing.reconciliation.queue.resolveDialog.success'),
                    variant: 'success'
                });
                onOpenChange(false);
            } catch (error) {
                addToast({
                    message: `${t('admin-billing.reconciliation.queue.resolveDialog.error')} ${translateAdminApiError({ error: error as ApiErrorShape, t })}`,
                    variant: 'error'
                });
            }
        }
    });

    // Reset on every open so a previous row's note never leaks onto the next
    // one — the note is the audit record, and inheriting it would attach one
    // payment's justification to another's.
    useEffect(() => {
        if (open) {
            form.reset({ resolution: 'resolved', note: '' });
        }
    }, [open, form]);

    if (!item) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.reconciliation.queue.resolveDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.reconciliation.queue.resolveDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    className="grid gap-4"
                >
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        {t('admin-billing.reconciliation.queue.resolveDialog.auditWarning')}
                    </div>

                    <dl className="grid gap-1 text-xs">
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">
                                {t('admin-billing.reconciliation.queue.columns.providerPaymentId')}
                            </dt>
                            <dd className="font-mono">{item.providerPaymentId}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">
                                {t('admin-billing.reconciliation.queue.columns.amount')}
                            </dt>
                            <dd className="font-medium">
                                {formatArsFromCents(item.amountInCents, locale)}
                            </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">
                                {t('admin-billing.reconciliation.queue.columns.flow')}
                            </dt>
                            <dd>{getQueueFlowLabel(item.flow, t)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">
                                {t('admin-billing.reconciliation.queue.columns.reason')}
                            </dt>
                            <dd>{getQueueReasonLabel(item.reason, t)}</dd>
                        </div>
                    </dl>

                    <form.Field name="resolution">
                        {(field) => (
                            <div className="grid gap-2">
                                <Label htmlFor="orphan-resolution">
                                    {t(
                                        'admin-billing.reconciliation.queue.resolveDialog.resolutionLabel'
                                    )}{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <select
                                    id="orphan-resolution"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={field.state.value}
                                    onChange={(e) =>
                                        field.handleChange(e.target.value as OrphanQueueResolution)
                                    }
                                    onBlur={field.handleBlur}
                                >
                                    <option value="resolved">
                                        {t(
                                            'admin-billing.reconciliation.queue.resolutions.resolved'
                                        )}
                                    </option>
                                    <option value="dismissed">
                                        {t(
                                            'admin-billing.reconciliation.queue.resolutions.dismissed'
                                        )}
                                    </option>
                                </select>
                                <p className="text-muted-foreground text-xs">
                                    {t(
                                        'admin-billing.reconciliation.queue.resolveDialog.resolutionHint'
                                    )}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="note">
                        {(field) => (
                            <div className="grid gap-2">
                                <Label htmlFor="orphan-note">
                                    {t(
                                        'admin-billing.reconciliation.queue.resolveDialog.noteLabel'
                                    )}{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <textarea
                                    id="orphan-note"
                                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder={t(
                                        'admin-billing.reconciliation.queue.resolveDialog.notePlaceholder'
                                    )}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                />
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.reconciliation.queue.resolveDialog.noteHint')}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={resolveMutation.isPending}
                        >
                            {t('admin-billing.common.cancel')}
                        </Button>
                        {/*
                          `form.Subscribe` rather than reading `form.state` in the
                          render body: this repo has already been bitten by the
                          latter freezing the value so the button never enables.
                        */}
                        <form.Subscribe selector={(state) => state.values}>
                            {(values) => (
                                <Button
                                    type="submit"
                                    disabled={
                                        values.note.trim().length < MIN_NOTE_LENGTH ||
                                        resolveMutation.isPending
                                    }
                                >
                                    {resolveMutation.isPending
                                        ? t(
                                              'admin-billing.reconciliation.queue.resolveDialog.processingButton'
                                          )
                                        : t(
                                              'admin-billing.reconciliation.queue.resolveDialog.confirmButton'
                                          )}
                                </Button>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
