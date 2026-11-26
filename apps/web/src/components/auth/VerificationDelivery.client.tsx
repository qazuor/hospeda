import { useEffect, useRef, useState } from 'react';
import styles from '@/components/shared/StatusActions.module.css';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { resendVerificationEmail } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { readVerificationDelivery, saveVerificationDelivery } from '@/lib/verification-delivery';

/** Shows the tab-local recipient and resends through the existing auth endpoint. */
export function VerificationDelivery({
    locale,
    signInHref
}: {
    readonly locale: SupportedLocale;
    readonly signInHref: string;
}) {
    const { t } = createTranslations(locale);
    const [delivery, setDelivery] = useState<ReturnType<typeof readVerificationDelivery>>(null);
    const [remaining, setRemaining] = useState(0);
    const [pending, setPending] = useState(false);
    const [result, setResult] = useState<'sent' | 'error' | null>(null);
    const inFlight = useRef(false);

    useEffect(() => {
        function refresh() {
            const next = readVerificationDelivery();
            setDelivery(next);
            setRemaining(next ? Math.max(0, Math.ceil((next.retryAt - Date.now()) / 1000)) : 0);
        }
        refresh();
        const timer = window.setInterval(refresh, 1000);
        return () => window.clearInterval(timer);
    }, []);

    async function resend(): Promise<void> {
        if (!delivery || delivery.retryAt > Date.now() || inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setResult(null);
        try {
            const response = await resendVerificationEmail({
                email: delivery.email,
                callbackURL: delivery.callbackURL
            });
            setResult(response.error ? 'error' : 'sent');
        } catch {
            setResult('error');
        } finally {
            saveVerificationDelivery(delivery);
            setDelivery(readVerificationDelivery());
            setRemaining(60);
            inFlight.current = false;
            setPending(false);
        }
    }

    return (
        <>
            {delivery && (
                <p className={styles.recipient}>
                    {t('auth.verificationDelivery.recipient', undefined, { email: delivery.email })}
                </p>
            )}
            <div className={styles.actions}>
                {delivery && (
                    <GradientButton
                        as="button"
                        type="button"
                        variant="primary"
                        size="lg"
                        shape="rounded"
                        disabled={pending || remaining > 0}
                        onClick={() => void resend()}
                        label={
                            remaining > 0
                                ? t('auth.verificationDelivery.wait', undefined, {
                                      seconds: remaining
                                  })
                                : t('auth.verificationDelivery.resend')
                        }
                    />
                )}
                <GradientButton
                    as="a"
                    href={signInHref}
                    label={t('auth-ui.pages.verifyEmailSent.signInLink')}
                    variant="outline-primary"
                    size="lg"
                    shape="rounded"
                />
            </div>
            {result === 'sent' && <p role="status">{t('auth.verificationDelivery.sent')}</p>}
            {result === 'error' && <p role="alert">{t('auth.verificationDelivery.error')}</p>}
        </>
    );
}
