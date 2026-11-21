/**
 * @file AlertsList.upgrade-plan-names.test.tsx
 * @description HOS-2437: the plan-gate state names the plans from the public
 * catalog (those that carry `price_alerts`), never a hardcoded "Plus y VIP".
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsList } from '../../../src/components/account/AlertsList.client';

vi.mock('../../../src/components/account/AlertsList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const uuid = (n: number) => `123e4567-e89b-42d3-a456-4266141740${String(n).padStart(2, '0')}`;
const plan = (n: number, name: string, entitlements: string[]) => ({
    planId: uuid(n),
    planVersionId: uuid(n + 20),
    slug: `plan-${n}`,
    name,
    description: null,
    pricingOrder: n,
    rank: n,
    trialDays: 0,
    inheritsTouristVip: false,
    entitlements,
    limits: {},
    billingOptions: [{ id: uuid(n + 40), cycle: 'monthly', amount: 100, currency: 'ARS' }]
});

function mockApi(plans: readonly object[] | 'catalog-down') {
    vi.mocked(fetch).mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/protected/price-alerts')) {
            return {
                ok: false,
                status: 403,
                json: async () => ({ success: false, error: { code: 'ENTITLEMENT_REQUIRED' } })
            } as Response;
        }
        if (plans === 'catalog-down') return { ok: false, status: 500 } as Response;
        return {
            ok: true,
            json: async () => ({
                success: true,
                data: { vertical: 'tourist', plans, floor: null, trialOffer: null }
            })
        } as Response;
    });
}

async function renderGate() {
    render(
        <AlertsList
            locale="es"
            apiUrl="http://localhost:3001"
            userId="user-001"
        />
    );
    await waitFor(() => expect(screen.queryByText('Cargando alertas...')).not.toBeInTheDocument());
}

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AlertsList plan gate (HOS-2437)', () => {
    it('names the catalog plans that carry the entitlement, whatever they are called', async () => {
        mockApi([
            plan(1, 'Explorador', ['price_alerts']),
            plan(2, 'Aventurero', ['price_alerts', 'exclusive_deals']),
            plan(3, 'Sin alertas', ['save_favorites'])
        ]);
        await renderGate();
        await waitFor(() =>
            expect(
                screen.getByText(/disponibles en los planes Explorador y Aventurero/)
            ).toBeInTheDocument()
        );
        expect(screen.queryByText(/Plus/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Sin alertas/)).not.toBeInTheDocument();
    });

    it('uses the singular form for a single plan', async () => {
        mockApi([plan(1, 'Explorador', ['price_alerts'])]);
        await renderGate();
        await waitFor(() =>
            expect(screen.getByText(/disponibles en el plan Explorador\./)).toBeInTheDocument()
        );
    });

    it('names no plan at all when the catalog cannot be read', async () => {
        mockApi('catalog-down');
        await renderGate();
        const message = await screen.findByText(/no están incluidas en tu plan actual/);
        expect(message.textContent).not.toMatch(/Plus|VIP/);
    });
});
