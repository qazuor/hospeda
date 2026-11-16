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

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ListingViewsWidget,
    type ListingViewsWidgetListing
} from '../../../src/components/listing/ListingViewsWidget.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) =>
            Object.entries(params ?? {}).reduce(
                (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
                fallback ?? _key
            )
    })
}));

vi.mock('../../../src/components/listing/ListingViewsWidget.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/listing/TrafficStatsCards.client', () => ({
    TrafficStatsCards: (props: { entityType: string; entityId: string; window: string }) => {
        // Lifecycle spies prove an island is handed a new prop, not remounted.
        useEffect(() => {
            mockIslandMounted(props.entityId);
            return () => mockIslandUnmounted(props.entityId);
        }, [props.entityId]);
        return (
            <div
                data-testid="traffic-stub"
                data-entity-type={props.entityType}
                data-entity-id={props.entityId}
                data-window={props.window}
            />
        );
    }
}));

const { mockGetViews, mockIslandMounted, mockIslandUnmounted } = vi.hoisted(() => ({
    mockGetViews: vi.fn(),
    mockIslandMounted: vi.fn(),
    mockIslandUnmounted: vi.fn()
}));

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

        // Scoped to the views list: the traffic section repeats each listing name.
        const list = await screen.findByTestId('listing-views-list');
        expect(within(list).getByText('La Parrilla del Puerto')).toBeTruthy();
        expect(within(list).getByText('Paseo en Kayak')).toBeTruthy();
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

    describe('traffic cards (HOS-2119)', () => {
        it('mounts one island per listing beneath the views list with the right entity type and id', async () => {
            mockGetViews.mockImplementation(async ({ vertical }: { vertical: string }) => ({
                ok: true,
                data:
                    vertical === 'venue'
                        ? [{ entityId: 'venue-1', unique: 12, total: 30 }]
                        : [{ entityId: 'exp-1', unique: 4, total: 9 }]
            }));

            render(
                <ListingViewsWidget
                    locale="es"
                    listings={[GASTRO_LISTING, EXPERIENCE_LISTING]}
                />
            );

            const section = await screen.findByTestId('listing-traffic-section-venue');
            const expSection = screen.getByTestId('listing-traffic-section-experience');
            // Separate section and h2 per vertical, never one mixed block.
            expect(section.querySelector('h2')).toHaveTextContent('Tráfico: Comer y salir');
            expect(expSection.querySelector('h2')).toHaveTextContent('Tráfico: Experiencia');
            expect(section.querySelector('h2')?.textContent).not.toContain('{{');
            const venueStubs = section.querySelectorAll('[data-testid="traffic-stub"]');
            const expStubs = expSection.querySelectorAll('[data-testid="traffic-stub"]');
            expect(venueStubs).toHaveLength(1);
            expect(expStubs).toHaveLength(1);
            expect(venueStubs[0]).toHaveAttribute('data-entity-type', 'VENUE');
            expect(venueStubs[0]).toHaveAttribute('data-entity-id', 'venue-1');
            expect(expStubs[0]).toHaveAttribute('data-entity-type', 'EXPERIENCE');
            expect(expStubs[0]).toHaveAttribute('data-entity-id', 'exp-1');
            // Beneath the existing views list, in document order.
            const list = screen.getByTestId('listing-views-list');
            expect(
                list.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy();
            // Existing cards unchanged.
            expect(screen.getByText(/12 únicos/)).toBeTruthy();
            expect(screen.getByText(/30 totales/)).toBeTruthy();
        });

        it('passes the selected window to every island and updates it on toggle WITHOUT remounting', async () => {
            let resolveSecond: (value: { ok: true; data: [] }) => void = () => undefined;
            mockGetViews.mockResolvedValueOnce({ ok: true, data: [] });
            mockGetViews.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveSecond = resolve;
                    })
            );

            render(
                <ListingViewsWidget
                    locale="es"
                    listings={[GASTRO_LISTING]}
                />
            );

            const stub = await screen.findByTestId('traffic-stub');
            expect(stub).toHaveAttribute('data-window', '30d');
            expect(mockIslandMounted).toHaveBeenCalledTimes(1);

            fireEvent.click(screen.getByText('7 días'));

            // The views read is still in flight: the section must not vanish.
            await waitFor(() => expect(mockGetViews).toHaveBeenCalledTimes(2));
            expect(screen.getByTestId('listing-traffic-section-venue')).toBeTruthy();
            expect(screen.getByTestId('traffic-stub')).toHaveAttribute('data-window', '7d');

            await act(async () => {
                resolveSecond({ ok: true, data: [] });
            });

            // Same DOM node, handed the new prop; never torn down and rebuilt.
            expect(screen.getByTestId('traffic-stub')).toBe(stub);
            expect(stub).toHaveAttribute('data-window', '7d');
            expect(mockIslandMounted).toHaveBeenCalledTimes(1);
            expect(mockIslandUnmounted).not.toHaveBeenCalled();
        });

        it('scopes each listing block with a section labelled by the listing name', async () => {
            mockGetViews.mockResolvedValue({ ok: true, data: [] });

            render(
                <ListingViewsWidget
                    locale="es"
                    listings={[GASTRO_LISTING]}
                />
            );

            const region = await screen.findByRole('region', { name: 'La Parrilla del Puerto' });
            expect(region).toContainElement(screen.getByTestId('traffic-stub'));
        });

        it('renders no traffic island for a PURGED listing but keeps it in the views list', async () => {
            mockGetViews.mockResolvedValue({
                ok: true,
                data: [
                    { entityId: 'venue-1', unique: 1, total: 2 },
                    { entityId: 'venue-2', unique: 3, total: 4 }
                ]
            });

            render(
                <ListingViewsWidget
                    locale="es"
                    listings={[
                        GASTRO_LISTING,
                        { id: 'venue-2', vertical: 'venue', name: 'Cerrado', purged: true }
                    ]}
                />
            );

            await screen.findByTestId('listing-views-list');
            const stubs = await screen.findAllByTestId('traffic-stub');
            expect(stubs).toHaveLength(1);
            expect(stubs[0]).toHaveAttribute('data-entity-id', 'venue-1');
            expect(screen.getAllByTestId('listing-views-row')).toHaveLength(2);
        });

        it('renders no traffic section when the only listing is PURGED', async () => {
            mockGetViews.mockResolvedValue({ ok: true, data: [] });

            render(
                <ListingViewsWidget
                    locale="es"
                    listings={[{ ...GASTRO_LISTING, purged: true }]}
                />
            );

            await waitFor(() => expect(mockGetViews).toHaveBeenCalledTimes(1));
            await act(async () => undefined);
            expect(screen.queryByTestId('listing-traffic-section-venue')).toBeNull();
            expect(screen.queryByTestId('traffic-stub')).toBeNull();
        });

        it('renders no traffic island for a locked vertical, only for the one that answered', async () => {
            mockGetViews.mockImplementation(async ({ vertical }: { vertical: string }) =>
                vertical === 'venue'
                    ? {
                          ok: false,
                          error: { status: 403, code: 'ENTITLEMENT_REQUIRED', message: 'x' }
                      }
                    : { ok: true, data: [{ entityId: 'exp-1', unique: 7, total: 11 }] }
            );

            render(
                <ListingViewsWidget
                    locale="es"
                    listings={[GASTRO_LISTING, EXPERIENCE_LISTING]}
                />
            );

            const stub = await screen.findByTestId('traffic-stub');
            expect(screen.queryByTestId('listing-traffic-section-venue')).toBeNull();
            expect(stub).toHaveAttribute('data-entity-type', 'EXPERIENCE');
            expect(screen.getAllByTestId('traffic-stub')).toHaveLength(1);
        });

        it('renders no traffic section when every vertical is locked', async () => {
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

            await screen.findByTestId('listing-views-locked');
            expect(screen.queryByTestId('listing-traffic-section-venue')).toBeNull();
            expect(screen.queryByTestId('listing-traffic-section-experience')).toBeNull();
            expect(screen.queryByTestId('traffic-stub')).toBeNull();
        });

        it('renders no traffic section on a genuine views failure', async () => {
            mockGetViews.mockResolvedValue({ ok: false, error: { status: 500, message: 'boom' } });

            render(
                <ListingViewsWidget
                    locale="es"
                    listings={[GASTRO_LISTING]}
                />
            );

            await screen.findByRole('alert');
            expect(screen.queryByTestId('listing-traffic-section-venue')).toBeNull();
            expect(screen.queryByTestId('listing-traffic-section-experience')).toBeNull();
        });
    });
});
