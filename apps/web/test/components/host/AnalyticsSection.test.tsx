/**
 * @file AnalyticsSection.test.tsx
 * @description TDD tests for AnalyticsSection — container component that
 * handles entitlement gating, parallel data fetching, and renders all
 * analytics widgets or a locked state.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
        const viewsTitle = await screen.findByText(/Vistas/i);
        expect(viewsTitle).toBeInTheDocument();

        expect(screen.getByText(/Favoritos/i)).toBeInTheDocument();
        expect(screen.getByText(/Tiempo de respuesta/i)).toBeInTheDocument();
        expect(screen.getByText(/Consultas/i)).toBeInTheDocument();
        expect(screen.getByText(/Comparación de mercado/i)).toBeInTheDocument();
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
