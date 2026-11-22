import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHostDashboardGet = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get hostDashboardApi() {
        return { get: mockHostDashboardGet };
    },
    get publishApi() {
        return { trialSummary: vi.fn().mockResolvedValue({ ok: true, data: { status: 'NONE' } }) };
    },
    get hostAnalyticsApi() {
        return new Proxy({}, { get: () => vi.fn().mockReturnValue(new Promise(() => {})) });
    }
}));

import { HostDashboard } from '../../../src/components/host/HostDashboard.client';

const dashboard = (plan: Record<string, unknown> | null) => ({
    properties: { total: 1, published: 1, draft: 0, archived: 0 },
    plan,
    unreadConversations: 0,
    unavailable: []
});

const plan = (over: Record<string, unknown>) => ({
    slug: 'owner-basico',
    name: 'Basic',
    status: 'active',
    subscriptionStatus: 'ACTIVE',
    serviceEndsAt: null,
    isTrial: false,
    ...over
});

beforeEach(() => {
    mockHostDashboardGet.mockReset();
});
afterEach(() => {
    vi.clearAllMocks();
});

describe('HOS-2543 host dashboard subscription card', () => {
    it('shows the catalog plan name instead of «Sin suscripción activa»', async () => {
        mockHostDashboardGet.mockResolvedValue({ ok: true, data: dashboard(plan({})) });
        render(<HostDashboard locale="es" />);
        expect(await screen.findByText('Basic')).toBeTruthy();
        expect(screen.queryByText('Sin suscripción activa')).toBeNull();
    });

    it.each([
        ['GRACE_PERIOD', 'Pago pendiente'],
        ['SUSPENDED', 'Suspendida'],
        ['PAUSED', 'Pausada']
    ])('shows a distinct label for %s', async (subscriptionStatus, text) => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: dashboard(plan({ subscriptionStatus, status: 'cancelled' }))
        });
        render(<HostDashboard locale="es" />);
        expect(await screen.findByText(text)).toBeTruthy();
    });

    it('shows the end date of a scheduled cancellation', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: dashboard(
                plan({
                    subscriptionStatus: 'CANCEL_SCHEDULED',
                    status: 'cancelled',
                    serviceEndsAt: '2026-12-31T15:00:00.000Z'
                })
            )
        });
        render(<HostDashboard locale="es" />);
        expect(await screen.findByText(/Baja programada hasta el .*2026/)).toBeTruthy();
    });
});
