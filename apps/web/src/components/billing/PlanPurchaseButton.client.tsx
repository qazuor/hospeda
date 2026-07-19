/**
 * @file PlanPurchaseButton.client.tsx
 * @description React island button that initiates MercadoPago checkout for subscription plans.
 *
 * On click, reads the Better Auth session via `useSession`. If the user is
 * unauthenticated, redirects to the sign-in page with a return redirect. If
 * authenticated, calls `billingApi.createCheckout` (the Hospeda-custom
 * `start-paid` route) and follows the returned `checkoutUrl` to the
 * MercadoPago payment page (or the in-app success sentinel for `comp` plans).
 *
 * Hydration: client:load — checkout CTAs are interactive immediately.
 */

import { TagIcon } from '@repo/icons';
import type { EffectPreview } from '@repo/schemas';
import type { JSX } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { billingApi, userApi } from '../../lib/api/endpoints-protected';
import { useSession } from '../../lib/auth-client';
import { storePendingCheckoutSubId } from '../../lib/billing/checkout-pending';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { buildUrl } from '../../lib/urls';
import styles from './PlanPurchaseButton.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Props for the PlanPurchaseButton component.
 *
 * Both `monthlyPrice` and `annualPrice` are passed in regardless of the
 * current toggle state because the button is mounted once at page-render
 * time and the user can flip the toggle freely afterward. The component
 * picks the price to display by listening for the toggle's
 * `data-billing` attribute change and reading from its closest ancestor
 * with that attribute. The chosen interval is also forwarded to the
 * `/start-paid` call on click so the backend creates the right kind of
 * subscription (monthly preapproval vs annual checkout).
 *
 * Plans that do not support annual billing pass `annualPrice: null`.
 * When the toggle is set to "annual" and the plan has no annual price,
 * the button renders a disabled "Monthly plan only" state instead.
 */
export interface PlanPurchaseButtonProps {
    /** Billing plan slug sent to the checkout endpoint. */
    readonly planSlug: string;
    /** Monthly price in cents (smallest currency unit). Always present — every plan has a monthly price. */
    readonly monthlyPrice: number;
    /**
     * Annual price in cents, or `null` when the plan does not offer an
     * annual variant. Display + checkout adapt accordingly.
     */
    readonly annualPrice: number | null;
    /** Currency code shown with the price. */
    readonly currency: 'ARS' | 'USD';
    /** Button label text (e.g. "Contratar" or "Get started"). */
    readonly ctaText: string;
    /** Current locale for translations and URL construction. */
    readonly locale: SupportedLocale;
    /**
     * Whether to render the inline promo-code section under the CTA. Defaults to
     * `true` (the full pricing-card context). Set to `false` when the button is
     * mounted outside a card — e.g. inside the comparison table header cells —
     * where the expandable promo form would stretch the shared sticky `<thead>`
     * row and the card-decoration effects have no `.pricing-card` ancestor to
     * target. The discount can still be applied later at checkout.
     */
    readonly showPromo?: boolean;
}

// ---------------------------------------------------------------------------
// Subscription cache (module singleton)
// ---------------------------------------------------------------------------

/**
 * Module-level promise that fetches the current user's subscription. Several
 * <PlanPurchaseButton> islands hydrate on the same pricing page; without
 * sharing the request each one would issue its own GET, hitting the API N
 * times for a value that's identical across all buttons. The first call
 * starts the fetch; all subsequent calls await the same promise.
 *
 * Reset by `clearSubscriptionCache()` if the page wants to invalidate after
 * a checkout completes (currently not used — the success page is a separate
 * route so the cache is naturally fresh on next visit).
 */
let subscriptionPromise: Promise<string | null> | null = null;

