/**
 * @file plan-gate-names.hos2554.test.tsx
 * @description HOS-2554: the plan gates of recommendations and search history (a kit
 * LockedState since HOS-2501; the exclusive-deals list was removed by HOS-2589) name the plans the SSR page read from the catalog, never a hardcoded "Plus y VIP".
 * Each surface is fed a DIFFERENT plan name so a regression to a literal fails all three,
 * and an empty catalog read must name no plan at all.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationsFeed } from '../../../src/components/account/RecommendationsFeed.client';
import { SearchHistoryList } from '../../../src/components/account/SearchHistoryList.client';

vi.mock('../../../src/lib/i18n', async () => {
    const { tFromCatalog } = await import('../../helpers/i18n-catalog');
    const t = (key: string, fallback?: string, params?: Record<string, unknown>): string =>
        // Plural keys carry no fallback: echo key + params so plan names stay assertable.
        // Keys the kit and the LockedState surfaces own resolve against the real catalog.
        key.startsWith('account.ui.') ||
        key.startsWith('account.searchHistory.') ||
        key.startsWith('account.recommendations.') ||
        key.startsWith('account.pages.')
            ? tFromCatalog(key, fallback, params)
            : (fallback ?? `${key} ${JSON.stringify(params ?? {})}`);
    return { createTranslations: () => ({ t, tPlural: (key: string) => key }), createT: () => t };
});

for (const name of ['RecommendationsFeed', 'SearchHistoryList']) {
    vi.doMock(`../../../src/components/account/${name}.module.css`, () => ({
        default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
    }));
}

vi.mock('../../../src/store/toast-store', () => ({ addToast: vi.fn() }));
vi.mock('../../../src/lib/format-utils', () => ({
    formatRelativeTime: () => 'hace 2 días',
    formatPrice: () => '$ 0'
}));

const API_URL = 'http://localhost:3001';

function mockEntitlementRequired(): void {
    global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ success: false, error: { code: 'ENTITLEMENT_REQUIRED' } })
    } as Response);
}

/** Surfaces that became a kit LockedState (HOS-2501): the catalog plan names are its pills. */
const LOCKED_SURFACES = [
    {
        label: 'search history',
        feature: 'Historial de búsquedas',
        renderIt: (names?: readonly string[]) =>
            render(
                <SearchHistoryList
                    locale="es"
                    apiUrl={API_URL}
                    userId="u1"
                    initialHistoryEnabled
                    gatePlanNames={names}
                />
            )
    },
    {
        label: 'recommendations',
        feature: 'Sugerencias para vos',
        renderIt: (names?: readonly string[]) =>
            render(
                <RecommendationsFeed
                    locale="es"
                    apiUrl={API_URL}
                    gatePlanNames={names}
                />
            )
    }
] as const;

describe('LockedState plan gates (HOS-2554, HOS-2501)', () => {
    beforeEach(() => {
        mockEntitlementRequired();
    });

    for (const surface of LOCKED_SURFACES) {
        describe(surface.label, () => {
            it('shows each catalog plan it receives as a plan pill, whatever it is called', async () => {
                surface.renderIt(['Viajero', 'Premium']);
                const feature = await screen.findByRole('heading', { name: surface.feature });
                const state = feature.closest('[data-reason]') as HTMLElement;
                expect(state).toHaveTextContent('Viajero');
                expect(state).toHaveTextContent('Premium');
                expect(state.textContent).not.toMatch(/Plus|VIP/);
            });

            it('names no plan when the catalog could not be read', async () => {
                surface.renderIt([]);
                const feature = await screen.findByRole('heading', { name: surface.feature });
                expect((feature.closest('[data-reason]') as HTMLElement).textContent).not.toMatch(
                    /Plus|VIP/
                );
            });
        });
    }
});
