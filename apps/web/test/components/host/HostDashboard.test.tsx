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
    publishApi: {
        trialSummary: vi.fn().mockResolvedValue({ ok: true, data: { status: 'NONE' } })
    },
    // AnalyticsSection also imports from endpoints-protected — stub the parts it uses
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

describe('HostDashboard quick actions (HOS-726 → HOS-1637)', () => {
    it('renders four quick-action links, with no add-ons shortcut', async () => {
        // HOS-726 added a fifth shortcut to the old add-ons catalog
        // (`mi-cuenta/addons`); that page was removed with the old billing
        // (HOS-1637, AC:B13a:20), and a link to it would be a 404.
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: mockDashboardApiResponse
        });

        render(<HostDashboard locale="es" />);

        // Wait for the ready render before touching the DOM — the loading
        // skeleton has no links at all, so asserting too early passes for the
        // wrong reason.
        const subscriptionLink = await screen.findByRole('link', { name: /suscripci/i });

        // Assert on the RENDERED list, not on the config.
        const quickActionList = subscriptionLink.closest('ul');
        expect(quickActionList).not.toBeNull();
        const hrefs = Array.from(quickActionList?.querySelectorAll('a') ?? []).map((anchor) =>
            anchor.getAttribute('href')
        );
        expect(hrefs).toEqual([
            '/es/mi-cuenta/propiedades/',
            '/es/mi-cuenta/promociones/',
            '/es/mi-cuenta/consultas-propietario/',
            '/es/mi-cuenta/suscripcion/'
        ]);
        expect(document.body.innerHTML).not.toContain('mi-cuenta/addons');
    });
});

describe('HostDashboard inbox links (HOS-2418)', () => {
    it('points every inquiries entry at the owner inbox, never the guest inbox', async () => {
        mockHostDashboardGet.mockResolvedValue({ ok: true, data: mockDashboardApiResponse });

        const { container } = render(<HostDashboard locale="es" />);
        await screen.findByText('Owner Pro');

        const inboxHrefs = Array.from(container.querySelectorAll('a[href]'))
            .map((a) => a.getAttribute('href') ?? '')
            .filter((href) => href.includes('/mi-cuenta/consultas'));

        // quick action + "Ver todos" widget link
        expect(inboxHrefs).toHaveLength(2);
        for (const href of inboxHrefs) {
            expect(href).toContain('/mi-cuenta/consultas-propietario');
        }
    });
});

describe('HostDashboard heading levels (HOS-2453)', () => {
    it('titles its widgets with h2 so the page h1 is never followed by an h3', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: mockDashboardApiResponse
        });

        render(<HostDashboard locale="es" />);

        await screen.findByText('Owner Pro');
        const levels = screen.getAllByRole('heading').map((heading) => Number(heading.tagName[1]));
        expect(levels.length).toBeGreaterThan(0);
        // The first heading in the island sits right under the page h1.
        expect(levels[0]).toBe(2);
        for (let i = 1; i < levels.length; i += 1) {
            expect(levels[i] - (levels[i - 1] as number)).toBeLessThanOrEqual(1);
        }
    });
});
