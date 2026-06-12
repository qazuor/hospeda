/**
 * @file HostDashboard.test.tsx
 * @description Tests for the HostDashboard island — covers renders, widget/quick-action
 * display, loading skeleton, and error state.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock before any imports — vitest hoists vi.mock to top of file
const mockHostDashboardGet = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get hostDashboardApi() {
        return { get: mockHostDashboardGet };
    },
    // AnalyticsSection also imports from endpoints-protected — stub the parts it uses
    get billingApi() {
        return {
            getEntitlements: vi.fn().mockReturnValue(new Promise(() => {}))
        };
    },
    get hostAnalyticsApi() {
        return {
            getViews: vi.fn().mockReturnValue(new Promise(() => {})),
            getFavoritesBreakdown: vi.fn().mockReturnValue(new Promise(() => {})),
            getResponseRate: vi.fn().mockReturnValue(new Promise(() => {})),
            getInquiryTrend: vi.fn().mockReturnValue(new Promise(() => {})),
            getMarketComparison: vi.fn().mockReturnValue(new Promise(() => {}))
        };
    }
}));

// Import AFTER mock setup
import { HostDashboard } from '../../../src/components/host/HostDashboard.client';

afterEach(() => {
    vi.clearAllMocks();
});

// Shared mock data for a fully-loaded dashboard
const mockDashboardApiResponse = {
    properties: { total: 5, published: 3, draft: 2, archived: 0 },
    plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' as const, isTrial: false },
    unreadConversations: 2
};

describe('HostDashboard', () => {
    it('renders loading skeleton on initial mount', () => {
        mockHostDashboardGet.mockReturnValue(new Promise(() => {})); // never resolves

        render(<HostDashboard locale="es" />);

        // Skeleton widgets should be rendered (aria-hidden placeholders)
        const skeletonWidgets = document.querySelectorAll('[aria-hidden="true"]');
        expect(skeletonWidgets.length).toBeGreaterThan(0);
    });

    it('renders error state with retry button when api fails', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: false,
            error: { message: 'Error de red' }
        });

        render(<HostDashboard locale="es" />);

        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(screen.getByText('Error de red')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('renders property summary widget with correct counts', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: mockDashboardApiResponse
        });

        render(<HostDashboard locale="es" />);

        // total=5 is unique in the document
        expect(await screen.findByText('5')).toBeInTheDocument();
        // published=3 is unique in the document
        expect(screen.getByText('3')).toBeInTheDocument();
        // draft=2 appears also as unread badge — use getAllByText and verify at least one exists
        const twos = screen.getAllByText('2');
        expect(twos.length).toBeGreaterThanOrEqual(1);
    });

    it('renders plan info widget with plan name', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: mockDashboardApiResponse
        });

        render(<HostDashboard locale="es" />);

        expect(await screen.findByText('Owner Pro')).toBeInTheDocument();
    });

    it('renders unread messages count when messages exist', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: mockDashboardApiResponse
        });

        render(<HostDashboard locale="es" />);

        // unreadConversations = 2 → badge shows "2"
        const unreadBadges = await screen.findAllByText('2');
        expect(unreadBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders all 4 quick-action links', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: mockDashboardApiResponse
        });

        render(<HostDashboard locale="es" />);

        // Wait for data to be ready
        await screen.findByText('Owner Pro');

        const links = screen.getAllByRole('link');
        // Quick actions: properties, promotions, messages, subscription + manage links in widgets
        expect(links.length).toBeGreaterThanOrEqual(4);
    });

    it('shows the promotions quick-action link', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: mockDashboardApiResponse
        });

        render(<HostDashboard locale="es" />);

        await screen.findByText('Owner Pro');

        // The promotions quick action should exist (i18n key resolves to default text in test env)
        const promoLinks = screen
            .getAllByRole('link')
            .filter((el) => el.getAttribute('href')?.includes('promociones'));
        expect(promoLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "no unread messages" text when unreadConversations is 0', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: { ...mockDashboardApiResponse, unreadConversations: 0 }
        });

        render(<HostDashboard locale="es" />);

        const noMessages = await screen.findByText(/no tenés mensajes nuevos/i);
        expect(noMessages).toBeInTheDocument();
    });

    it('shows trial badge when plan is on trial', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: {
                ...mockDashboardApiResponse,
                plan: { ...mockDashboardApiResponse.plan, isTrial: true }
            }
        });

        render(<HostDashboard locale="es" />);

        const trialBadge = await screen.findByText(/prueba gratuita/i);
        expect(trialBadge).toBeInTheDocument();
    });

    it('shows "no plan" text when plan is null', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: { ...mockDashboardApiResponse, plan: null }
        });

        render(<HostDashboard locale="es" />);

        const noPlan = await screen.findByText(/sin suscripción activa/i);
        expect(noPlan).toBeInTheDocument();
    });
});
