// @vitest-environment jsdom
/**
 * Smoke tests for AiUsageFeatureModelChart and AiUsageDailyChart (SPEC-260 T-021).
 *
 * Recharts renders to SVG in jsdom. Full SVG geometry assertions are brittle
 * and not valuable — these tests instead verify:
 *   - Card titles and descriptions render (the i18n key strings)
 *   - Loading / error / empty states delegate to AiUsageBlockState correctly
 *   - With real data, the card title is present and no error state is shown
 *
 * `useAiUsageByFeatureModelQuery` and `useAiUsageDailyQuery` are mocked per test.
 * `useTranslations` → globally mocked: `t: (key) => key`, `tPlural: (key) => key`.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiUsageDailySearch } from '../../types';

vi.mock('@/features/ai-usage/hooks', () => ({
    useAiUsageByModelQuery: vi.fn(),
    useAiUsageByProviderQuery: vi.fn(),
    useAiUsageByFeatureModelQuery: vi.fn(),
    useAiUsageDailyQuery: vi.fn()
}));

// Recharts uses ResizeObserver + SVG APIs not available in jsdom.
// Mock the charting primitives so render does not throw.
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="recharts-container">{children}</div>
    ),
    BarChart: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="bar-chart">{children}</div>
    ),
    Bar: () => null,
    AreaChart: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="area-chart">{children}</div>
    ),
    Area: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null
}));

import { useAiUsageByFeatureModelQuery, useAiUsageDailyQuery } from '@/features/ai-usage/hooks';
import { AiUsageDailyChart } from '../AiUsageDailyChart';
import { AiUsageFeatureModelChart } from '../AiUsageFeatureModelChart';

const mockFeatureModelQuery = vi.mocked(useAiUsageByFeatureModelQuery);
const mockDailyQuery = vi.mocked(useAiUsageDailyQuery);

const SEARCH: AiUsageDailySearch = { page: 1, pageSize: 20 };

function fakeFeatureModelData(items: object[]) {
    return {
        items,
        pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 }
    };
}

function fakeDailyData(items: object[]) {
    return {
        items,
        pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 }
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AiUsageFeatureModelChart
// ---------------------------------------------------------------------------
describe('AiUsageFeatureModelChart', () => {
    it('renders loading state (spinner + loading title in description)', () => {
        mockFeatureModelQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

        render(<AiUsageFeatureModelChart search={SEARCH} />);

        expect(screen.getByTestId('icon-LoaderIcon')).toBeInTheDocument();
        expect(
            screen.getAllByText('admin-pages.ai.usage.featureModel.chartLoading').length
        ).toBeGreaterThanOrEqual(1);
    });

    it('renders error state with error and hint keys', () => {
        mockFeatureModelQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true
        } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

        render(<AiUsageFeatureModelChart search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.featureModel.chartLoadError').length
        ).toBeGreaterThanOrEqual(1);
        expect(
            screen.getByText('admin-pages.ai.usage.featureModel.loadErrorHint')
        ).toBeInTheDocument();
    });

    it('renders empty state when items array is empty', () => {
        mockFeatureModelQuery.mockReturnValue({
            data: fakeFeatureModelData([]),
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

        render(<AiUsageFeatureModelChart search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.featureModel.chartEmpty').length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('admin-pages.ai.usage.featureModel.emptyHint')).toBeInTheDocument();
    });

    it('renders card title and chart container when data is present', () => {
        mockFeatureModelQuery.mockReturnValue({
            data: fakeFeatureModelData([
                {
                    feature: 'chat',
                    model: 'gpt-4o-mini',
                    calls: 100,
                    tokensIn: 200_000,
                    tokensOut: 80_000,
                    costMicroUsd: 100_000
                }
            ]),
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

        render(<AiUsageFeatureModelChart search={SEARCH} />);

        // Card title always renders
        expect(
            screen.getByText('admin-pages.ai.usage.featureModel.chartTitle')
        ).toBeInTheDocument();
        // Chart container rendered (not an error/empty state)
        expect(screen.getByTestId('recharts-container')).toBeInTheDocument();
        // Error state NOT shown
        expect(
            screen.queryByText('admin-pages.ai.usage.featureModel.chartLoadError')
        ).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// AiUsageDailyChart
// ---------------------------------------------------------------------------
describe('AiUsageDailyChart', () => {
    it('renders loading state (spinner icon present)', () => {
        mockDailyQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageDailyQuery>);

        render(<AiUsageDailyChart search={SEARCH} />);

        expect(screen.getByTestId('icon-LoaderIcon')).toBeInTheDocument();
    });

    it('renders error state with error and hint keys', () => {
        mockDailyQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true
        } as unknown as ReturnType<typeof useAiUsageDailyQuery>);

        render(<AiUsageDailyChart search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.daily.loadError').length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('admin-pages.ai.usage.daily.loadErrorHint')).toBeInTheDocument();
    });

    it('renders empty state when items array is empty', () => {
        mockDailyQuery.mockReturnValue({
            data: fakeDailyData([]),
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageDailyQuery>);

        render(<AiUsageDailyChart search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.daily.empty').length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('admin-pages.ai.usage.daily.emptyHint')).toBeInTheDocument();
    });

    it('renders card title and chart container when data is present', () => {
        mockDailyQuery.mockReturnValue({
            data: fakeDailyData([
                {
                    day: '2026-06-10',
                    calls: 160,
                    tokensIn: 320_000,
                    tokensOut: 125_000,
                    costMicroUsd: 160_000
                },
                {
                    day: '2026-06-11',
                    calls: 80,
                    tokensIn: 160_000,
                    tokensOut: 65_000,
                    costMicroUsd: 160_000
                }
            ]),
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageDailyQuery>);

        render(<AiUsageDailyChart search={SEARCH} />);

        // Card title renders
        expect(screen.getByText('admin-pages.ai.usage.daily.title')).toBeInTheDocument();
        // Chart container renders (recharts mock)
        expect(screen.getByTestId('recharts-container')).toBeInTheDocument();
        // Error state NOT present
        expect(screen.queryByText('admin-pages.ai.usage.daily.loadError')).not.toBeInTheDocument();
    });

    it('does NOT render truncation notice when total <= pageSize', () => {
        // 2 rows, total=2, pageSize=100 → no truncation
        mockDailyQuery.mockReturnValue({
            data: fakeDailyData([
                { day: '2026-06-10', calls: 10, tokensIn: 1000, tokensOut: 500, costMicroUsd: 100 }
            ]),
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageDailyQuery>);

        render(<AiUsageDailyChart search={SEARCH} />);

        expect(
            screen.queryByText('admin-pages.ai.usage.daily.truncationNotice')
        ).not.toBeInTheDocument();
    });
});
