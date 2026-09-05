/**
 * @file CommerceListingActions.client.tsx
 * @description Per-listing state badge + checklist + CTA island for the
 * `mi-cuenta/comercio` owner index (HOS-166 §8 points 4/5/6).
 *
 * Renders the listing-card state machine (`resolveCommerceListingCardState`)
 * and, for the `draft-complete` state, the "Publicar y pagar" CTA that starts
 * the owner's self-checkout — mirrors `PlanPurchaseButton.client.tsx` +
 * `checkout-pending.ts` (sessionStorage) + `CheckoutStatusPoller.client.tsx`
 * (HOS-151), stripped down to what commerce actually needs: no promo codes,
 * no annual/monthly toggle (HOS-166 D-7 — binary billing). A tier picker WAS
 * added in HOS-1119 (`CommercePlanPicker`) once gastronomy went from one
 * sellable tier to two — see that prop's doc for the exact condition.
 *
 * HOS-1184 replaced the `hasVerticalSubscription` boolean with the server's
 * three-state `trialVerdict`. The CTA is no longer "pay or don't": publishing
 * can now be free because a plan is already paid for, OR free because a trial
 * is starting, and those are different things to tell an owner.
 *
 * Hydration: `client:visible` — this sits inside a listing card in a list,
 * not above-the-fold interactive chrome.
 */

import type { CommerceTrialVerdictKind } from '@repo/schemas';
import type { JSX } from 'react';
import { useState } from 'react';
import { PayerEmailConfirmDialog } from '@/components/billing/PayerEmailConfirmDialog.client';
import { Dialog } from '@/components/shared/ui/Dialog.client';
import { useSession } from '@/lib/auth-client';
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
import type { CommercePlanOption } from '@/lib/commerce/plan-options';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl, buildUrlWithParams } from '@/lib/urls';
import { BrochureDownloadButton } from './BrochureDownloadButton.client';
import styles from './CommerceListingActions.module.css';
import { CommercePlanPicker } from './CommercePlanPicker.client';
import { ExperienceCertificatePanel } from './ExperienceCertificatePanel.client';

