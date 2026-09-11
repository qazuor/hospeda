import type { ApiErrorShape } from '@repo/i18n';
import { BackfillPaymentRequestSchema, ForceLinkPreapprovalRequestSchema } from '@repo/schemas';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { translateAdminApiError } from '@/lib/errors';
import type { useBackfillPaymentMutation, useForceLinkMutation } from './hooks';
import type { Divergence, ReconcileAction } from './types';

/**
 * The MercadoPago-side identifier a `force-link` binds — the preapproval id.
 *
 * Present on both {@link Divergence} kinds (an `unrecorded-payment` carries a
 * nullable `preapprovalId`, an `orphan-preapproval` carries a required one),
 * so it can be read without narrowing on `kind`.
 */
function getForceLinkTargetId(divergence: Divergence): string | null {
    return divergence.preapprovalId;
}

/**
 * The MercadoPago-side identifier a `backfill-payment` records — the payment
 * id. Only `unrecorded-payment` items carry one.
 */
function getBackfillTargetId(divergence: Divergence): string | null {
    return divergence.kind === 'unrecorded-payment' ? divergence.mpPaymentId : null;
}

/**
 * Props for {@link ReconcileActionDialog}.
 */
export interface ReconcileActionDialogProps {
    readonly divergence: Divergence | null;
    /** Which rescue verb this instance performs. */
    readonly action: ReconcileAction;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    /**
     * A `localSubscriptionId` the operator explicitly chose via "Usar este"
     * on a candidate row. `null`/`undefined` means no explicit choice was
     * made — the destination field then starts EMPTY, never guessed from
     * `divergence.candidates`.
     *
     * This is the field that enforces the tool's non-negotiable design rule:
     * the candidate list itself must never prefill the destination. Only an
     * explicit operator click can put a value here.
     */
    readonly prefillLocalSubscriptionId?: string | null;
    readonly forceLinkMutation: ReturnType<typeof useForceLinkMutation>;
    readonly backfillMutation: ReturnType<typeof useBackfillPaymentMutation>;
    readonly addToast: ReturnType<typeof useToast>['addToast'];
}

/**
 * Whether the operator's current input would be accepted by the API.
 *
 * Validated against the SAME Zod schemas the route enforces, so the confirm
 * button cannot become enabled for a payload the server will reject — and, more
 * importantly, cannot stay disabled for one the server would accept.
 *
 * A pure function of its arguments rather than a read of `form.state` inside
 * render: TanStack Form's store does not re-render this component on a field
 * change, so a render-time read of `form.state.values` returns the values as
 * they were when the dialog mounted. That is not a style preference — it shipped
 * as a real defect here: the button never left its disabled state no matter what
 * the operator typed, and the dialog was unusable. The live values now arrive
 * through `form.Subscribe`, which is the repo's established pattern for exactly
 * this (see `routes/_authed/billing/settings.tsx`).
 *
 * @param params - The rescue verb, the MercadoPago-side id, and the live field values.
 * @returns True when the payload validates and a MercadoPago target exists.
 */
function isSubmittable(params: {
    readonly action: ReconcileAction;
    readonly targetId: string | null;
    readonly localSubscriptionId: string;
    readonly reason: string;
}): boolean {
    const { action, targetId, localSubscriptionId, reason } = params;
    if (!targetId) {
        return false;
    }

    const result =
        action === 'force-link'
            ? ForceLinkPreapprovalRequestSchema.safeParse({
                  preapprovalId: targetId,
                  localSubscriptionId,
                  reason
              })
            : BackfillPaymentRequestSchema.safeParse({
                  mpPaymentId: targetId,
                  localSubscriptionId,
                  reason
              });

    return result.success;
}

/**
 * Reconciliation action dialog for the orphan-payment rescue screen (HOS-765).
 *
 * A SINGLE dialog serving both write verbs (`force-link` and
 * `backfill-payment`), discriminated by the `action` prop. Uses TanStack Form
 * with two fields (`localSubscriptionId`, `reason`), validated with the same
 * Zod schemas the API enforces (`ForceLinkPreapprovalRequestSchema` /
 * `BackfillPaymentRequestSchema`) via `safeParse` — never `zodResolver`, per
 * this repo's TanStack Form convention (see `ManualOverrideDialog`).
 *
 * `localSubscriptionId` ALWAYS starts empty unless
 * {@link ReconcileActionDialogProps.prefillLocalSubscriptionId} carries an
 * explicit operator choice — this is the concrete implementation of the
 * "the tool proposes, a human decides" design rule from the schema module
 * doc: nothing here ever reads `divergence.candidates` to guess a value.
 */
