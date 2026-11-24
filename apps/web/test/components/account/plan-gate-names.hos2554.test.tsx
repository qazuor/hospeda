/**
 * @file plan-gate-names.hos2554.test.tsx
 * @description HOS-2554: the plan gates of exclusive deals, recommendations and search
 * history (the last two a kit LockedState since HOS-2501) name the plans the SSR page read from the catalog, never a hardcoded "Plus y VIP".
 * A regression to a literal fails every surface, and an empty catalog read must name no plan
 * at all (HOS-2599: nor leave an empty «Está incluida en:» line).
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExclusiveDealsList } from '../../../src/components/account/ExclusiveDealsList.client';
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
        key.startsWith('account.exclusiveDeals.') ||
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

/**
 * Surfaces that became a kit LockedState (HOS-2501; exclusive deals since HOS-2599): the
 * catalog plan names are its pills.
 */
const LOCKED_SURFACES = [
    {
        label: 'exclusive deals',
        feature: 'Ofertas exclusivas',
        renderIt: (names?: readonly string[]) =>
            render(
                <ExclusiveDealsList
                    locale="es"
                    apiUrl={API_URL}
                    userId="u1"
                    gatePlanNames={names}
                />
            )
    },
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

describe('exclusive deals lock (HOS-2599)', () => {
    beforeEach(() => {
        mockEntitlementRequired();
    });

    it('says «Está incluida en:» followed by the catalog plan', async () => {
        render(
            <ExclusiveDealsList
                locale="es"
                apiUrl={API_URL}
                userId="u1"
                gatePlanNames={['Explorador']}
            />
        );
        const feature = await screen.findByRole('heading', { name: 'Ofertas exclusivas' });
        const state = feature.closest('[data-reason]') as HTMLElement;
        expect(state).toHaveTextContent(/Está incluida en:\s*Explorador/);
    });

    it('drops the «Está incluida en:» line and says the plan lacks it without catalog names', async () => {
        render(
            <ExclusiveDealsList
                locale="es"
                apiUrl={API_URL}
                userId="u1"
                gatePlanNames={[]}
            />
        );
        await waitFor(() => {
            expect(
                screen.getByText(/ofertas exclusivas no están incluidas en tu plan actual/)
            ).toBeInTheDocument();
        });
        expect(document.body.textContent).not.toContain('Está incluida en:');
    });
});
