/**
 * @file cookie-consent.session-recording-copy.test.tsx
 * @description HOS-2347 D-1 / AC-C1: the usage-analytics consent copy mentions
 * session recordings and heatmaps in es, en and pt, and `CONSENT_VERSION`
 * stays 2, so a visitor with a stored v2 consent is not asked again.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner.client';
import { CONSENT_COOKIE_NAME, CONSENT_VERSION } from '@/lib/cookie-consent';

const LOCALES = resolve(import.meta.dirname, '../../../../packages/i18n/src/locales');

function analyticsDescription(locale: 'es' | 'en' | 'pt'): string {
    const json = JSON.parse(
        readFileSync(resolve(LOCALES, locale, 'cookieConsent.json'), 'utf8')
    ) as { categories?: { analytics?: { description?: string } } };
    const found = JSON.stringify(json).match(
        /"analytics":\{"label":"[^"]*","description":"([^"]*)"/
    );
    return found?.[1] ?? '';
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
    document.cookie = `${CONSENT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
});

describe('analytics consent copy (HOS-2347 AC-C1)', () => {
    it.each([
        ['es', /grabaciones de sesión/, /mapas de calor/],
        ['en', /session recordings/, /heatmaps/],
        ['pt', /gravações de sessão/, /mapas de calor/]
    ] as const)('%s mentions recordings and heatmaps', (locale, recordings, heatmaps) => {
        const description = analyticsDescription(locale);
        expect(description).toMatch(recordings);
        expect(description).toMatch(heatmaps);
    });

    it('keeps CONSENT_VERSION at 2 (D-1: no re-ask)', () => {
        expect(CONSENT_VERSION).toBe(2);
    });

    it('shows no banner to a visitor with a stored v2 consent', () => {
        // Arrange
        const stored = {
            necessary: true,
            crashReporting: true,
            analytics: true,
            marketing: false,
            version: 2,
            decidedAt: '2026-10-01'
        };
        document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(stored))}; path=/`;

        // Act
        const { container } = render(
            <CookieConsentBanner
                locale="es"
                cookiesPolicyUrl="https://hospeda.com.ar/es/legal/cookies/"
            />
        );

        // Assert
        expect(container.querySelector('dialog')).toBeNull();
    });
});
