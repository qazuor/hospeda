/**
 * @file use-cookie-consent-decided.ts
 * @description Tells whether the visitor has already answered the cookie banner
 * (HOS-2448).
 *
 * The banner is a fixed bottom dialog that opens on a first visit; the account
 * welcome tour is another overlay. Showing both at once buries one under the
 * other, so the tour waits for this to become `true`.
 */

import { useEffect, useState } from 'react';
import { CONSENT_CHANGED_EVENT, getConsent } from '@/lib/cookie-consent';

/**
 * Whether a cookie-consent decision exists. Starts `false` (SSR-safe) and flips
 * to `true` on mount when a decision is already stored, or as soon as one is
 * saved from the banner.
 *
 * @returns `true` once the banner will not be, or no longer is, awaiting an answer.
 */
export function useCookieConsentDecided(): boolean {
    const [decided, setDecided] = useState(false);

    useEffect(() => {
        if (getConsent()) {
            setDecided(true);
            return;
        }
        const onChanged = () => setDecided(true);
        window.addEventListener(CONSENT_CHANGED_EVENT, onChanged);
        return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChanged);
    }, []);

    return decided;
}
