/**
 * @file HostDashboard.test.tsx
 * @description The host dashboard island on the kit (HOS-2474): per-card error
 * states that never show `0` (HOS-2424), the plan lock with catalog names
 * instead of «Entitlement required» (HOS-2214), the onboarding empty state and
 * the owner-inbox link (HOS-2418).
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockHostDashboardGet = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get hostDashboardApi() {
        return { get: mockHostDashboardGet };
    },
    // AnalyticsSection also imports from endpoints-protected: stub what it uses.
    get hostAnalyticsApi() {
        const pending = () => new Promise(() => {});
        return {
            getViews: vi.fn(pending),
            getFavoritesBreakdown: vi.fn(pending),
            getResponseRate: vi.fn(pending),
            getInquiryTrend: vi.fn(pending),
            getMarketComparison: vi.fn(pending),
            listOwnAccommodations: vi.fn(pending),
            getViewsDailySeries: vi.fn(pending)
        };
    }
}));

import { HostDashboard } from '../../../src/components/host/HostDashboard.client';

/** Fixture catalog: the page reads plan names from the catalog and passes them in. */
const PLAN_NAMES = ['Plan Fixture Uno', 'Plan Fixture Dos'];

const renderDashboard = () =>
    render(
        <HostDashboard
            locale="es"
            planNames={PLAN_NAMES}
            plansHref="/es/propietarios/planes/"
        />
    );

const card = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-widget="${id}"]`) as HTMLElement;

const READY = {
    properties: { total: 5, published: 3, draft: 2, archived: 0 },
    unreadConversations: 2,
    unavailable: []
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('HostDashboard (HOS-2474)', () => {
    it('shows both cards loading first', () => {
        mockHostDashboardGet.mockReturnValue(new Promise(() => {}));
        const { container } = renderDashboard();
        expect(card(container, 'hostProperties')).toHaveAttribute('data-state', 'loading');
        expect(card(container, 'hostUnreadMessages')).toHaveAttribute('data-state', 'loading');
    });

    it('renders the counts when the read succeeds', async () => {
        mockHostDashboardGet.mockResolvedValue({ ok: true, data: READY });
        const { container } = renderDashboard();
        await screen.findByText('5');
        expect(within(card(container, 'hostUnreadMessages')).getByText('2')).toBeInTheDocument();
    });

    it('a failed read shows «—» and retry on each card, never 0', async () => {
        // Arrange
        mockHostDashboardGet.mockResolvedValueOnce({
            ok: false,
            error: { status: 500, message: 'boom', code: 'INTERNAL_ERROR' }
        });
        mockHostDashboardGet.mockResolvedValueOnce({ ok: true, data: READY });
        const user = userEvent.setup();
        // Act
        const { container } = renderDashboard();
        const alerts = await screen.findAllByRole('alert');
        // Assert
        expect(alerts).toHaveLength(2);
        for (const id of ['hostProperties', 'hostUnreadMessages']) {
            const el = card(container, id);
            expect(el).toHaveAttribute('data-state', 'error');
            expect(el.textContent).toContain('—');
            expect(el.textContent).not.toMatch(/\b0\b/);
        }
        await user.click(screen.getAllByRole('button', { name: /reintentar/i })[0] as HTMLElement);
        await screen.findByText('5');
        expect(mockHostDashboardGet).toHaveBeenCalledTimes(2);
    });

    it('a section the API flagged unavailable is an error, not its zero fallback (HOS-2424)', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: { ...READY, unreadConversations: 0, unavailable: ['unreadConversations'] }
        });
        const { container } = renderDashboard();
        await screen.findByText('5');
        const unread = card(container, 'hostUnreadMessages');
        expect(unread).toHaveAttribute('data-state', 'error');
        expect(unread.textContent).not.toMatch(/\b0\b/);
    });

    it('a host without plan sees a LockedState with catalog names and no enabled control (HOS-2214)', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: false,
            error: { status: 403, message: 'Entitlement required', code: 'ENTITLEMENT_REQUIRED' }
        });
        const { container } = renderDashboard();
        const locked = await screen.findByText('Plan Fixture Uno');
        const root = locked.closest('[data-reason="plan"]') as HTMLElement;
        expect(root).not.toBeNull();
        expect(within(root).getByText('Plan Fixture Dos')).toBeInTheDocument();
        expect(container.textContent).not.toContain('Entitlement required');
        expect(
            root.querySelectorAll('input, select, textarea, button:not([disabled])')
        ).toHaveLength(0);
        expect(within(root).getByRole('link', { name: 'Ver planes' })).toHaveAttribute(
            'href',
            '/es/propietarios/planes/'
        );
    });

    it('a host with no property sees the onboarding empty state', async () => {
        mockHostDashboardGet.mockResolvedValue({
            ok: true,
            data: { ...READY, properties: { total: 0, published: 0, draft: 0, archived: 0 } }
        });
        renderDashboard();
        const link = await screen.findByRole('link', { name: /cargar/i });
        expect(link.getAttribute('href')).toBe('/es/mi-cuenta/propiedades/');
    });

    it('points the unread card at the owner inbox, never the guest inbox (HOS-2418)', async () => {
        mockHostDashboardGet.mockResolvedValue({ ok: true, data: READY });
        const { container } = renderDashboard();
        await screen.findByText('5');
        const hrefs = Array.from(container.querySelectorAll('a[href*="/mi-cuenta/consultas"]')).map(
            (a) => a.getAttribute('href')
        );
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs) expect(href).toContain('/mi-cuenta/consultas-propietario');
    });
});
