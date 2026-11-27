import type { AddonOffersResponse } from '@repo/schemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/account/ui/Button';
import { Stepper } from '@/components/account/ui/Stepper';
import {
    billingSubscriptionApi,
    type PublishVerticalSlug,
    publishApi
} from '@/lib/api/endpoints-protected';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import { type ApiErrorShape, translateApiError, visibleApiMessage } from '@/lib/api-errors';
import { noSubscriptionReason } from '@/lib/billing/addon-account-verticals';
import {
    type ActiveAddonInstance,
    type AddonSubscriptionTarget,
    addonPlansPath,
    closedCopyKey,
    eligibleSubscriptionTargets,
    eligibleTargets,
    isAddonActiveOnTarget,
    isOfferFullyActive,
    mintOrderRequestId,
    orderIdentityReleased,
    processingCopyKey,
    purchaseStateFrom
} from '@/lib/billing/addon-purchase';
import { useRememberedPayerEmail } from '@/lib/billing/use-remembered-payer-email';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import stylesNotice from '../PaidSignupsPausedNotice.module.css';
import { AddonOfferList } from './AddonOfferList';
import styles from './AddonPurchase.module.css';
import { AddonPurchaseOutcome } from './AddonPurchaseOutcome';
import { AddonPurchaseSummary } from './AddonPurchaseSummary';
import { AddonSubscriptionPicker } from './AddonSubscriptionPicker';
import { type AddonTarget, AddonTargetPicker } from './AddonTargetPicker';
import { useAddonOffers } from './use-addon-offers';
import {
    ADDON_PURCHASE_STEP_INDEX,
    type AddonPurchaseView,
    useAddonPurchaseBack
} from './use-addon-purchase-back';
import { useAddonPurchasePoll } from './use-addon-purchase-poll';

type Offer = AddonOffersResponse['items'][number];
type View = AddonPurchaseView;
const PUBLISH_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

/**
 * Owner-only addon purchase screen. Billing reads happen in the browser, so the page itself
 * stays session-blind. A recurring addon is paid at the provider checkout and a one-time one
 * on a Mercado Pago payment page (HOS-2179); both redirect, and the return lands here with
 * `?compra=<id>`, which the screen re-reads until it settles. No card data is ever asked for.
 */
