import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import type { Divergence, DivergenceCandidate } from './types';
import {
    formatArsFromCents,
    formatDate,
    getKindLabel,
    getMatchedOnLabel,
    getMpStatusVariant
} from './utils';

/**
 * Props for {@link DivergenceDetailDialog}.
 */
export interface DivergenceDetailDialogProps {
    readonly divergence: Divergence | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    /**
     * Called when the operator clicks "Usar este" on a candidate row.
     *
     * This is the ONLY path by which a candidate's `localSubscriptionId`
     * reaches the action dialog — the candidate list never pre-fills the
     * destination field on its own. See {@link ReconcileActionDialog} for the
     * consuming end.
     */
    readonly onUseCandidate: (localSubscriptionId: string) => void;
}

/** One labeled field in the detail grid. */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="font-medium text-sm">{value}</p>
        </div>
    );
}

/**
 * Detail dialog for the orphan-payment rescue screen (HOS-765).
 *
 * Shows every raw field of one divergence plus its ranked candidate list.
 * Read-only — the only interactive elements are "Usar este" (copies a
 * candidate id up to the caller, never binds anything) and "Cerrar".
 */
export function DivergenceDetailDialog({
    divergence,
    open,
    onOpenChange,
    onUseCandidate
}: DivergenceDetailDialogProps) {
    const { t, locale } = useTranslations();

    if (!divergence) return null;

    const isUnrecordedPayment = divergence.kind === 'unrecorded-payment';

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.reconciliation.detailDialog.title')}
                    </DialogTitle>
                    <DialogDescription>{getKindLabel(divergence.kind, t)}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* MercadoPago fields */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.reconciliation.detailDialog.mpSection')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3">
                            {isUnrecordedPayment ? (
                                <>
                                    <DetailField
                                        label={t('admin-billing.reconciliation.fields.mpPaymentId')}
                                        value={
                                            <span className="font-mono text-xs">
                                                {divergence.mpPaymentId}
                                            </span>
                                        }
                                    />
                                    <DetailField
                                        label={t(
                                            'admin-billing.reconciliation.fields.mpStatusDetail'
                                        )}
                                        value={
                                            divergence.mpStatusDetail ??
                                            t('admin-billing.common.noData')
                                        }
                                    />
                                    <DetailField
                                        label={t('admin-billing.reconciliation.fields.approvedAt')}
                                        value={formatDate(divergence.approvedAt, locale)}
                                    />
                                    <DetailField
                                        label={t('admin-billing.reconciliation.fields.payerId')}
                                        value={
                                            divergence.payerId ?? t('admin-billing.common.noData')
                                        }
                                    />
                                    <DetailField
                                        label={t(
                                            'admin-billing.reconciliation.fields.preapprovalId'
                                        )}
                                        value={
                                            <span className="font-mono text-xs">
                                                {divergence.preapprovalId ??
                                                    t('admin-billing.common.noData')}
                                            </span>
                                        }
                                    />
                                    <DetailField
                                        label={t('admin-billing.reconciliation.fields.description')}
                                        value={
                                            divergence.description ??
                                            t('admin-billing.common.noData')
                                        }
                                    />
                                </>
                            ) : (
                                <>
                                    <DetailField
                                        label={t(
                                            'admin-billing.reconciliation.fields.preapprovalId'
                                        )}
                                        value={
                                            <span className="font-mono text-xs">
                                                {divergence.preapprovalId}
                                            </span>
                                        }
                                    />
                                    <DetailField
                                        label={t('admin-billing.reconciliation.fields.reason')}
                                        value={
                                            divergence.reason ?? t('admin-billing.common.noData')
                                        }
                                    />
                                    <DetailField
                                        label={t(
                                            'admin-billing.reconciliation.fields.nextPaymentDate'
                                        )}
                                        value={formatDate(divergence.nextPaymentDate, locale)}
                                    />
                                    <DetailField
                                        label={t(
                                            'admin-billing.reconciliation.fields.preapprovalPlanId'
                                        )}
                                        value={
                                            <span className="font-mono text-xs">
                                                {divergence.preapprovalPlanId ??
                                                    t('admin-billing.common.noData')}
                                            </span>
                                        }
                                    />
                                    <DetailField
                                        label={t('admin-billing.reconciliation.fields.payerId')}
                                        value={
                                            divergence.payerId ?? t('admin-billing.common.noData')
                                        }
                                    />
                                    <DetailField
                                        label={t(
                                            'admin-billing.reconciliation.fields.sourcePaymentId'
                                        )}
                                        value={
                                            <span className="font-mono text-xs">
                                                {divergence.sourcePaymentId ??
                                                    t('admin-billing.common.noData')}
                                            </span>
                                        }
                                    />
                                </>
                            )}
                            <DetailField
                                label={t('admin-billing.reconciliation.fields.amount')}
                                value={formatArsFromCents(divergence.amountInCents, locale)}
                            />
                            <DetailField
                                label={t('admin-billing.reconciliation.fields.mpStatus')}
                                value={
                                    <Badge variant={getMpStatusVariant(divergence.mpStatus)}>
                                        {divergence.mpStatus}
                                    </Badge>
                                }
                            />
                            <DetailField
                                label={t('admin-billing.reconciliation.fields.createdAt')}
                                value={formatDate(divergence.createdAt, locale)}
                            />
                            <DetailField
                                label={t('admin-billing.reconciliation.fields.externalReference')}
                                value={
                                    divergence.externalReference ?? t('admin-billing.common.noData')
                                }
                            />
                        </div>
                    </div>

                    {/* Payer identity — the two-email nuance (HOS-765 spec, note 1) */}
                    {!isUnrecordedPayment && (
                        <div className="grid gap-2">
                            <h3 className="font-semibold text-sm">
                                {t('admin-billing.reconciliation.detailDialog.payerSection')}
                            </h3>
                            <div className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3">
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        {t('admin-billing.reconciliation.fields.payerEmailRaw')}
                                    </p>
                                    <p className="font-medium text-sm">
                                        {divergence.payerEmail ? (
                                            divergence.payerEmail
                                        ) : (
                                            <span className="text-muted-foreground italic">
                                                {t(
                                                    'admin-billing.reconciliation.payerEmailRawEmptyHint'
                                                )}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">
                                        {t(
                                            'admin-billing.reconciliation.fields.payerEmailFromPayment'
                                        )}
                                    </p>
                                    <p className="font-medium text-sm">
                                        {divergence.payerEmailFromPayment ? (
                                            divergence.payerEmailFromPayment
                                        ) : (
                                            <span className="text-muted-foreground italic">
                                                {t(
                                                    'admin-billing.reconciliation.notAttributableYet'
                                                )}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Candidates */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.reconciliation.detailDialog.candidatesSection')}
                        </h3>
                        {divergence.candidates.length === 0 ? (
                            <p className="text-muted-foreground text-sm italic">
                                {t('admin-billing.reconciliation.detailDialog.noCandidates')}
                            </p>
                        ) : (
                            <div className="grid gap-2">
                                {divergence.candidates.map((candidate: DivergenceCandidate) => (
                                    <div
                                        key={candidate.localSubscriptionId}
                                        className="grid gap-2 rounded-md border p-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-mono text-xs">
                                                    {candidate.localSubscriptionId}
                                                </p>
                                                <p className="text-sm">
                                                    {candidate.customerDisplayName ??
                                                        candidate.customerEmail ??
                                                        t('admin-billing.common.noData')}
                                                </p>
                                                <p className="text-muted-foreground text-xs">
                                                    {t(
                                                        'admin-billing.reconciliation.detailDialog.localStatusLabel'
                                                    )}{' '}
                                                    {candidate.localSubscriptionStatus}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    onUseCandidate(candidate.localSubscriptionId)
                                                }
                                            >
                                                {t(
                                                    'admin-billing.reconciliation.detailDialog.useCandidateButton'
                                                )}
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {candidate.matchedOn.map((signal) => (
                                                <Badge
                                                    key={signal}
                                                    variant="secondary"
                                                >
                                                    {getMatchedOnLabel(signal, t)}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('admin-billing.common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
