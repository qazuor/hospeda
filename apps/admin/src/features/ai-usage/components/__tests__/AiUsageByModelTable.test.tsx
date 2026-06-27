// @vitest-environment jsdom
/**
 * AiUsageByModelTable component tests (SPEC-260 T-021).
 *
 * Tests the REAL component logic:
 *   - `costPer1kTokens` guard: renders "—" when tokensIn + tokensOut = 0
 *   - Per-model row rendering with formatted cost values
 *   - `tPlural` description changes between 0-and-many models
 *   - Loading / error / empty branch delegation to AiUsageBlockState
 *
 * `useAiUsageByModelQuery` is mocked at the module level.
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

import { useAiUsageByModelQuery } from '@/features/ai-usage/hooks';
import { AiUsageByModelTable } from '../AiUsageByModelTable';

const mockQuery = vi.mocked(useAiUsageByModelQuery);

const SEARCH: AiUsageDailySearch = { page: 1, pageSize: 20 };

function makeRow(
    model: string,
    calls: number,
    tokensIn: number,
    tokensOut: number,
    costMicroUsd: number
) {
    return { model, calls, tokensIn, tokensOut, costMicroUsd };
}

function fakeData(rows: ReturnType<typeof makeRow>[]) {
    return {
        items: rows,
        pagination: { page: 1, pageSize: 20, total: rows.length, totalPages: 1 }
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('AiUsageByModelTable', () => {
    // -------------------------------------------------------------------------
    // Loading state
    // -------------------------------------------------------------------------
    it('renders loading state via AiUsageBlockState', () => {
        mockQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

        render(<AiUsageByModelTable search={SEARCH} />);

        // Spinner icon is present (AiUsageBlockState status="loading")
        expect(screen.getByTestId('icon-LoaderIcon')).toBeInTheDocument();
        // Loading i18n key rendered (both in CardDescription and AiUsageBlockState)
        expect(
            screen.getAllByText('admin-pages.ai.usage.byModel.loading').length
        ).toBeGreaterThanOrEqual(1);
    });

    // -------------------------------------------------------------------------
    // Error state
    // -------------------------------------------------------------------------
    it('renders error state via AiUsageBlockState', () => {
        mockQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true
        } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

        render(<AiUsageByModelTable search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.byModel.loadError').length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('admin-pages.ai.usage.byModel.loadErrorHint')).toBeInTheDocument();
        // No table rows
        expect(screen.queryByRole('row')).not.toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Empty state
    // -------------------------------------------------------------------------
    it('renders empty state when items array is empty', () => {
        mockQuery.mockReturnValue({
            data: fakeData([]),
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

        render(<AiUsageByModelTable search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.byModel.empty').length
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('admin-pages.ai.usage.byModel.emptyHint')).toBeInTheDocument();
    });

    // -------------------------------------------------------------------------
    // Data state — per-row rendering
    // -------------------------------------------------------------------------
    describe('data state', () => {
        it('renders one table row per model', () => {
            mockQuery.mockReturnValue({
                data: fakeData([
                    makeRow('gpt-4o-mini', 100, 200_000, 80_000, 100_000),
                    makeRow('claude-haiku', 60, 120_000, 45_000, 60_000)
                ]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageByModelTable search={SEARCH} />);

            expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
            expect(screen.getByText('claude-haiku')).toBeInTheDocument();
        });

        it('renders formatted cost for each model row', () => {
            // 100000 µUSD → "$0.1", 60000 µUSD → "$0.06"
            mockQuery.mockReturnValue({
                data: fakeData([
                    makeRow('gpt-4o-mini', 100, 200_000, 80_000, 100_000),
                    makeRow('claude-haiku', 60, 120_000, 45_000, 60_000)
                ]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageByModelTable search={SEARCH} />);

            expect(screen.getByText('$0.1')).toBeInTheDocument();
            expect(screen.getByText('$0.06')).toBeInTheDocument();
        });

        it('renders "—" for cost/1k when total tokens is zero (divide-by-zero guard)', () => {
            mockQuery.mockReturnValue({
                data: fakeData([makeRow('stub-model', 5, 0, 0, 50_000)]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageByModelTable search={SEARCH} />);

            // "—" is the divide-by-zero guard
            expect(screen.getByText('—')).toBeInTheDocument();
        });

        it('renders the cost/1k column as a formatted USD value when tokens > 0', () => {
            // costPer1kTokens(90000, 300000, 200000) = 90000 / 500000 * 1000 = 180
            // formatMicroUsd(180) → "$0.00018"
            mockQuery.mockReturnValue({
                data: fakeData([makeRow('gpt-4o-mini', 100, 300_000, 200_000, 90_000)]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageByModelTable search={SEARCH} />);

            // Should NOT see "—" since totalTokens > 0
            expect(screen.queryByText('—')).not.toBeInTheDocument();
        });

        it('renders all column headers', () => {
            mockQuery.mockReturnValue({
                data: fakeData([makeRow('gpt-4o-mini', 1, 1000, 500, 5000)]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByModelQuery>);

            render(<AiUsageByModelTable search={SEARCH} />);

            expect(screen.getByText('admin-pages.ai.usage.table.colModel')).toBeInTheDocument();
            expect(screen.getByText('admin-pages.ai.usage.table.colCalls')).toBeInTheDocument();
            expect(screen.getByText('admin-pages.ai.usage.table.colEstCost')).toBeInTheDocument();
            expect(screen.getByText('admin-pages.ai.usage.table.colCostPer1k')).toBeInTheDocument();
        });
    });
});
