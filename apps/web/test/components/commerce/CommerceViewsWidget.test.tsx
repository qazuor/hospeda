/**
 * @file CommerceViewsWidget.test.tsx
 * @description RTL tests for the gastronomy/experience basic view-stats
 * widget (HOS-734).
 *
 * Verifies:
 *  - Renders nothing when the owner has zero listings.
 *  - Fetches views per distinct vertical present in `listings` and renders
 *    one row per listing, zipped with its name.
 *  - The 7d/30d toggle re-fetches with the new window.
 *  - A failed fetch shows the inline error message (never a locked/upsell
 *    CTA — VIEW_BASIC_STATS is the commerce floor, HOS-734).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CommerceViewsWidget,
    type CommerceViewsWidgetListing
} from '../../../src/components/commerce/CommerceViewsWidget.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/commerce/CommerceViewsWidget.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const { mockGetViews } = vi.hoisted(() => ({ mockGetViews: vi.fn() }));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    commerceAnalyticsApi: {
        getViews: mockGetViews
    }
}));

const GASTRO_LISTING: CommerceViewsWidgetListing = {
    id: 'gastro-1',
    vertical: 'gastronomy',
    name: 'La Parrilla del Puerto'
};

const EXPERIENCE_LISTING: CommerceViewsWidgetListing = {
    id: 'exp-1',
    vertical: 'experience',
    name: 'Paseo en Kayak'
};

describe('CommerceViewsWidget (HOS-734)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when the owner has zero listings', () => {
        const { container } = render(
            <CommerceViewsWidget
                locale="es"
                listings={[]}
            />
        );
        expect(container.firstChild).toBeNull();
        expect(mockGetViews).not.toHaveBeenCalled();
    });

    it('fetches views for each distinct vertical and renders one row per listing', async () => {
        mockGetViews.mockImplementation(({ vertical }: { vertical: string }) => {
            if (vertical === 'gastronomy') {
                return Promise.resolve({
                    ok: true,
                    data: [{ entityId: 'gastro-1', unique: 12, total: 30 }]
                });
            }
            return Promise.resolve({
                ok: true,
                data: [{ entityId: 'exp-1', unique: 4, total: 9 }]
            });
        });

        render(
            <CommerceViewsWidget
                locale="es"
                listings={[GASTRO_LISTING, EXPERIENCE_LISTING]}
            />
        );

        await waitFor(() => expect(mockGetViews).toHaveBeenCalledTimes(2));

        expect(await screen.findByText('La Parrilla del Puerto')).toBeTruthy();
        expect(await screen.findByText('Paseo en Kayak')).toBeTruthy();
        expect(screen.getAllByTestId('commerce-views-unique')).toHaveLength(2);
        expect(screen.getByText(/12 únicos/)).toBeTruthy();
        expect(screen.getByText(/30 totales/)).toBeTruthy();
        expect(screen.getByText(/4 únicos/)).toBeTruthy();
        expect(screen.getByText(/9 totales/)).toBeTruthy();

        // Both verticals were queried with the default 30d window.
        for (const call of mockGetViews.mock.calls) {
            expect(call[0]).toMatchObject({ window: '30d' });
        }
    });

    it('re-fetches with window=7d when the 7 días toggle is clicked', async () => {
        mockGetViews.mockResolvedValue({
            ok: true,
            data: [{ entityId: 'gastro-1', unique: 1, total: 2 }]
        });

        render(
            <CommerceViewsWidget
                locale="es"
                listings={[GASTRO_LISTING]}
            />
        );
        await waitFor(() => expect(mockGetViews).toHaveBeenCalledTimes(1));

        fireEvent.click(screen.getByText('7 días'));

        await waitFor(() => expect(mockGetViews).toHaveBeenCalledTimes(2));
        const lastCall = mockGetViews.mock.calls[1]?.[0] as { window: string };
        expect(lastCall.window).toBe('7d');
    });

    it('shows the inline error message on a failed fetch, never a locked CTA', async () => {
        mockGetViews.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'boom' }
        });

        render(
            <CommerceViewsWidget
                locale="es"
                listings={[GASTRO_LISTING]}
            />
        );

        expect(
            await screen.findByText('No pudimos cargar las vistas. Probá de nuevo más tarde.')
        ).toBeTruthy();
        expect(screen.queryByTestId('commerce-views-row')).toBeNull();
    });
});
