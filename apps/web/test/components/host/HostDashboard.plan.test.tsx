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

const dashboard = (plan: Record<string, unknown> | null, planUnavailable = false) => ({
    properties: { total: 1, published: 1, draft: 0, archived: 0 },
    plan,
    unreadConversations: 0,
    unavailable: [],
    planUnavailable
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
                    // 01:30 UTC is still 30 Dec in Buenos Aires: pins the site time zone
                    serviceEndsAt: '2026-12-31T01:30:00.000Z'
                })
            )
        });
        render(<HostDashboard locale="es" />);
        expect(
            await screen.findByText('Baja programada hasta el 30 de diciembre de 2026')
        ).toBeTruthy();
    });

    it('shows «No disponible», not «Sin suscripción activa», when the plan read failed', async () => {
        mockHostDashboardGet.mockResolvedValue({ ok: true, data: dashboard(null, true) });
        render(<HostDashboard locale="es" />);
        expect(await screen.findByTestId('host-dashboard-plan-unavailable')).toBeTruthy();
        expect(screen.getByText('No disponible')).toBeTruthy();
        expect(screen.queryByText('Sin suscripción activa')).toBeNull();
    });

    it('still shows «Sin suscripción activa» when the read worked and there is no plan', async () => {
        mockHostDashboardGet.mockResolvedValue({ ok: true, data: dashboard(null, false) });
        render(<HostDashboard locale="es" />);
        expect(await screen.findByText('Sin suscripción activa')).toBeTruthy();
        expect(screen.queryByText('No disponible')).toBeNull();
    });

    it('does not use the warning style for an active plan from an API without subscriptionStatus', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: dashboard(plan({ subscriptionStatus: undefined, status: 'active' }))
        });
        render(<HostDashboard locale="es" />);
        const badge = await screen.findByText('Activo');
        expect(badge.className).not.toContain('planBadgeWarning');
    });
});
