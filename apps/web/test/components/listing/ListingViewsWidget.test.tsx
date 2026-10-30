/**
 * @file ListingViewsWidget.test.tsx
 * @description RTL tests for the venue/experience basic view-stats
 * widget (HOS-734).
 *
 * Verifies:
 *  - Renders nothing when the owner has zero listings.
 *  - Fetches views per distinct vertical present in `listings` and renders
 *    one row per listing, zipped with its name.
 *  - The 7d/30d toggle re-fetches with the new window.
 *  - A failed fetch shows the inline error message.
 *  - A 403 (an owner with no tier yet: never published, or trial ended
 *    unpaid) is an informative locked sentence, not that error.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ListingViewsWidget,
    type ListingViewsWidgetListing
} from '../../../src/components/listing/ListingViewsWidget.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/listing/ListingViewsWidget.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const { mockGetViews } = vi.hoisted(() => ({ mockGetViews: vi.fn() }));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    listingAnalyticsApi: {
        getViews: mockGetViews
    }
}));

const GASTRO_LISTING: ListingViewsWidgetListing = {
    id: 'venue-1',
    vertical: 'venue',
    name: 'La Parrilla del Puerto'
};

const EXPERIENCE_LISTING: ListingViewsWidgetListing = {
    id: 'exp-1',
    vertical: 'experience',
    name: 'Paseo en Kayak'
};

describe('ListingViewsWidget (HOS-734)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when the owner has zero listings', () => {
        const { container } = render(
            <ListingViewsWidget
                locale="es"
                listings={[]}
            />
        );
        expect(container.firstChild).toBeNull();
        expect(mockGetViews).not.toHaveBeenCalled();
    });

    it('fetches views for each distinct vertical and renders one row per listing', async () => {
        mockGetViews.mockImplementation(({ vertical }: { vertical: string }) => {
            if (vertical === 'venue') {
                return Promise.resolve({
                    ok: true,
                    data: [{ entityId: 'venue-1', unique: 12, total: 30 }]
                });
            }
            return Promise.resolve({
                ok: true,
                data: [{ entityId: 'exp-1', unique: 4, total: 9 }]
            });
        });

        render(
            <ListingViewsWidget
                locale="es"
                listings={[GASTRO_LISTING, EXPERIENCE_LISTING]}
            />
        );

        await waitFor(() => expect(mockGetViews).toHaveBeenCalledTimes(2));

        expect(await screen.findByText('La Parrilla del Puerto')).toBeTruthy();
        expect(await screen.findByText('Paseo en Kayak')).toBeTruthy();
        expect(screen.getAllByTestId('listing-views-unique')).toHaveLength(2);
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
            data: [{ entityId: 'venue-1', unique: 1, total: 2 }]
        });

        render(
            <ListingViewsWidget
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
            <ListingViewsWidget
                locale="es"
                listings={[GASTRO_LISTING]}
            />
        );

        expect(
            await screen.findByText('No pudimos cargar las vistas. Probá de nuevo más tarde.')
        ).toBeTruthy();
        expect(screen.queryByTestId('listing-views-row')).toBeNull();
        expect(screen.queryByTestId('listing-views-locked')).toBeNull();
    });

    it('shows an informative locked sentence, not an error, when the API answers 403', async () => {
        mockGetViews.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'x' }
        });

        render(
            <ListingViewsWidget
                locale="es"
                listings={[GASTRO_LISTING, EXPERIENCE_LISTING]}
            />
        );

        expect(await screen.findByTestId('listing-views-locked')).toHaveTextContent(
            'Las vistas de tus fichas aparecen mientras están publicadas'
        );
        expect(screen.queryByRole('alert')).toBeNull();
        expect(
            screen.queryByText('No pudimos cargar las vistas. Probá de nuevo más tarde.')
        ).toBeNull();
    });

    it('one vertical locked does not hide another vertical that has data', async () => {
        mockGetViews.mockImplementation(async ({ vertical }: { vertical: string }) =>
            vertical === 'venue'
                ? { ok: false, error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'x' } }
                : { ok: true, data: [{ entityId: 'exp-1', unique: 7, total: 11 }] }
        );

        render(
            <ListingViewsWidget
                locale="es"
                listings={[GASTRO_LISTING, EXPERIENCE_LISTING]}
            />
        );

        const row = await screen.findByTestId('listing-views-row');
        expect(row).toHaveTextContent('Paseo en Kayak');
        expect(row).toHaveTextContent('7');
        expect(screen.getAllByTestId('listing-views-row')).toHaveLength(1);
        expect(screen.getByTestId('listing-views-locked')).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('a 403 with another code is the error, not the locked sentence', async () => {
        mockGetViews.mockResolvedValue({
            ok: false,
            error: { status: 403, code: 'EMAIL_NOT_VERIFIED', message: 'x' }
        });

        render(
            <ListingViewsWidget
                locale="es"
                listings={[GASTRO_LISTING]}
            />
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las vistas');
        expect(screen.queryByTestId('listing-views-locked')).toBeNull();
    });

    it('a 403 mixed with a genuine failure is still the error', async () => {
        mockGetViews.mockImplementation(async ({ vertical }: { vertical: string }) =>
            vertical === 'venue'
                ? { ok: false, error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'x' } }
                : { ok: false, error: { status: 500, message: 'boom' } }
        );

        render(
            <ListingViewsWidget
                locale="es"
                listings={[GASTRO_LISTING, EXPERIENCE_LISTING]}
            />
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las vistas');
        expect(screen.queryByTestId('listing-views-locked')).toBeNull();
    });
});
