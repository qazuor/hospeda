/**
 * @file TrialExtensionForm.client.tsx
 * @description The one place a customer types a promo code outside checkout
 * (HOS-1012 T-039, generalised by HOS-1171).
 *
 * Until T-039 the ONLY surface in the whole site that collected a promo code
 * was the plan purchase button — which is the PAID path, reached after the
 * trial is over. A host holding a live trial had nowhere to type `FREEMONTH` or
 * `LANZAMIENTO60`. This is that place. HOS-1171 gave it a second home: a
 * standalone, shareable page (`/{lang}/mi-cuenta/canjear/`) that is reachable at
 * any time, not only while a trial happens to be running. Both mount THIS
 * component — the `variant` prop only swaps the heading copy.
 *
 * ## Two requests, not one, and why
 *
 * Submitting runs `/validate` FIRST and only then `/apply`:
 *
 * - `/validate` answers a typed `errorCode` (`PROMO_CODE_EXPIRED`,
 *   `PROMO_CODE_MAX_USES`, …) and an `effectPreview.effectKind`. `/apply`
 *   answers neither: `handleRouteError` derives `error.code` from the HTTP
 *   status, so a 422 arrives as `VALIDATION_ERROR` and every distinct refusal
 *   reads "Los datos enviados no son válidos." The pre-flight is what makes the
 *   message specific.
 * - It is also what keeps a DISCOUNT code out of `/apply` entirely. A discount
 *   is not redeemable here (owner decision, HOS-1171) and it must not be spent
 *   — the customer keeps it for checkout. The API refuses it too (that is the
 *   gate, this is the courtesy), but the refusal message is nicer when we never
 *   send it.
 *
 * Cost: every POST under `/billing/` shares one 10-requests-per-15-minutes
 * bucket per IP, so a submit spends 1 (discount/comp/invalid) or 2 (a real
 * trial extension). That is why validation runs on SUBMIT and never on a
 * keystroke.
 *
 * `/apply` pushes `trial_end` on the row and answers with the date that was
 * PERSISTED. The component renders that date verbatim and asks the dashboard to
 * refresh — it never recomputes the new end from `extraDays`, because the whole
 * point of T-039 is that the client no longer projects a date the server did
 * not write.
 */

