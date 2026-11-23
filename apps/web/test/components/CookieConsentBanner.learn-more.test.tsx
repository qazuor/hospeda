/**
 * @file CookieConsentBanner.learn-more.test.tsx
 * @description The cookie policy link must be descriptive out of context
 * (Lighthouse "link-text", WCAG 2.4.4): a bare "Más información" says nothing
 * when links are listed on their own (HOS-2572).
 */

import { render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner.client';

const POLICY_URL = 'https://hospeda.com.ar/es/legal/cookies/';

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
});

describe('CookieConsentBanner learn-more link', () => {
    it.each([
        ['es', 'Más información sobre cookies'],
        ['en', 'Learn more about cookies'],
        ['pt', 'Saiba mais sobre cookies']
    ] as const)('should read a descriptive text in %s', (locale, expected) => {
        // Arrange + Act
        const { container } = render(
            <CookieConsentBanner
                locale={locale}
                cookiesPolicyUrl={POLICY_URL}
            />
        );
        const link = container.querySelector(`a[href="${POLICY_URL}"]`);

        // Assert
        expect(link?.textContent?.trim()).toBe(expected);
    });
});
