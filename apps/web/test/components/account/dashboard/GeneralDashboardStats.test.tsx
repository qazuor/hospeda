/**
 * @file GeneralDashboardStats.test.tsx
 * @description The general dashboard's stat island (HOS-2473): each card
 * settles on its own, a failed read is «—» plus retry and never `0` (AC-2,
 * HOS-2424), and the subscription card names the plan from the catalog map.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getStats = vi.fn();
const getReviews = vi.fn();
const trialSummary = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get userApi() {
        return { getStats, getReviews };
    },
    get publishApi() {
        return { trialSummary };
    }
}));

import { GeneralDashboardStats } from '../../../../src/components/account/dashboard/GeneralDashboardStats.client';

const STATS = {
    bookmarkCount: 4,
    plan: { slug: 'owner-pro', name: 'owner-pro', status: 'ACTIVE' },
    activeSubscriptionsCount: 1
};
const card = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-widget="${id}"]`) as HTMLElement;

afterEach(() => {
    vi.clearAllMocks();
});

describe('GeneralDashboardStats (HOS-2473)', () => {
    it('renders favorites, reviews and the catalog plan name', async () => {
        getStats.mockResolvedValue({ ok: true, data: STATS });
        getReviews.mockResolvedValue({ ok: true, data: { totals: { total: 9 } } });
        const { container } = render(
            <GeneralDashboardStats
                locale="es"
                planNames={{ 'owner-pro': 'Pro anfitrión' }}
            />
        );
        await screen.findByText('Pro anfitrión');
        expect(within(card(container, 'favorites')).getByText('4')).toBeInTheDocument();
        expect(within(card(container, 'reviews')).getByText('9')).toBeInTheDocument();
        expect(trialSummary).not.toHaveBeenCalled();
    });

    it('a failed stats read leaves favorites and subscription in error, never 0, and retries', async () => {
        // Arrange
        getStats.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'x' } });
        getStats.mockResolvedValueOnce({ ok: true, data: STATS });
        getReviews.mockResolvedValue({ ok: true, data: { totals: { total: 0 } } });
        const user = userEvent.setup();
        // Act
        const { container } = render(
            <GeneralDashboardStats
                locale="es"
                planNames={{}}
            />
        );
        await screen.findAllByRole('alert');
        // Assert
        for (const id of ['favorites', 'subscription']) {
            const el = card(container, id);
            expect(el).toHaveAttribute('data-state', 'error');
            expect(el.textContent).not.toMatch(/\b0\b/);
        }
        // A real zero on a card whose read worked is still a zero.
        expect(within(card(container, 'reviews')).getByText('0')).toBeInTheDocument();
        await user.click(
            within(card(container, 'favorites')).getByRole('button', { name: /reintentar/i })
        );
        await within(card(container, 'favorites')).findByText('4');
    });

    it('a failed reviews read errors only the reviews card', async () => {
        getStats.mockResolvedValue({ ok: true, data: STATS });
        getReviews.mockRejectedValue(new Error('network'));
        const { container } = render(
            <GeneralDashboardStats
                locale="es"
                planNames={{}}
            />
        );
        await within(card(container, 'reviews')).findByRole('alert');
        expect(card(container, 'favorites')).toHaveAttribute('data-state', 'ready');
    });

    it('HOS-2553 a declined single plan shows its exact status and what to do', async () => {
        // Arrange
        getStats.mockResolvedValue({
            ok: true,
            data: { ...STATS, plan: { ...STATS.plan, status: 'CHARGE_DECLINED' } }
        });
        getReviews.mockResolvedValue({ ok: true, data: { totals: { total: 0 } } });
        // Act
        const { container } = render(
            <GeneralDashboardStats
                locale="es"
                planNames={{ 'owner-pro': 'Pro anfitrión' }}
            />
        );
        await screen.findByText('Pro anfitrión');
        // Assert
        const sub = card(container, 'subscription');
        expect(within(sub).getByText('Cobro rechazado')).toBeInTheDocument();
        expect(within(sub).getByTestId('subscription-action').textContent).toMatch(
            /Mercado Pago no aprobó el pago/
        );
    });

    it('HOS-2553 two or more subscriptions are listed with their status, max three, and «Ver todas»', async () => {
        // Arrange
        const row = (slug: string, status: string) => ({
            slug,
            name: slug.toUpperCase(),
            status,
            vertical: 'accommodation'
        });
        getStats.mockResolvedValue({
            ok: true,
            data: {
                ...STATS,
                plan: null,
                activeSubscriptionsCount: 2,
                subscriptions: [
                    row('owner-pro', 'ACTIVE'),
                    row('venue-pro', 'PENDING_AUTHORIZATION'),
                    row('experience-pro', 'CHARGE_DECLINED'),
                    row('partner-gold', 'ACTIVE')
                ]
            }
        });
        getReviews.mockResolvedValue({ ok: true, data: { totals: { total: 0 } } });
        // Act
        const { container } = render(
            <GeneralDashboardStats
                locale="es"
                planNames={{ 'owner-pro': 'Pro anfitrión' }}
            />
        );
        await screen.findByText('Pro anfitrión');
        // Assert
        const sub = card(container, 'subscription');
        const rows = within(sub).getAllByTestId('subscription-row');
        expect(rows.map((el) => el.textContent)).toEqual([
            'Pro anfitrión · Activo',
            'VENUE-PRO · Esperando autorización',
            'EXPERIENCE-PRO · Cobro rechazado'
        ]);
        // The first row that needs action decides the line.
        expect(within(sub).getByTestId('subscription-action').textContent).toMatch(
            /autorices el pago/
        );
        expect(within(sub).getByRole('link', { name: 'Ver todas' })).toBeInTheDocument();
        expect(trialSummary).not.toHaveBeenCalled();
    });

    it('HOS-2553 an active single plan has no action line and keeps «Ver mi suscripción»', async () => {
        getStats.mockResolvedValue({ ok: true, data: STATS });
        getReviews.mockResolvedValue({ ok: true, data: { totals: { total: 0 } } });
        const { container } = render(
            <GeneralDashboardStats
                locale="es"
                planNames={{ 'owner-pro': 'Pro anfitrión' }}
            />
        );
        await screen.findByText('Pro anfitrión');
        const sub = card(container, 'subscription');
        expect(within(sub).queryByTestId('subscription-action')).toBeNull();
        expect(within(sub).getByRole('link', { name: 'Ver mi suscripción' })).toBeInTheDocument();
    });
});
