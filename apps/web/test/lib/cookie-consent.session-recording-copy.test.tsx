/**
 * @file cookie-consent.session-recording-copy.test.tsx
 * @description HOS-2347 D-1 / AC-C1: the usage-analytics consent copy mentions
 * session recordings and heatmaps in es, en and pt, and `CONSENT_VERSION`
 * stays 2, so a visitor with a stored v2 consent is not asked again.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CookieConsentBanner } from '@/components/legal/CookieConsentBanner.client';
import * as consent from '@/lib/cookie-consent';
import { createTranslations } from '@/lib/i18n';

const { CONSENT_COOKIE_NAME, CONSENT_VERSION } = consent;

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

describe('cookie policy preferences', () => {
    it.each([
        ['before', 'savePreferences'],
        ['after', 'savePreferences'],
        ['before', 'rejectAll'],
        ['after', 'rejectAll']
    ] as const)('opens section 4 preferences %s hydration and restores focus after %s', (clickTiming, action) => {
        const layout = readFileSync(
            resolve(import.meta.dirname, '../../src/layouts/LegalLayout.astro'),
            'utf8'
        );
        const footer = readFileSync(
            resolve(import.meta.dirname, '../../src/layouts/Footer.astro'),
            'utf8'
        );
        const markup = layout.match(/\{managePreferences && (<button[^\n]+<\/button>)\}/)?.[1];
        // Execute the real delegated click listener without booting the unrelated footer scripts.
        const wiring = footer.match(
            /import \{ ([^}]+) \} from '@\/lib\/cookie-consent';\s*(document\.addEventListener\('click',[\s\S]+?\n {4}\}\);)/
        );
        if (!markup || !wiring)
            throw new Error('Cookie preferences trigger or delegated listener not found');

        const { t } = createTranslations('es');
        const section = document.createElement('section');
        section.innerHTML = markup.replace('{managePreferences}', t('cookies.managePreferences'));
        document.body.append(section);
        const controller = new AbortController();
        const install = new Function(
            'consent',
            'document',
            `const { ${wiring[1]} } = consent;\n${wiring[2]}`
        );
        install(consent, {
            addEventListener: (type: string, listener: EventListener) =>
                document.addEventListener(type, listener, { signal: controller.signal })
        });
        consent.saveConsent({ crashReporting: true, analytics: false, marketing: false });
        const trigger = within(section).getByRole('button', {
            name: t('cookies.managePreferences')
        });

        try {
            trigger.focus();
            if (clickTiming === 'before') fireEvent.click(trigger);
            render(
                <CookieConsentBanner
                    locale="es"
                    cookiesPolicyUrl="/es/legal/cookies/"
                />
            );
            if (clickTiming === 'after') {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                fireEvent.click(trigger);
            }

            const panel = screen.getByRole('dialog', { name: t('cookieConsent.title') });
            expect(panel).toHaveFocus();
            const dialog = within(panel);
            const crashReporting = dialog.getByRole('switch', {
                name: t('cookieConsent.categories.crashReporting.label')
            });
            const analytics = dialog.getByRole('switch', {
                name: t('cookieConsent.categories.analytics.label')
            });
            expect(crashReporting).toBeChecked();
            expect(analytics).not.toBeChecked();
            if (action === 'savePreferences') fireEvent.click(analytics);
            const close = dialog.getByRole('button', {
                name: t(`cookieConsent.buttons.${action}`)
            });
            close.focus();
            fireEvent.click(close);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(trigger).toHaveFocus();
            expect(consent.getConsent()).toMatchObject({
                necessary: true,
                crashReporting: action === 'savePreferences',
                analytics: action === 'savePreferences',
                marketing: false
            });
        } finally {
            controller.abort();
            section.remove();
        }
    });
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
