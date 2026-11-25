import type { AddonOffersResponse } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import { visibleApiMessage } from '@/lib/api-errors';
import { offersForAccountVerticals } from '@/lib/billing/addon-account-verticals';
import { purchasableOffers } from '@/lib/billing/addon-purchase';
import type { createTranslations } from '@/lib/i18n';
import type { AddonPurchaseView } from './use-addon-purchase-back';

type Offer = AddonOffersResponse['items'][number];

/** Load saleable offers and narrow every target to the account's subscription verticals. */
export function useAddonOffers(input: {
    readonly accountVerticals: readonly string[] | null;
    readonly returnOrderRequestId: string | null;
    readonly t: ReturnType<typeof createTranslations>['t'];
    readonly setView: (view: AddonPurchaseView) => void;
    readonly setError: (error: string | null) => void;
}): { readonly offers: readonly Offer[] } {
    const { accountVerticals, returnOrderRequestId, t, setView, setError } = input;
    const [offers, setOffers] = useState<readonly Offer[]>([]);

    useEffect(() => {
        let alive = true;
        void billingAddonApi
            .offers()
            .then((result) => {
                if (!alive) return;
                if (result.ok) {
                    setOffers(
                        offersForAccountVerticals({
                            offers: purchasableOffers(result.data.items),
                            accountVerticals
                        }).map((item) => ({
                            ...item,
                            compatibleVerticals: item.compatibleVerticals.filter(
                                (vertical) =>
                                    !accountVerticals || accountVerticals.includes(vertical)
                            )
                        }))
                    );
                    if (!returnOrderRequestId) setView('OFFERS');
                } else
                    setError(
                        visibleApiMessage({ error: result.error }) ??
                            t('billing.addonPurchase.loadError')
                    );
            })
            .catch((cause: unknown) => {
                if (alive)
                    setError(
                        cause instanceof Error
                            ? cause.message
                            : t('billing.addonPurchase.loadError')
                    );
            });
        return () => {
            alive = false;
        };
    }, [returnOrderRequestId, t, accountVerticals, setView, setError]);

    return { offers };
}
