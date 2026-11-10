/**
 * @file VenueMenuManager.locked-intro.test.tsx
 * @description HOS-2079 (failed smoke criterion AC:5:8 of HOS-1806).
 *
 * A carta locked by plan used to keep the section intro, which promises
 * "subí una foto o un PDF", right above an upsell for a plan that does not
 * include it. The locked state must carry a neutral intro in es/en/pt, and the
 * unlocked state must keep the original one. Translations are resolved from the
 * REAL locale files so the assertion covers the shipped copy, not a fallback.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VenueMenuManager } from '@/components/venue/VenueMenuManager.client';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import { getEntitlementsCached } from '@/lib/entitlements-cache';

type Json = { readonly [key: string]: Json | string };

const LOCALES = ['es', 'en', 'pt'] as const;
const FILE_OR_LINK_PROMISE =
    /pdf|foto|photo|enlace|link|archivo|file|arquivo|plato por plato|dish by dish|prato a prato/i;

function loadVenueLocale(locale: string): Json {
    return JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../../packages/i18n/src/locales/${locale}/venue.json`),
            'utf8'
        )
    ) as Json;
}

function lookup({ tree, key }: { readonly tree: Json; readonly key: string }): string | undefined {
    const value = key
        .replace(/^venue\./, '')
        .split('.')
        .reduce<Json | string | undefined>(
            (node, part) => (typeof node === 'object' ? node[part] : undefined),
            tree
        );
    return typeof value === 'string' ? value : undefined;
}

const { mockLocale } = vi.hoisted(() => ({ mockLocale: { current: 'es' } }));

vi.mock('@/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) =>
            lookup({ tree: loadVenueLocale(mockLocale.current), key }) ?? fallback ?? key,
        tPlural: (key: string) => key
    })
}));

vi.mock('@/lib/env', () => ({ getApiUrl: () => 'https://api.test' }));

const { mockFreshEntitlements } = vi.hoisted(() => ({ mockFreshEntitlements: vi.fn() }));

vi.mock('@/lib/entitlements-cache', () => ({
    getEntitlementsCached: vi.fn(),
    fetchEntitlementsUncached: mockFreshEntitlements
}));

const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const NO_MENU: EntitlementsData = {
    entitlements: {},
    limits: {},
    hasLiveNonTrialTitle: true,
    failed: false
};

const fetchMock = vi.fn();

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEntitlementsCached).mockResolvedValue(NO_MENU);
    mockFreshEntitlements.mockResolvedValue(NO_MENU);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
            success: true,
            data: { sections: [], file: null, externalUrl: null }
        })
    } as unknown as Response);
});

describe('VenueMenuManager locked intro (HOS-2079)', () => {
    it.each(LOCALES)('locked carta does not promise a file or link (%s)', async (locale) => {
        mockLocale.current = locale;
        const { container } = render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale={locale}
                sectionState="locked"
            />
        );
        await screen.findByTestId('venue-section-locked-notice');

        const intro = container.querySelector('p.intro');
        expect(intro).not.toBeNull();
        expect(intro?.textContent ?? '').not.toMatch(FILE_OR_LINK_PROMISE);
    });

    it('unlocked carta keeps the original intro (es)', async () => {
        mockLocale.current = 'es';
        const { container } = render(
            <VenueMenuManager
                listingId={LISTING_ID}
                locale="es"
                sectionState="available"
            />
        );
        await screen.findByRole('heading', { name: 'Carta' });
        expect(container.querySelector('p.intro')?.textContent).toBe(
            'Cargá tu carta plato por plato, o subí una foto o un PDF del menú. Podés usar las dos formas, y ninguna es obligatoria.'
        );
    });
});
