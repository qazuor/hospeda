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
    locale
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
        // HOS-259: `?domain=commerce` tells the subscription page (and, via
        // it, `GET /users/me/subscription?productDomain=commerce`) to resolve
        // the caller's COMMERCE subscription specifically — an owner who
        // holds BOTH an accommodation host plan and a commerce listing
        // subscription would otherwise land on whichever one the endpoint's
        // default (`accommodation`) resolves, not necessarily the one that
        // actually needs recovering.
        const subscriptionHref = buildUrlWithParams({
            locale,
            path: 'mi-cuenta/suscripcion',
            params: { domain: 'commerce' }
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
                {isCheckoutStarting
                    ? t('commerce.owner.checklist.publishing', 'Iniciando pago...')
                    : t('commerce.owner.checklist.publishCta', 'Publicar y pagar')}
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
