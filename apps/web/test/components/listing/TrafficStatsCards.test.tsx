/**
 * @file TrafficStatsCards.test.tsx
 * @description RTL tests for the owner traffic-stats cards (HOS-2119 T-051).
 *
 * `t` echoes the i18n key (and `tPlural` echoes `key:count`) so the tests
 * assert WHICH key each label uses, not its Spanish fallback.
 */

import {
    EntityTypeEnum,
    LISTING_TRAFFIC_DIRECT_REFERRER,
    LISTING_TRAFFIC_INTERNAL_REFERRER,
    type ListingTrafficStatsEntityType
} from '@repo/schemas';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrafficStatsCards } from '../../../src/components/listing/TrafficStatsCards.client';

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string) => key,
        tPlural: (key: string, count: number) => `${key}:${count}`
    })
}));

vi.mock('../../../src/components/listing/TrafficStatsCards.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

const { mockGetTrafficStats } = vi.hoisted(() => ({ mockGetTrafficStats: vi.fn() }));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    listingAnalyticsApi: { getTrafficStats: mockGetTrafficStats }
}));

const FULL = {
    window: '30d',
    available: true,
    referrers: [
        { value: 'google.com', count: 9 },
        { value: LISTING_TRAFFIC_DIRECT_REFERRER, count: 4 },
        { value: LISTING_TRAFFIC_INTERNAL_REFERRER, count: 2 }
    ],
    countries: [{ value: 'AR', count: 7 }],
    devices: [
        { value: 'mobile', count: 6 },
        { value: 'laptop', count: 3 },
        { value: 'smartwatch', count: 1 }
    ],
    contactFunnel: { views: 20, contactStarted: 5, contactCompleted: 2 }
};

const ok = (data: unknown) => ({ ok: true, data });

function renderCards(
    props: Partial<{ entityType: ListingTrafficStatsEntityType; window: '7d' | '30d' | '90d' }> = {}
) {
    return render(
        <TrafficStatsCards
            locale="es"
            entityType={props.entityType ?? EntityTypeEnum.ACCOMMODATION}
            entityId="11111111-1111-4111-8111-111111111111"
            window={props.window ?? '30d'}
        />
    );
}

