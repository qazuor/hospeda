// @vitest-environment jsdom
/**
 * AiUsageByFeatureTable component tests (SPEC-260 T-021).
 *
 * The key real logic under test here is `groupByFeature`:
 *   - Feature×model rows sharing the same `feature` are grouped and their
 *     metrics are summed.
 *   - Result is sorted by costMicroUsd DESC.
 *
 * The component consumes `useAiUsageByFeatureModelQuery` (not a separate endpoint)
 * and performs the group-by client-side. This test verifies that aggregation
 * is visible in the rendered output.
 *
 * `useAiUsageByFeatureModelQuery` is mocked at the module level.
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

import { useAiUsageByFeatureModelQuery } from '@/features/ai-usage/hooks';
import { AiUsageByFeatureTable } from '../AiUsageByFeatureTable';

const mockQuery = vi.mocked(useAiUsageByFeatureModelQuery);

const SEARCH: AiUsageDailySearch = { page: 1, pageSize: 20 };

function fakeData(items: object[]) {
    return {
        items,
        pagination: { page: 1, pageSize: 100, total: items.length, totalPages: 1 }
    };
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('AiUsageByFeatureTable', () => {
    // -------------------------------------------------------------------------
    // States
    // -------------------------------------------------------------------------
    it('renders loading state (spinner icon present)', () => {
        mockQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

        render(<AiUsageByFeatureTable search={SEARCH} />);

        expect(screen.getByTestId('icon-LoaderIcon')).toBeInTheDocument();
    });

    it('renders error state with error and hint keys', () => {
        mockQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true
        } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

        render(<AiUsageByFeatureTable search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.byFeature.loadError').length
        ).toBeGreaterThanOrEqual(1);
        expect(
            screen.getByText('admin-pages.ai.usage.byFeature.loadErrorHint')
        ).toBeInTheDocument();
    });

    it('renders empty state when items array is empty', () => {
        mockQuery.mockReturnValue({
            data: fakeData([]),
            isLoading: false,
            isError: false
        } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

        render(<AiUsageByFeatureTable search={SEARCH} />);

        // Key appears in both CardDescription and AiUsageBlockState title
        expect(
            screen.getAllByText('admin-pages.ai.usage.byFeature.empty').length
        ).toBeGreaterThanOrEqual(1);
    });

    // -------------------------------------------------------------------------
    // groupByFeature logic — the real logic under test
    // -------------------------------------------------------------------------
    describe('groupByFeature aggregation', () => {
        it('aggregates two feature×model rows for the same feature into one table row', () => {
            // chat/gpt-4o-mini + chat/claude-haiku → one "chat" row
            mockQuery.mockReturnValue({
                data: fakeData([
                    {
                        feature: 'chat',
                        model: 'gpt-4o-mini',
                        calls: 100,
                        tokensIn: 200_000,
                        tokensOut: 80_000,
                        costMicroUsd: 100_000
                    },
                    {
                        feature: 'chat',
                        model: 'claude-haiku',
                        calls: 30,
                        tokensIn: 60_000,
                        tokensOut: 25_000,
                        costMicroUsd: 80_000
                    }
                ]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

            render(<AiUsageByFeatureTable search={SEARCH} />);

            // Only one "chat" row should be rendered (not two separate rows)
            const chatCells = screen.getAllByText('chat');
            expect(chatCells).toHaveLength(1);

            // Summed calls: 100 + 30 = 130
            expect(screen.getByText('130')).toBeInTheDocument();
            // Summed cost: 100000 + 80000 = 180000 µUSD → "$0.18"
            expect(screen.getByText('$0.18')).toBeInTheDocument();
        });

        it('renders separate rows for different features', () => {
            mockQuery.mockReturnValue({
                data: fakeData([
                    {
                        feature: 'chat',
                        model: 'gpt-4o-mini',
                        calls: 100,
                        tokensIn: 200_000,
                        tokensOut: 80_000,
                        costMicroUsd: 100_000
                    },
                    {
                        feature: 'text_improve',
                        model: 'gpt-4o-mini',
                        calls: 60,
                        tokensIn: 120_000,
                        tokensOut: 45_000,
                        costMicroUsd: 60_000
                    },
                    {
                        feature: 'search',
                        model: 'claude-haiku',
                        calls: 50,
                        tokensIn: 100_000,
                        tokensOut: 40_000,
                        costMicroUsd: 80_000
                    }
                ]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

            render(<AiUsageByFeatureTable search={SEARCH} />);

            expect(screen.getByText('chat')).toBeInTheDocument();
            expect(screen.getByText('text_improve')).toBeInTheDocument();
            expect(screen.getByText('search')).toBeInTheDocument();
        });

        it('sorts features by costMicroUsd DESC', () => {
            // chat → 100000 µUSD, text_improve → 60000, search → 80000
            // Expected render order: chat, search, text_improve
            mockQuery.mockReturnValue({
                data: fakeData([
                    {
                        feature: 'text_improve',
                        model: 'gpt-4o-mini',
                        calls: 60,
                        tokensIn: 120_000,
                        tokensOut: 45_000,
                        costMicroUsd: 60_000
                    },
                    {
                        feature: 'chat',
                        model: 'gpt-4o-mini',
                        calls: 100,
                        tokensIn: 200_000,
                        tokensOut: 80_000,
                        costMicroUsd: 100_000
                    },
                    {
                        feature: 'search',
                        model: 'claude-haiku',
                        calls: 50,
                        tokensIn: 100_000,
                        tokensOut: 40_000,
                        costMicroUsd: 80_000
                    }
                ]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

            render(<AiUsageByFeatureTable search={SEARCH} />);

            const cells = screen.getAllByRole('cell');
            // First data cell (first td of first row) should be the most expensive feature
            const firstFeatureCell = cells[0];
            expect(firstFeatureCell.textContent).toBe('chat');
        });

        it('renders correct per-feature totals when same feature appears across multiple models', () => {
            // search via haiku (80k µUSD) + search via gpt (40k µUSD) = 120k µUSD → "$0.12"
            mockQuery.mockReturnValue({
                data: fakeData([
                    {
                        feature: 'search',
                        model: 'claude-haiku',
                        calls: 50,
                        tokensIn: 100_000,
                        tokensOut: 40_000,
                        costMicroUsd: 80_000
                    },
                    {
                        feature: 'search',
                        model: 'gpt-4o-mini',
                        calls: 30,
                        tokensIn: 60_000,
                        tokensOut: 25_000,
                        costMicroUsd: 40_000
                    }
                ]),
                isLoading: false,
                isError: false
            } as unknown as ReturnType<typeof useAiUsageByFeatureModelQuery>);

            render(<AiUsageByFeatureTable search={SEARCH} />);

            // Only one "search" feature row
            expect(screen.getAllByText('search')).toHaveLength(1);
            // Summed calls: 50 + 30 = 80
            expect(screen.getByText('80')).toBeInTheDocument();
            // Summed cost: 80000 + 40000 = 120000 µUSD → "$0.12"
            expect(screen.getByText('$0.12')).toBeInTheDocument();
        });
    });
});
