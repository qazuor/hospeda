/**
 * @file use-cookie-consent-decided.test.tsx
 * @description Regression for HOS-2448: the welcome tour and the cookie banner
 * appeared together on a first visit.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useCookieConsentDecided } from '../../src/hooks/use-cookie-consent-decided';
import { CONSENT_CHANGED_EVENT, saveConsent } from '../../src/lib/cookie-consent';

function clearConsentCookie(): void {
    document.cookie = 'cookie-consent=; Max-Age=0; path=/';
}

describe('useCookieConsentDecided', () => {
    afterEach(clearConsentCookie);

    it('is false while the banner awaits an answer', () => {
        clearConsentCookie();
        const { result } = renderHook(() => useCookieConsentDecided());
        expect(result.current).toBe(false);
    });

    it('becomes true when the visitor answers the banner', () => {
        clearConsentCookie();
        const { result } = renderHook(() => useCookieConsentDecided());

        act(() => {
            window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
        });

        expect(result.current).toBe(true);
    });

    it('is true immediately when a decision is already stored', () => {
        saveConsent({ crashReporting: false, analytics: false, marketing: false });
        const { result } = renderHook(() => useCookieConsentDecided());
        expect(result.current).toBe(true);
    });
});
