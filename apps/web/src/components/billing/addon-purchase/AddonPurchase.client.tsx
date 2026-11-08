import type { AddonOffersResponse } from '@repo/schemas';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { type PublishVerticalSlug, publishApi } from '@/lib/api/endpoints-protected';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import {
    eligibleTargets,
    mintOrderRequestId,
    purchaseStateFrom
} from '@/lib/billing/addon-purchase';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { AddonOfferList } from './AddonOfferList';
import styles from './AddonPurchase.module.css';
import { AddonPurchaseSummary } from './AddonPurchaseSummary';
import { type AddonTarget, AddonTargetPicker } from './AddonTargetPicker';

type Offer = AddonOffersResponse['items'][number];
type View = 'LOADING' | 'OFFERS' | 'TARGETS' | 'SUMMARY' | 'PROCESSING' | 'ACTIVE' | 'CLOSED';
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 10;
const PUBLISH_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

/** Owner-only addon purchase screen. Billing reads happen in the browser. */
export function AddonPurchase(input: {
    readonly locale: SupportedLocale;
    readonly returnOrderRequestId: string | null;
    readonly accountEmail: string;
    readonly navigateToCheckout?: (url: string) => void;
}) {
    const { t } = useMemo(() => createTranslations(input.locale), [input.locale]);
    const [offers, setOffers] = useState<readonly Offer[]>([]);
    const [offer, setOffer] = useState<Offer | null>(null);
    const [targets, setTargets] = useState<readonly AddonTarget[]>([]);
    const [target, setTarget] = useState<AddonTarget | null>(null);
    const [orderRequestId, setOrderRequestId] = useState<string | null>(null);
    const [view, setView] = useState<View>(input.returnOrderRequestId ? 'PROCESSING' : 'LOADING');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payerEmail, setPayerEmail] = useState(input.accountEmail);
    const [pollAttempt, setPollAttempt] = useState(0);
    const free =
        !!offer &&
        (target
            ? offer.freeUnderGrantVerticals.includes(target.vertical)
            : offer.compatibleVerticals.some((vertical) =>
                  offer.freeUnderGrantVerticals.includes(vertical)
              ));

    useEffect(() => {
        let alive = true;
        void billingAddonApi
            .offers()
            .then((result) => {
                if (!alive) return;
                if (result.ok) {
                    setOffers(result.data.items);
                    if (!input.returnOrderRequestId) setView('OFFERS');
                } else setError(result.error.message);
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
    }, [input.returnOrderRequestId, t]);

    useEffect(() => {
        if (
            !input.returnOrderRequestId ||
            view !== 'PROCESSING' ||
            pollAttempt >= POLL_MAX_ATTEMPTS
        )
            return;
        let alive = true;
        const timer = window.setTimeout(() => {
            void billingAddonApi
                .readPurchase({ orderRequestId: input.returnOrderRequestId as string })
                .then((result) => {
                    if (!alive) return;
                    if (result.ok) {
                        const state = purchaseStateFrom({ read: result.data });
                        if (state === 'ACTIVE') setView('ACTIVE');
                        else if (state === 'CLOSED') setView('CLOSED');
                    } else setError(result.error.message);
                    setPollAttempt((attempt) => attempt + 1);
                })
                .catch((cause: unknown) => {
                    if (alive) {
                        setError(
                            cause instanceof Error
                                ? cause.message
                                : t('billing.addonPurchase.loadError')
                        );
                        setPollAttempt((attempt) => attempt + 1);
                    }
                });
        }, POLL_INTERVAL_MS);
        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, [input.returnOrderRequestId, pollAttempt, t, view]);

    const selectOffer = async (selected: Offer) => {
        setOffer(selected);
        setTarget(null);
        setOrderRequestId(null);
        setError(null);
        if (selected.scopeType !== 'LISTING') {
            setOrderRequestId(mintOrderRequestId());
            setView('SUMMARY');
            return;
        }
        setView('LOADING');
        const verticals = selected.compatibleVerticals.filter(
            (vertical): vertical is PublishVerticalSlug =>
                PUBLISH_VERTICALS.includes(vertical as PublishVerticalSlug)
        );
        try {
            const reads = await Promise.all(
                verticals.map(async (vertical) => {
                    const result = await publishApi.listingNotices({ vertical });
                    if (!result.ok) throw new Error(result.error.message);
                    return result.data.items.map((item) => ({ ...item, vertical }));
                })
            );
            setTargets(
                eligibleTargets({
                    items: reads.flat(),
                    compatibleVerticals: selected.compatibleVerticals
                })
            );
            setView('TARGETS');
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t('billing.addonPurchase.loadError'));
            setView('OFFERS');
        }
    };

    const selectTarget = (selected: AddonTarget) => {
        setTarget(selected);
        setOrderRequestId(mintOrderRequestId());
        setView('SUMMARY');
    };

    const confirm = async () => {
        if (!offer || !orderRequestId || busy) return;
        setBusy(true);
        setError(null);
        const body = {
            productId: offer.productId,
            addonVersionId: offer.addonVersionId,
            targetId: target?.listingId ?? null,
            orderRequestId
        };
        try {
            if (free) {
                const result = await billingAddonApi.chooseFree({ body });
                if (result.ok) setView('ACTIVE');
                else setError(result.error.message);
            } else if (offer.chargeKind === 'PERIODICO') {
                const email = z.email().safeParse(payerEmail);
                if (!email.success) {
                    setError(t('billing.addonPurchase.payerEmailInvalid'));
                    return;
                }
                const result = await billingAddonApi.purchase({
                    body: { ...body, payerEmail: email.data }
                });
                if (result.ok) {
                    const state = purchaseStateFrom({ response: result.data });
                    if (state === 'REDIRECT' && result.data.checkoutUrl)
                        (
                            input.navigateToCheckout ??
                            ((url: string) => window.location.assign(url))
                        )(result.data.checkoutUrl);
                    else if (state === 'ACTIVE') setView('ACTIVE');
                    else if (state === 'PROCESSING') setView('PROCESSING');
                    else setView('CLOSED');
                } else setError(result.error.message);
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t('billing.addonPurchase.loadError'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.root}>
            {error && (
                <p
                    role="alert"
                    className={styles.error}
                >
                    {error}
                </p>
            )}
            {view === 'LOADING' && <p>{t('billing.addonPurchase.loading')}</p>}
            {view === 'OFFERS' && (
                <AddonOfferList
                    offers={offers}
                    onSelect={(selected) => {
                        void selectOffer(selected);
                    }}
                    t={t}
                />
            )}
            {view === 'TARGETS' && (
                <AddonTargetPicker
                    items={targets}
                    onSelect={selectTarget}
                    t={t}
                />
            )}
            {view === 'SUMMARY' && offer && (
                <AddonPurchaseSummary
                    offer={offer}
                    target={target}
                    payerEmail={payerEmail}
                    onPayerEmailChange={setPayerEmail}
                    free={free}
                    busy={busy}
                    locale={input.locale}
                    onConfirm={() => {
                        void confirm();
                    }}
                    t={t}
                />
            )}
            {view === 'PROCESSING' && (
                <p
                    data-testid="addon-purchase-processing"
                    role="status"
                >
                    {t('billing.addonPurchase.processing')}
                </p>
            )}
            {view === 'ACTIVE' && <p role="status">{t('billing.addonPurchase.active')}</p>}
            {view === 'CLOSED' && <p role="status">{t('billing.addonPurchase.closed')}</p>}
        </div>
    );
}
