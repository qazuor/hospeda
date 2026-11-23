/**
 * @file plan-gate-names.hos2554.test.tsx
 * @description HOS-2554: the plan gates of exclusive deals, recommendations and search
 * history (a kit LockedState since HOS-2501) name the plans the SSR page read from the catalog, never a hardcoded "Plus y VIP".
 * Each surface is fed a DIFFERENT plan name so a regression to a literal fails all three,
 * and an empty catalog read must name no plan at all.
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
        key.startsWith('account.pages.')
            ? tFromCatalog(key, fallback, params)
            : (fallback ?? `${key} ${JSON.stringify(params ?? {})}`);
    return { createTranslations: () => ({ t, tPlural: (key: string) => key }), createT: () => t };
});

for (const name of ['ExclusiveDealsList', 'RecommendationsFeed', 'SearchHistoryList']) {
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

type Surface = {
    readonly label: string;
    readonly planName: string;
    readonly keyBase: string;
    readonly noPlans: RegExp;
    readonly renderIt: (names?: readonly string[]) => void;
};

const SURFACES: readonly Surface[] = [
    {
        label: 'exclusive deals',
        planName: 'Explorador',
        keyBase: 'account.exclusiveDeals.upgrade.message',
        noPlans: /ofertas exclusivas no están incluidas en tu plan actual/,
        renderIt: (names) =>
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
        label: 'recommendations',
        planName: 'Aventurero',
        keyBase: 'account.recommendations.upgrade.message',
        noPlans: /sugerencias personalizadas no están incluidas en tu plan actual/,
        renderIt: (names) =>
            render(
                <RecommendationsFeed
                    locale="es"
                    apiUrl={API_URL}
                    gatePlanNames={names}
                />
            )
    }
];

describe('search history plan gate (HOS-2554, HOS-2501)', () => {
    beforeEach(() => {
        mockEntitlementRequired();
    });

    const renderHistory = (names?: readonly string[]) =>
        render(
            <SearchHistoryList
                locale="es"
                apiUrl={API_URL}
                userId="u1"
                initialHistoryEnabled
                gatePlanNames={names}
            />
        );

    it('shows each catalog plan it receives as a plan pill, whatever it is called', async () => {
        renderHistory(['Viajero', 'Premium']);
        const feature = await screen.findByRole('heading', { name: 'Historial de búsquedas' });
        const state = feature.closest('[data-reason]') as HTMLElement;
        expect(state).toHaveTextContent('Viajero');
        expect(state).toHaveTextContent('Premium');
        expect(state.textContent).not.toMatch(/Plus|VIP/);
    });

    it('names no plan when the catalog could not be read', async () => {
        renderHistory([]);
        const feature = await screen.findByRole('heading', { name: 'Historial de búsquedas' });
        expect((feature.closest('[data-reason]') as HTMLElement).textContent).not.toMatch(
            /Plus|VIP/
        );
    });
});

describe('plan gates name the catalog plans (HOS-2554)', () => {
    beforeEach(() => {
        mockEntitlementRequired();
    });

    for (const surface of SURFACES) {
        describe(surface.label, () => {
            it('names a single catalog plan with the singular key', async () => {
                surface.renderIt([surface.planName]);
                const node = await screen.findByText(new RegExp(surface.planName));
                expect(node.textContent).toContain(`${surface.keyBase}_one`);
                expect(node.textContent).not.toMatch(/Plus|VIP/);
            });

            it('names several catalog plans as a list with the plural key', async () => {
                surface.renderIt([surface.planName, 'Premium']);
                const node = await screen.findByText(new RegExp(surface.planName));
                expect(node.textContent).toContain(`${surface.keyBase}_other`);
                expect(node.textContent).toContain(`${surface.planName} y Premium`);
            });

            it('names no plan when the catalog could not be read', async () => {
                surface.renderIt([]);
                await waitFor(() => {
                    expect(screen.getByText(surface.noPlans)).toBeInTheDocument();
                });
                expect(document.body.textContent).not.toMatch(/Plus|VIP/);
            });
        });
    }
});
