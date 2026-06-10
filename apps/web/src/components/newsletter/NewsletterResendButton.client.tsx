/**
 * @file NewsletterResendButton.client.tsx
 * @description Island shown on `/{locale}/newsletter/confirma-tu-email` so a
 * guest who didn't receive the double opt-in email can request a re-send.
 *
 * The API endpoint (POST /api/v1/public/newsletter/resend) is anti-enumeration
 * safe and rate-limited at 1 request/minute per IP. We also enforce a local
 * 60-second countdown in the button so the user can't hammer the network
 * after a successful click — a 429 from the server would still surface as the
 * generic error message, but the local cooldown prevents the obvious
 * mis-click loop.
 *
 * Hydrates with `client:visible` — the page is server-rendered and the button
 * is only meaningful after the user reads the surrounding copy.
 */

import { cn } from '@/lib/cn';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useId, useState } from 'react';
import styles from './NewsletterResendButton.module.css';

const COOLDOWN_SECONDS = 60;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export interface NewsletterResendButtonProps {
    readonly email: string;
    readonly locale: SupportedLocale;
}

export function NewsletterResendButton({ email, locale }: NewsletterResendButtonProps) {
    const { t } = createTranslations(locale);
    const liveRegionId = useId();

    const [status, setStatus] = useState<Status>('idle');
    const [cooldown, setCooldown] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Countdown ticker. Started by handleClick after a successful send; stops
    // itself on cleanup or when it reaches zero.
    useEffect(() => {
        if (cooldown <= 0) return;
        const handle = setTimeout(() => {
            setCooldown((current) => Math.max(0, current - 1));
        }, 1000);
        return () => clearTimeout(handle);
    }, [cooldown]);

    const handleClick = async (): Promise<void> => {
        if (status === 'sending' || cooldown > 0) return;
        setStatus('sending');
        setErrorMessage('');

        try {
            const response = await fetch(
                `${getApiUrl().replace(/\/$/, '')}/api/v1/public/newsletter/resend`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ email })
                }
            );

            if (!response.ok) {
                // 429 (rate limit) and 500-class errors share a generic message
                // since the endpoint is anti-enumeration: surfacing different
                // copy would leak server state.
                const message = t(
                    'newsletter.confirmYourEmail.resendError',
                    'No pudimos reenviar el email. Probá de nuevo en un minuto.'
                );
                setErrorMessage(message);
                setStatus('error');
                return;
            }

            setStatus('sent');
            setCooldown(COOLDOWN_SECONDS);
        } catch {
            setErrorMessage(
                t(
                    'newsletter.confirmYourEmail.resendError',
                    'No pudimos reenviar el email. Probá de nuevo en un minuto.'
                )
            );
            setStatus('error');
        }
    };

    const buttonLabel = (() => {
        if (status === 'sending') {
            return t('newsletter.confirmYourEmail.resendSending', 'Enviando...');
        }
        if (cooldown > 0) {
            return t('newsletter.confirmYourEmail.resendCooldown', 'Reintentar en {seconds}s', {
                seconds: cooldown
            });
        }
        return t('newsletter.confirmYourEmail.resendCta', 'Reenviar email');
    })();

    const successText =
        status === 'sent'
            ? t(
                  'newsletter.confirmYourEmail.resendSentMessage',
                  'Te enviamos un nuevo email. Revisá tu bandeja y la carpeta de spam.'
              )
            : '';

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                className={cn(
                    styles.button,
                    cooldown > 0 && styles.buttonDisabled,
                    status === 'sending' && styles.buttonBusy
                )}
                onClick={() => {
                    void handleClick();
                }}
                disabled={status === 'sending' || cooldown > 0}
                aria-describedby={liveRegionId}
                aria-busy={status === 'sending'}
            >
                {buttonLabel}
            </button>

            <p
                id={liveRegionId}
                className={styles.liveRegion}
                aria-live="polite"
                aria-atomic="true"
            >
                {status === 'sent' && successText}
                {status === 'error' && errorMessage}
            </p>
        </div>
    );
}
