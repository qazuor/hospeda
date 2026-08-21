/**
 * @file CommerceListingActions.client.tsx
 * @description Per-listing state badge + checklist + CTA island for the
 * `mi-cuenta/comercio` owner index (HOS-166 §8 points 4/5/6).
 *
 * Renders the listing-card state machine (`resolveCommerceListingCardState`)
 * and, for the `draft-complete` state, the "Publicar y pagar" CTA that starts
 * the owner's self-checkout — mirrors `PlanPurchaseButton.client.tsx` +
 * `checkout-pending.ts` (sessionStorage) + `CheckoutStatusPoller.client.tsx`
 * (HOS-151), stripped down to what commerce actually needs: no plan picker,
 * no promo codes, no annual/monthly toggle (HOS-166 D-7 — one plan, binary
 * billing).
 *
 * Hydration: `client:visible` — this sits inside a listing card in a list,
 * not above-the-fold interactive chrome.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { storePendingCheckoutSubId } from '@/lib/billing/checkout-pending';
import {
    type CommerceListingCardState,
    resolveCommerceListingCardState
} from '@/lib/commerce/listing-card-state';
import {
    MISSING_FIELD_FALLBACK_LABEL,
    MISSING_FIELD_I18N_SUFFIX
} from '@/lib/commerce/missing-field-labels';
import type { CommerceOwnerListingSummaryWithState } from '@/lib/commerce/owner-listings';
import { startOwnerListingCheckout } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl, buildUrlWithParams } from '@/lib/urls';
import styles from './CommerceListingActions.module.css';

export interface CommerceListingActionsProps {
    /** The listing summary + completeness preview to render actions for. */
    readonly listing: CommerceOwnerListingSummaryWithState;
    /** Active locale for translations and URL construction. */
    readonly locale: SupportedLocale;
    /**
     * Whether the owner already holds a subscription for THIS listing's
     * vertical (HOS-689 item 4), resolved server-side from the per-vertical
     * usage reading (`fetchCommerceUsageByVertical` — a resolved reading IS
     * proof of an existing subscription, since the usage endpoint 404s
     * otherwise).
     *
     * Drives which draft-complete CTA renders: `false` (no subscription yet)
     * keeps the real "Publicar y pagar" checkout (HOS-688 §6.8 branch 1);
     * `true` switches to a plain "Publicar" CTA that still calls
     * `startOwnerListingCheckout`, but the backend silently attaches the
     * listing to the existing subscription and opens no payment (branch 2)
     * — the same shape as accommodation, where publishing the second
     * property never opens a checkout.
     */
    readonly hasVerticalSubscription: boolean;
}

/** Public detail path segment per vertical (mirrors the `[slug].astro` routes). */
const PUBLIC_PATH_BY_VERTICAL: Record<CommerceOwnerListingSummaryWithState['vertical'], string> = {
    gastronomy: 'gastronomia',
    experience: 'experiencias'
};

/**
 * CommerceListingActions — renders the right badge/checklist/CTA for a
 * single owner-listing card, driven by `resolveCommerceListingCardState`.
 */
