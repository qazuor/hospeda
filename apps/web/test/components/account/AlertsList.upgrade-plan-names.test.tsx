/**
 * @file AlertsList.upgrade-plan-names.test.tsx
 * @description HOS-2437: the plan-gate state names the plans from the public
 * catalog (those that carry `price_alerts`), never a hardcoded "Plus y VIP".
 * The SSR page reads the catalog (`planNamesWithEntitlement`) and hands the
 * names to the island; the island itself never reads the server-only catalog.
 */

import { EntitlementKeyEnum } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsList } from '../../../src/components/account/AlertsList.client';
import {
    type PublicPlanData,
    planNamesWithEntitlement
} from '../../../src/lib/billing/fetch-plans';

vi.mock('../../../src/components/account/AlertsList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const plan = (name: string, entitlements: string[]): PublicPlanData => ({
    id: name,
    vertical: 'tourist',
    slug: name.toLowerCase(),
    name,
    description: '',
    category: 'tourist',
    monthlyPriceArs: 100,
    annualPriceArs: null,
    hasTrial: false,
    trialDays: 0,
    sortOrder: 0,
    isActive: true,
    inheritsTouristVip: false,
    entitlements,
    limits: {}
});

function mockGateApi() {
    vi.mocked(fetch).mockImplementation(async () => {
        return {
            ok: false,
            status: 403,
            json: async () => ({ success: false, error: { code: 'ENTITLEMENT_REQUIRED' } })
        } as Response;
    });
}

async function renderGate(gatePlanNames?: readonly string[]) {
    render(
        <AlertsList
            locale="es"
            apiUrl="http://localhost:3001"
            userId="user-001"
            gatePlanNames={gatePlanNames}
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

describe('planNamesWithEntitlement (HOS-2437)', () => {
    it('keeps only the plans that carry the entitlement, in catalog order', () => {
        const names = planNamesWithEntitlement({
            result: {
                ok: true,
                plans: [
                    plan('Explorador', ['price_alerts']),
                    plan('Sin alertas', ['save_favorites']),
                    plan('Aventurero', ['price_alerts', 'exclusive_deals'])
                ]
            },
            entitlement: EntitlementKeyEnum.PRICE_ALERTS
        });
        expect(names).toEqual(['Explorador', 'Aventurero']);
    });

    it('names no plan when the catalog could not be read', () => {
        expect(
            planNamesWithEntitlement({
                result: { ok: false, error: 'HTTP 500' },
                entitlement: EntitlementKeyEnum.PRICE_ALERTS
            })
        ).toEqual([]);
    });
});

describe('AlertsList plan gate (HOS-2437)', () => {
    it('names the catalog plans it receives, whatever they are called', async () => {
        mockGateApi();
        await renderGate(['Explorador', 'Aventurero']);
        await waitFor(() =>
            expect(
                screen.getByText(/disponibles en los planes Explorador y Aventurero/)
            ).toBeInTheDocument()
        );
        expect(screen.queryByText(/Plus/)).not.toBeInTheDocument();
    });

    it('uses the singular form for a single plan', async () => {
        mockGateApi();
        await renderGate(['Explorador']);
        await waitFor(() =>
            expect(screen.getByText(/disponibles en el plan Explorador\./)).toBeInTheDocument()
        );
    });

    it('names no plan at all when it receives none', async () => {
        mockGateApi();
        await renderGate();
        const message = await screen.findByText(/no están incluidas en tu plan actual/);
        expect(message.textContent).not.toMatch(/Plus|VIP/);
    });

    it('never calls the plan catalog from the browser', async () => {
        mockGateApi();
        await renderGate(['Explorador']);
        const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
        expect(urls.some((url) => url.includes('plan-catalog'))).toBe(false);
    });
});
