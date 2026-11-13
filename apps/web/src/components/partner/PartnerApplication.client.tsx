/**
 * @file PartnerApplication.client.tsx
 * @description Guest Partner application form for PP1 (AC:V7:15).
 */

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { partnerApplicationApi } from '@/lib/api/endpoints';
import { fetchAuthMe } from '@/lib/auth-cache';
import { resendVerificationEmail } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './PartnerApplication.module.css';

interface TurnstileOptions {
    readonly sitekey: string;
    readonly callback: (token: string) => void;
    readonly 'expired-callback': () => void;
    readonly 'error-callback': () => void;
}

interface TurnstileApi {
    render(target: HTMLElement, options: TurnstileOptions): string;
    remove(widgetId: string): void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
        onPartnerApplicationTurnstileLoad?: () => void;
    }
}

export interface PartnerApplicationProps {
    readonly locale: SupportedLocale;
    readonly turnstileSiteKey?: string;
}

type FormState = 'idle' | 'sending' | 'success' | 'error' | 'verify-email';
type ResendState = 'idle' | 'sending' | 'sent' | 'error';

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Renders the guest PP1 form and submits only its email and Turnstile token (AC:V7:15). */
export function PartnerApplication({ locale, turnstileSiteKey }: PartnerApplicationProps) {
    const { t } = createTranslations(locale);
    const [email, setEmail] = useState('');
    const [honeypot, setHoneypot] = useState('');
    const [token, setToken] = useState('');
    const [state, setState] = useState<FormState>('idle');
    const [resendState, setResendState] = useState<ResendState>('idle');
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    const widgetRef = useRef<HTMLDivElement>(null);
    const resendInFlightRef = useRef(false);

    useEffect(() => {
        if (!turnstileSiteKey || !widgetRef.current) return;

        let widgetId: string | undefined;
        let script = document.querySelector<HTMLScriptElement>(
            'script[data-partner-application-turnstile]'
        );
        const mountWidget = (): void => {
            if (!window.turnstile || !widgetRef.current || widgetId) return;
            widgetId = window.turnstile.render(widgetRef.current, {
                sitekey: turnstileSiteKey,
                callback: setToken,
                'expired-callback': () => setToken(''),
                'error-callback': () => setToken('')
            });
        };

        window.onPartnerApplicationTurnstileLoad = mountWidget;
        if (window.turnstile) {
            mountWidget();
        } else if (!script) {
            script = document.createElement('script');
            const callbackParameter = ['on', 'load'].join('');
            const query = new URLSearchParams({
                [callbackParameter]: 'onPartnerApplicationTurnstileLoad',
                render: 'explicit'
            });
            script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?${query}`;
            script.async = true;
            script.defer = true;
            script.dataset.partnerApplicationTurnstile = 'true';
            document.head.append(script);
        }

        return () => {
            if (widgetId) window.turnstile?.remove(widgetId);
            delete window.onPartnerApplicationTurnstileLoad;
        };
    }, [turnstileSiteKey]);

    const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (!turnstileSiteKey || !isValidEmail(email) || !token || state === 'sending') return;
        if (honeypot) {
            setState('success');
            return;
        }

        setState('sending');
        try {
            const result = await partnerApplicationApi.submit({
                email: email.trim(),
                cfTurnstileToken: token
            });
            if (result.ok) {
                setState('success');
            } else if (result.error.status === 403 && result.error.code === 'EMAIL_NOT_VERIFIED') {
                const snapshot = await fetchAuthMe();
                setAccountEmail(snapshot.user?.email ?? null);
                setState('verify-email');
            } else {
                setState('error');
            }
        } catch {
            setState('error');
        }
    };

    const resendVerification = async (): Promise<void> => {
        if (!accountEmail || resendInFlightRef.current) return;

        resendInFlightRef.current = true;
        setResendState('sending');
        try {
            const callbackURL = new URL(
                buildUrl({ locale, path: 'sumate/partner' }),
                window.location.origin
            ).href;
            const result = await resendVerificationEmail({ email: accountEmail, callbackURL });
            setResendState(result.error ? 'error' : 'sent');
        } catch {
            setResendState('error');
        } finally {
            resendInFlightRef.current = false;
        }
    };

    if (!turnstileSiteKey) {
        return (
            <section
                className={styles.card}
                aria-labelledby="partner-application-heading"
            >
                <h2
                    id="partner-application-heading"
                    className={styles.heading}
                >
                    {t('alliance-leads.partnerApplication.title')}
                </h2>
                <p
                    className={styles.message}
                    role="status"
                >
                    {t('alliance-leads.partnerApplication.unavailable')}
                </p>
            </section>
        );
    }

    if (state === 'success') {
        return (
            <section
                className={styles.card}
                aria-labelledby="partner-application-heading"
            >
                <h2
                    id="partner-application-heading"
                    className={styles.heading}
                >
                    {t('alliance-leads.partnerApplication.title')}
                </h2>
                <p
                    className={styles.message}
                    role="status"
                >
                    {t('alliance-leads.partnerApplication.success')}
                </p>
            </section>
        );
    }

    if (state === 'verify-email') {
        return (
            <section
                className={styles.card}
                aria-labelledby="partner-application-heading"
            >
                <h2
                    id="partner-application-heading"
                    className={styles.heading}
                >
                    {t('alliance-leads.partnerApplication.title')}
                </h2>
                <p
                    className={styles.message}
                    role="status"
                    data-testid="partner-application-verify-email"
                >
                    {t('alliance-leads.partnerApplication.verifyEmailFirst')}
                </p>
                {resendState === 'sent' ? (
                    <p
                        className={styles.message}
                        role="status"
                    >
                        {t('alliance-leads.partnerApplication.verificationResent')}
                    </p>
                ) : (
                    <>
                        {resendState === 'error' && (
                            <p
                                className={styles.error}
                                role="alert"
                            >
                                {t('alliance-leads.partnerApplication.resendVerificationError')}
                            </p>
                        )}
                        {accountEmail !== null && (
                            <button
                                type="button"
                                className={styles.button}
                                disabled={resendState === 'sending'}
                                onClick={resendVerification}
                            >
                                {resendState === 'sending'
                                    ? t('alliance-leads.partnerApplication.resendingVerification')
                                    : t('alliance-leads.partnerApplication.resendVerification')}
                            </button>
                        )}
                    </>
                )}
            </section>
        );
    }

    return (
        <section
            className={styles.card}
            aria-labelledby="partner-application-heading"
        >
            <h2
                id="partner-application-heading"
                className={styles.heading}
            >
                {t('alliance-leads.partnerApplication.title')}
            </h2>
            <form
                className={styles.form}
                onSubmit={submit}
            >
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="partner-application-email"
                    >
                        {t('alliance-leads.partnerApplication.emailLabel')}
                    </label>
                    <input
                        id="partner-application-email"
                        className={styles.input}
                        type="email"
                        name="email"
                        autoComplete="email"
                        required
                        value={email}
                        aria-describedby="partner-application-email-help"
                        onChange={(event) => setEmail(event.currentTarget.value)}
                    />
                    <p
                        id="partner-application-email-help"
                        className={styles.help}
                    >
                        {t('alliance-leads.partnerApplication.emailHelp')}
                    </p>
                </div>
                <div
                    className={styles.honeypot}
                    aria-hidden="true"
                >
                    <input
                        id="partner-application-company"
                        name="_hp"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(event) => setHoneypot(event.currentTarget.value)}
                    />
                </div>
                <div
                    className={styles.turnstile}
                    ref={widgetRef}
                />
                {state === 'error' && (
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {t('alliance-leads.partnerApplication.error')}
                    </p>
                )}
                <button
                    className={styles.button}
                    type="submit"
                    disabled={!isValidEmail(email) || !token || state === 'sending'}
                >
                    {state === 'sending'
                        ? t('alliance-leads.partnerApplication.sending')
                        : t('alliance-leads.partnerApplication.submit')}
                </button>
            </form>
        </section>
    );
}