export function CommerceListingActions({
    listing,
    locale,
    hasVerticalSubscription
}: CommerceListingActionsProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [isCheckoutStarting, setIsCheckoutStarting] = useState(false);
    const [checkoutError, setCheckoutError] = useState<string | null>(null);
    // AC-14/R-5: on a 422 the SERVER's `missing` array is authoritative and
    // overrides the local preview — see `resolveListingCompleteness`'s module
    // doc in `@repo/schemas` (`packages/schemas/src/common/commerce-completeness.ts`).
    const [serverMissing, setServerMissing] = useState<readonly string[] | null>(null);

    const effectiveCompleteness =
        serverMissing === null
            ? listing.completeness
            : { complete: serverMissing.length === 0, missing: serverMissing };

    const state: CommerceListingCardState = resolveCommerceListingCardState({
        isPublic: listing.isPublic,
        completeness: effectiveCompleteness,
        subscriptionStatus: listing.subscriptionStatus,
        isCheckoutStarting
    });

    async function handlePublishAndPay(): Promise<void> {
        if (isCheckoutStarting) {
            return;
        }
        setCheckoutError(null);
        setIsCheckoutStarting(true);

        try {
            const result = await startOwnerListingCheckout({
                vertical: listing.vertical,
                listingId: listing.id
            });

            if (result.ok) {
                if (result.data.appliedEffect === 'attached') {
                    // HOS-688 §6.8 branch 2: the owner already held a
                    // subscription for this vertical, so the listing was
                    // attached to it and published synchronously
                    // server-side — no MercadoPago checkout was opened, and
                    // `checkoutUrl` is only an in-app sentinel. Reload so the
                    // index re-fetches `isPublic` and this card renders as
                    // `published`, instead of following a link that leads
                    // nowhere meaningful.
                    window.location.reload();
                    return;
                }
                storePendingCheckoutSubId(result.data.localSubscriptionId);
                window.location.href = result.data.checkoutUrl;
                return;
            }

            if (result.error.status === 422) {
                // R-5: `missing` is a SIBLING of `code`/`message` on the error
                // body (`{error: {code, message, missing}}`), NOT nested under
                // `details` — see `ApiError.missing` / `parseError()` in
                // `lib/api/client.ts`.
                setServerMissing(result.error.missing ?? []);
                setCheckoutError(
                    t(
                        'commerce.owner.checklist.incompleteError',
                        'Todavía faltan datos para publicar.'
                    )
                );
                return;
            }

            if (result.error.status === 409) {
                setCheckoutError(
                    t(
                        'commerce.owner.checklist.alreadySubscribedError',
                        'Este comercio ya tiene una suscripción activa.'
                    )
                );
                return;
            }

            setCheckoutError(
                t(
                    'commerce.owner.checklist.checkoutError',
                    'No pudimos iniciar el pago. Probá de nuevo.'
                )
            );
        } catch {
            setCheckoutError(
                t(
                    'commerce.owner.checklist.checkoutError',
                    'No pudimos iniciar el pago. Probá de nuevo.'
                )
            );
        } finally {
            setIsCheckoutStarting(false);
        }
    }

    if (state.kind === 'published') {
        const publicUrl = buildUrl({
            locale,
            path: `${PUBLIC_PATH_BY_VERTICAL[listing.vertical]}/${listing.slug}`
        });
        return (
            <div className={styles.actions}>
                <span className={`${styles.badge} ${styles.badgePublished}`}>
                    {t('commerce.owner.list.state.published', 'Publicado')}
                </span>
                <a
                    className={styles.link}
                    href={publicUrl}
                >
                    {t('commerce.owner.list.state.viewPublic', 'Ver ficha pública')}
                </a>
            </div>
        );
    }

    if (state.kind === 'pending-payment') {
        return (
            <div className={styles.actions}>
                <span className={`${styles.badge} ${styles.badgePending}`}>
                    {t('commerce.owner.list.state.pendingPayment', 'Pago en proceso')}
                </span>
            </div>
        );
    }

    if (state.kind === 'suspended') {
        // HOS-166 judgment-day W1: the recover CTA points at the general
        // account subscription page (`mi-cuenta/suscripcion`) — the same
        // billing/dunning surface accommodations use — rather than
        // re-triggering `startOwnerListingCheckout`, which the backend now
        // 409s for `past_due` (a second checkout would try to open a SECOND
        // MercadoPago preapproval instead of recovering the existing one).
        // HOS-259 / HOS-689: `?domain=<vertical>` tells the subscription page
        // (and, via it, `GET /users/me/subscription?productDomain=<vertical>`)
        // to resolve the caller's subscription for THIS listing's vertical
        // specifically. Scoping to the listing's own vertical (rather than
        // the transitional `commerce` umbrella) matters for an owner who
        // holds subscriptions in BOTH gastronomy and experience: `commerce`
        // would match either one ambiguously, exactly the bug HOS-259 fixed
        // for accommodation vs. commerce in the first place.
        const subscriptionHref = buildUrlWithParams({
            locale,
            path: 'mi-cuenta/suscripcion',
            params: { domain: listing.vertical }
        });
        return (
            <div className={styles.actions}>
                <span className={`${styles.badge} ${styles.badgeSuspended}`}>
                    {t('commerce.owner.list.state.suspended', 'Suspendido')}
                </span>
                <p className={styles.hint}>
                    {t(
                        'commerce.owner.list.state.suspendedHint',
                        'Tu pago no pudo procesarse. Revisá tu método de pago para reactivar la publicación.'
                    )}
                </p>
                <a
                    className={styles.link}
                    href={subscriptionHref}
                >
                    {t('commerce.owner.list.state.recoverCta', 'Revisar mi suscripción')}
                </a>
            </div>
        );
    }

    if (state.kind === 'unknown') {
        return (
            <div className={styles.actions}>
                <span className={styles.badge}>
                    {t('commerce.owner.list.state.unknown', 'Estado no disponible')}
                </span>
            </div>
        );
    }

    // draft-incomplete | draft-complete — always render the checklist section
    // (never a bare disabled button, HOS-166 §8 point 4).
    const missing = state.kind === 'draft-incomplete' ? state.missing : [];
    const canPublish = state.kind === 'draft-complete';

    // HOS-689 item 4: "Publicar y pagar" only when this WOULD open a real
    // MercadoPago checkout — once the owner already holds a subscription for
    // this vertical, publishing a later listing is free (it just consumes
    // quota), so the CTA drops the "y pagar" framing entirely.
    const publishCtaLabel = hasVerticalSubscription
        ? t('commerce.owner.checklist.publishCtaFree', 'Publicar')
        : t('commerce.owner.checklist.publishCta', 'Publicar y pagar');
    const publishingLabel = hasVerticalSubscription
        ? t('commerce.owner.checklist.publishingFree', 'Publicando...')
        : t('commerce.owner.checklist.publishing', 'Iniciando pago...');

    return (
        <div className={styles.actions}>
            <span className={`${styles.badge} ${styles.badgeDraft}`}>
                {canPublish
                    ? t('commerce.owner.list.state.draftComplete', 'Borrador — listo para publicar')
                    : t('commerce.owner.list.state.draftIncomplete', 'Borrador — incompleto')}
            </span>

            {missing.length > 0 && (
                <ul
                    className={styles.checklist}
                    data-testid="commerce-checklist"
                >
                    {missing.map((field) => (
                        <li key={field}>
                            {t(
                                `commerce.owner.checklist.field.${MISSING_FIELD_I18N_SUFFIX[field] ?? field}`,
                                MISSING_FIELD_FALLBACK_LABEL[field] ?? field
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <button
                type="button"
                className={styles.publishButton}
                disabled={!canPublish || isCheckoutStarting}
                aria-busy={isCheckoutStarting}
                onClick={() => void handlePublishAndPay()}
                data-testid="commerce-publish-button"
            >
                {isCheckoutStarting ? publishingLabel : publishCtaLabel}
            </button>

            {checkoutError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {checkoutError}
                </p>
            )}
        </div>
    );
}
