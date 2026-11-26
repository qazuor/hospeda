/**
 * @file PartnerClaim.client.tsx
 * @description Claims an approved Partner from a one-time email link (HOS-1486).
 */

import { AlertTriangleIcon, InfoIcon } from '@repo/icons';
import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import actionStyles from '@/components/shared/StatusActions.module.css';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { partnerClaimsPublicApi } from '@/lib/api/endpoints';
import { partnersApi } from '@/lib/api/endpoints-protected';
import { refreshBetterAuthSession } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { clearPendingAction, savePendingAction, takePendingAction } from '@/lib/pending-action';
import { signOutAndClearClientState } from '@/lib/sign-out';
import { buildUrl } from '@/lib/urls';
import styles from './PartnerClaim.module.css';
import { PartnerClaimSignInForm } from './PartnerClaimSignInForm.client';
import { PartnerClaimSignUpForm } from './PartnerClaimSignUpForm.client';

/** Props for the Partner claim island. */
export interface PartnerClaimProps {
    /** Current route locale. */
    readonly locale: SupportedLocale;
}

type ClaimState =
    | 'loading'
    | 'sign-in'
    | 'sign-up'
    | 'confirm'
    | 'claiming'
    | 'success'
    | 'not-found'
    | 'no-link'
    | 'already-claimed'
    | 'account-already-owns'
    | 'email-mismatch'
    | 'wrong-account'
    | 'error';