import { useId, useState } from 'react';
import { billingApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './TrialExtensionForm.module.css';

/**
 * Which surface the form is mounted on. Changes the heading copy and nothing
 * else — the behaviour is identical, so there is one component and one flow.
 */
export type PromoRedeemVariant = 'dashboard' | 'redeem';

/** Props for {@link TrialExtensionForm}. */
export interface TrialExtensionFormProps {
    /** Active locale, for copy and date formatting */
    readonly locale: SupportedLocale;
    /**
     * The signed-in user's id. Required by `/validate`, which enforces
     * self-validation server-side (403 for anyone else's id).
     */
    readonly userId: string;
    /**
     * The trialing subscription the code should be applied to.
     *
     * OPTIONAL: `/apply` resolves the caller's own running trial when it is
     * omitted (`promo-trial-extension-apply.service.ts`). The dashboard knows
     * which row it is rendering and passes it; the standalone redeem page does
     * not, and does not need to.
     */
    readonly subscriptionId?: string;
    /** Pre-fills the field — the code carried by a shared redeem link */
    readonly initialCode?: string;
    /** Which heading copy to use. Defaults to the dashboard's. */
    readonly variant?: PromoRedeemVariant;
    /** Where "see plans" points when the code turns out to be a discount */
    readonly plansHref?: string;
    /** Called after a successful apply so the dashboard re-reads the new trial end */
    readonly onApplied?: () => void;
}

/**
 * UI state machine.
 *
 * `info` is deliberately NOT `error`: a discount code typed here is a perfectly
 * good code that simply belongs at checkout, and it has not been spent. Showing
 * it in the error style would read as "your code is broken".
 */
type ApplyStatus = 'idle' | 'checking' | 'applying' | 'applied' | 'error' | 'info';

/** Heading copy per variant. */
const HEADING_KEYS: Readonly<Record<PromoRedeemVariant, { title: string; help: string }>> = {
    dashboard: {
        title: 'account.pages.subscription.trialExtension.title',
        help: 'account.pages.subscription.trialExtension.help'
    },
    redeem: {
        title: 'account.pages.redeem.title',
        help: 'account.pages.redeem.help'
    }
};

/**
 * Promo-code form for a signed-in customer.
 *
 * @param props - See {@link TrialExtensionFormProps}
 * @returns The form island, or the success summary once a code was applied.
 */
export function TrialExtensionForm({
    locale,
    userId,
    subscriptionId,
    initialCode,
    variant = 'dashboard',
    plansHref,
    onApplied
}: TrialExtensionFormProps) {
    const { t } = createTranslations(locale);
    const inputId = useId();
    const [code, setCode] = useState(initialCode ?? '');
    const [status, setStatus] = useState<ApplyStatus>('idle');
    const [message, setMessage] = useState<string | null>(null);
    const [showPlansCta, setShowPlansCta] = useState(false);
    const [newTrialEnd, setNewTrialEnd] = useState<string | null>(null);
    const [appliedEffectKind, setAppliedEffectKind] = useState<string | null>(null);

    const trimmed = code.trim();
    const isBusy = status === 'checking' || status === 'applying';
    const headingKeys = HEADING_KEYS[variant];

    const genericError = t(
        'account.pages.subscription.trialExtension.errorGeneric',
        'No pudimos aplicar el código. Revisalo e intentá de nuevo.'
    );

    /**
     * Map a `/validate` `errorCode` to localized copy.
     *
     * The endpoint also returns an `errorMessage`, but it is hardcoded in
     * ENGLISH server-side (`promo-code.validation.ts`), so it is deliberately
     * DISCARDED — the typed code is the stable contract. An unknown or missing
     * code falls back to the generic copy, so a new server-side code can never
     * leak raw English. Mirrors `resolvePromoError` in
     * `PlanPurchaseButton.client.tsx`, which does the same job at checkout.
     *
     * @param errorCode - Typed code from the validate response, if any.
     * @returns Localized message for the current locale.
     */
    function resolveValidationError(errorCode: string | undefined): string {
        switch (errorCode) {
            case 'PROMO_CODE_NOT_FOUND':
                return t(
                    'account.pages.redeem.errorNotFound',
                    'No encontramos ese código. Revisá que esté bien escrito.'
                );
            case 'PROMO_CODE_INACTIVE':
                return t('account.pages.redeem.errorInactive', 'Este código ya no está activo.');
            case 'PROMO_CODE_EXPIRED':
                return t('account.pages.redeem.errorExpired', 'Este código ya venció.');
            case 'PROMO_CODE_MAX_USES':
                return t(
                    'account.pages.redeem.errorMaxUses',
                    'Este código alcanzó su límite de usos.'
                );
            case 'PROMO_CODE_MAX_USES_PER_USER':
                return t(
                    'account.pages.redeem.errorMaxUsesPerUser',
                    'Ya usaste este código la cantidad máxima de veces.'
                );
            case 'PROMO_CODE_PLAN_RESTRICTION':
                return t(
                    'account.pages.redeem.errorPlanRestriction',
                    'Este código no es válido para tu plan.'
                );
            case 'PROMO_CODE_NEW_USERS_ONLY':
                return t(
                    'account.pages.redeem.errorNewUsersOnly',
                    'Este código es solo para clientes nuevos.'
                );
            case 'PROMO_CODE_MIN_AMOUNT':
                return t(
                    'account.pages.redeem.errorMinAmount',
                    'Tu compra no alcanza el mínimo requerido para este código.'
                );
            default:
                return genericError;
        }
    }

    /**
     * Success copy for the effect that was actually applied.
     *
     * A trial extension names the new end date, which is the value the server
     * PERSISTED (never one recomputed from `extraDays`). A discount has no such
     * date, so it gets its own line — reusing the trial copy there would tell a
     * paying subscriber their free trial was extended.
     */
    function resolveSuccessMessage(): string {
        if (appliedEffectKind === 'discount') {
            return t(
                'account.pages.redeem.successDiscount',
                'Listo. Aplicamos el descuento a tu suscripción.'
            );
        }
        if (newTrialEnd !== null) {
            return t(
                'account.pages.subscription.trialExtension.successWithDate',
                'Listo. Tu prueba gratis ahora termina el {{date}}.',
                { date: formatDate({ date: newTrialEnd, locale }) }
            );
        }
        return t(
            'account.pages.subscription.trialExtension.success',
            'Listo. Extendimos tu prueba gratis.'
        );
    }

    /** Shows a non-error notice and stops — the code was NOT sent to `/apply`. */
    function showNotice(text: string, withPlansCta: boolean) {
        setStatus('info');
        setMessage(text);
        setShowPlansCta(withPlansCta);
    }

    async function handleApply() {
        if (trimmed.length === 0 || isBusy) return;

        setStatus('checking');
        setMessage(null);
        setShowPlansCta(false);

        const validation = await billingApi.validatePromoCode({ code: trimmed, userId });

        if (!validation.ok) {
            setStatus('error');
            setMessage(translateApiError({ error: validation.error, t, fallback: genericError }));
            return;
        }

        if (!validation.data.valid) {
            setStatus('error');
            setMessage(resolveValidationError(validation.data.errorCode));
            return;
        }

        const effectKind = validation.data.effectPreview?.effectKind;

        // A `comp` code is not redeemable anywhere: a complimentary subscription
        // is an operator's grant, not a redemption (HOS-1171). The API refuses it
        // too (403); stopping here just makes the message better. The copy stays
        // vague on purpose — confirming "yes, that is a comp code" to whoever
        // typed it is not information this surface owes.
        if (effectKind === 'comp') {
            showNotice(
                t(
                    'account.pages.redeem.compNotice',
                    'Este código no se puede canjear. Escribinos si te prometieron una suscripción de cortesía.'
                ),
                false
            );
            return;
        }

        // A discount needs a subscription to apply to. With one, `/apply` routes
        // through the fail-closed T-007 seam and really does lower the price of
        // the subscription being paid for — that is the whole point of letting a
        // subscribed customer redeem here.
        //
        // WITHOUT one there is nothing to discount, and sending it anyway would
        // spend the code for no effect. So this stops and says "keep it for
        // checkout" instead — an `undefined` effect lands here too, because a
        // legacy row whose `value_kind` was never backfilled is a discount the
        // server could not type, and guessing permissively is how a code gets
        // burnt for nothing.
        const isDiscountLike = effectKind !== 'trial_extension';
        if (isDiscountLike && subscriptionId === undefined) {
            showNotice(
                t(
                    'account.pages.redeem.discountNotice',
                    'Este código es un descuento. No lo usamos: vas a poder aplicarlo cuando contrates un plan.'
                ),
                plansHref !== undefined
            );
            return;
        }

        setStatus('applying');

        const result = await billingApi.applyPromoCode({
            code: trimmed,
            ...(subscriptionId === undefined ? {} : { subscriptionId })
        });

        if (!result.ok) {
            setStatus('error');
            // `NO_ACTIVE_TRIAL` arrives as `error.reason` (HOS-1171 whitelisted
            // it in `utils/entitlement-cause.ts`) and outranks the 422's
            // status-derived `VALIDATION_ERROR` in the translation chain.
            setMessage(translateApiError({ error: result.error, t, fallback: genericError }));
            return;
        }

        // `trialEnd` is the value the server PERSISTED — render it as-is. It is
        // absent for a discount, and the success copy falls back to a generic
        // line rather than claiming a trial that was not extended.
        setNewTrialEnd(result.data.trialEnd ?? null);
        setAppliedEffectKind(result.data.effectKind);
        setStatus('applied');
        onApplied?.();
    }

    if (status === 'applied') {
        return (
            <section
                className={styles.card}
                aria-label={t(headingKeys.title)}
            >
                <p
                    className={styles.success}
                    role="status"
                >
                    {resolveSuccessMessage()}
                </p>
            </section>
        );
    }

    return (
        <section
            className={styles.card}
            aria-label={t(headingKeys.title)}
        >
            <h3 className={styles.title}>{t(headingKeys.title)}</h3>
            <p className={styles.help}>{t(headingKeys.help)}</p>

            <div className={styles.row}>
                <label
                    className={styles.label}
                    htmlFor={inputId}
                >
                    {t('account.pages.subscription.trialExtension.label', 'Código promocional')}
                </label>
                <div className={styles.controls}>
                    <input
                        id={inputId}
                        className={styles.input}
                        type="text"
                        autoComplete="off"
                        spellCheck={false}
                        value={code}
                        disabled={isBusy}
                        placeholder={t(
                            'account.pages.subscription.trialExtension.placeholder',
                            'Ingresá tu código'
                        )}
                        onChange={(event) => {
                            setCode(event.target.value);
                            if (status === 'error' || status === 'info') {
                                setStatus('idle');
                                setMessage(null);
                                setShowPlansCta(false);
                            }
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleApply();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className={styles.button}
                        onClick={() => void handleApply()}
                        disabled={trimmed.length === 0 || isBusy}
                        aria-busy={isBusy}
                    >
                        {isBusy
                            ? t(
                                  'account.pages.subscription.trialExtension.applying',
                                  'Aplicando...'
                              )
                            : t('account.pages.subscription.trialExtension.apply', 'Aplicar')}
                    </button>
                </div>
            </div>

            {message !== null && status === 'error' && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {message}
                </p>
            )}

            {message !== null && status === 'info' && (
                <p
                    className={styles.notice}
                    role="status"
                >
                    {message}
                    {showPlansCta && plansHref !== undefined && (
                        <>
                            {' '}
                            <a
                                className={styles.noticeLink}
                                href={plansHref}
                            >
                                {t('account.pages.redeem.plansCta', 'Ver planes')}
                            </a>
                        </>
                    )}
                </p>
            )}
        </section>
    );
}
