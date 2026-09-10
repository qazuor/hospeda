import type { TranslationKey } from '@repo/i18n';
import { CrownIcon } from '@repo/icons';
import { useState } from 'react';
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
import type { ParsedPlanRecord } from '@/features/billing-plans/hooks';
import { useTranslations } from '@/hooks/use-translations';
import { formatCentsToArs } from '@/lib/format-helpers';
import type { Subscription } from './types';

/**
 * Props for GrantCompDialog
 */
export interface GrantCompDialogProps {
    readonly subscription: Subscription;
    /**
     * Every comped-able plan across every vertical (HOS-1314 F-1). Fetched
     * DB-backed via `usePlansQuery()` — never the static, accommodation-only
     * `ALL_PLANS` catalog `ChangePlanDialog` uses, because a comp grant must
     * reach gastronomy, experience, partner and tourist plans too.
     */
    readonly plans: readonly ParsedPlanRecord[];
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onConfirm: (payload: { planId: string; interval: 'monthly' | 'annual' }) => void;
    readonly isPending?: boolean;
}

/** The order verticals appear in the plan selector. Anything not listed here sorts last. */
const DOMAIN_ORDER: readonly string[] = [
    'accommodation',
    'tourist',
    'gastronomy',
    'experience',
    'partner',
    'addon'
];

/**
 * Groups active, non-deleted plans by `productDomain`, in {@link DOMAIN_ORDER}.
 *
 * Deleted and inactive plans are excluded — comping a customer onto a plan
 * nobody can otherwise buy is not something this dialog offers a path to.
 */
function groupPlansByDomain(
    plans: readonly ParsedPlanRecord[]
): ReadonlyArray<{ domain: string; plans: readonly ParsedPlanRecord[] }> {
    const eligible = plans.filter((p) => p.isActive && !p.isDeleted);
    const byDomain = new Map<string, ParsedPlanRecord[]>();

    for (const plan of eligible) {
        const bucket = byDomain.get(plan.productDomain) ?? [];
        bucket.push(plan);
        byDomain.set(plan.productDomain, bucket);
    }

    const orderedDomains = [
        ...DOMAIN_ORDER.filter((d) => byDomain.has(d)),
        ...[...byDomain.keys()].filter((d) => !DOMAIN_ORDER.includes(d))
    ];

    return orderedDomains.map((domain) => ({
        domain,
        plans: (byDomain.get(domain) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
    }));
}

/**
 * Grant a permanently-complimentary (`status='comp'`) subscription (HOS-1314).
 *
 * The only admin-facing entry point to
 * `POST /api/v1/admin/billing/subscriptions/grant-comp` — until this dialog,
 * granting a comp required a raw HTTP call naming the plan's raw UUID by hand.
 * Modelled on {@link GrantCourtesyDialog}, but the two grant DIFFERENT things:
 * courtesy gifts N free cycles to someone already paying and reverts to full
 * price on its own; comp is permanent, has no MercadoPago preapproval at all,
 * and does not revert by itself — this dialog says so before the operator
 * confirms, because there is no "undo" button for it afterward (only cancelling
 * the resulting subscription like any other).
 *
 * Targets the CUSTOMER (`subscription.customerId`, a `billing_customers.id`),
 * not the subscription row the dialog was opened from — the grant creates its
 * own subscription and retires whatever the customer already holds in the
 * chosen plan's vertical, leaving every other vertical's subscription alone.
 */
export function GrantCompDialog({
    subscription,
    plans,
    isOpen,
    onClose,
    onConfirm,
    isPending = false
}: GrantCompDialogProps) {
    const { t, locale } = useTranslations();
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');

    const groups = groupPlansByDomain(plans);
    const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;

    const handleConfirm = () => {
        if (!selectedPlanId) return;
        onConfirm({ planId: selectedPlanId, interval });
    };

    const handleClose = () => {
        setSelectedPlanId('');
        setInterval('monthly');
        onClose();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={handleClose}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.subscriptions.compDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.subscriptions.compDialog.description')}{' '}
                        {subscription.user?.displayName ??
                            t('admin-billing.subscriptions.unknownUser')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="comp-plan">
                            {t('admin-billing.subscriptions.compDialog.planLabel')}
                        </Label>
                        {groups.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                {t('admin-billing.subscriptions.compDialog.noPlans')}
                            </p>
                        ) : (
                            <select
                                id="comp-plan"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                            >
                                <option value="">
                                    {t('admin-billing.subscriptions.compDialog.selectPlan')}
                                </option>
                                {groups.map((group) => (
                                    <optgroup
                                        key={group.domain}
                                        label={t(
                                            `admin-billing.subscriptions.productDomainLabels.${group.domain}` as TranslationKey
                                        )}
                                    >
                                        {group.plans.map((plan) => (
                                            <option
                                                key={plan.id}
                                                value={plan.id}
                                            >
                                                {plan.name} —{' '}
                                                {formatCentsToArs({
                                                    cents: plan.monthlyPriceArs,
                                                    locale
                                                })}
                                                {t(
                                                    'admin-billing.subscriptions.compDialog.perMonth'
                                                )}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        )}
                    </div>

                    {selectedPlan && (
                        <div className="rounded-md border bg-card p-3">
                            <p className="font-medium">{selectedPlan.name}</p>
                            <p className="text-muted-foreground text-sm">
                                {t(
                                    `admin-billing.subscriptions.productDomainLabels.${selectedPlan.productDomain}` as TranslationKey
                                )}
                            </p>
                        </div>
                    )}

                    {selectedPlan && selectedPlan.annualPriceArs !== null && (
                        <div className="space-y-2">
                            <Label htmlFor="comp-interval">
                                {t('admin-billing.subscriptions.compDialog.intervalLabel')}
                            </Label>
                            <select
                                id="comp-interval"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={interval}
                                onChange={(e) =>
                                    setInterval(e.target.value as 'monthly' | 'annual')
                                }
                            >
                                <option value="monthly">
                                    {t('admin-billing.subscriptions.compDialog.intervalMonthly')}
                                </option>
                                <option value="annual">
                                    {t('admin-billing.subscriptions.compDialog.intervalAnnual')}
                                </option>
                            </select>
                        </div>
                    )}

                    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3">
                        <CrownIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <p className="text-sm">
                            {t('admin-billing.subscriptions.compDialog.permanentWarning')}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                    >
                        {t('admin-billing.common.cancel')}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedPlanId || isPending}
                    >
                        {t('admin-billing.subscriptions.compDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
