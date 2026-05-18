/**
 * @file PostHogInit.client.tsx
 * @description Headless React island that boots PostHog on every page load
 * (SPEC-140 T-140-10).
 *
 * The island has no rendered output — it only exists to run
 * `initPostHog({ consent })` once the client is idle, then keep PostHog in
 * sync with consent changes coming from the cookie banner.
 *
 * Wired into `BaseLayout.astro` with `client:idle` so it never competes
 * with above-the-fold rendering. Pairs with `CookieConsentBanner.client`
 * which is what actually mutates the consent cookie via `saveConsent`.
 */

import { setConsent } from '@/lib/analytics/posthog-client';
import { initPostHog } from '@/lib/analytics/posthog-client';
import { CONSENT_CHANGED_EVENT, type ConsentState, getConsent } from '@/lib/cookie-consent';
import { useEffect } from 'react';

/**
 * Headless island that initializes PostHog and subscribes to consent
 * changes. Renders nothing.
 */
export function PostHogInit(): null {
    useEffect(() => {
        initPostHog({ consent: getConsent() });

        function handleConsentChanged(event: Event) {
            const next = (event as CustomEvent<ConsentState>).detail;
            setConsent(next);
        }

        window.addEventListener(CONSENT_CHANGED_EVENT, handleConsentChanged);
        return () => {
            window.removeEventListener(CONSENT_CHANGED_EVENT, handleConsentChanged);
        };
    }, []);

    return null;
}
