import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/account/ui/EmptyState';
import { LinkButton } from '@/components/account/ui/LinkButton';
import { Skeleton } from '@/components/account/ui/Skeleton';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { AddonPurchase } from './AddonPurchase.client';

/** Props of {@link AddonPurchaseGate}. */
export interface AddonPurchaseGateProps {
    readonly locale: SupportedLocale;
    /** The Mercado Pago return id, when the owner comes back to settle a purchase. */
    readonly returnOrderRequestId: string | null;
    readonly accountEmail: string;
    /** Where «Ver planes» goes (`resolveEmptySubscriptionPlansPath`, owner decision 2). */
    readonly plansPath: string;
}

/** What the gate knows about the account's subscriptions. */
type GateState = 'LOADING' | 'NONE' | 'SOME';

/**
 * The add-ons page's entry (owner decision 3, Mi cuenta UI epic): an account
 * with NO subscription at all sees «Antes tenés que suscribirte a un plan» and
 * the plans CTA instead of the purchase flow, because an add-on only exists on
 * top of a plan. The read happens in the browser, like every billing read of
 * this page (AC:B10:11), so the page stays session-blind.
 *
 * Only a SUCCESSFUL read listing zero subscriptions closes the flow. A failed
 * read opens it (the flow handles its own states and the server stays the
 * authority), and a return from Mercado Pago skips the read entirely: there is
 * an order to settle.
 *
 * @param props - See {@link AddonPurchaseGateProps}.
 * @returns The empty state, a loading skeleton, or the purchase flow.
 */
export function AddonPurchaseGate({
    locale,
    returnOrderRequestId,
    accountEmail,
    plansPath
}: AddonPurchaseGateProps) {
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const [state, setState] = useState<GateState>(returnOrderRequestId ? 'SOME' : 'LOADING');

    useEffect(() => {
        if (returnOrderRequestId) return;
        let alive = true;
        const read = async () => {
            try {
                const result = await billingSubscriptionApi.listMine({});
                if (!alive) return;
                setState(result.ok && result.data.subscriptions.length === 0 ? 'NONE' : 'SOME');
            } catch {
                if (alive) setState('SOME');
            }
        };
        void read();
        return () => {
            alive = false;
        };
    }, [returnOrderRequestId]);

    if (state === 'LOADING') {
        return (
            <Skeleton
                locale={locale}
                shape="block"
            />
        );
    }
    if (state === 'NONE') {
        return (
            <div data-testid="addons-no-subscription">
                <EmptyState
                    title={t('billing.addonPurchase.noSubscription.title')}
                    description={t('billing.addonPurchase.noSubscription.description')}
                    action={
                        <LinkButton
                            href={buildUrl({ locale, path: plansPath })}
                            data-testid="addons-no-subscription-plans"
                        >
                            {t('billing.addonPurchase.noSubscription.viewPlans')}
                        </LinkButton>
                    }
                />
            </div>
        );
    }
    return (
        <AddonPurchase
            locale={locale}
            returnOrderRequestId={returnOrderRequestId}
            accountEmail={accountEmail}
        />
    );
}