export interface CommerceListingActionsProps {
    /** The listing summary + completeness preview to render actions for. */
    readonly listing: CommerceOwnerListingSummaryWithState;
    /** Active locale for translations and URL construction. */
    readonly locale: SupportedLocale;
    /**
     * What publishing THIS listing would actually do, resolved server-side by
     * `GET /protected/commerce/subscriptions/{vertical}/trial-verdict`
     * (HOS-1184).
     *
     * Three states and deliberately not a boolean. This prop replaced
     * `hasVerticalSubscription`, which could only say "already paying / not
     * already paying" — and once commerce got its trial back, "not already
     * paying" stopped meaning "about to pay". An owner with an intact trial
     * read "Publicar y pagar" and was told they were about to be charged for
     * something the server was about to give them free for thirty days.
     *
     * That is the same defect HOS-1183 is fixing on the accommodation side,
     * where three server-side verdicts get flattened into a boolean meaning
     * only `has_active_sub`. Collapsing the three here again is the one change
     * this prop exists to prevent.
     *
     * - `trial_available` — publishing starts a free trial. No checkout, no
     *   tier choice, no payer to confirm.
     * - `has_active_sub` — publishing attaches the listing to the subscription
     *   the owner already pays for (HOS-688 §6.8 branch 2).
     * - `payment_required` — publishing opens a real MercadoPago checkout.
     */
    readonly trialVerdict: CommerceTrialVerdictKind;
    /**
     * How many free days the trial would run, present only when
     * {@link trialVerdict} is `trial_available`.
     *
     * Comes from the resolved trial plan row rather than a constant, so the
     * number on the button is the number the grant writes — the same reason the
     * public pricing pages read `trialDays` live from the database.
     *
     * When absent the CTA falls back to naming no number at all rather than
     * guessing one: promising the wrong count is worse than promising none.
     */
    readonly trialDays?: number;
    /**
     * Whether the own-preapproval checkout path (HOS-937) is active, resolved
     * SSR-side by the page via `fetchCheckoutConfig()` — the web app has no
     * client access to the API's env.
     *
     * Gates {@link PayerEmailConfirmDialog} (HOS-1008). The dialog only has an
     * effect on that path: it is the only one that binds `payer_email`
     * server-side. On the hosted share-link path MercadoPago discards the
     * email entirely, so the dialog would be a pure extra click in a flow
     * that bills.
     *
     * Defaults to `false` — the same dark-by-default posture as the API flag,
     * so a page that forgets to pass it renders today's behavior rather than
     * a step that does nothing.
     */
    readonly ownPreapprovalEnabled?: boolean;
    /**
     * Active tiers of this listing's vertical (HOS-1119), resolved SSR-side
     * by the page via `fetchPublicPlans({ domain: vertical })` +
     * `filterPlansByCategory(..., 'owner')`.
     *
     * Defaults to `[]` — the same safe-degradation posture the page itself
     * uses on a failed fetch: with 0 or 1 entries the tier picker never
     * renders and checkout behaves EXACTLY as it did before HOS-1119 (no
     * `planSlug` sent, backend resolves the vertical's default tier). The
     * picker only opens when there is a real choice to make AND the owner is
     * choosing their FIRST subscription for this vertical — an owner who
     * already holds one changes tiers from `CommercePlanChange` instead,
     * never from this checkout CTA.
     */
    readonly availablePlans?: readonly CommercePlanOption[];
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
    trialVerdict,
    trialDays,
    ownPreapprovalEnabled = false,
    availablePlans = []
}: CommerceListingActionsProps): JSX.Element {
    const { t, tPlural } = createTranslations(locale);
    const { data: session } = useSession();
    const [isCheckoutStarting, setIsCheckoutStarting] = useState(false);
    const [showPayerEmailConfirm, setShowPayerEmailConfirm] = useState(false);
    const [showPlanPicker, setShowPlanPicker] = useState(false);
    // The tier chosen on the plan picker, carried across the (optional)
    // payer-email confirmation step until `runCheckout` actually fires.
    const [pendingPlanSlug, setPendingPlanSlug] = useState<string | undefined>(undefined);
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

    /**
     * Whether this click will actually open a MercadoPago checkout.
     *
     * Two conditions, and BOTH matter (HOS-1008):
     *
     * - `ownPreapprovalEnabled` — only that path binds `payer_email`.
     * - `payment_required` — the ONLY verdict that opens a payment. Under
     *   `has_active_sub` the backend attaches the listing and publishes it
     *   synchronously (HOS-688 §6.8 branch 2); under `trial_available` it
     *   grants a local trial and never tells MercadoPago the subscription
     *   exists (HOS-1184). In both cases the dialog would ask the owner to
     *   confirm the payer for a charge that is not going to happen.
     *
     * HOS-1184 note: this was `!hasVerticalSubscription`, which included the
     * trial case and would now stop a free publish behind a payment-email
     * screen.
     */
    const needsPayerEmailConfirm = ownPreapprovalEnabled && trialVerdict === 'payment_required';

    /**
     * Runs the checkout itself.
     *
     * `payerEmail` is forwarded only when the owner actually went through the
     * confirmation screen; `planSlug` only when the owner went through the
     * tier picker (HOS-1119). With both omitted the request is byte-identical
     * to the pre-HOS-1008 one.
     */
    async function runCheckout(payerEmail?: string, planSlug?: string): Promise<void> {
        if (isCheckoutStarting) {
            return;
        }
        setCheckoutError(null);
        setIsCheckoutStarting(true);

        try {
            const result = await startOwnerListingCheckout({
                vertical: listing.vertical,
                listingId: listing.id,
                ...(payerEmail === undefined ? {} : { payerEmail }),
                ...(planSlug === undefined ? {} : { planSlug })
            });

            if (result.ok) {
                if (
                    result.data.appliedEffect === 'attached' ||
                    result.data.appliedEffect === 'trial'
                ) {
                    // Two effects, one meaning: the listing was published
                    // server-side and NO MercadoPago checkout was opened, so
                    // `checkoutUrl` is only an in-app sentinel. Reload so the
                    // index re-fetches `isPublic` and this card renders as
                    // `published`, instead of following a link that leads
                    // nowhere meaningful.
                    //
                    // - `attached` (HOS-688 §6.8 branch 2) — the owner already
                    //   held a subscription for this vertical.
                    // - `trial` (HOS-1184 branch 1a) — a local trial was
                    //   granted; MercadoPago was never told it exists.
                    //
                    // Missing the `trial` case here does not degrade, it
                    // misleads: the owner would be sent to the payment-method
                    // page right after publishing for free.
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

            if (result.error.status === 400) {
                // HOS-1119: the chosen `planSlug` is not a tier of this
                // vertical — distinct from the generic checkoutError so an
                // owner who somehow submits a stale/foreign slug gets a
                // message that points at the plan choice, not at a vague
                // payment failure.
                setCheckoutError(
                    t(
                        'commerce.owner.checklist.invalidPlanError',
                        'El plan elegido ya no está disponible. Recargá la página e intentá de nuevo.'
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

    /**
     * Whether this click should open the tier picker first (HOS-1119): only
     * when there is a real choice (more than one active tier) AND the owner
     * is choosing their FIRST subscription for this vertical. An owner who
     * already holds one changes tiers from `CommercePlanChange` instead —
     * offering the picker here too would let them silently re-subscribe at a
     * different tier through a route the backend does not treat as an
     * upgrade.
     *
     * HOS-1184 narrowed this from `!hasVerticalSubscription` to
     * `payment_required` for a reason that is not symmetry: a trial does not
     * run on a tier. It runs on the vertical's own `*-trial` plan, so a tier
     * picked here would be collected and then ignored — the owner would choose
     * a plan they are not being put on.
     */
    const shouldShowPlanPicker = availablePlans.length > 1 && trialVerdict === 'payment_required';

    /**
     * The CTA handler. Opens the tier picker when there is a real choice to
     * make (HOS-1119); otherwise opens the payer-email confirmation screen
     * when this click will really open a MercadoPago checkout; otherwise goes
     * straight to {@link runCheckout}, which is exactly what happened before
     * HOS-1008.
     */
    function handlePublishAndPay(): void {
        if (isCheckoutStarting) {
            return;
        }
        if (shouldShowPlanPicker) {
            setCheckoutError(null);
            setShowPlanPicker(true);
            return;
        }
        if (needsPayerEmailConfirm) {
            setCheckoutError(null);
            setShowPayerEmailConfirm(true);
            return;
        }
        void runCheckout();
    }

    /** Called with the chosen tier slug once the owner confirms the picker. */
    function handlePlanPickerConfirm(planSlug: string): void {
        setShowPlanPicker(false);
        setPendingPlanSlug(planSlug);
        if (needsPayerEmailConfirm) {
            setCheckoutError(null);
            setShowPayerEmailConfirm(true);
            return;
        }
        void runCheckout(undefined, planSlug);
    }

    /** Called with the confirmed (possibly edited) email. */
    function handlePayerEmailConfirmed(email: string): void {
        setShowPayerEmailConfirm(false);
        void runCheckout(email, pendingPlanSlug);
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
                {/*
                 * HOS-1058. Only in the `published` state, and that is not a
                 * styling choice: the sheet is a print of the PUBLIC ficha, so
                 * a draft has nothing to print and its QR would lead to a 404.
                 * The API enforces the same rule; this just avoids offering a
                 * button that could only ever answer 404.
                 */}
                <BrochureDownloadButton
                    vertical={listing.vertical}
                    listingId={listing.id}
                    slug={listing.slug}
                    locale={locale}
                />
                {/*
                 * HOS-1057. Experiences only — a restaurant has nothing to
                 * certify — and only in the `published` state, for the same
                 * reason as the brochure above: the certificate carries a QR
                 * back to the PUBLIC ficha, so a draft would print a permanent
                 * 404 onto a piece of paper somebody keeps. The API enforces
                 * that rule on the PDF route itself; this only avoids offering a
                 * panel whose download could not work.
                 */}
                {listing.vertical === 'experience' && (
                    <ExperienceCertificatePanel
                        listingId={listing.id}
                        locale={locale}
                    />
                )}
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

    // HOS-689 item 4: "Publicar y pagar" ONLY when this would open a real
    // MercadoPago checkout. HOS-1184 added the third case rather than a second
    // one, because the two free outcomes are not the same promise: attaching to
    // a plan already paid for costs nothing and starts nothing, while a trial
    // costs nothing and starts a clock. The owner has to be told which.
    //
    // The trial label ANNOUNCES the free days (owner decision, HOS-1183, applied
    // to both verticals so they do not promise different things) and never says
    // "sin tarjeta": the card is asked for at signup, so claiming otherwise here
    // would be the mirror image of today's bug — a true-sounding sentence about
    // money that the rest of the product contradicts.
    //
    // `trialDays` absent falls back to a count-free label rather than guessing a
    // number: promising the wrong number of free days is worse than promising
    // none.
    function resolvePublishLabels(): { readonly cta: string; readonly busy: string } {
        if (trialVerdict === 'has_active_sub') {
            return {
                cta: t('commerce.owner.checklist.publishCtaFree', 'Publicar'),
                busy: t('commerce.owner.checklist.publishingFree', 'Publicando...')
            };
        }

        if (trialVerdict === 'trial_available') {
            return {
                cta:
                    trialDays === undefined
                        ? t('commerce.owner.checklist.publishCtaTrialNoCount', 'Publicar gratis')
                        : // `tPlural`, not `t`: the key has a real `_one`/`_other`
                          // pair, and `t` would never apply pluralization.
                          // `i18n-plural-shape.guard.test.ts` fails on exactly
                          // that mistake — it caught this one.
                          //
                          // It takes no fallback (its third parameter is
                          // `params`, not a default string), which is why the
                          // count-free variant above is a separate `t` key
                          // rather than this call with an empty count.
                          tPlural('commerce.owner.checklist.publishCtaTrial', trialDays),
                busy: t('commerce.owner.checklist.publishingFree', 'Publicando...')
            };
        }

        return {
            cta: t('commerce.owner.checklist.publishCta', 'Publicar y pagar'),
            busy: t('commerce.owner.checklist.publishing', 'Iniciando pago...')
        };
    }

    const { cta: publishCtaLabel, busy: publishingLabel } = resolvePublishLabels();

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
                onClick={handlePublishAndPay}
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

            {/*
             * HOS-1008: the pre-redirect payer-email screen the commerce
             * checkout was missing. Mounted unconditionally and toggled via
             * `isOpen` — the same shape `PlanPurchaseButton` uses — so the
             * dialog's own "re-seed on open" effect works across repeated
             * attempts. It can only ever open when `needsPayerEmailConfirm`
             * is true.
             */}
            <PayerEmailConfirmDialog
                isOpen={showPayerEmailConfirm}
                locale={locale}
                defaultEmail={session?.user?.email ?? ''}
                onCancel={() => setShowPayerEmailConfirm(false)}
                onConfirm={handlePayerEmailConfirmed}
            />

            {/*
             * HOS-1119: the tier picker, shown BEFORE the payer-email
             * confirmation (per `handlePublishAndPay`/`handlePlanPickerConfirm`)
             * only when there is a real choice and this is the owner's first
             * subscription for the vertical (`shouldShowPlanPicker`). Mounted
             * unconditionally and toggled via `isOpen`, same shape as the
             * payer-email dialog above.
             */}
            <Dialog
                isOpen={showPlanPicker}
                onClose={() => setShowPlanPicker(false)}
                ariaLabel={t('commerce.owner.planPicker.title', 'Elegí tu plan')}
                size="md"
            >
                <CommercePlanPicker
                    plans={availablePlans}
                    locale={locale}
                    onConfirm={handlePlanPickerConfirm}
                    onCancel={() => setShowPlanPicker(false)}
                />
            </Dialog>
        </div>
    );
}
