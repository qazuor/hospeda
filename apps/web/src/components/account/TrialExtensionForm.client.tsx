/**
 * @file TrialExtensionForm.client.tsx
 * @description Self-service entry point for extending a running trial with a promo code (HOS-1012 T-039).
 *
 * Until T-039 the ONLY surface in the whole site that collected a promo code
 * was the plan purchase button — which is the PAID path, reached after the
 * trial is over. A host holding a live trial had nowhere to type `FREEMONTH` or
 * `LANZAMIENTO60`. This is that place: it sits on the account subscription page
 * and is rendered only while the subscription is actually `trial`.
 *
 * It posts to `POST /protected/billing/promo-codes/apply`, which pushes
 * `trial_end` on the row and answers with the date that was PERSISTED. The
 * component renders that date verbatim and asks the dashboard to refresh — it
 * never recomputes the new end from `extraDays`, because the whole point of
 * T-039 is that the client no longer projects a date the server did not write.
 */

import { useId, useState } from 'react';
import { billingApi } from '@/lib/api/endpoints-protected';
import { translateApiError } from '@/lib/api-errors';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './TrialExtensionForm.module.css';

/** Props for {@link TrialExtensionForm}. */
export interface TrialExtensionFormProps {
    /** Active locale, for copy and date formatting */
    readonly locale: SupportedLocale;
    /** The trialing subscription the code should be applied to */
    readonly subscriptionId: string;
    /** Called after a successful apply so the dashboard re-reads the new trial end */
    readonly onApplied?: () => void;
}

/** UI state machine for the apply flow. */
type ApplyStatus = 'idle' | 'applying' | 'applied' | 'error';

/**
 * Promo-code form for a host whose trial is still running.
 *
 * @param props - See {@link TrialExtensionFormProps}
 * @returns The form island, or the success summary once a code was applied.
 */
export function TrialExtensionForm({ locale, subscriptionId, onApplied }: TrialExtensionFormProps) {
    const { t } = createTranslations(locale);
    const inputId = useId();
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<ApplyStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [newTrialEnd, setNewTrialEnd] = useState<string | null>(null);

    const trimmed = code.trim();
    const isApplying = status === 'applying';

    async function handleApply() {
        if (trimmed.length === 0 || isApplying) return;

        setStatus('applying');
        setErrorMessage(null);

        const result = await billingApi.applyPromoCode({ code: trimmed, subscriptionId });

        if (!result.ok) {
            setStatus('error');
            setErrorMessage(
                translateApiError({
                    error: result.error,
                    t,
                    fallback: t(
                        'account.pages.subscription.trialExtension.errorGeneric',
                        'No pudimos aplicar el código. Revisalo e intentá de nuevo.'
                    )
                })
            );
            return;
        }

        // `trialEnd` is the value the server PERSISTED — render it as-is.
        setNewTrialEnd(result.data.trialEnd ?? null);
        setStatus('applied');
        onApplied?.();
    }

    if (status === 'applied') {
        return (
            <section
                className={styles.card}
                aria-label={t(
                    'account.pages.subscription.trialExtension.title',
                    'Extender tu prueba gratis'
                )}
            >
                <p
                    className={styles.success}
                    role="status"
                >
                    {newTrialEnd
                        ? t(
                              'account.pages.subscription.trialExtension.successWithDate',
                              'Listo. Tu prueba gratis ahora termina el {{date}}.',
                              { date: formatDate({ date: newTrialEnd, locale }) }
                          )
                        : t(
                              'account.pages.subscription.trialExtension.success',
                              'Listo. Extendimos tu prueba gratis.'
                          )}
                </p>
            </section>
        );
    }

    return (
        <section
            className={styles.card}
            aria-label={t(
                'account.pages.subscription.trialExtension.title',
                'Extender tu prueba gratis'
            )}
        >
            <h3 className={styles.title}>
                {t('account.pages.subscription.trialExtension.title', 'Extender tu prueba gratis')}
            </h3>
            <p className={styles.help}>
                {t(
                    'account.pages.subscription.trialExtension.help',
                    'Si tenés un código promocional, aplicalo ahora y sumás días a tu prueba.'
                )}
            </p>

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
                        disabled={isApplying}
                        placeholder={t(
                            'account.pages.subscription.trialExtension.placeholder',
                            'Ingresá tu código'
                        )}
                        onChange={(event) => {
                            setCode(event.target.value);
                            if (status === 'error') {
                                setStatus('idle');
                                setErrorMessage(null);
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
                        disabled={trimmed.length === 0 || isApplying}
                        aria-busy={isApplying}
                    >
                        {isApplying
                            ? t(
                                  'account.pages.subscription.trialExtension.applying',
                                  'Aplicando...'
                              )
                            : t('account.pages.subscription.trialExtension.apply', 'Aplicar')}
                    </button>
                </div>
            </div>

            {errorMessage !== null && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {errorMessage}
                </p>
            )}
        </section>
    );
}
