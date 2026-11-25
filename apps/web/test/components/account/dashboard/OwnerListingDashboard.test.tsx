/**
 * @file OwnerListingDashboard.test.tsx
 * @description The venue and experience owner dashboard island (HOS-2475,
 * HOS-2476): ONE stats request (AC-16), a locked traffic widget is a
 * LockedState with catalog names and no number (AC-3), a failed read is «—»
 * plus retry, never `0` (AC-2), and an empty account gets the onboarding.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getStats = vi.fn();

vi.mock('@/lib/api/endpoints-protected-dashboards', () => ({
    get ownerDashboardApi() {
        return { getStats };
    }
}));

import { OwnerListingDashboard } from '../../../../src/components/account/dashboard/OwnerListingDashboard.client';

/** Fixture catalog (AC-3: no plan-name literal comes from the component). */
const PLAN_NAMES = ['Plan Fixture A'];
const card = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-widget="${id}"]`) as HTMLElement;

const renderFor = (vertical: 'venue' | 'experience') =>
    render(
        <OwnerListingDashboard
            locale="es"
            vertical={vertical}
            planNames={PLAN_NAMES}
            plansHref="/es/planes/comer-y-salir/"
        />
    );

const listings = { total: 3, published: 2, draft: 1, archived: 0 };

afterEach(() => {
    vi.clearAllMocks();
});

describe.each([
    ['venue', 'venueListings', 'venueTraffic'],
    ['experience', 'experienceListings', 'experienceTraffic']
] as const)('OwnerListingDashboard (%s)', (vertical, listingsId, trafficId) => {
    it.each([
        [1, 1, '1 publicada · 1 borrador'],
        [2, 2, '2 publicadas · 2 borradores']
    ])('pluralizes each listing count independently (%s, %s)', async (published, draft, expected) => {
        getStats.mockResolvedValue({
            ok: true,
            data: {
                vertical,
                listings: { total: published + draft, published, draft, archived: 0 },
                trafficAccess: 'locked'
            }
        });
        const { container } = renderFor(vertical);
        expect(await within(card(container, listingsId)).findByText(expected)).toBeInTheDocument();
    });

    it('makes exactly one stats request and renders counts and traffic', async () => {
        getStats.mockResolvedValue({
            ok: true,
            data: {
                vertical,
                listings,
                trafficAccess: 'granted',
                traffic: { windowDays: 30, unique: 11, total: 42 }
            }
        });
        const { container } = renderFor(vertical);
        await screen.findByText('42');
        expect(within(card(container, listingsId)).getByText('3')).toBeInTheDocument();
        expect(getStats).toHaveBeenCalledExactlyOnceWith({ vertical });
    });

    it('a locked traffic widget is a LockedState with catalog names and no number', async () => {
        getStats.mockResolvedValue({
            ok: true,
            data: { vertical, listings, trafficAccess: 'locked' }
        });
        const { container } = renderFor(vertical);
        await screen.findByText('Plan Fixture A');
        const traffic = card(container, trafficId);
        expect(traffic).toHaveAttribute('data-state', 'locked');
        expect(traffic.textContent).not.toMatch(/\b\d+\b/);
        expect(
            traffic.querySelectorAll('input, select, textarea, button:not([disabled])')
        ).toHaveLength(0);
    });

    it('an unavailable traffic block is an error with retry, never 0', async () => {
        getStats.mockResolvedValue({
            ok: true,
            data: { vertical, listings, trafficAccess: 'unavailable' }
        });
        const { container } = renderFor(vertical);
        await screen.findByRole('alert');
        const traffic = card(container, trafficId);
        expect(traffic).toHaveAttribute('data-state', 'error');
        expect(traffic.textContent).not.toMatch(/\b0\b/);
        expect(card(container, listingsId)).toHaveAttribute('data-state', 'ready');
    });

    it('a failed read errors both widgets and retries with one more request', async () => {
        getStats.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'x' } });
        getStats.mockResolvedValueOnce({
            ok: true,
            data: { vertical, listings, trafficAccess: 'locked' }
        });
        const user = userEvent.setup();
        const { container } = renderFor(vertical);
        const alerts = await screen.findAllByRole('alert');
        expect(alerts).toHaveLength(2);
        expect(card(container, listingsId).textContent).not.toMatch(/\b0\b/);
        await user.click(screen.getAllByRole('button', { name: /reintentar/i })[0] as HTMLElement);
        await within(card(container, listingsId)).findByText('3');
        expect(getStats).toHaveBeenCalledTimes(2);
    });

    it('an owner with no listing gets the onboarding with a publish link', async () => {
        getStats.mockResolvedValue({
            ok: true,
            data: {
                vertical,
                listings: { total: 0, published: 0, draft: 0, archived: 0 },
                trafficAccess: 'locked'
            }
        });
        renderFor(vertical);
        const cta = await screen.findByRole('link', { name: /publicar/i });
        expect(cta.getAttribute('href')).toMatch(/^\/es\/publicar\//);
    });
});
