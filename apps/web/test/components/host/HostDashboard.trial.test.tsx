import { TrialSummaryResponseSchema } from '@repo/schemas';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockHostDashboardGet = vi.fn();
const mockTrialSummary = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get hostDashboardApi() {
        return { get: mockHostDashboardGet };
    },
    get publishApi() {
        return { trialSummary: mockTrialSummary };
    },
    get hostAnalyticsApi() {
        return {
            getViews: vi.fn().mockReturnValue(new Promise(() => {})),
            getFavoritesBreakdown: vi.fn().mockReturnValue(new Promise(() => {})),
            getResponseRate: vi.fn().mockReturnValue(new Promise(() => {})),
            getInquiryTrend: vi.fn().mockReturnValue(new Promise(() => {})),
            getMarketComparison: vi.fn().mockReturnValue(new Promise(() => {})),
            listOwnAccommodations: vi.fn().mockReturnValue(new Promise(() => {})),
            getViewsDailySeries: vi.fn().mockReturnValue(new Promise(() => {}))
        };
    }
}));

import { HostDashboard } from '../../../src/components/host/HostDashboard.client';

const dashboard = {
    properties: { total: 5, published: 3, draft: 2, archived: 0 },
    plan: null,
    unreadConversations: 0
};

function activeTrial({ endsAt }: { readonly endsAt: string | null }) {
    return TrialSummaryResponseSchema.parse({
        status: 'TRIAL_ACTIVE',
        startedAt: '2026-11-02T17:48:40.000Z',
        endsAt,
        totalDays: 30,
        origins: { base: 30, promo: 0, support: 0 }
    });
}

beforeEach(() => {
    mockHostDashboardGet.mockResolvedValue({ ok: true, data: dashboard });
    mockTrialSummary.mockResolvedValue({ ok: true, data: { status: 'NONE' } });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('HOS-2019 host dashboard trial', () => {
    it('shows the running trial and its end date when the dashboard has no plan', async () => {
        // Arrange
        mockTrialSummary.mockResolvedValue({
            ok: true,
            data: activeTrial({ endsAt: '2026-12-02T17:48:40.000Z' })
        });

        // Act
        render(<HostDashboard locale="es" />);

        // Assert
        expect(await screen.findByTestId('host-dashboard-plan-trial')).toHaveTextContent(
            'Prueba gratuita'
        );
        expect(await screen.findByTestId('host-dashboard-trial-ends')).toHaveTextContent(
            'Hasta el'
        );
        expect(screen.getByTestId('host-dashboard-trial-ends')).toHaveTextContent('2026');
        expect(screen.queryByText('Sin suscripción activa')).toBeNull();
    });

    it('keeps "Sin suscripción activa" when there is no trial', async () => {
        // Arrange
        mockTrialSummary.mockResolvedValue({ ok: true, data: { status: 'NONE' } });

        // Act
        render(<HostDashboard locale="es" />);

        // Assert
        expect(await screen.findByText('Sin suscripción activa')).toBeInTheDocument();
        expect(screen.queryByTestId('host-dashboard-plan-trial')).toBeNull();
    });

    it('keeps "Sin suscripción activa" when the trial ended', async () => {
        // Arrange
        mockTrialSummary.mockResolvedValue({
            ok: true,
            data: TrialSummaryResponseSchema.parse({
                ...activeTrial({ endsAt: '2026-10-01T00:00:00.000Z' }),
                status: 'TRIAL_EXPIRED'
            })
        });

        // Act
        render(<HostDashboard locale="es" />);

        // Assert
        expect(await screen.findByText('Sin suscripción activa')).toBeInTheDocument();
        expect(screen.queryByTestId('host-dashboard-plan-trial')).toBeNull();
    });

    it('keeps the dashboard and the empty label when the trial read fails', async () => {
        // Arrange
        mockTrialSummary.mockRejectedValue(new Error('trial read failed'));

        // Act
        render(<HostDashboard locale="es" />);

        // Assert
        expect(await screen.findByText('Sin suscripción activa')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    });

    it('a plan from the dashboard wins over the trial read', async () => {
        // Arrange
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: {
                ...dashboard,
                plan: { slug: 'owner-pro', name: 'Plan Pro', status: 'active', isTrial: false }
            }
        });
        mockTrialSummary.mockResolvedValue({
            ok: true,
            data: activeTrial({ endsAt: '2026-12-02T17:48:40.000Z' })
        });

        // Act
        render(<HostDashboard locale="es" />);

        // Assert
        expect(await screen.findByText('Plan Pro')).toBeInTheDocument();
        expect(screen.queryByTestId('host-dashboard-plan-trial')).toBeNull();
    });

    it('shows the trial without a date line when endsAt is null', async () => {
        // Arrange
        mockTrialSummary.mockResolvedValue({ ok: true, data: activeTrial({ endsAt: null }) });

        // Act
        render(<HostDashboard locale="es" />);

        // Assert
        expect(await screen.findByTestId('host-dashboard-plan-trial')).toHaveTextContent(
            'Prueba gratuita'
        );
        expect(screen.queryByTestId('host-dashboard-trial-ends')).toBeNull();
    });
});
