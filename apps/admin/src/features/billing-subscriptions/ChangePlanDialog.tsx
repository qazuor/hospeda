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
import { useTranslations } from '@/hooks/use-translations';
import { ALL_PLANS } from '@repo/billing';
import { useState } from 'react';
import type { Subscription } from './types';
import { formatArs, formatDate, getPlanBySlug } from './utils';

/**
 * Props for ChangePlanDialog
 */
export interface ChangePlanDialogProps {
    readonly subscription: Subscription;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (newPlanSlug: string) => void;
}

/**
 * Change plan dialog component.
 * Displays available plans within the same category and shows prorated amount.
 */
export function ChangePlanDialog({
    subscription,
    isOpen,
    onClose,
    onConfirm
}: ChangePlanDialogProps) {
    const { t, locale } = useTranslations();
    const currentPlan = getPlanBySlug(subscription.planSlug);
    const [selectedPlan, setSelectedPlan] = useState<string>('');

    const availablePlans = ALL_PLANS.filter(
        (plan) => plan.category === currentPlan?.category && plan.slug !== subscription.planSlug
    );

    const handleConfirm = () => {
        if (selectedPlan) {
            onConfirm(selectedPlan);
            setSelectedPlan('');
        }
    };

    const selectedPlanDef = selectedPlan ? getPlanBySlug(selectedPlan) : null;
    const proratedAmount =
        selectedPlanDef && currentPlan
            ? (selectedPlanDef.monthlyPriceArs - currentPlan.monthlyPriceArs) / 100
            : 0;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {t('admin-billing.subscriptions.changePlanDialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.changePlanDialog.description')}{' '}
                        {subscription.userName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <p className="mb-2 font-medium text-sm">
                            {t('admin-billing.subscriptions.changePlanDialog.currentPlan')}
                        </p>
                        <div className="rounded-md border p-3">
                            <p className="font-medium">{currentPlan?.name}</p>
                            <p className="text-muted-foreground text-sm">
                                {formatArs(currentPlan?.monthlyPriceArs ?? 0, locale)}
                                {t('admin-billing.subscriptions.changePlanDialog.perMonth')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-plan">
                            {t('admin-billing.subscriptions.changePlanDialog.newPlanLabel')}
                        </Label>
                        <select
                            id="new-plan"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                        >
                            <option value="">
                                {t('admin-billing.subscriptions.changePlanDialog.selectPlan')}
                            </option>
                            {availablePlans.map((plan) => (
                                <option
                                    key={plan.slug}
                                    value={plan.slug}
                                >
                                    {plan.name} - {formatArs(plan.monthlyPriceArs, locale)}
                                    {t('admin-billing.subscriptions.changePlanDialog.perMonth')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedPlanDef && (
                        <div className="rounded-md border bg-muted p-3">
                            <p className="mb-2 font-medium text-sm">
                                {t('admin-billing.subscriptions.changePlanDialog.prorationTitle')}
                            </p>
                            <p className="text-muted-foreground text-sm">
                                {proratedAmount > 0 && (
                                    <span>
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationCharge'
                                        )}{' '}
                                        {formatArs(proratedAmount, locale)}{' '}
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationChargeToday'
                                        )}
                                    </span>
                                )}
                                {proratedAmount < 0 && (
                                    <span>
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationCredit'
                                        )}{' '}
                                        {formatArs(Math.abs(proratedAmount), locale)}{' '}
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationCreditToAccount'
                                        )}
                                    </span>
                                )}
                                {proratedAmount === 0 && (
                                    <span>
                                        {t(
                                            'admin-billing.subscriptions.changePlanDialog.prorationNone'
                                        )}
                                    </span>
                                )}
                            </p>
                            <p className="mt-2 text-muted-foreground text-xs">
                                {t('admin-billing.subscriptions.changePlanDialog.nextCharge')}{' '}
                                {formatDate(subscription.currentPeriodEnd, locale)}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        {t('admin-billing.common.cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedPlan}
                    >
                        {t('admin-billing.subscriptions.changePlanDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
