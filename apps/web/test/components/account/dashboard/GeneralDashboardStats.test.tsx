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
});