describe('TrafficStatsCards (HOS-2119)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the four cards for an accommodation', async () => {
        mockGetTrafficStats.mockResolvedValue(ok(FULL));
        renderCards();
        expect(await screen.findByTestId('traffic-card-referrers')).toBeInTheDocument();
        expect(screen.getByTestId('traffic-card-countries')).toBeInTheDocument();
        expect(screen.getByTestId('traffic-card-devices')).toBeInTheDocument();
        const contacts = screen.getByTestId('traffic-card-contacts');
        expect(within(contacts).getByText('20')).toBeInTheDocument();
        expect(within(contacts).getByText('5')).toBeInTheDocument();
        expect(within(contacts).getByText('2')).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    });

    it('renders three cards (no Contactos) when contactFunnel is null', async () => {
        mockGetTrafficStats.mockResolvedValue(ok({ ...FULL, contactFunnel: null }));
        renderCards({ entityType: EntityTypeEnum.VENUE });
        await screen.findByTestId('traffic-card-referrers');
        expect(screen.queryByTestId('traffic-card-contacts')).not.toBeInTheDocument();
        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    });

    it('renders the direct and internal sentinels with their i18n labels and hosts verbatim', async () => {
        mockGetTrafficStats.mockResolvedValue(ok(FULL));
        renderCards();
        const card = await screen.findByTestId('traffic-card-referrers');
        expect(within(card).getByText('google.com')).toBeInTheDocument();
        expect(
            within(card).getByText('listing.owner.traffic.referrers.direct')
        ).toBeInTheDocument();
        expect(
            within(card).getByText('listing.owner.traffic.referrers.internal')
        ).toBeInTheDocument();
        expect(within(card).queryByText(LISTING_TRAFFIC_DIRECT_REFERRER)).not.toBeInTheDocument();
        expect(within(card).queryByText(LISTING_TRAFFIC_INTERNAL_REFERRER)).not.toBeInTheDocument();
        expect(within(card).getByText('listing.owner.traffic.visitors:9')).toBeInTheDocument();
    });

    it('labels laptop and falls back to "other" for unknown devices', async () => {
        mockGetTrafficStats.mockResolvedValue(ok(FULL));
        renderCards();
        const card = await screen.findByTestId('traffic-card-devices');
        expect(within(card).getByText('listing.owner.traffic.devices.mobile')).toBeInTheDocument();
        expect(within(card).getByText('listing.owner.traffic.devices.laptop')).toBeInTheDocument();
        expect(within(card).getByText('listing.owner.traffic.devices.other')).toBeInTheDocument();
    });

    it('renders the country name from the ISO code via Intl.DisplayNames', async () => {
        mockGetTrafficStats.mockResolvedValue(
            ok({
                ...FULL,
                countries: [
                    { value: 'AR', count: 7 },
                    { value: 'ZZZZ', count: 1 }
                ]
            })
        );
        renderCards();
        const card = await screen.findByTestId('traffic-card-countries');
        const expected = new Intl.DisplayNames(['es'], { type: 'region' }).of('AR');
        expect(expected).toBe('Argentina');
        expect(within(card).getByText('Argentina')).toBeInTheDocument();
        // Invalid code: falls back to the raw code instead of throwing.
        expect(within(card).getByText('ZZZZ')).toBeInTheDocument();
    });

    it('renders the empty message when there is no data at all', async () => {
        mockGetTrafficStats.mockResolvedValue(
            ok({
                window: '30d',
                available: true,
                referrers: [],
                countries: [],
                devices: [],
                contactFunnel: null
            })
        );
        renderCards();
        expect(await screen.findByTestId('traffic-stats-empty')).toHaveTextContent(
            'listing.owner.traffic.empty'
        );
        expect(screen.queryByTestId('traffic-stats-cards')).not.toBeInTheDocument();
    });

    it('renders nothing when available is false', async () => {
        mockGetTrafficStats.mockResolvedValue(
            ok({
                window: '30d',
                available: false,
                referrers: [],
                countries: [],
                devices: [],
                contactFunnel: null
            })
        );
        const { container } = renderCards();
        await waitFor(() => expect(mockGetTrafficStats).toHaveBeenCalled());
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('renders nothing when the request fails', async () => {
        mockGetTrafficStats.mockResolvedValue({ ok: false, error: { status: 500, code: 'X' } });
        const { container } = renderCards();
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('renders nothing when the request throws', async () => {
        mockGetTrafficStats.mockRejectedValue(new Error('network'));
        const { container } = renderCards();
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('renders nothing when the payload does not match the schema', async () => {
        mockGetTrafficStats.mockResolvedValue(ok({ window: '30d', available: true }));
        const { container } = renderCards();
        await waitFor(() => expect(container).toBeEmptyDOMElement());
    });

    it('shows a busy loading state before the response arrives', () => {
        mockGetTrafficStats.mockReturnValue(new Promise(() => {}));
        renderCards();
        expect(screen.getByTestId('traffic-stats-loading')).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByRole('status')).toBe(screen.getByTestId('traffic-stats-loading'));
    });

    it('refetches with the new window when the window prop changes', async () => {
        mockGetTrafficStats.mockResolvedValue(ok(FULL));
        const { rerender } = renderCards({ window: '7d' });
        await screen.findByTestId('traffic-stats-cards');
        expect(mockGetTrafficStats).toHaveBeenLastCalledWith(
            expect.objectContaining({
                entityType: EntityTypeEnum.ACCOMMODATION,
                entityId: '11111111-1111-4111-8111-111111111111',
                window: '7d'
            })
        );

        rerender(
            <TrafficStatsCards
                locale="es"
                entityType={EntityTypeEnum.ACCOMMODATION}
                entityId="11111111-1111-4111-8111-111111111111"
                window="90d"
            />
        );
        await waitFor(() => expect(mockGetTrafficStats).toHaveBeenCalledTimes(2));
        expect(mockGetTrafficStats).toHaveBeenLastCalledWith(
            expect.objectContaining({ window: '90d' })
        );
    });

    it('ignores a slow response of a previous window (race)', async () => {
        let resolve7d: (value: unknown) => void = () => {};
        let resolve90d: (value: unknown) => void = () => {};
        const slow7d = new Promise((r) => {
            resolve7d = r;
        });
        const fast90d = new Promise((r) => {
            resolve90d = r;
        });
        mockGetTrafficStats.mockImplementation(({ window }: { window: string }) =>
            window === '7d' ? slow7d : fast90d
        );

        const { rerender } = renderCards({ window: '7d' });
        rerender(
            <TrafficStatsCards
                locale="es"
                entityType={EntityTypeEnum.ACCOMMODATION}
                entityId="11111111-1111-4111-8111-111111111111"
                window="90d"
            />
        );

        resolve90d(ok({ ...FULL, referrers: [{ value: 'b.com', count: 3 }] }));
        expect(await screen.findByText('b.com')).toBeInTheDocument();

        resolve7d(ok({ ...FULL, referrers: [{ value: 'a.com', count: 8 }] }));
        await act(async () => {
            await slow7d;
        });
        expect(screen.getByText('b.com')).toBeInTheDocument();
        expect(screen.queryByText('a.com')).not.toBeInTheDocument();
    });

    it('shows at most five rows per breakdown card', async () => {
        mockGetTrafficStats.mockResolvedValue(
            ok({
                ...FULL,
                countries: ['AR', 'UY', 'BR', 'CL', 'PY', 'BO'].map((value, i) => ({
                    value,
                    count: 10 - i
                }))
            })
        );
        renderCards();
        const card = await screen.findByTestId('traffic-card-countries');
        expect(within(card).getAllByRole('listitem')).toHaveLength(5);
    });

    it('shows the funnel when only contactCompleted is non-zero', async () => {
        mockGetTrafficStats.mockResolvedValue(
            ok({
                window: '30d',
                available: true,
                referrers: [],
                countries: [],
                devices: [],
                contactFunnel: { views: 0, contactStarted: 0, contactCompleted: 4 }
            })
        );
        renderCards();
        const contacts = await screen.findByTestId('traffic-card-contacts');
        expect(within(contacts).getByText('4')).toBeInTheDocument();
        expect(screen.queryByTestId('traffic-stats-empty')).not.toBeInTheDocument();
    });

    it('aggregates unknown devices into a single "other" row summing their counts', async () => {
        mockGetTrafficStats.mockResolvedValue(
            ok({
                ...FULL,
                devices: [
                    { value: 'mobile', count: 6 },
                    { value: 'smartwatch', count: 2 },
                    { value: 'tv', count: 3 }
                ]
            })
        );
        renderCards();
        const card = await screen.findByTestId('traffic-card-devices');
        expect(within(card).getAllByRole('listitem')).toHaveLength(2);
        const other = within(card).getAllByText('listing.owner.traffic.devices.other');
        expect(other).toHaveLength(1);
        expect(within(card).getByText('listing.owner.traffic.visitors:5')).toBeInTheDocument();
    });

    it('formats counts with the locale', async () => {
        mockGetTrafficStats.mockResolvedValue(
            ok({
                ...FULL,
                referrers: [{ value: 'google.com', count: 12345 }],
                contactFunnel: { views: 12345, contactStarted: 5, contactCompleted: 2 }
            })
        );
        renderCards();
        const formatted = (12345).toLocaleString('es');
        const referrers = await screen.findByTestId('traffic-card-referrers');
        expect(
            within(referrers).getByText(`listing.owner.traffic.visitors:${formatted}`)
        ).toBeInTheDocument();
        expect(
            within(screen.getByTestId('traffic-card-contacts')).getByText(formatted)
        ).toBeInTheDocument();
    });
});