function fetchCurrentPlanSlug(): Promise<string | null> {
    if (subscriptionPromise) return subscriptionPromise;
    subscriptionPromise = userApi
        .getSubscription()
        .then((result) => {
            if (!result.ok) return null;
            return result.data.subscription?.planSlug ?? null;
        })
        .catch(() => null);
    return subscriptionPromise;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a price amount for display, using a simple currency prefix.
 * Avoids complex i18n number formatting for MVP; suitable for static pricing pages.
 *
 * @param params.amount - Numeric price value
 * @param params.currency - ISO currency code
 * @returns Formatted price string, e.g. "$ 1.200" or "USD 12"
 */
function formatPrice({
    amount,
    currency
}: {
    readonly amount: number;
    readonly currency: 'ARS' | 'USD';
}): string {
    const prefix = currency === 'ARS' ? '$' : 'USD';
    return `${prefix} ${amount.toLocaleString('es-AR')}`;
}

/**
 * Convert centavos to major-unit string for display in promo effect messages.
 * E.g. 50000 cents → "500" (formatted as es-AR integer).
 *
 * @param cents - Amount in centavos
 * @returns Major-unit formatted string
 */
function centsToDisplay(cents: number): string {
    return (cents / 100).toLocaleString('es-AR');
}

/**
 * Append (or overwrite) a query param on an absolute URL (HOS-110 W1).
 * Used to flag `promoIgnored=1` on the in-app checkout-success sentinel URL
 * so that page can surface a "your discount code was not applied" note.
 *
 * @param url - Absolute URL string
 * @param key - Query param name
 * @param value - Query param value
 * @returns The URL with the param set, as a string
 */
function appendQueryParam(url: string, key: string, value: string): string {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
}

// ---------------------------------------------------------------------------
// Promo state types
// ---------------------------------------------------------------------------

/** State machine for the promo code field */
type PromoStatus = 'idle' | 'applying' | 'valid' | 'error';

interface PromoState {
    /** Whether the promo code section is expanded */
    readonly expanded: boolean;
    /** Raw code string typed by the user */
    readonly code: string;
    /** Current status of the promo apply flow */
    readonly status: PromoStatus;
    /** Validated effect preview (set when status === 'valid') */
    readonly preview: EffectPreview | null;
    /** Error message to show (set when status === 'error') */
    readonly errorMsg: string | null;
    /** The successfully applied code forwarded to checkout (set when status === 'valid') */
    readonly appliedCode: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PlanPurchaseButton — interactive CTA island for initiating plan checkout.
 *
 * Behaviour:
 * - **Unauthenticated**: navigates to `/auth/signin?redirect=/suscriptores/planes`
 * - **Authenticated (idle)**: displays `ctaText` + formatted `price`
 * - **Authenticated (loading)**: disables button, shows processing spinner + text
 * - **Authenticated (error)**: re-enables button, renders inline error below
 *
 * The button is disabled while a checkout request is in flight to prevent
 * double-submission. The `aria-label` is updated to the processing label
 * during loading so assistive technology announces the state change.
 *
 * A collapsible promo-code section is shown when the user is authenticated
 * and the plan is available. Validating a code previews the effect; a valid
 * code is forwarded to `createCheckout` on submit.
 *
 * For `comp` promo codes, `checkoutUrl` is an in-app success sentinel URL
 * (no MercadoPago redirect) — `window.location.href = checkoutUrl` is still
 * the correct action and the sentinel page handles the success flow.
 *
 * @example
 * ```astro
 * <PlanPurchaseButton
 *   client:load
 *   planSlug="owner-pro"
 *   monthlyPrice={120000}
 *   annualPrice={1200000}
 *   currency="ARS"
 *   ctaText="Contratar"
 *   locale={locale}
 * />
 * ```
 */
export function PlanPurchaseButton({
    planSlug,
    monthlyPrice,
    annualPrice,
    currency,
    ctaText,
    locale,
    showPromo = true
}: PlanPurchaseButtonProps): JSX.Element {
    const { data: session, isPending: sessionPending } = useSession();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null);
    // The toggle lives outside this island (vanilla JS in PricingCardsGrid).
    // The island observes the closest `data-billing` ancestor for changes so
    // the displayed price + the checkout payload stay in sync with the
    // toggle without coupling the two components via a store. Initial value
    // is 'monthly' — the toggle defaults to monthly on first render.
    const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    // ---------------------------------------------------------------------------
    // Promo code state
    // ---------------------------------------------------------------------------

    const [promo, setPromo] = useState<PromoState>({
        expanded: false,
        code: '',
        status: 'idle',
        preview: null,
        errorMsg: null,
        appliedCode: null
    });

    // Per-island unique id so the promo input/label association stays correct
    // when several <PlanPurchaseButton> islands render on the same pricing page
    // (a hardcoded id would collide across cards and break <label htmlFor>).
    const promoInputId = useId();

    const { t } = createTranslations(locale);

    const isAuthenticated = !sessionPending && Boolean(session?.user);
    const hasAnnual = annualPrice !== null && annualPrice > 0;
    const isAnnualUnavailable = billingInterval === 'annual' && !hasAnnual;
    // Convert cents to major units for the display formatter (the formatter
    // takes a number that it prefixes with the currency symbol; passing
    // cents would render "$ 12000000" for a $120000 plan).
    const displayPriceCents =
        billingInterval === 'annual' && hasAnnual ? (annualPrice as number) : monthlyPrice;
    const formattedPrice = formatPrice({
        amount: displayPriceCents / 100,
        currency
    });

    // Effective price after a successfully applied promo. Only `discount` and
    // `comp` change the headline price; `trial_extension` leaves it untouched
    // (it extends the free trial, not the recurring amount). The card DOM
    // (struck-through original + badge + trial days) is updated separately by
    // the `useEffect` below; here we only swap the price shown inside the CTA.
    const appliedPreview = promo.status === 'valid' ? promo.preview : null;
    const freeLabel = t('pricing.free', 'Gratis');
    const effectivePriceCents = ((): number => {
        if (!appliedPreview) return displayPriceCents;
        if (appliedPreview.effectKind === 'comp') return 0;
        if (appliedPreview.effectKind === 'discount' && appliedPreview.finalAmount !== null) {
            return appliedPreview.finalAmount;
        }
        return displayPriceCents;
    })();
    const hasPricePromo = appliedPreview !== null && effectivePriceCents !== displayPriceCents;
    const effectiveFormattedPrice =
        effectivePriceCents === 0
            ? freeLabel
            : formatPrice({ amount: effectivePriceCents / 100, currency });
    // Precomputed badge copy (e.g. "50% de descuento por 3 meses") so the
    // card-DOM effect below has a plain-string dependency instead of the
    // `buildPreviewText` closure (keeps useEffect deps exhaustive + stable).
    const promoBadgeText = appliedPreview ? buildPreviewText(appliedPreview) : '';

    const processingText = t('billing.checkout.button.processing', 'Procesando...');
    const processingAriaLabel = t('billing.checkout.button.processingAriaLabel', 'Procesando pago');
    const errorText = t(
        'billing.checkout.button.error',
        'No pudimos iniciar el pago. Intenta de nuevo.'
    );
    const currentPlanLabel = t('billing.checkout.button.currentPlan', 'Plan actual');
    const currentPlanAriaLabel = t(
        'billing.checkout.button.currentPlanAriaLabel',
        'Este es tu plan actual'
    );
    const monthlyOnlyLabel = t('pricing.monthlyOnly', 'Solo plan mensual');

    // Promo i18n strings
    const promoToggleLabel = t(
        'billing.checkout.promoApply.toggle',
        '¿Tenés un código de descuento?'
    );
    const promoLabel = t('billing.checkout.promoApply.label', 'Código de descuento');
    const promoPlaceholder = t('billing.checkout.promoApply.inputPlaceholder', 'Ingresá tu código');
    const promoApplyButton = t('billing.checkout.promoApply.applyButton', 'Aplicar');
    const promoApplying = t('billing.checkout.promoApply.applying', 'Verificando...');
    const promoRemoveButton = t('billing.checkout.promoApply.removeButton', 'Quitar');
    const promoErrorGeneric = t(
        'billing.checkout.promoApply.errorGeneric',
        'No pudimos verificar el código. Intentá de nuevo.'
    );

    /**
     * Map a server `errorCode` from the validate endpoint to a localized,
     * user-facing message.
     *
     * The endpoint also returns an `errorMessage`, but that string is hardcoded
     * in ENGLISH server-side (see `promo-code.validation.ts`), so it is
     * intentionally DISCARDED here. The typed `errorCode` is the stable contract
     * we translate against. Unknown or missing codes fall back to the generic
     * "invalid code" copy, so a new server-side code can never leak raw English.
     *
     * @param errorCode - Stable error code from the validate response (or undefined)
     * @returns Localized message for the current locale
     */
    function resolvePromoError(errorCode: string | undefined): string {
        switch (errorCode) {
            case 'PROMO_CODE_NOT_FOUND':
                return t(
                    'billing.checkout.promoApply.errorNotFound',
                    'No encontramos ese código. Revisá que esté bien escrito.'
                );
            case 'PROMO_CODE_INACTIVE':
                return t(
                    'billing.checkout.promoApply.errorInactive',
                    'Este código ya no está activo.'
                );
            case 'PROMO_CODE_EXPIRED':
                return t('billing.checkout.promoApply.errorExpired', 'Este código ya venció.');
            case 'PROMO_CODE_MAX_USES':
                return t(
                    'billing.checkout.promoApply.errorMaxUses',
                    'Este código alcanzó su límite de usos.'
                );
            case 'PROMO_CODE_MAX_USES_PER_USER':
                return t(
                    'billing.checkout.promoApply.errorMaxUsesPerUser',
                    'Ya usaste este código la cantidad máxima de veces.'
                );
            case 'PROMO_CODE_PLAN_RESTRICTION':
                return t(
                    'billing.checkout.promoApply.errorPlanRestriction',
                    'Este código no es válido para el plan seleccionado.'
                );
            case 'PROMO_CODE_NEW_USERS_ONLY':
                return t(
                    'billing.checkout.promoApply.errorNewUsersOnly',
                    'Este código es solo para clientes nuevos.'
                );
            case 'PROMO_CODE_MIN_AMOUNT':
                return t(
                    'billing.checkout.promoApply.errorMinAmount',
                    'Tu compra no alcanza el mínimo requerido para este código.'
                );
            case 'PROMO_CODE_VALIDATION_ERROR':
                return promoErrorGeneric;
            default:
                return t(
                    'billing.checkout.promoApply.errorInvalid',
                    'El código ingresado no es válido. Revisalo e intentá de nuevo.'
                );
        }
    }

    // Fetch the user's current subscription once they're authenticated. Shared
    // across every PlanPurchaseButton on the page via subscriptionPromise so a
    // pricing grid with N tiers issues exactly one request, not N.
    useEffect(() => {
        if (!isAuthenticated) {
            setCurrentPlanSlug(null);
            return;
        }
        let cancelled = false;
        fetchCurrentPlanSlug().then((slug) => {
            if (!cancelled) setCurrentPlanSlug(slug);
        });
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    // Observe the closest ancestor that carries the billing-interval toggle
    // state (set by PricingCardsGrid.astro's inline vanilla JS). We use a
    // MutationObserver because the toggle changes the attribute imperatively
    // and there is no React-side signal to react to. Pattern keeps the
    // toggle UI as pure HTML+JS in the Astro template (cheap, SSG-friendly)
    // while letting the island stay in sync.
    useEffect(() => {
        const root = buttonRef.current?.closest('[data-billing]') as HTMLElement | null;
        if (!root) return;
        const readCurrent = (): 'monthly' | 'annual' =>
            root.dataset.billing === 'annual' ? 'annual' : 'monthly';
        setBillingInterval(readCurrent());
        const observer = new MutationObserver(() => {
            setBillingInterval(readCurrent());
        });
        observer.observe(root, { attributes: true, attributeFilter: ['data-billing'] });
        return () => {
            observer.disconnect();
        };
    }, []);

    // Invalidate any applied promo when the billing interval changes. The code
    // was previewed (and `appliedCode` captured) against the previous interval's
    // price; carrying it over would forward a code to checkout that the user
    // never previewed against the now-selected amount — a real-money mismatch,
    // especially for fixed-amount discounts. Keep the typed code + expanded
    // state so the user can simply re-apply against the new price.
    // biome-ignore lint/correctness/useExhaustiveDependencies: billingInterval is a trigger-only dependency — the effect must re-run when it changes, though its value is not read in the body.
    useEffect(() => {
        setPromo((prev) =>
            prev.appliedCode === null && prev.status !== 'valid'
                ? prev
                : { ...prev, status: 'idle', preview: null, errorMsg: null, appliedCode: null }
        );
    }, [billingInterval]);

    const isCurrentPlan = isAuthenticated && currentPlanSlug === planSlug;

    // Show the promo section only when the user can interact with checkout
    const showPromoSection = showPromo && isAuthenticated && !isCurrentPlan && !isAnnualUnavailable;

    // BETA-183: a MercadoPago preapproval (used by every MONTHLY plan) is created
    // with a fixed payer_email = the Hospeda signup email. MP rejects the payment
    // if the paying MP account is under a different email — a surprise the user
    // only hits on MP's own screen, with no prior warning in Hospeda. Surface an
    // up-front notice before the redirect so the user can use (or switch to) an MP
    // account under this email. Monthly-only: annual is a one-time charge and any
    // MP account can pay it. Layer 1 (notice only) — capturing an alternate
    // payer_email is a follow-up.
    const userEmail = session?.user?.email ?? '';
    const showMonthlyEmailNotice =
        isAuthenticated && billingInterval === 'monthly' && !isCurrentPlan && userEmail !== '';
    const monthlyEmailNoticeTitle = t(
        'billing.checkout.monthlyEmailNotice.title',
        'Antes de continuar'
    );
    const monthlyEmailNoticeText = t(
        'billing.checkout.monthlyEmailNotice.text',
        'Vas a pagar con la cuenta de MercadoPago asociada a {{email}}. Si tu cuenta de MercadoPago usa otro correo, no vas a poder completar el pago mensual.'
    ).replace('{{email}}', userEmail);

    // ---------------------------------------------------------------------------
    // Promo helpers
    // ---------------------------------------------------------------------------

    /**
     * Build a human-readable preview string from the validated `EffectPreview`.
     *
     * @param preview - Effect preview object from the validate endpoint
     * @returns Localised summary string for display
     */
    function buildPreviewText(preview: EffectPreview): string {
        const { effectKind, valueKind, value, durationCycles, extraDays } = preview;

        if (effectKind === 'comp') {
            return t('billing.checkout.promoApply.comp', 'Gratis para siempre');
        }

        if (effectKind === 'trial_extension' && extraDays !== null) {
            return t(
                'billing.checkout.promoApply.trialExtension',
                '{{days}} días de prueba gratis adicionales'
            ).replace('{{days}}', String(extraDays));
        }

        if (effectKind === 'discount') {
            if (valueKind === 'percentage' && value !== null) {
                const months = durationCycles;
                if (months === null) {
                    return t(
                        'billing.checkout.promoApply.discountPercentForever',
                        '{{percent}}% de descuento para siempre'
                    ).replace('{{percent}}', String(value));
                }
                return t(
                    'billing.checkout.promoApply.discountPercentCycles',
                    '{{percent}}% de descuento por {{months}} meses'
                )
                    .replace('{{percent}}', String(value))
                    .replace('{{months}}', String(months));
            }
            if (valueKind === 'fixed' && value !== null) {
                // `value` is the discount amount in centavos — the copy reads
                // "$X de descuento" (X OFF), so it must use the discount, NOT
                // `finalAmount` (which is the resulting price after the discount).
                const displayAmount = centsToDisplay(value);
                const months = durationCycles;
                if (months === null) {
                    return t(
                        'billing.checkout.promoApply.discountFixedForever',
                        '${{amount}} de descuento para siempre'
                    ).replace('{{amount}}', displayAmount);
                }
                return t(
                    'billing.checkout.promoApply.discountFixedCycles',
                    '${{amount}} de descuento por {{months}} meses'
                )
                    .replace('{{amount}}', displayAmount)
                    .replace('{{months}}', String(months));
            }
        }

        // Degenerate case: a valid effect arrived with fields we can't render.
        // Return empty rather than a misleading default (never imply "free
        // forever" for a code we couldn't summarize).
        return '';
    }

    /**
     * Handle "Aplicar" click on the promo code section.
     * Calls the validate endpoint and updates promo state accordingly.
     */
    async function handleApplyPromo(): Promise<void> {
        const code = promo.code.trim();
        if (!code || !session?.user) return;

        setPromo((prev) => ({ ...prev, status: 'applying', errorMsg: null }));

        try {
            const result = await billingApi.validatePromoCode({
                code,
                userId: session.user.id,
                amount: displayPriceCents
            });

            if (!result.ok) {
                setPromo((prev) => ({
                    ...prev,
                    status: 'error',
                    errorMsg: promoErrorGeneric,
                    appliedCode: null
                }));
                return;
            }

            const { valid, errorCode, effectPreview } = result.data;

            if (!valid || !effectPreview) {
                setPromo((prev) => ({
                    ...prev,
                    status: 'error',
                    errorMsg: resolvePromoError(errorCode),
                    appliedCode: null
                }));
                return;
            }

            setPromo((prev) => ({
                ...prev,
                status: 'valid',
                preview: effectPreview,
                errorMsg: null,
                appliedCode: code
            }));
        } catch {
            setPromo((prev) => ({
                ...prev,
                status: 'error',
                errorMsg: promoErrorGeneric,
                appliedCode: null
            }));
        }
    }

    /**
     * Remove the applied promo code and reset the section to idle.
     */
    function handleRemovePromo(): void {
        setPromo((prev) => ({
            ...prev,
            status: 'idle',
            code: '',
            preview: null,
            errorMsg: null,
            appliedCode: null
        }));
    }

    // ---------------------------------------------------------------------------
    // Reflect the applied promo on the surrounding Astro card (price, trial days,
    // badge). The headline price + trial days are SSG markup rendered OUTSIDE this
    // island by PricingCardsGrid.astro, so we reach the ancestor `.pricing-card`
    // and mutate it directly. Every mutation is fully reverted in the cleanup, so
    // removing the code (or switching billing interval, which clears the promo)
    // restores the original markup. Styles for the injected nodes live in a
    // `<style is:global>` block in PricingCardsGrid.astro (the injected nodes lack
    // Astro's scope attribute, so scoped CSS would not apply).
    useEffect(() => {
        const card = buttonRef.current?.closest('.pricing-card');
        const preview = promo.status === 'valid' ? promo.preview : null;
        if (!card || !preview) return;

        const priceWrap = card.querySelector('.pricing-card__price');
        if (!priceWrap) return;

        const billingClass = billingInterval === 'annual' ? 'annual' : 'monthly';
        const amountEl = card.querySelector<HTMLElement>(`.pricing-card__amount--${billingClass}`);
        // HOS-115: the trial line is now interval-neutral (`.pricing-card__trial`,
        // visible under both toggles) — the old `--monthly`-only selector would
        // silently stop matching anything once the class was renamed.
        const trialEl = card.querySelector<HTMLElement>('.pricing-card__trial');

        const injected: Element[] = [];
        let trialOriginal: string | null = null;

        priceWrap.classList.add('pricing-card__price--promo-active');

        const injectBadge = (): void => {
            if (!promoBadgeText) return;
            const badge = document.createElement('span');
            badge.className = 'pricing-card__promo-badge';
            badge.textContent = promoBadgeText;
            priceWrap.appendChild(badge);
            injected.push(badge);
        };

        const injectNewAmount = (text: string): void => {
            if (!amountEl) return;
            amountEl.classList.add('pricing-card__amount--struck');
            const promoAmount = document.createElement('span');
            promoAmount.className = 'pricing-card__amount pricing-card__amount--promo';
            promoAmount.textContent = text;
            amountEl.insertAdjacentElement('afterend', promoAmount);
            injected.push(promoAmount);
        };

        if (preview.effectKind === 'discount' && effectivePriceCents !== displayPriceCents) {
            injectNewAmount(effectiveFormattedPrice);
            injectBadge();
        } else if (preview.effectKind === 'comp') {
            injectNewAmount(freeLabel);
            injectBadge();
        } else if (preview.effectKind === 'trial_extension' && preview.extraDays && trialEl) {
            trialOriginal = trialEl.textContent;
            const baseDays = Number.parseInt(trialOriginal?.match(/\d+/)?.[0] ?? '0', 10);
            const totalDays = baseDays + preview.extraDays;
            trialEl.textContent = (trialOriginal ?? '').replace(/\d+/, String(totalDays));
            trialEl.classList.add('pricing-card__trial--promo');
            injectBadge();
        }

        return () => {
            priceWrap.classList.remove('pricing-card__price--promo-active');
            amountEl?.classList.remove('pricing-card__amount--struck');
            for (const el of injected) el.remove();
            if (trialEl && trialOriginal !== null) {
                trialEl.textContent = trialOriginal;
                trialEl.classList.remove('pricing-card__trial--promo');
            }
        };
    }, [
        promo.status,
        promo.preview,
        billingInterval,
        promoBadgeText,
        effectiveFormattedPrice,
        effectivePriceCents,
        displayPriceCents,
        freeLabel
    ]);

    /**
     * Handle button click.
     * Redirects unauthenticated users to sign-in; fires checkout POST for authenticated users.
     */
    async function handleClick(): Promise<void> {
        // Clear any previous error on each attempt.
        setError(null);

        // If the toggle is on annual but this plan has no annual price,
        // the button rendered the disabled "Monthly plan only" state and
        // should not have been clickable. Defensive guard in case the
        // disabled state is bypassed (e.g. assistive tech edge cases).
        if (isAnnualUnavailable) {
            return;
        }

        if (!isAuthenticated) {
            const plansPath = buildUrl({ locale, path: 'suscriptores/planes' });
            const signinPath = `${buildUrl({ locale, path: 'auth/signin' })}?redirect=${encodeURIComponent(plansPath)}`;
            window.location.href = signinPath;
            return;
        }

        // Prevent double-submission.
        if (loading) {
            return;
        }

        setLoading(true);

        try {
            const result = await billingApi.createCheckout({
                planSlug,
                billingInterval,
                ...(promo.appliedCode ? { promoCode: promo.appliedCode } : {})
            });

            if (!result.ok || !result.data.checkoutUrl) {
                // TODO(SPEC-262): when start-paid surfaces a distinguishable
                // errorCode for a discount rejected on annual outside trial, map
                // it to `billing.checkout.promoApply.errorAnnualOutsideTrial`
                // (the key already ships in all locales). Until then, fall back
                // to the generic checkout error — safe, never misleading.
                const checkoutError = t(
                    'billing.checkout.button.error',
                    'No pudimos iniciar el pago. Intenta de nuevo.'
                );
                setError(checkoutError);
                return;
            }

            // For comp/trial promo codes, checkoutUrl is an in-app success sentinel
            // URL (not a MercadoPago redirect). window.location.href handles all
            // cases correctly — the sentinel page manages the success flow.
            //
            // A comp grant returns an in-app sentinel URL, not an MP redirect, so it
            // has no `collection_status` — without a signal the success page would
            // default to its "verifying payment" variant and wait on a payment that
            // was never made. Flag the effect on the URL so it renders the right copy.
            // checkoutUrl is always our own absolute site URL for comp (never an
            // external MP redirect), so appending a query param here is safe.
            //
            // `comp` is the only effect that takes this branch. It used to be shared
            // with `trial`, back when a trial-eligible checkout granted a no-card
            // trial instead of a paid one; HOS-171 made a trial just `free_trial` on
            // the paid preapproval, so it now goes to MercadoPago like any other
            // checkout and resolves through the poller below.
            let target = result.data.checkoutUrl;
            if (result.data.appliedEffect === 'comp') {
                target = appendQueryParam(target, 'effect', result.data.appliedEffect);
            } else {
                // HOS-151 Bug A: a real MercadoPago redirect (plain paid, a trial, or
                // a `discount` preapproval). The recurring-preapproval return carries
                // no `collection_status`, so stash the local sub id for the success
                // page to poll on return. Skipped for comp, which resolves instantly
                // on the in-app sentinel page.
                storePendingCheckoutSubId(result.data.localSubscriptionId);
            }
            // The server accepted a promo code that ended up doing nothing (a
            // trial_extension with no trial to lengthen) — tell the user rather than
            // pocketing it silently. Can coexist with the effect param.
            if (result.data.promoCodeIgnored) {
                target = appendQueryParam(target, 'promoIgnored', '1');
            }
            window.location.href = target;
        } catch {
            setError(errorText);
        } finally {
            setLoading(false);
        }
    }

    const buttonAriaLabel = isCurrentPlan
        ? currentPlanAriaLabel
        : isAnnualUnavailable
          ? monthlyOnlyLabel
          : loading
            ? processingAriaLabel
            : `${ctaText} — ${formattedPrice}`;

    const buttonDisabled = loading || isCurrentPlan || isAnnualUnavailable;

    return (
        <div className={styles.wrapper}>
            <button
                ref={buttonRef}
                type="button"
                data-testid="plan-cta-button"
                disabled={buttonDisabled}
                aria-label={buttonAriaLabel}
                aria-busy={loading}
                aria-disabled={isCurrentPlan || isAnnualUnavailable}
                onClick={buttonDisabled ? undefined : () => void handleClick()}
                className={`${styles.button}${isCurrentPlan ? ` ${styles.buttonCurrent}` : ''}`}
            >
                {isCurrentPlan ? (
                    <span className={styles.currentContent}>
                        <svg
                            className={styles.currentIcon}
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M5 12.5l4.5 4.5L19 7"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <span>{currentPlanLabel}</span>
                    </span>
                ) : loading ? (
                    <span className={styles.loadingContent}>
                        <span
                            className={styles.spinner}
                            aria-hidden="true"
                        />
                        <span>{processingText}</span>
                    </span>
                ) : isAnnualUnavailable ? (
                    <span className={styles.idleContent}>
                        <span className={styles.ctaText}>{monthlyOnlyLabel}</span>
                    </span>
                ) : (
                    <span className={styles.idleContent}>
                        <span className={styles.ctaText}>{ctaText}</span>
                        {hasPricePromo ? (
                            <span className={styles.price}>
                                <s className={styles.priceStruck}>{formattedPrice}</s>{' '}
                                <span className={styles.pricePromo}>{effectiveFormattedPrice}</span>
                            </span>
                        ) : (
                            <span className={styles.price}>{formattedPrice}</span>
                        )}
                    </span>
                )}
            </button>

            {error !== null && (
                <p
                    role="alert"
                    className={styles.errorMessage}
                >
                    {error}
                </p>
            )}

            {/* BETA-183: monthly MP email-mismatch notice (layer 1 — notice only) */}
            {showMonthlyEmailNotice && (
                <aside
                    className={styles.monthlyNotice}
                    data-testid="monthly-email-notice"
                >
                    <p className={styles.monthlyNoticeTitle}>{monthlyEmailNoticeTitle}</p>
                    <p className={styles.monthlyNoticeText}>{monthlyEmailNoticeText}</p>
                </aside>
            )}

            {/* Promo code section — only shown when the user can actually checkout */}
            {showPromoSection && (
                <div className={styles.promoSection}>
                    {promo.expanded ? (
                        <div className={styles.promoField}>
                            {promo.status === 'valid' ? (
                                /* Valid code — show preview */
                                <div className={styles.promoSuccess}>
                                    {/* <output> carries an implicit role="status" */}
                                    <output className={styles.promoPreviewText}>
                                        {promo.preview ? buildPreviewText(promo.preview) : ''}
                                    </output>
                                    <button
                                        type="button"
                                        className={styles.promoRemoveButton}
                                        onClick={handleRemovePromo}
                                    >
                                        {promoRemoveButton}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <label
                                        htmlFor={promoInputId}
                                        className={styles.promoLabel}
                                    >
                                        {promoLabel}
                                    </label>
                                    <div className={styles.promoInputRow}>
                                        <input
                                            id={promoInputId}
                                            type="text"
                                            className={styles.promoInput}
                                            placeholder={promoPlaceholder}
                                            value={promo.code}
                                            onChange={(e) =>
                                                setPromo((prev) => ({
                                                    ...prev,
                                                    code: e.target.value,
                                                    status: 'idle',
                                                    errorMsg: null
                                                }))
                                            }
                                            onKeyDown={(e) => {
                                                if (
                                                    e.key === 'Enter' &&
                                                    promo.code.trim() &&
                                                    promo.status !== 'applying'
                                                ) {
                                                    void handleApplyPromo();
                                                }
                                            }}
                                            disabled={promo.status === 'applying'}
                                            aria-label={promoLabel}
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                        <button
                                            type="button"
                                            className={styles.promoApplyButton}
                                            onClick={() => void handleApplyPromo()}
                                            disabled={
                                                !promo.code.trim() || promo.status === 'applying'
                                            }
                                            aria-busy={promo.status === 'applying'}
                                        >
                                            {promo.status === 'applying'
                                                ? promoApplying
                                                : promoApplyButton}
                                        </button>
                                    </div>
                                    {promo.status === 'error' && promo.errorMsg && (
                                        <p
                                            role="alert"
                                            className={styles.promoErrorMessage}
                                        >
                                            {promo.errorMsg}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <button
                            type="button"
                            className={styles.promoToggle}
                            onClick={() => setPromo((prev) => ({ ...prev, expanded: true }))}
                        >
                            <TagIcon
                                size={16}
                                weight="regular"
                                aria-hidden="true"
                            />
                            <span>{promoToggleLabel}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
