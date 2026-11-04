/**
 * @file PartnerClaim.client.tsx
 * @description Claims an approved Partner from a one-time email link (HOS-1486).
 */

import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { partnersApi } from '@/lib/api/endpoints-protected';
import { refreshBetterAuthSession } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { savePendingAction, takePendingAction } from '@/lib/pending-action';
import { buildUrl } from '@/lib/urls';
import styles from './PartnerClaim.module.css';

/** Props for the Partner claim island. */
export interface PartnerClaimProps {
    /** Current route locale. */
    readonly locale: SupportedLocale;
}

type ClaimState =
    | 'loading'
    | 'sign-in'
    | 'confirm'
    | 'claiming'
    | 'success'
    | 'not-found'
    | 'already-claimed'
    | 'account-already-owns'
    | 'verify-email-first'
    | 'error';

interface ClaimLink {
    readonly partnerId: string;
    readonly secret: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads and consumes the emailed claim link, then asks the signed-in account
 * to confirm before changing Partner ownership.
 *
 * @param props - The current page locale.
 * @returns The claim flow's current prompt or result.
 */
export const PartnerClaim: FC<PartnerClaimProps> = ({ locale }) => {
    const { t } = createTranslations(locale);
    const { user, permissions } = useAccountPermissions();
    const [claimLink, setClaimLink] = useState<ClaimLink | null>(null);
    const [state, setState] = useState<ClaimState>('loading');
    const claimStartedRef = useRef<boolean>(false);

    useEffect(() => {
        const fragment = window.location.hash;
        let nextLink: ClaimLink | null = null;

        if (fragment) {
            const params = new URLSearchParams(fragment.slice(1));
            const partnerId = params.get('partner');
            const secret = params.get('secret');
            window.history.replaceState(null, '', window.location.pathname);
            if (partnerId && secret) nextLink = { partnerId, secret };
        } else {
            const pending = takePendingAction({
                path: window.location.pathname,
                matches: (action) => action.kind === 'partner-claim'
            });
            if (pending?.kind === 'partner-claim') {
                nextLink = { partnerId: pending.partnerId, secret: pending.secret };
            }
        }

        if (!nextLink || !UUID_PATTERN.test(nextLink.partnerId) || !nextLink.secret) {
            setState('not-found');
            return;
        }

        setClaimLink(nextLink);
    }, []);

    useEffect(() => {
        if (!claimLink || permissions === null) return;
        setState(user ? 'confirm' : 'sign-in');
    }, [claimLink, permissions, user]);

    const saveClaimAction = (): void => {
        if (!claimLink) return;
        savePendingAction({
            action: {
                kind: 'partner-claim',
                partnerId: claimLink.partnerId,
                secret: claimLink.secret
            },
            path: window.location.pathname
        });
    };

    const signIn = (): void => {
        saveClaimAction();
        const returnUrl = encodeURIComponent(window.location.pathname);
        window.location.assign(`/${locale}/auth/signin/?returnUrl=${returnUrl}`);
    };

    const claim = async (): Promise<void> => {
        if (!claimLink || state !== 'confirm' || claimStartedRef.current) return;
        claimStartedRef.current = true;
        setState('claiming');
        const result = await partnersApi.claim(claimLink);
        if (result.ok) {
            await refreshBetterAuthSession();
            setState('success');
            return;
        }

        const { status, reason } = result.error;
        if (status === 404 || status === 400) setState('not-found');
        else if (status === 409 && reason === 'PARTNER_ALREADY_CLAIMED')
            setState('already-claimed');
        else if (status === 409 && reason === 'PARTNER_CLAIM_ACCOUNT_ALREADY_OWNS')
            setState('account-already-owns');
        else if (status === 403 && reason === 'EMAIL_NOT_VERIFIED') setState('verify-email-first');
        else if (status === 401) {
            saveClaimAction();
            setState('sign-in');
        } else setState('error');
    };

    const promptByState: Partial<Record<ClaimState, string>> = {
        'sign-in': t('partners.claim.signInPrompt'),
        confirm: t('partners.claim.confirmPrompt'),
        success: t('partners.claim.success'),
        'not-found': t('partners.claim.notFound'),
        'already-claimed': t('partners.claim.alreadyClaimed'),
        'account-already-owns': t('partners.claim.accountAlreadyOwns'),
        'verify-email-first': t('partners.claim.verifyEmailFirst'),
        error: t('partners.claim.genericError')
    };
    const supportState =
        state === 'already-claimed' ||
        state === 'account-already-owns' ||
        state === 'verify-email-first';

    return (
        <section
            className={styles.card}
            aria-labelledby="partner-claim-heading"
        >
            <h1
                id="partner-claim-heading"
                className={styles.heading}
            >
                {t('partners.claim.heading')}
            </h1>
            {state === 'loading' || state === 'claiming' ? (
                <p
                    className={styles.message}
                    aria-live="polite"
                    aria-busy={state === 'claiming'}
                >
                    {state === 'claiming'
                        ? t('partners.claim.claiming')
                        : t('partners.claim.heading')}
                </p>
            ) : (
                <p
                    className={styles.message}
                    role={state === 'error' ? 'alert' : undefined}
                >
                    {promptByState[state]}
                </p>
            )}
            {state === 'sign-in' && (
                <button
                    className={styles.button}
                    type="button"
                    onClick={signIn}
                >
                    {t('partners.claim.signInCta')}
                </button>
            )}
            {state === 'confirm' && (
                <button
                    className={styles.button}
                    type="button"
                    onClick={claim}
                >
                    {t('partners.claim.confirmCta')}
                </button>
            )}
            {state === 'claiming' && (
                <button
                    className={styles.button}
                    type="button"
                    disabled
                >
                    {t('partners.claim.claiming')}
                </button>
            )}
            {state === 'success' && (
                <a
                    className={styles.link}
                    href={buildUrl({ locale, path: 'mi-cuenta/partner' })}
                >
                    {t('partners.claim.successCta')}
                </a>
            )}
            {supportState && (
                <a
                    className={styles.link}
                    href={buildUrl({ locale, path: 'contacto' })}
                >
                    {t('partners.claim.supportCta')}
                </a>
            )}
        </section>
    );
};
