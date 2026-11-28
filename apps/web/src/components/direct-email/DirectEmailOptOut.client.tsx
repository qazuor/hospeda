/**
 * @file DirectEmailOptOut.client.tsx
 * @description Island on `/{locale}/correos/baja` (HOS-2685).
 *
 * The opt-out from direct emails happens only when the person clicks the
 * button, never on page load: mail scanners prefetch links, so loading the page
 * must not write anything. On mount the island only READS the token
 * (`GET /api/v1/public/direct-emails/opt-out?token=`) to show the masked
 * address; the click POSTs the same token to the same path and shows the result
 * in place.
 *
 * The page stays session-blind: it reads no session and no cookie.
 */

import { useEffect, useId, useState } from 'react';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './DirectEmailOptOut.module.css';

type Phase =
    | { readonly name: 'verifying' }
    | { readonly name: 'ready'; readonly maskedEmail: string }
    | { readonly name: 'submitting'; readonly maskedEmail: string }
    | { readonly name: 'done'; readonly maskedEmail: string }
    | { readonly name: 'invalid' }
    | {
          readonly name: 'error';
          /** Present when the token was read, so the button can retry the POST. */
          readonly maskedEmail: string | null;
      };

export interface DirectEmailOptOutProps {
    /** Signed token from the mail link. May be empty on a broken link. */
    readonly token: string;
    readonly locale: SupportedLocale;
}

const OPT_OUT_PATH = '/api/v1/public/direct-emails/opt-out';

function endpoint(): string {
    return `${getApiUrl().replace(/\/$/, '')}${OPT_OUT_PATH}`;
}

/** Reads `data.maskedEmail` from an API envelope, or `null` when absent. */
async function readMaskedEmail(response: Response): Promise<string | null> {
    const body: unknown = await response.json().catch(() => null);
    const masked = (body as { data?: { maskedEmail?: unknown } } | null)?.data?.maskedEmail;
    return typeof masked === 'string' && masked.length > 0 ? masked : null;
}

/** A rejected token (400) or any other client error that retrying cannot fix. */
function isTokenRejection(status: number): boolean {
    return status >= 400 && status < 500;
}

export function DirectEmailOptOut({ token, locale }: DirectEmailOptOutProps) {
    const { t } = createTranslations(locale);
    const liveRegionId = useId();
    const [phase, setPhase] = useState<Phase>(token ? { name: 'verifying' } : { name: 'invalid' });

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();

        void (async () => {
            try {
                const response = await fetch(`${endpoint()}?token=${encodeURIComponent(token)}`, {
                    method: 'GET',
                    signal: controller.signal
                });
                if (response.ok) {
                    const maskedEmail = await readMaskedEmail(response);
                    setPhase(maskedEmail ? { name: 'ready', maskedEmail } : { name: 'invalid' });
                    return;
                }
                setPhase(
                    isTokenRejection(response.status)
                        ? { name: 'invalid' }
                        : { name: 'error', maskedEmail: null }
                );
            } catch {
                if (controller.signal.aborted) return;
                setPhase({ name: 'error', maskedEmail: null });
            }
        })();

        return () => controller.abort();
    }, [token]);

    const submitOptOut = async (maskedEmail: string): Promise<void> => {
        setPhase({ name: 'submitting', maskedEmail });
        try {
            const response = await fetch(endpoint(), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ token })
            });
            if (response.ok) {
                const confirmed = await readMaskedEmail(response);
                setPhase({ name: 'done', maskedEmail: confirmed ?? maskedEmail });
                return;
            }
            setPhase(
                isTokenRejection(response.status)
                    ? { name: 'invalid' }
                    : { name: 'error', maskedEmail }
            );
        } catch {
            setPhase({ name: 'error', maskedEmail });
        }
    };

    if (phase.name === 'invalid') {
        return (
            <div className={styles.wrapper}>
                <p
                    role="alert"
                    className={styles.heading}
                >
                    {t('newsletter.directEmailOptOut.invalidTitle')}
                </p>
                <p className={styles.text}>
                    {t('newsletter.directEmailOptOut.invalidDescription')}
                </p>
            </div>
        );
    }

    if (phase.name === 'done') {
        return (
            <div className={styles.wrapper}>
                <p
                    role="status"
                    className={styles.heading}
                >
                    {t('newsletter.directEmailOptOut.successTitle')}
                </p>
                <p className={styles.text}>
                    {t('newsletter.directEmailOptOut.successDescription', undefined, {
                        email: phase.maskedEmail
                    })}
                </p>
            </div>
        );
    }

    if (phase.name === 'verifying') {
        return (
            <div className={styles.wrapper}>
                <p
                    role="status"
                    className={styles.text}
                >
                    {t('newsletter.directEmailOptOut.verifying')}
                </p>
            </div>
        );
    }

    const maskedEmail = phase.maskedEmail;
    const submitting = phase.name === 'submitting';

    return (
        <div className={styles.wrapper}>
            {maskedEmail && (
                <p className={styles.text}>
                    {t('newsletter.directEmailOptOut.addressLine', undefined, {
                        email: maskedEmail
                    })}
                </p>
            )}
            {maskedEmail && (
                <button
                    type="button"
                    className={`${styles.button}${submitting ? ` ${styles.buttonBusy}` : ''}`}
                    onClick={() => {
                        void submitOptOut(maskedEmail);
                    }}
                    disabled={submitting}
                    aria-describedby={liveRegionId}
                    aria-busy={submitting}
                >
                    {submitting
                        ? t('newsletter.directEmailOptOut.confirming')
                        : t('newsletter.directEmailOptOut.confirmButton')}
                </button>
            )}
            <p
                id={liveRegionId}
                className={styles.liveRegion}
                aria-live="polite"
                aria-atomic="true"
            >
                {phase.name === 'error' && t('newsletter.directEmailOptOut.networkError')}
            </p>
        </div>
    );
}
