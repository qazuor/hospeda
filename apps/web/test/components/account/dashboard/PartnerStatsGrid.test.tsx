/**
 * @file PartnerStatsGrid.test.tsx
 * @description The partner dashboard's numbers (HOS-2477): only the cards the
 * API computes for this partner (NG-6), a failed read is «—» plus retry and
 * never `0`, and `available: false` renders nothing.
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mineStats = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get partnersApi() {
        return { mineStats };
    }
}));

import { PartnerStatsGrid } from '../../../../src/components/account/dashboard/PartnerStatsGrid.client';

const counts = (total: number) => ({ unique: total, total });
const card = (container: HTMLElement, id: string) =>
    container.querySelector(`[data-widget="${id}"]`) as HTMLElement | null;

afterEach(() => {
    vi.clearAllMocks();
});

describe('PartnerStatsGrid (HOS-2477)', () => {
    it('asks mineStats once for the 30-day window', async () => {
        mineStats.mockResolvedValue({ ok: true, data: { available: false } });
        render(<PartnerStatsGrid locale="es" />);
        await vi.waitFor(() =>
            expect(mineStats).toHaveBeenCalledExactlyOnceWith({ windowDays: 30 })
        );
    });

    it('a partner with its own page sees views (its logo leads to that page, so clicks too)', async () => {
        mineStats.mockResolvedValue({
            ok: true,
            data: {
                available: true,
                partner: { id: 'p1', name: 'Aliado', slug: 'aliado', hasPublicPage: true },
                windowDays: 30,
                views: counts(12),
                clicks: counts(3)
            }
        });
        const { container } = render(<PartnerStatsGrid locale="es" />);
        await screen.findByText('12');
        expect(card(container, 'partnerViews')).not.toBeNull();
    });

    it('a logo that links out shows clicks and no views card', async () => {
        mineStats.mockResolvedValue({
            ok: true,
            data: {
                available: true,
                partner: { id: 'p1', name: 'Aliado', websiteUrl: 'https://aliado.example' },
                windowDays: 30,
                views: counts(12),
                clicks: counts(3)
            }
        });
        const { container } = render(<PartnerStatsGrid locale="es" />);
        await screen.findByText('3');
        expect(card(container, 'partnerViews')).toBeNull();
    });

    it('renders nothing when the API says stats are not available', async () => {
        mineStats.mockResolvedValue({ ok: true, data: { available: false } });
        const { container } = render(<PartnerStatsGrid locale="es" />);
        await vi.waitFor(() =>
            expect(container.querySelector('[data-state="loading"]')).toBeNull()
        );
        expect(container.querySelector('[data-widget]')).toBeNull();
    });

    it('a failed read is «—» plus retry, never 0', async () => {
        mineStats.mockResolvedValueOnce({ ok: false, error: { status: 500, message: 'x' } });
        mineStats.mockResolvedValueOnce({ ok: true, data: { available: false } });
        const user = userEvent.setup();
        const { container } = render(<PartnerStatsGrid locale="es" />);
        const alert = await screen.findByRole('alert');
        const el = card(container, 'partnerStats') as HTMLElement;
        expect(el).toHaveAttribute('data-state', 'error');
        expect(el.textContent).not.toMatch(/\b0\b/);
        await user.click(within(alert).getByRole('button', { name: /reintentar/i }));
        await vi.waitFor(() => expect(mineStats).toHaveBeenCalledTimes(2));
    });
});
