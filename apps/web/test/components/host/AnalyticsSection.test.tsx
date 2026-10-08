/**
 * @file AnalyticsSection.test.tsx
 * @description Tests for AnalyticsSection — container component that fetches
 * the wired analytics endpoints in parallel and renders the widgets or a
 * locked state.
 *
 * HOS-1637 (AC:B13a:22): the section no longer pre-gates on the old billing's
 * entitlements. The API decides: a 403 on the basic views read renders the
 * locked state; a 403 on the market-comparison read hides the advanced
 * (market + favorites) widgets.
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
const mockGetResponseRate = vi.fn();
const mockGetInquiryTrend = vi.fn();
const mockGetMarketComparison = vi.fn();
const mockGetViews = vi.fn();
const mockListOwnAccommodations = vi.fn();
const mockGetFavoritesBreakdown = vi.fn();
const mockGetViewsDailySeries = vi.fn();

vi.mock('@/lib/api/endpoints-protected', () => ({
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

/** A 403 as the API client reports it. */
const FORBIDDEN = {
    ok: false,
    error: { status: 403, code: 'FORBIDDEN', message: 'Forbidden' }
} as const;

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

/** Basic reads granted, advanced reads refused by the API. */
function stubBasicOnly(): void {
    stubWiredEndpoints();
    mockGetMarketComparison.mockResolvedValue(FORBIDDEN);
    mockGetFavoritesBreakdown.mockResolvedValue(FORBIDDEN);
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('AnalyticsSection', () => {
    it('renders loading skeleton while fetching', () => {
        stubWiredEndpoints();
        mockGetViews.mockReturnValue(new Promise(() => {})); // never resolves

        render(<AnalyticsSection locale="es" />);
        expect(screen.getByTestId('analytics-section-skeleton')).toBeInTheDocument();
    });

    it('renders locked state when the API refuses the basic views read', async () => {
        stubWiredEndpoints();
        mockGetViews.mockResolvedValue(FORBIDDEN);

        render(<AnalyticsSection locale="es" />);
        const lockedTitle = await screen.findByText(/Estadísticas disponibles/i);
        expect(lockedTitle).toBeInTheDocument();
    });

    it('renders the wired widgets when every read is granted', async () => {
        stubWiredEndpoints();

        render(<AnalyticsSection locale="es" />);

        expect((await screen.findAllByText('Casa Uno')).length).toBeGreaterThanOrEqual(1);
        expect((await screen.findAllByText(/Tiempo de respuesta/i)).length).toBeGreaterThanOrEqual(
            1
        );
        expect((await screen.findAllByText(/Consultas/i)).length).toBeGreaterThanOrEqual(1);
        expect(
            (await screen.findAllByText(/Comparación de mercado/i)).length
        ).toBeGreaterThanOrEqual(1);
        expect(await screen.findByText(/Favoritos/i)).toBeInTheDocument();
    });

    it('hides the market and favorites widgets when the API refuses the advanced reads', async () => {
        stubBasicOnly();

        render(<AnalyticsSection locale="es" />);

        // Basic widgets render…
        await screen.findAllByText(/Tiempo de respuesta/i);
        // …and the advanced widgets do not.
        expect(screen.queryByText(/Comparación de mercado/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Favoritos/i)).not.toBeInTheDocument();
    });

    it('shows a widget error, not the locked state, when the views read fails for another reason', async () => {
        stubWiredEndpoints();
        mockGetViews.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'Error de vistas' }
        });

        render(<AnalyticsSection locale="es" />);

        await screen.findAllByText(/Tiempo de respuesta/i);
        expect(screen.queryByText(/Estadísticas disponibles/i)).not.toBeInTheDocument();
    });

    it('shows section title when the reads are granted', async () => {
        stubBasicOnly();

        render(<AnalyticsSection locale="es" />);

        const sectionTitle = await screen.findByText(/Estadísticas/i);
        expect(sectionTitle).toBeInTheDocument();
    });

    // ── SPEC-207 Fase A: daily-series fetch ─────────────────────────────

    it('calls getViewsDailySeries once on mount with the default window', async () => {
        stubBasicOnly();

        render(<AnalyticsSection locale="es" />);
        await screen.findAllByText(/Tiempo de respuesta/i);

        expect(mockGetViewsDailySeries).toHaveBeenCalledOnce();
        expect(mockGetViewsDailySeries).toHaveBeenCalledWith({ window: '30d' });
    });

    it('passes dailySeries data to ViewsWidget (smoke: Views title visible)', async () => {
        stubBasicOnly();

        render(<AnalyticsSection locale="es" />);

        expect(await screen.findByText(/Vistas/i)).toBeInTheDocument();
        expect(mockGetViewsDailySeries).toHaveBeenCalled();
    });
});
