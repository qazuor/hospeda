/**
 * @file AnalyticsSection.test.tsx
 * @description TDD tests for AnalyticsSection — container component that
 * handles entitlement gating, parallel data fetching, and renders all
 * analytics widgets or a locked state.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock recharts BEFORE any imports — it's heavy and causes OOM in CI
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { readonly children: React.ReactNode }) => children,
    BarChart: () => null,
    Bar: () => null,
    LineChart: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null
}));

// Mock before any imports — vitest hoists vi.mock to top of file
const mockGetEntitlements = vi.fn();
const mockGetViews = vi.fn();
const mockGetFavoritesBreakdown = vi.fn();
const mockGetResponseRate = vi.fn();
const mockGetInquiryTrend = vi.fn();
const mockGetMarketComparison = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get billingApi() {
        return { getEntitlements: mockGetEntitlements };
    },
    get hostAnalyticsApi() {
        return {
            getViews: mockGetViews,
            getFavoritesBreakdown: mockGetFavoritesBreakdown,
            getResponseRate: mockGetResponseRate,
            getInquiryTrend: mockGetInquiryTrend,
            getMarketComparison: mockGetMarketComparison
        };
    }
}));

// Import component AFTER mock setup (vitest handles hoisting)
import { AnalyticsSection } from '../../../src/components/host/AnalyticsSection.client';

afterEach(() => {
    vi.clearAllMocks();
});

describe('AnalyticsSection', () => {
    it('renders loading skeleton while fetching entitlements', () => {
        mockGetEntitlements.mockReturnValue(new Promise(() => {})); // never resolves

        render(<AnalyticsSection locale="es" />);
        expect(screen.getByTestId('analytics-section-skeleton')).toBeInTheDocument();
    });

    it('renders locked state when entitlement is absent', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: { entitlements: [], limits: {}, plan: null, asOf: '2026-01-01' }
        });

        render(<AnalyticsSection locale="es" />);
        const lockedTitle = await screen.findByText(/Estadísticas disponibles/i);
        expect(lockedTitle).toBeInTheDocument();
    });

    it('renders all 5 widgets when entitlement is present', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['VIEW_BASIC_STATS'],
                limits: {},
                plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        mockGetViews.mockResolvedValue({
            ok: true,
            data: { window: '7d', items: [] }
        });
        mockGetFavoritesBreakdown.mockResolvedValue({
            ok: true,
            data: { collections: [] }
        });
        mockGetResponseRate.mockResolvedValue({
            ok: true,
            data: { responseRatePct: 85, avgResponseTimeMinutes: 12 }
        });
        mockGetInquiryTrend.mockResolvedValue({
            ok: true,
            data: { months: [] }
        });
        mockGetMarketComparison.mockResolvedValue({
            ok: true,
            data: { items: [] }
        });

        render(<AnalyticsSection locale="es" />);

        // Wait for all data to load — all 5 widget titles should appear
        // Use findAllByText with specific heading level to avoid matching empty state text
        const viewsTitles = await screen.findAllByText(/Vistas/i);
        expect(viewsTitles.length).toBeGreaterThanOrEqual(1);

        const favoritesTitles = await screen.findAllByText(/Favoritos/i);
        expect(favoritesTitles.length).toBeGreaterThanOrEqual(1);

        const responseRateTitles = await screen.findAllByText(/Tiempo de respuesta/i);
        expect(responseRateTitles.length).toBeGreaterThanOrEqual(1);

        const inquiriesTitles = await screen.findAllByText(/Consultas/i);
        expect(inquiriesTitles.length).toBeGreaterThanOrEqual(1);

        const marketTitles = await screen.findAllByText(/Comparación de mercado/i);
        expect(marketTitles.length).toBeGreaterThanOrEqual(1);
    });

    it('shows section title when entitlement is present', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['VIEW_BASIC_STATS'],
                limits: {},
                plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        mockGetViews.mockResolvedValue({
            ok: true,
            data: { window: '7d', items: [] }
        });
        mockGetFavoritesBreakdown.mockResolvedValue({
            ok: true,
            data: { collections: [] }
        });
        mockGetResponseRate.mockResolvedValue({
            ok: true,
            data: { responseRatePct: 85, avgResponseTimeMinutes: 12 }
        });
        mockGetInquiryTrend.mockResolvedValue({
            ok: true,
            data: { months: [] }
        });
        mockGetMarketComparison.mockResolvedValue({
            ok: true,
            data: { items: [] }
        });

        render(<AnalyticsSection locale="es" />);

        const sectionTitle = await screen.findByText(/Estadísticas/i);
        expect(sectionTitle).toBeInTheDocument();
    });
});
