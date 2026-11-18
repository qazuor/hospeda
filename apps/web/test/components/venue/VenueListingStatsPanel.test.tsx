import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    VenueListingStatsPanel,
    type VenueListingStatsPanelListing
} from '../../../src/components/venue/VenueListingStatsPanel.client';

const { mockGetVenueStats } = vi.hoisted(() => ({ mockGetVenueStats: vi.fn() }));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    listingAnalyticsApi: { getVenueStats: mockGetVenueStats }
}));
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) =>
            Object.entries(params ?? {}).reduce(
                (value, [key, item]) => value.replace(`{{${key}}}`, String(item)),
                fallback ?? _key
            ),
        tPlural: (_key: string, count: number) => `${count} días`
    })
}));
vi.mock('../../../src/components/venue/VenueListingStatsPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_target, key) => String(key) })
}));

const LISTINGS: readonly VenueListingStatsPanelListing[] = [
    { id: 'venue-1', name: 'La Parrilla' },
    { id: 'venue-2', name: 'El Café' }
];

const READY = {
    ok: true as const,
    data: {
        window: '30d' as const,
        views: { unique: 3, total: 4 },
        dailyViews: [{ date: '2026-11-18', total: 4 }],
        clicks: {
            total: 2,
            byKind: {
                PHONE_CLICK: { unique: 1, total: 1 },
                MAP_CLICK: { unique: 1, total: 1 },
                WEBSITE_CLICK: { unique: 0, total: 0 },
                INSTAGRAM_CLICK: { unique: 0, total: 0 },
                TICKET_CLICK: { unique: 0, total: 0 },
                WHATSAPP_CLICK: { unique: 0, total: 0 }
            }
        },
        clickRate: 0.5
    }
};

const LOCKED = {
    ok: false as const,
    error: {
        status: 403,
        code: 'ENTITLEMENT_REQUIRED',
        details: { entitlementKey: 'view_advanced_stats' },
        message: 'forbidden'
    }
};

describe('VenueListingStatsPanel (HOS-2261)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetVenueStats.mockResolvedValue(READY);
    });

    it('renders nothing and makes no request when no venues are supplied', () => {
        const { container } = render(
            <VenueListingStatsPanel
                locale="es"
                listings={[]}
                unlockingPlanName={null}
            />
        );
        expect(container.firstChild).toBeNull();
        expect(mockGetVenueStats).not.toHaveBeenCalled();
    });

    it('renders nothing and makes no request until the venue catalog grants the key', () => {
        const { container } = render(
            <VenueListingStatsPanel
                locale="es"
                listings={LISTINGS}
                unlockingPlanName={null}
            />
        );
        expect(container.firstChild).toBeNull();
        expect(mockGetVenueStats).not.toHaveBeenCalled();
    });

    it('shows the catalog plan in the locked notice', async () => {
        mockGetVenueStats.mockResolvedValue(LOCKED);
        render(
            <VenueListingStatsPanel
                locale="es"
                listings={[LISTINGS[0]!]}
                unlockingPlanName="Pro"
            />
        );
        expect(await screen.findByTestId('venue-stats-upgrade-notice')).toHaveTextContent('Pro');
    });

    it('renders the stats panel when the user has the entitlement', async () => {
        render(
            <VenueListingStatsPanel
                locale="es"
                listings={[LISTINGS[0]!]}
                unlockingPlanName="Premium"
            />
        );
        expect(await screen.findByTestId('venue-stats-daily-views')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeVisible();
        expect(screen.getByTestId('venue-listing-stats-panel')).toBeVisible();
    });

    it('shows daily views, channel totals and the click-rate explanation', async () => {
        render(
            <VenueListingStatsPanel
                locale="es"
                listings={LISTINGS}
                unlockingPlanName="Pro"
            />
        );
        expect(await screen.findByTestId('venue-stats-daily-views')).toBeInTheDocument();
        expect(
            screen.getByText('De cada 100 visitas, cuántas tocaron algún contacto.')
        ).toBeVisible();
        expect(screen.getByText('phone')).toBeVisible();
        expect(screen.getByText('map')).toBeVisible();
    });

    it('loads the selected venue and window after user changes', async () => {
        render(
            <VenueListingStatsPanel
                locale="es"
                listings={LISTINGS}
                unlockingPlanName="Pro"
            />
        );
        await screen.findByTestId('venue-stats-daily-views');
        fireEvent.change(screen.getByLabelText('Local'), { target: { value: 'venue-2' } });
        fireEvent.click(screen.getByRole('button', { name: '90 días' }));
        await waitFor(() =>
            expect(mockGetVenueStats).toHaveBeenLastCalledWith({ id: 'venue-2', window: '90d' })
        );
    });

    it('renders an error for failures other than the entitlement gate', async () => {
        mockGetVenueStats.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'error' }
        });
        render(
            <VenueListingStatsPanel
                locale="es"
                listings={[LISTINGS[0]!]}
                unlockingPlanName="Pro"
            />
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No pudimos cargar las métricas'
        );
    });
});
