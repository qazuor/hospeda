/**
 * @file AllianceClaimBanner.client.tsx
 * @description Redeems the claim token from an invitation email
 * (HOS-278 AC-4), on the page that link lands on.
 *
 * The email sends the address owner to `/mi-cuenta/aliados?lead=…&claim=…`.
 * Until this existed, that click arrived at a page that ignored the query
 * string entirely — the token was minted, delivered, and then had nowhere to
 * go.
 *
 * ## Why redeeming on mount is safe here
 *
 * It is a state change triggered by a page load, which normally invites the
 * email-scanner problem: corporate filters and inbox prefetchers follow links
 * and would burn a single-use token before the human ever clicked. That does
 * not apply, because redemption requires being SIGNED IN as the account that
 * owns the address (see `claimLead`). A scanner has no session, so it lands on
 * the sign-in redirect and the token survives.
 *
 * A repeat (refresh, back button) is answered idempotently by the API for the
 * account that already holds the lead, so a double click looks like success
 * rather than a broken link.
 *
 * ## The token never touches the DOM as a prop
 *
 * The page passes only a boolean. This component reads the token from
 * `window.location` and strips it from the URL as soon as it is spent, so it
 * does not survive into a refresh, a copied address, or a screenshot.
 */

import { useEffect, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AllianceClaimBanner.module.css';

const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

/** Props for the AllianceClaimBanner island. */
export interface AllianceClaimBannerProps {
    /** Active locale for i18n. */
    readonly locale: SupportedLocale;
}

type ClaimState = 'working' | 'confirmed' | 'failed' | 'idle';

/**
 * Reads `?lead=&claim=` out of the current URL.
 *
 * @returns The pair when BOTH are present, otherwise null — a half-filled
 *   link is a broken link, not a claim worth attempting.
 */
function readClaimFromUrl(): { readonly leadId: string; readonly token: string } | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const leadId = params.get('lead');
    const token = params.get('claim');
    if (!leadId || !token) return null;
    return { leadId, token };
}

/** Removes the claim parameters from the address bar without a navigation. */
function stripClaimFromUrl(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('lead');
    url.searchParams.delete('claim');
    window.history.replaceState({}, '', url.toString());
}

/**
 * AllianceClaimBanner — confirms an application belongs to the signed-in
 * account, when the URL carries an invitation token.
 *
 * @param props - Component props (see {@link AllianceClaimBannerProps}).
 */
export function AllianceClaimBanner({ locale }: AllianceClaimBannerProps) {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<ClaimState>('idle');

    useEffect(() => {
        const claim = readClaimFromUrl();
        if (!claim) return;

        let cancelled = false;
        setState('working');

        // Spend the token from the address bar immediately, before the request
        // settles: a refresh mid-flight must not fire a second redemption, and
        // the secret has no business outliving the one click it was for.
        stripClaimFromUrl();

        void fetch(`${API_BASE}/api/v1/protected/alliance/leads/${claim.leadId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // The API and the web app are different origins; without this the
            // session never travels and every claim answers 404.
            credentials: 'include',
            body: JSON.stringify({ token: claim.token })
        })
            .then((res) => {
                if (cancelled) return;
                setState(res.ok ? 'confirmed' : 'failed');
                if (res.ok) {
                    // The applications list is server-rendered, so the freshly
                    // linked application is not in this document. Re-render it
                    // once, after the banner has painted its confirmation.
                    window.setTimeout(() => window.location.reload(), 1200);
                }
            })
            .catch(() => {
                if (!cancelled) setState('failed');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    if (state === 'idle') return null;

    return (
        <div
            className={`${styles.banner} ${state === 'failed' ? styles.bannerError : ''}`}
            role="status"
            aria-live="polite"
        >
            {state === 'working' &&
                t('account.alliances.claim.working', 'Confirmando tu postulación…')}
            {state === 'confirmed' &&
                t(
                    'account.alliances.claim.confirmed',
                    '¡Listo! Vinculamos la postulación a tu cuenta.'
                )}
            {state === 'failed' &&
                t(
                    'account.alliances.claim.failed',
                    'No pudimos confirmar esa postulación. El enlace pudo haber vencido o ya haberse usado.'
                )}
        </div>
    );
}
