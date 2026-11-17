/**
 * @file ActiveSessionNotice.client.tsx
 * @description Interstitial shown by `/auth/signin` when the visitor already
 * has a session (BETA-216). Names the signed-in account and offers to continue
 * to the requested destination or to sign out and use another account.
 */

import { useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { signOutAndClearClientState } from '@/lib/sign-out';
import styles from './ActiveSessionNotice.module.css';

/** Props for {@link ActiveSessionNotice}. */
export interface ActiveSessionNoticeProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /** Email of the account that owns the open session. */
    readonly email: string;
    /** Server-validated destination of the "Continuar" action. */
    readonly continueUrl: string;
    /** Called once the session has been ended, so the page can show the sign-in form. */
    readonly onSignedOut: () => void;
}

/**
 * "Ya iniciaste sesión como {email}" with Continue / Use another account.
 *
 * `continueUrl` is computed by the page through the open-redirect guard; this
 * component never derives a destination itself.
 */
export function ActiveSessionNotice({
    locale,
    email,
    continueUrl,
    onSignedOut
}: ActiveSessionNoticeProps) {
    const { t } = createTranslations(locale);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [failed, setFailed] = useState(false);

    async function handleUseOtherAccount(): Promise<void> {
        setIsSigningOut(true);
        setFailed(false);
        const { ok } = await signOutAndClearClientState();
        if (ok) {
            onSignedOut();
            return;
        }
        setIsSigningOut(false);
        setFailed(true);
    }

    return (
        <div className={styles.notice}>
            <p className={styles.message}>
                {t('auth-ui.signIn.activeSession.message', 'Ya iniciaste sesión como {{email}}', {
                    email
                })}
            </p>
            {failed && (
                <div
                    role="alert"
                    className={styles.error}
                >
                    {t(
                        'auth-ui.signIn.activeSession.signOutError',
                        'No se pudo cerrar la sesión. Probá de nuevo.'
                    )}
                </div>
            )}
            <div className={styles.actions}>
                <a
                    href={continueUrl}
                    className={styles.primary}
                >
                    {t('auth-ui.signIn.activeSession.continue', 'Continuar')}
                </a>
                <button
                    type="button"
                    className={styles.secondary}
                    onClick={handleUseOtherAccount}
                    disabled={isSigningOut}
                >
                    {t('auth-ui.signIn.activeSession.useOtherAccount', 'Usar otra cuenta')}
                </button>
            </div>
        </div>
    );
}
