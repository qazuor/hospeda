/**
 * @file AnalyticsSection.test.tsx
 * @description Tests for AnalyticsSection — container component that handles
 * entitlement gating, parallel data fetching, and renders the wired analytics
 * widgets or a locked state.
 *
 * SPEC-207 status: Views and Favorites widgets are deferred (no backend
 * daily-series endpoint; favorites needs redesign), so only Response Rate +
 * Inquiry Trend (VIEW_BASIC_STATS) and Market Comparison (VIEW_ADVANCED_STATS)
 * are mounted here.
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

vi.mock('@/lib/api/endpoints-protected', () => ({
    get billingApi() {
        return { getEntitlements: mockGetEntitlements };
    },
    get hostAnalyticsApi() {
        return {
            getResponseRate: mockGetResponseRate,
            getInquiryTrend: mockGetInquiryTrend,
            getMarketComparison: mockGetMarketComparison
        };
    }
}));

// Import component AFTER mock setup (vitest handles hoisting)
import { AnalyticsSection } from '../../../src/components/host/AnalyticsSection.client';

/** Stub the three wired endpoints with empty-but-ok payloads. */
function stubWiredEndpoints(): void {
    mockGetResponseRate.mockResolvedValue({
        ok: true,
        data: { responseRatePct: 85, avgResponseTimeMinutes: 12 }
    });
    mockGetInquiryTrend.mockResolvedValue({ ok: true, data: { months: [] } });
    mockGetMarketComparison.mockResolvedValue({ ok: true, data: { comparisons: [] } });
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

    it('does not mount the deferred Views and Favorites widgets (SPEC-207)', async () => {
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

        await screen.findAllByText(/Tiempo de respuesta/i);
        expect(screen.queryByText(/Vistas/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Favoritos/i)).not.toBeInTheDocument();
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
});
