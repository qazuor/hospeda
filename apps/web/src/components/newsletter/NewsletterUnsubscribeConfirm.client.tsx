/**
 * @file NewsletterUnsubscribeConfirm.client.tsx
 * @description Island on `/{locale}/newsletter/unsubscribe` (HOS-2617).
 *
 * The unsubscribe happens only when the person clicks the button, never on
 * page load: mail scanners prefetch links, so a GET must not change anything.
 * The click POSTs the token to `/api/v1/public/newsletter/unsubscribe`, then
 * navigates to `desuscripto` on success or to `error` with the reason the API
 * reported (`token_expired` or `invalid_token`).
 */

import { useId, useState } from 'react';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './NewsletterUnsubscribeConfirm.module.css';

type Status = 'idle' | 'submitting' | 'error';

export interface NewsletterUnsubscribeConfirmProps {
    /** HMAC unsubscribe token from the mail link. May be empty on a broken link. */
    readonly token: string;
    readonly locale: SupportedLocale;
}

/**
 * Maps an API error body to the `reason` query the error page understands.
 */
function toErrorReason(body: unknown): 'token_expired' | 'invalid_token' {
    const reason = (body as { error?: { reason?: unknown } } | null)?.error?.reason;
    return reason === 'NEWSLETTER_TOKEN_EXPIRED' ? 'token_expired' : 'invalid_token';
}

export function NewsletterUnsubscribeConfirm({ token, locale }: NewsletterUnsubscribeConfirmProps) {
    const { t } = createTranslations(locale);
    const liveRegionId = useId();
    const [status, setStatus] = useState<Status>('idle');

    const goTo = (page: 'desuscripto' | 'error', reason?: string): void => {
        const query = reason ? `?reason=${reason}` : '';
        window.location.assign(`/${locale}/newsletter/${page}/${query}`);
    };

    const handleClick = async (): Promise<void> => {
        if (status === 'submitting') return;
        if (!token) {
            goTo('error', 'invalid_token');
            return;
        }
        setStatus('submitting');

        try {
            const response = await fetch(
                `${getApiUrl().replace(/\/$/, '')}/api/v1/public/newsletter/unsubscribe`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ token })
                }
            );

            if (response.ok) {
                goTo('desuscripto');
                return;
            }

            if (response.status === 401 || response.status === 404 || response.status === 400) {
                const body: unknown = await response.json().catch(() => null);
                goTo('error', toErrorReason(body));
                return;
            }

            setStatus('error');
        } catch {
            setStatus('error');
        }
    };

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                className={`${styles.button}${status === 'submitting' ? ` ${styles.buttonBusy}` : ''}`}
                onClick={() => {
                    void handleClick();
                }}
                disabled={status === 'submitting'}
                aria-describedby={liveRegionId}
                aria-busy={status === 'submitting'}
            >
                {status === 'submitting'
                    ? t('newsletter.unsubscribeConfirm.confirming')
                    : t('newsletter.unsubscribeConfirm.confirmButton')}
            </button>
            <p
                id={liveRegionId}
                className={styles.liveRegion}
                aria-live="polite"
                aria-atomic="true"
            >
                {status === 'error' && t('newsletter.unsubscribeConfirm.networkError')}
            </p>
        </div>
    );
}
