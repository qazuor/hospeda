/**
 * @file AnalyticsSection.test.tsx
 * @description Tests for AnalyticsSection — container component that handles
 * entitlement gating, parallel data fetching, and renders the wired analytics
 * widgets or a locked state.
 *
 * SPEC-207 Fase A: daily-series endpoint is now fetched alongside getViews.
 * Both are gated by view_basic_stats and re-fetched on window toggle.
 * Favorites widget remains gated by view_advanced_stats (SPEC-207 Fase B).
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
const mockGetResponseRate = vi.fn();
const mockGetInquiryTrend = vi.fn();
const mockGetMarketComparison = vi.fn();
const mockGetViews = vi.fn();
const mockListOwnAccommodations = vi.fn();
const mockGetFavoritesBreakdown = vi.fn();
const mockGetViewsDailySeries = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
    get billingApi() {
        return { getEntitlements: mockGetEntitlements };
    },
    get hostAnalyticsApi() {
        return {
            getResponseRate: mockGetResponseRate,
            getInquiryTrend: mockGetInquiryTrend,
            getMarketComparison: mockGetMarketComparison,
            getViews: mockGetViews,
            listOwnAccommodations: mockListOwnAccommodations,
            getFavoritesBreakdown: mockGetFavoritesBreakdown,
            getViewsDailySeries: mockGetViewsDailySeries
        };
    }
}));

// Import component AFTER mock setup (vitest handles hoisting)
import { AnalyticsSection } from '../../../src/components/host/AnalyticsSection.client';

/** Stub all wired endpoints with empty-but-ok payloads. */
function stubWiredEndpoints(): void {
    mockGetResponseRate.mockResolvedValue({
        ok: true,
        data: { responseRatePct: 85, avgResponseTimeMinutes: 12 }
    });
    mockGetInquiryTrend.mockResolvedValue({ ok: true, data: { months: [] } });
    mockGetMarketComparison.mockResolvedValue({ ok: true, data: { comparisons: [] } });
    mockGetViews.mockResolvedValue({
        ok: true,
        data: [{ entityId: 'a1', unique: 2, total: 5 }]
    });
    mockListOwnAccommodations.mockResolvedValue({
        ok: true,
        data: { items: [{ id: 'a1', name: 'Casa Uno' }] }
    });
    mockGetFavoritesBreakdown.mockResolvedValue({
        ok: true,
        data: [{ accommodationId: 'a1', slug: 'casa-uno', bookmarkCount: 7 }]
    });
    mockGetViewsDailySeries.mockResolvedValue({
        ok: true,
        data: {
            window: '30d',
            items: [
                { date: '2026-05-17', total: 3 },
                { date: '2026-05-18', total: 0 }
            ]
        }
    });
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('AnalyticsSection', () => {
    it('renders loading skeleton while fetching entitlements', () => {
        mockGetEntitlements.mockReturnValue(new Promise(() => {})); // never resolves

        render(<AnalyticsSection locale="es" />);
        expect(screen.getByTestId('analytics-section-skeleton')).toBeInTheDocument();
    });

    it('renders locked state when basic-stats entitlement is absent', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: { entitlements: [], limits: {}, plan: null, asOf: '2026-01-01' }
        });

        render(<AnalyticsSection locale="es" />);
        const lockedTitle = await screen.findByText(/Estadísticas disponibles/i);
        expect(lockedTitle).toBeInTheDocument();
    });

    it('renders the wired widgets with basic + advanced entitlements', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats', 'view_advanced_stats'],
                limits: {},
                plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        // Views widget and Favorites widget both show the accommodation name (appears twice now)
        expect((await screen.findAllByText('Casa Uno')).length).toBeGreaterThanOrEqual(1);
        expect((await screen.findAllByText(/Tiempo de respuesta/i)).length).toBeGreaterThanOrEqual(
            1
        );
        expect((await screen.findAllByText(/Consultas/i)).length).toBeGreaterThanOrEqual(1);
        expect(
            (await screen.findAllByText(/Comparación de mercado/i)).length
        ).toBeGreaterThanOrEqual(1);
    });

    it('hides the market widget when the advanced-stats entitlement is absent', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats'],
                limits: {},
                plan: { slug: 'owner-basico', name: 'Owner Básico', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        // Basic widgets render…
        await screen.findAllByText(/Tiempo de respuesta/i);
        // …and the advanced market widget is not fetched nor rendered.
        expect(screen.queryByText(/Comparación de mercado/i)).not.toBeInTheDocument();
        expect(mockGetMarketComparison).not.toHaveBeenCalled();
    });

    it('mounts both Views and Favorites widgets when view_advanced_stats is present (SPEC-207)', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats', 'view_advanced_stats'],
                limits: {},
                plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        // Views widget is mounted — the title should be visible
        expect(await screen.findByText(/Vistas/i)).toBeInTheDocument();
        // Favorites is now mounted too (SPEC-207 Fase B)
        expect(await screen.findByText(/Favoritos/i)).toBeInTheDocument();
        // The favorites API was called
        expect(mockGetFavoritesBreakdown).toHaveBeenCalled();
    });

    it('hides Favorites widget and does not call getFavoritesBreakdown when view_advanced_stats is absent', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats'],
                limits: {},
                plan: { slug: 'owner-basico', name: 'Owner Básico', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        // Basic widgets render…
        await screen.findAllByText(/Tiempo de respuesta/i);
        // …and the favorites widget is not rendered
        expect(screen.queryByText(/Favoritos/i)).not.toBeInTheDocument();
        // …and the endpoint was never called
        expect(mockGetFavoritesBreakdown).not.toHaveBeenCalled();
    });

    it('shows section title when entitlement is present', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats'],
                limits: {},
                plan: { slug: 'owner-basico', name: 'Owner Básico', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        const sectionTitle = await screen.findByText(/Estadísticas/i);
        expect(sectionTitle).toBeInTheDocument();
    });

    // ── SPEC-207 Fase A: daily-series fetch ─────────────────────────────

    it('calls getViewsDailySeries on mount when view_basic_stats is present', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats'],
                limits: {},
                plan: { slug: 'owner-basico', name: 'Owner Básico', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);
        await screen.findAllByText(/Tiempo de respuesta/i);

        expect(mockGetViewsDailySeries).toHaveBeenCalledOnce();
        expect(mockGetViewsDailySeries).toHaveBeenCalledWith({ window: '30d' });
    });

    it('does NOT call getViewsDailySeries when view_basic_stats is absent', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: { entitlements: [], limits: {}, plan: null, asOf: '2026-01-01' }
        });

        render(<AnalyticsSection locale="es" />);
        await screen.findByText(/Estadísticas disponibles/i);

        expect(mockGetViewsDailySeries).not.toHaveBeenCalled();
    });

    it('passes dailySeries data to ViewsWidget (smoke: Views title visible)', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats'],
                limits: {},
                plan: { slug: 'owner-basico', name: 'Owner Básico', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        // Views widget renders (the daily-series is wired internally in ViewsWidget)
        expect(await screen.findByText(/Vistas/i)).toBeInTheDocument();
        expect(mockGetViewsDailySeries).toHaveBeenCalled();
    });

    it('favorites tests still pass: favorites API called with advanced stats', async () => {
        mockGetEntitlements.mockResolvedValue({
            ok: true,
            data: {
                entitlements: ['view_basic_stats', 'view_advanced_stats'],
                limits: {},
                plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' },
                asOf: '2026-01-01'
            }
        });
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        await screen.findByText(/Favoritos/i);
        expect(mockGetFavoritesBreakdown).toHaveBeenCalled();
        // Daily series also called
        expect(mockGetViewsDailySeries).toHaveBeenCalled();
    });
});