export function AddonPurchase(input: {
    readonly locale: SupportedLocale;
    readonly returnOrderRequestId: string | null;
    readonly accountEmail: string;
    readonly navigateToCheckout?: (url: string) => void;
    /** HOS-2599: the account's subscription verticals; only compatible add-ons are offered. */
    readonly accountVerticals?: readonly string[] | null;
}) {
    const accountVerticals = input.accountVerticals ?? null;
    const { t } = useMemo(() => createTranslations(input.locale), [input.locale]);
    const [offer, setOffer] = useState<Offer | null>(null);
    const [targets, setTargets] = useState<readonly AddonTarget[]>([]);
    const [target, setTarget] = useState<AddonTarget | null>(null);
    const [subscriptionTargets, setSubscriptionTargets] = useState<
        readonly AddonSubscriptionTarget[]
    >([]);
    const [subscriptionTarget, setSubscriptionTarget] = useState<AddonSubscriptionTarget | null>(
        null
    );
    const [emptyReason, setEmptyReason] = useState<'INACTIVE' | 'NONE'>('NONE');
    const [orderRequestId, setOrderRequestId] = useState<string | null>(null);
    const [view, setView] = useState<View>(input.returnOrderRequestId ? 'PROCESSING' : 'LOADING');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [purchasesPaused, setPurchasesPaused] = useState(false);
    const [payerEmail, setPayerEmail] = useState(input.accountEmail);
    // HOS-2616: the email declared on the last approved charge prefills the purchase until the
    // payer types another one or asks to change it. It is declared, never confirmed.
    const { rememberedEmail } = useRememberedPayerEmail();
    const [usingRememberedEmail, setUsingRememberedEmail] = useState(false);
    const [payerEmailEdited, setPayerEmailEdited] = useState(false);
    useEffect(() => {
        if (!rememberedEmail || payerEmailEdited) return;
        setPayerEmail(rememberedEmail);
        setUsingRememberedEmail(true);
    }, [rememberedEmail, payerEmailEdited]);
    // The purchase the screen waits on: the one the owner came back for, or the one a replay
    // answered without a link. A purchase another screen holds is not ours to read.
    const [pollOrderRequestId, setPollOrderRequestId] = useState(input.returnOrderRequestId);
    // A purchase another screen holds (PENDING_ELSEWHERE) carries no order id this screen can
    // read, so nothing would ever end its wait: it shows the "come back later" ending at once.
    const [waitingElsewhere, setWaitingElsewhere] = useState(false);
    const [activeInstances, setActiveInstances] = useState<readonly ActiveAddonInstance[]>([]);
    const [liveSubscriptions, setLiveSubscriptions] = useState<
        readonly AddonSubscriptionTarget[] | null
    >(null);
    const targetVertical = target?.vertical ?? subscriptionTarget?.vertical ?? null;
    const free =
        !!offer &&
        (targetVertical
            ? offer.freeUnderGrantVerticals.includes(targetVertical)
            : offer.compatibleVerticals.some((vertical) =>
                  offer.freeUnderGrantVerticals.includes(vertical)
              ));

    const { offers } = useAddonOffers({
        accountVerticals,
        returnOrderRequestId: input.returnOrderRequestId,
        t,
        setView,
        setError
    });

    // HOS-2362: what the account already holds, so a bought addon shows as active instead of
    // inviting a purchase the API refuses. Best effort: if the read fails the screen simply
    // behaves as before and the server stays the authority.
    const refreshActive = useCallback(async () => {
        try {
            const result = await billingAddonApi.listRecurringAddons();
            if (!result.ok) return;
            setActiveInstances(result.data.items);
            if (!result.data.items.some((item) => item.status === 'ACTIVE')) return;
            const subs = await billingSubscriptionApi.listMine({});
            if (subs.ok)
                setLiveSubscriptions(
                    eligibleSubscriptionTargets({
                        subscriptions: subs.data.subscriptions,
                        compatibleVerticals: subs.data.subscriptions.map((item) => item.vertical)
                    })
                );
        } catch {
            // Leave the screen on its pre-read behavior.
        }
    }, []);

    useEffect(() => {
        void refreshActive();
    }, [refreshActive]);

    const poll = useAddonPurchasePoll({
        orderRequestId: pollOrderRequestId,
        enabled: view === 'PROCESSING',
        loadError: t('billing.addonPurchase.loadError')
    });
    useEffect(() => {
        if (!poll.read) return;
        const state = purchaseStateFrom({ read: poll.read });
        if (state === 'ACTIVE') setView('ACTIVE');
        else if (state === 'CLOSED') setView('CLOSED');
    }, [poll.read]);
    const waitingKind = poll.read?.chargeKind ?? offer?.chargeKind ?? null;
    const waitEnded = poll.exhausted || waitingElsewhere;

    const selectOffer = async (selected: Offer) => {
        setOffer(selected);
        setTarget(null);
        setSubscriptionTarget(null);
        setOrderRequestId(null);
        setError(null);
        setPurchasesPaused(false);
        if (selected.scopeType === 'VERTICAL_SUBSCRIPTION') {
            setView('LOADING');
            try {
                const result = await billingSubscriptionApi.listMine({});
                if (!result.ok)
                    throw new Error(
                        visibleApiMessage({ error: result.error }) ??
                            t('billing.addonPurchase.loadError')
                    );
                const items = eligibleSubscriptionTargets({
                    subscriptions: result.data.subscriptions,
                    compatibleVerticals: selected.compatibleVerticals
                });
                setSubscriptionTargets(items);
                setEmptyReason(
                    noSubscriptionReason({
                        subscriptions: result.data.subscriptions,
                        compatibleVerticals: selected.compatibleVerticals
                    })
                );
                const [only] = items;
                if (
                    items.length === 1 &&
                    only &&
                    !isAddonActiveOnTarget({
                        active: activeInstances,
                        slug: selected.slug,
                        targetId: only.id
                    })
                )
                    selectSubscription(only);
                else setView('SUBSCRIPTIONS');
            } catch (cause) {
                setError(
                    cause instanceof Error ? cause.message : t('billing.addonPurchase.loadError')
                );
                setView('OFFERS');
            }
            return;
        }
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
                    if (!result.ok)
                        throw new Error(
                            visibleApiMessage({ error: result.error }) ??
                                t('billing.addonPurchase.loadError')
                        );
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

    const selectSubscription = (selected: AddonSubscriptionTarget) => {
        setSubscriptionTarget(selected);
        setOrderRequestId(mintOrderRequestId());
        setView('SUMMARY');
    };

    const selectTarget = (selected: AddonTarget) => {
        setTarget(selected);
        setOrderRequestId(mintOrderRequestId());
        setView('SUMMARY');
    };

    const { backView, goBack } = useAddonPurchaseBack({
        view,
        target,
        subscriptionTarget,
        subscriptionTargetCount: subscriptionTargets.length,
        busy,
        setError,
        setPurchasesPaused,
        setOffer,
        setTarget,
        setSubscriptionTarget,
        setOrderRequestId,
        setView
    });

    /** Known refusal codes and reasons get their localized copy; anything else keeps the API text. */
    const purchaseErrorMessage = ({ error }: { readonly error: ApiErrorShape }): string =>
        translateApiError({
            error,
            t,
            fallback: visibleApiMessage({ error }) ?? t('billing.addonPurchase.loadError')
        });

    const confirmPurchase = async () => {
        if (!offer || !orderRequestId || busy) return;
        setBusy(true);
        setError(null);
        setPurchasesPaused(false);
        setWaitingElsewhere(false);
        const body = {
            productId: offer.productId,
            addonVersionId: offer.addonVersionId,
            targetId: target?.listingId ?? subscriptionTarget?.id ?? null,
            orderRequestId
        };
        try {
            if (free) {
                const result = await billingAddonApi.chooseFree({ body });
                if (result.ok) setView('ACTIVE');
                else setError(purchaseErrorMessage({ error: result.error }));
            } else {
                // A one-time addon neither asks for the payer email nor sends it (P-8).
                let payer: { payerEmail?: string } = {};
                if (offer.chargeKind === 'PERIODICO') {
                    const email = z.email().safeParse(payerEmail);
                    if (!email.success) {
                        setError(t('billing.addonPurchase.payerEmailInvalid'));
                        return;
                    }
                    payer = { payerEmail: email.data };
                }
                const result = await billingAddonApi.purchase({ body: { ...body, ...payer } });
                if (result.ok) {
                    const state = purchaseStateFrom({ response: result.data });
                    if (state === 'REDIRECT' && result.data.checkoutUrl)
                        (
                            input.navigateToCheckout ??
                            ((url: string) => window.location.assign(url))
                        )(result.data.checkoutUrl);
                    else if (state === 'PROCESSING' || state === 'SETTLED') {
                        // Our own purchase without a link to follow: read it until it settles.
                        if (result.data.outcome === 'PENDING_ELSEWHERE') setWaitingElsewhere(true);
                        else setPollOrderRequestId(orderRequestId);
                        setView('PROCESSING');
                    } else setView('CLOSED');
                } else if (result.error.code === 'ADDON_PURCHASES_FROZEN') setPurchasesPaused(true);
                else {
                    // HOS-2321: the server released this order identity, so the next click must
                    // be a new order or it would replay the abandoned attempt.
                    if (orderIdentityReleased({ error: result.error }))
                        setOrderRequestId(mintOrderRequestId());
                    setError(
                        result.error.code === 'ADDON_ORDER_REQUEST_ABANDONED'
                            ? t('billing.addonPurchase.attemptExpired')
                            : purchaseErrorMessage({ error: result.error })
                    );
                    // HOS-2362: lost a race with another purchase; re-read so the addon shows
                    // as active and send the owner back to the offers.
                    if (result.error.code === 'ADDON_ALREADY_ACTIVE') {
                        void refreshActive();
                        setView('OFFERS');
                    }
                }
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : t('billing.addonPurchase.loadError'));
        } finally {
            setBusy(false);
        }
    };

    // HOS-2485: the purchase position (display only; Back moves between views).
    const steps = (['offer', 'target', 'confirm'] as const).map((id) => ({
        id,
        label: t(`billing.addonPurchase.steps.${id}`)
    }));
    const stepIndex = ADDON_PURCHASE_STEP_INDEX[view] ?? null;

    return (
        <div className={styles.root}>
            {purchasesPaused && (
                <div
                    role="status"
                    className={stylesNotice.notice}
                    data-testid="addon-purchases-paused-notice"
                >
                    <p className={stylesNotice.title}>{t('billing.addonPurchase.paused.title')}</p>
                    <p className={stylesNotice.body}>{t('billing.addonPurchase.paused.body')}</p>
                </div>
            )}
            {error && (
                <p
                    role="alert"
                    className={styles.error}
                >
                    {error}
                </p>
            )}
            {stepIndex !== null && (
                <Stepper
                    steps={steps}
                    current={stepIndex}
                    label={t('billing.addonPurchase.steps.label')}
                    locale={input.locale}
                    action={
                        backView ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                data-testid="addon-purchase-back"
                                disabled={busy}
                                onClick={goBack}
                            >
                                {t('billing.addonPurchase.back')}
                            </Button>
                        ) : undefined
                    }
                />
            )}
            {view === 'LOADING' && <p>{t('billing.addonPurchase.loading')}</p>}
            {view === 'OFFERS' && (
                <AddonOfferList
                    locale={input.locale}
                    offers={offers}
                    isActive={(candidate) =>
                        isOfferFullyActive({
                            offer: candidate,
                            active: activeInstances,
                            subscriptionTargets: liveSubscriptions
                        })
                    }
                    onSelect={(selected) => {
                        void selectOffer(selected);
                    }}
                    t={t}
                />
            )}
            {view === 'TARGETS' && (
                <AddonTargetPicker
                    items={targets}
                    isActive={(item) =>
                        !!offer &&
                        isAddonActiveOnTarget({
                            active: activeInstances,
                            slug: offer.slug,
                            targetId: item.listingId
                        })
                    }
                    onSelect={selectTarget}
                    t={t}
                />
            )}
            {view === 'SUBSCRIPTIONS' && (
                <AddonSubscriptionPicker
                    items={subscriptionTargets}
                    isActive={(item) =>
                        !!offer &&
                        isAddonActiveOnTarget({
                            active: activeInstances,
                            slug: offer.slug,
                            targetId: item.id
                        })
                    }
                    onSelect={selectSubscription}
                    emptyReason={emptyReason}
                    locale={input.locale}
                    plansHref={buildUrl({
                        locale: input.locale,
                        path: addonPlansPath({
                            compatibleVerticals: offer?.compatibleVerticals ?? []
                        })
                    })}
                    t={t}
                />
            )}
            {view === 'SUMMARY' && offer && (
                <AddonPurchaseSummary
                    offer={offer}
                    target={target}
                    subscriptionTarget={subscriptionTarget}
                    payerEmail={payerEmail}
                    onPayerEmailChange={(value) => {
                        setPayerEmailEdited(true);
                        setPayerEmail(value);
                    }}
                    usingRememberedEmail={usingRememberedEmail}
                    onUseAnotherEmail={() => {
                        setPayerEmailEdited(true);
                        setUsingRememberedEmail(false);
                    }}
                    free={free}
                    busy={busy}
                    locale={input.locale}
                    onConfirm={() => {
                        void confirmPurchase();
                    }}
                    t={t}
                />
            )}
            {(view === 'PROCESSING' || view === 'ACTIVE' || view === 'CLOSED') && (
                <AddonPurchaseOutcome
                    view={view}
                    processingKey={
                        waitingElsewhere
                            ? 'billing.addonPurchase.waitingPaymentLong'
                            : processingCopyKey({
                                  chargeKind: waitingKind,
                                  exhausted: poll.exhausted
                              })
                    }
                    waitEnded={waitEnded}
                    pollError={poll.error}
                    closedKey={closedCopyKey({ read: poll.read })}
                    t={t}
                />
            )}
        </div>
    );
}