export function ReconcileActionDialog({
    divergence,
    action,
    open,
    onOpenChange,
    prefillLocalSubscriptionId,
    forceLinkMutation,
    backfillMutation,
    addToast
}: ReconcileActionDialogProps) {
    const { t } = useTranslations();

    const form = useForm({
        defaultValues: {
            localSubscriptionId: '',
            reason: ''
        },
        onSubmit: async ({ value }) => {
            if (!divergence) return;

            if (action === 'force-link') {
                const targetId = getForceLinkTargetId(divergence);
                const validated = ForceLinkPreapprovalRequestSchema.safeParse({
                    preapprovalId: targetId ?? '',
                    localSubscriptionId: value.localSubscriptionId,
                    reason: value.reason
                });
                if (!validated.success) return;

                try {
                    await forceLinkMutation.mutateAsync(validated.data);
                    addToast({
                        message: t('admin-billing.reconciliation.actionDialog.forceLinkSuccess'),
                        variant: 'success'
                    });
                    onOpenChange(false);
                } catch (error) {
                    addToast({
                        message: `${t('admin-billing.reconciliation.actionDialog.forceLinkError')} ${translateAdminApiError({ error: error as ApiErrorShape, t })}`,
                        variant: 'error'
                    });
                }
                return;
            }

            const targetId = getBackfillTargetId(divergence);
            const validated = BackfillPaymentRequestSchema.safeParse({
                mpPaymentId: targetId ?? '',
                localSubscriptionId: value.localSubscriptionId,
                reason: value.reason
            });
            if (!validated.success) return;

            try {
                await backfillMutation.mutateAsync(validated.data);
                addToast({
                    message: t('admin-billing.reconciliation.actionDialog.backfillSuccess'),
                    variant: 'success'
                });
                onOpenChange(false);
            } catch (error) {
                addToast({
                    message: `${t('admin-billing.reconciliation.actionDialog.backfillError')} ${translateAdminApiError({ error: error as ApiErrorShape, t })}`,
                    variant: 'error'
                });
            }
        }
    });

    // Reset on every open — including re-opens with a fresh explicit
    // candidate choice. The field is EMPTY unless an explicit choice exists;
    // it is never derived from `divergence.candidates`.
    useEffect(() => {
        if (open) {
            form.reset({
                localSubscriptionId: prefillLocalSubscriptionId ?? '',
                reason: ''
            });
        }
    }, [open, prefillLocalSubscriptionId, form]);

    if (!divergence) return null;

    const targetId =
        action === 'force-link'
            ? getForceLinkTargetId(divergence)
            : getBackfillTargetId(divergence);

    const isPending =
        action === 'force-link' ? forceLinkMutation.isPending : backfillMutation.isPending;

    const title =
        action === 'force-link'
            ? t('admin-billing.reconciliation.actionDialog.forceLinkTitle')
            : t('admin-billing.reconciliation.actionDialog.backfillTitle');
    const description =
        action === 'force-link'
            ? t('admin-billing.reconciliation.actionDialog.forceLinkDescription')
            : t('admin-billing.reconciliation.actionDialog.backfillDescription');
    const confirmLabel =
        action === 'force-link'
            ? t('admin-billing.reconciliation.actionDialog.forceLinkConfirmButton')
            : t('admin-billing.reconciliation.actionDialog.backfillConfirmButton');

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
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
                        {t('admin-billing.reconciliation.actionDialog.auditWarning')}
                    </div>

                    <div className="grid gap-2">
                        <Label>
                            {t('admin-billing.reconciliation.actionDialog.mpTargetLabel')}
                        </Label>
                        <p className="font-mono text-xs">
                            {targetId ?? t('admin-billing.common.noData')}
                        </p>
                    </div>

                    <form.Field name="localSubscriptionId">
                        {(field) => (
                            <div className="grid gap-2">
                                <Label htmlFor="localSubscriptionId">
                                    {t(
                                        'admin-billing.reconciliation.actionDialog.localSubscriptionIdLabel'
                                    )}{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="localSubscriptionId"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    placeholder={t(
                                        'admin-billing.reconciliation.actionDialog.localSubscriptionIdPlaceholder'
                                    )}
                                />
                                <p className="text-muted-foreground text-xs">
                                    {t(
                                        'admin-billing.reconciliation.actionDialog.localSubscriptionIdHint'
                                    )}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="reason">
                        {(field) => (
                            <div className="grid gap-2">
                                <Label htmlFor="reason">
                                    {t('admin-billing.reconciliation.actionDialog.reasonLabel')}{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <textarea
                                    id="reason"
                                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder={t(
                                        'admin-billing.reconciliation.actionDialog.reasonPlaceholder'
                                    )}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                />
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.reconciliation.actionDialog.reasonHint')}
                                </p>
                            </div>
                        )}
                    </form.Field>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            {t('admin-billing.common.cancel')}
                        </Button>
                        <form.Subscribe selector={(state) => state.values}>
                            {(values) => (
                                <Button
                                    type="submit"
                                    disabled={
                                        !isSubmittable({
                                            action,
                                            targetId,
                                            localSubscriptionId: values.localSubscriptionId,
                                            reason: values.reason
                                        }) || isPending
                                    }
                                >
                                    {isPending
                                        ? t(
                                              'admin-billing.reconciliation.actionDialog.processingButton'
                                          )
                                        : confirmLabel}
                                </Button>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
