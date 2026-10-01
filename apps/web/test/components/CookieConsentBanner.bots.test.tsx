/**
 * @file CookieConsentBanner.bots.test.tsx
 * @description The consent banner must auto-open for people with no stored
 * consent, and must NOT auto-open for crawlers or auditing tools
 * (Googlebot's renderer, Lighthouse/PSI), which never persist the cookie and
 * would otherwise see it on every visit.
 */

import { render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner.client';

const HUMAN_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const GOOGLEBOT_UA =
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const LIGHTHOUSE_UA =
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse';

function renderWithUserAgent(ua: string) {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
    return render(
        <CookieConsentBanner
            locale="es"
            cookiesPolicyUrl="https://hospeda.com.ar/es/legal/cookies/"
        />
    );
}

beforeAll(() => {
    if (typeof globalThis.ResizeObserver === 'undefined') {
        globalThis.ResizeObserver = class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        } as unknown as typeof ResizeObserver;
    }
});

afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = 'cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('CookieConsentBanner — bot user agents', () => {
    it('opens for a human visitor without stored consent', () => {
        // Arrange + Act
        const { container } = renderWithUserAgent(HUMAN_UA);

        // Assert
        expect(container.querySelector('dialog')).not.toBeNull();
    });

    it('stays closed for Googlebot', () => {
        const { container } = renderWithUserAgent(GOOGLEBOT_UA);

        expect(container.querySelector('dialog')).toBeNull();
    });

    it('stays closed for Lighthouse / PageSpeed Insights', () => {
        const { container } = renderWithUserAgent(LIGHTHOUSE_UA);

        expect(container.querySelector('dialog')).toBeNull();
    });
});
