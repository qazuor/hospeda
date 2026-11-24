/**
 * @file AlertsList.free-lock.test.tsx
 * @description HOS-2599 (audit finding 9): `GET /protected/price-alerts` is not gated, so a
 * Free tourist with no alerts used to see «No tenés alertas activas · Explorar alojamientos»,
 * an invitation the plan refuses. The island now reads the tourist effective set beside the
 * list and shows the plan LockedState instead.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertsList } from '../../../src/components/account/AlertsList.client';
import type { EntitlementsData } from '../../../src/lib/entitlements-cache';

const { getEntitlementsCached } = vi.hoisted(() => ({ getEntitlementsCached: vi.fn() }));
vi.mock('../../../src/lib/entitlements-cache', () => ({ getEntitlementsCached }));
vi.mock('../../../src/components/account/AlertsList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

const effectiveSet = (input: {
    readonly alerts: boolean;
    readonly failed?: boolean;
}): EntitlementsData => ({
    entitlements: input.alerts ? { price_alerts: 1 } : {},
    limits: { max_active_alerts: input.alerts ? 5 : 0 },
    hasLiveNonTrialTitle: false,
    failed: input.failed ?? false
});

function mockEmptyList(): void {
    vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { items: [], total: 0 } })
    } as Response);
}

function renderList(): void {
    render(
        <AlertsList
            locale="es"
            apiUrl="http://localhost:3001"
            userId="user-001"
            gatePlanNames={['VIP']}
        />
    );
}

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    mockEmptyList();
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

describe('AlertsList plan lock for an empty list (HOS-2599)', () => {
    it('shows the LockedState naming the catalog plan to a Free tourist', async () => {
        getEntitlementsCached.mockResolvedValue(effectiveSet({ alerts: false }));
        renderList();
        const feature = await screen.findByRole('heading', { name: 'Alertas de precio' });
        const state = feature.closest('[data-reason]') as HTMLElement;
        expect(state).toHaveAttribute('data-reason', 'plan');
        expect(state).toHaveTextContent('VIP');
        expect(screen.queryByText('Explorar alojamientos')).toBeNull();
        expect(getEntitlementsCached).toHaveBeenCalledWith({ vertical: 'tourist' });
    });

    it('keeps the empty state for a tourist whose plan includes alerts', async () => {
        getEntitlementsCached.mockResolvedValue(effectiveSet({ alerts: true }));
        renderList();
        expect(await screen.findByText('No tenés alertas activas')).toBeInTheDocument();
        expect(document.querySelector('[data-reason]')).toBeNull();
    });

    it('keeps the empty state when the effective set cannot be read', async () => {
        getEntitlementsCached.mockResolvedValue(effectiveSet({ alerts: false, failed: true }));
        renderList();
        expect(await screen.findByText('No tenés alertas activas')).toBeInTheDocument();
    });
});