interface ClaimLink {
    readonly partnerId: string;
    readonly secret: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads an emailed claim link and guides its mailbox owner through account entry and claim. */
export const PartnerClaim: FC<PartnerClaimProps> = ({ locale }) => {
    const { t } = createTranslations(locale);
    const { user, permissions } = useAccountPermissions();
    const [claimLink, setClaimLink] = useState<ClaimLink | null>(null);
    const [claimEmail, setClaimEmail] = useState<string | null>(null);
    const [state, setState] = useState<ClaimState>('loading');
    const [needsSignInLink, setNeedsSignInLink] = useState(false);
    const claimStartedRef = useRef(false);
    const accountCheckedRef = useRef(false);
    const accountEmail = user?.email ?? null;

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
            if (pending?.kind === 'partner-claim')
                nextLink = { partnerId: pending.partnerId, secret: pending.secret };
        }
        if (!nextLink && !fragment) {
            setState('no-link');
            return;
        }
        if (!nextLink || !UUID_PATTERN.test(nextLink.partnerId) || !nextLink.secret) {
            setState('not-found');
            return;
        }
        setClaimLink(nextLink);
    }, []);

    useEffect(() => {
        if (!claimLink || permissions === null) return;
        if (user && accountCheckedRef.current) return;
        setState('loading');
        if (user) {
            // The check runs once per page: a later session refresh (e.g. after the claim
            // itself) must not send a finished claim back through it.
            accountCheckedRef.current = true;
            // HOS-2353: warn about a different account BEFORE the claim click. The 403 on
            // the claim itself stays as the safety net.
            void partnersApi
                .checkClaim(claimLink)
                .then((result) => {
                    if (result.ok) {
                        setState(result.data.emailMatches ? 'confirm' : 'wrong-account');
                        return;
                    }
                    const { status, reason } = result.error;
                    if (status === 404 || status === 400) setState('not-found');
                    else if (status === 409 && reason === 'PARTNER_ALREADY_CLAIMED')
                        setState('already-claimed');
                    else setState('error');
                })
                .catch(() => setState('error'));
            return;
        }
        let active = true;
        void partnerClaimsPublicApi
            .lookup(claimLink)
            .then((result) => {
                if (!active) return;
                if (!result.ok) {
                    if (result.error.status === 400 || result.error.status === 404)
                        setState('not-found');
                    else if (
                        result.error.status === 409 &&
                        result.error.reason === 'PARTNER_ALREADY_CLAIMED'
                    )
                        setState('already-claimed');
                    else setState('error');
                    return;
                }
                setClaimEmail(result.data.email);
                setState(result.data.accountExists ? 'sign-in' : 'sign-up');
            })
            .catch(() => {
                if (active) setState('error');
            });
        return () => {
            active = false;
        };
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

    const signInAnotherWay = (): void => {
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
        else if (status === 403 && reason === 'PARTNER_CLAIM_EMAIL_MISMATCH')
            setState('email-mismatch');
        else if (status === 401) {
            saveClaimAction();
            setState('sign-in');
        } else setState('error');
    };

    const signOutAndContinue = async (): Promise<void> => {
        // The fragment is gone from the URL by now; the pending action carries the
        // link across the reload. The shared sign-out also drops the cached signed-in
        // /auth/me snapshot, which would otherwise make the reload resume as the old
        // account (HOS-2338).
        saveClaimAction();
        const { ok } = await signOutAndClearClientState();
        if (!ok) {
            clearPendingAction();
            setState('error');
            return;
        }
        window.location.reload();
    };

    const promptByState: Partial<Record<ClaimState, string>> = {
        'sign-in': t('partners.claim.signInPrompt'),
        'sign-up': t('partners.claim.signUpPrompt'),
        confirm: t('partners.claim.confirmPrompt'),
        success: t('partners.claim.success'),
        'already-claimed': t('partners.claim.alreadyClaimed'),
        'account-already-owns': t('partners.claim.accountAlreadyOwns'),
        'email-mismatch': t('partners.claim.emailMismatch'),
        'wrong-account': t('partners.claim.wrongAccount'),
        error: t('partners.claim.genericError')
    };
    const supportState =
        state === 'already-claimed' ||
        state === 'account-already-owns' ||
        state === 'email-mismatch';

    if (state === 'no-link' || state === 'not-found') {
        const invalid = state === 'not-found';
        const Icon = invalid ? AlertTriangleIcon : InfoIcon;
        return (
            <section
                className={actionStyles.recovery}
                data-tone={invalid ? 'warning' : 'info'}
                aria-labelledby="partner-claim-heading"
            >
                <Icon
                    size={56}
                    weight="duotone"
                    color="currentColor"
                    className={actionStyles.statusIcon}
                    aria-hidden="true"
                />
                <div role={invalid ? 'alert' : undefined}>
                    <h1
                        id="partner-claim-heading"
                        className={styles.heading}
                    >
                        {t(
                            invalid
                                ? 'partners.claim.invalidLinkTitle'
                                : 'partners.claim.instructionsTitle'
                        )}
                    </h1>
                    <p className={actionStyles.description}>
                        {t(invalid ? 'partners.claim.notFound' : 'partners.claim.instructions')}
                    </p>
                </div>
                <div className={actionStyles.actions}>
                    <GradientButton
                        as="a"
                        href={buildUrl({ locale, path: 'contacto' })}
                        label={t('partners.claim.contactCta')}
                        variant="primary"
                        shape="rounded"
                    />
                    <GradientButton
                        as="a"
                        href={buildUrl({ locale, path: '/' })}
                        label={t('partners.claim.homeCta')}
                        variant="outline-primary"
                        shape="rounded"
                    />
                </div>
            </section>
        );
    }

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
            {state === 'sign-up' && claimLink && claimEmail && (
                <PartnerClaimSignUpForm
                    partnerId={claimLink.partnerId}
                    secret={claimLink.secret}
                    email={claimEmail}
                    locale={locale}
                    onSuccess={(signedIn) => {
                        setNeedsSignInLink(!signedIn);
                        setState('success');
                    }}
                    onAccountExists={() => setState('sign-in')}
                />
            )}
            {state === 'sign-in' && claimEmail && (
                <PartnerClaimSignInForm
                    email={claimEmail}
                    locale={locale}
                    onSuccess={() => setState('confirm')}
                    onOtherMethods={signInAnotherWay}
                />
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
            {(state === 'email-mismatch' || state === 'wrong-account') && accountEmail !== null && (
                <>
                    <p className={styles.message}>
                        {t('partners.claim.emailMismatchSignedInAs', undefined, {
                            email: accountEmail
                        })}
                    </p>
                    <button
                        className={styles.button}
                        type="button"
                        onClick={signOutAndContinue}
                    >
                        {t('partners.claim.signOutAndContinue')}
                    </button>
                </>
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
            {state === 'success' && needsSignInLink && (
                <a
                    className={styles.link}
                    href={buildUrl({ locale, path: 'auth/signin' })}
                >
                    {t('partners.claim.signInCta')}
                </a>
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
