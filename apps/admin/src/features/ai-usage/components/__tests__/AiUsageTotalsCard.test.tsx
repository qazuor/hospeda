// @vitest-environment jsdom
/**
 * AiUsageTotalsCard component tests (SPEC-260 T-021).
 *
 * Covers:
 *   - Loading state → 4 skeleton cards with animated pulse divs (no metric values)
 *   - Error state → error block with AiUsageBlockState status="error"
 *   - Data state → real `sumByModelRows` logic: asserts the 4 summed metric values
 *     are formatted and rendered correctly (calls, tokensIn, tokensOut, cost).
 *
 * The hook `useAiUsageByModelQuery` is mocked at the module level so each test
 * controls `{ data, isLoading, isError }`.
 *
 * `useTranslations` is mocked globally (test/setup.tsx): `t: (key) => key`.
 * `@repo/icons` is mocked globally: all icons → `<span data-testid="icon-Name" />`.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiUsageDailySearch } from '../../types';

// ---------------------------------------------------------------------------
// Mock the hooks module so each test controls query state
// ---------------------------------------------------------------------------
vi.mock('@/features/ai-usage/hooks', () => ({
    useAiUsageByModelQuery: vi.fn(),
    useAiUsageByProviderQuery: vi.fn(),
    useAiUsageByFeatureModelQuery: vi.fn(),
    useAiUsageDailyQuery: vi.fn()
}));

import { useAiUsageByModelQuery } from '@/features/ai-usage/hooks';
import { AiUsageTotalsCard } from '../AiUsageTotalsCard';

const mockUseAiUsageByModelQuery = vi.mocked(useAiUsageByModelQuery);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SEARCH: AiUsageDailySearch = { page: 1, pageSize: 20 };

/**
 * Two model rows. Real component calls `sumByModelRows` on these:
 *   calls:       100 + 60 = 160
 *   tokensIn:    200000 + 120000 = 320000
 *   tokensOut:   80000 + 45000 = 125000
 *   costMicroUsd: 100000 + 60000 = 160000  → formatMicroUsd(160000) = "$0.16"
 */
const MODEL_ROWS = [
    {
        model: 'gpt-4o-mini',
        calls: 100,
        tokensIn: 200_000,
        tokensOut: 80_000,
        costMicroUsd: 100_000
    },
    {
        model: 'claude-haiku',
        calls: 60,
        tokensIn: 120_000,
        tokensOut: 45_000,
        costMicroUsd: 60_000
    }
] as const;

const PAGINATED_RESPONSE = {
    items: MODEL_ROWS,
    pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 }
};

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('AiUsageTotalsCard', () => {
    // -------------------------------------------------------------------------
    // Loading state
    // -------------------------------------------------------------------------
    describe('loading state', () => {
        it('renders 4 skeleton cards with animate-pulse elements', () => {
            mockUseAiUsageByModelQuery.mockReturnValue({
                data: undefined,
                isLoading: true,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            const { container } = render(<AiUsageTotalsCard search={SEARCH} />);

            // 4 pulse elements (one per metric skeleton)
            const pulseEls = container.querySelectorAll('.animate-pulse');
            // Each skeleton card has 2 pulse divs (label + value) → 8 total
            expect(pulseEls.length).toBeGreaterThanOrEqual(4);
        });

        it('does NOT render metric values in loading state', () => {
            mockUseAiUsageByModelQuery.mockReturnValue({
                data: undefined,
                isLoading: true,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageTotalsCard search={SEARCH} />);

            // No translated i18n key strings should appear (they only render when data is present)
            expect(screen.queryByText('admin-pages.ai.usage.totals.title')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Error state
    // -------------------------------------------------------------------------
    describe('error state', () => {
        it('renders the error block with the i18n error key as title', () => {
            mockUseAiUsageByModelQuery.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: true
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageTotalsCard search={SEARCH} />);

            // AiUsageBlockState is rendered with status="error"
            // t() returns key as-is → assertion matches i18n key string
            expect(screen.getByText('admin-pages.ai.usage.totals.loadError')).toBeInTheDocument();
            expect(
                screen.getByText('admin-pages.ai.usage.totals.loadErrorHint')
            ).toBeInTheDocument();
        });

        it('does NOT render metric cards in error state', () => {
            mockUseAiUsageByModelQuery.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: true
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageTotalsCard search={SEARCH} />);

            // No metric value card title rendered
            expect(screen.queryByText('admin-pages.ai.usage.totals.title')).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Data state — tests the real sumByModelRows aggregation logic
    // -------------------------------------------------------------------------
    describe('data state', () => {
        beforeEach(() => {
            mockUseAiUsageByModelQuery.mockReturnValue({
                data: PAGINATED_RESPONSE,
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);
        });

        it('renders the summed calls total (160)', () => {
            render(<AiUsageTotalsCard search={SEARCH} />);
            // 100 + 60 = 160; toLocaleString in jsdom defaults to "160"
            expect(screen.getByText('160')).toBeInTheDocument();
        });

        it('renders the summed tokensIn total (320,000)', () => {
            render(<AiUsageTotalsCard search={SEARCH} />);
            // 200000 + 120000 = 320000; toLocaleString → "320,000"
            expect(screen.getByText('320,000')).toBeInTheDocument();
        });

        it('renders the summed tokensOut total (125,000)', () => {
            render(<AiUsageTotalsCard search={SEARCH} />);
            // 80000 + 45000 = 125000; toLocaleString → "125,000"
            expect(screen.getByText('125,000')).toBeInTheDocument();
        });

        it('renders the summed cost formatted as USD ($0.16)', () => {
            render(<AiUsageTotalsCard search={SEARCH} />);
            // 100000 + 60000 = 160000 µUSD → formatMicroUsd(160000) = "$0.16"
            expect(screen.getByText('$0.16')).toBeInTheDocument();
        });

        it('renders all four metric card label keys', () => {
            render(<AiUsageTotalsCard search={SEARCH} />);
            expect(screen.getByText('admin-pages.ai.usage.totals.title')).toBeInTheDocument();
            expect(screen.getByText('admin-pages.ai.usage.totals.tokensIn')).toBeInTheDocument();
            expect(screen.getByText('admin-pages.ai.usage.totals.tokensOut')).toBeInTheDocument();
            expect(screen.getByText('admin-pages.ai.usage.totals.estCost')).toBeInTheDocument();
        });
    });
});
