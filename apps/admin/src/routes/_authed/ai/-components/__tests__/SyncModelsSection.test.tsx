// @vitest-environment jsdom
/**
 * Component tests for SyncModelsSection (HOS-94 T-011/T-012).
 *
 * Mocks `useSyncModelsMutation` (mirrors the mocking strategy used by the
 * sibling `social/credentials` dialog tests) and asserts on translation
 * KEYS (not localized copy) via an identity `t` mock, so the tests stay
 * stable across copy changes.
 *
 * Covers:
 * - Sync populates the list with source badges (detected/curated/both) and
 *   the count summary.
 * - Empty state when the sync result has zero models.
 * - Loading state while the mutation is pending.
 * - 400 (VALIDATION_ERROR) vs 503 (SERVICE_UNAVAILABLE) error rendering —
 *   503 shows a retry action, 400 does not.
 * - Toggling a model calls `onSelectedModelsChange` with the updated set.
 * - Auto-removal of denylisted ids on sync (owner follow-up, HOS-94): a
 *   previously-enabled id present in `result.hiddenModelIds` is dropped from
 *   the selection, while a hand-added custom id NOT in `hiddenModelIds`
 *   stays enabled.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/i18n', () => ({
    useTranslations: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params ? `${key}::${JSON.stringify(params)}` : key
    })
}));

vi.mock('@/features/ai-settings', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/features/ai-settings')>();
    return {
        ...actual,
        useSyncModelsMutation: vi.fn()
    };
});

import type { AiSyncModelsResult } from '@repo/schemas';
import { useSyncModelsMutation } from '@/features/ai-settings';
import { ApiError } from '@/lib/errors';
import { SyncModelsSection } from '../SyncModelsSection';

const mockUseSyncModelsMutation = vi.mocked(useSyncModelsMutation);

type MutationMock = ReturnType<typeof useSyncModelsMutation>;

function buildMutationMock(overrides: Partial<MutationMock> = {}): MutationMock {
    return {
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        data: undefined,
        error: null,
        isPending: false,
        isError: false,
        isSuccess: false,
        ...overrides
    } as unknown as MutationMock;
}

const baseProps = {
    providerId: 'openai',
    curatedModels: ['gpt-4o', 'gpt-4o-mini'],
    selectedModels: ['gpt-4o'],
    onSelectedModelsChange: vi.fn()
};

describe('SyncModelsSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the curated list before any sync', () => {
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock());

        render(<SyncModelsSection {...baseProps} />);

        expect(screen.getByText('gpt-4o')).toBeInTheDocument();
        expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
        // No source badges pre-sync.
        expect(screen.queryByText('admin-ai.credentials.syncModels.badgeDetected')).toBeNull();
    });

    it('shows a loading state while syncing', () => {
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ isPending: true }));

        render(<SyncModelsSection {...baseProps} />);

        expect(screen.getByText('admin-ai.credentials.syncModels.loading')).toBeInTheDocument();
    });

    it('renders the merged list with source badges and a count summary after sync', () => {
        const syncResult: AiSyncModelsResult = {
            providerId: 'openai',
            fetchedAt: new Date().toISOString(),
            models: [
                { id: 'gpt-4o', source: 'both' },
                { id: 'gpt-4o-mini', source: 'curated' },
                { id: 'gpt-5-preview', source: 'detected' },
                { id: 'gpt-oddball', source: 'detected', capabilityHint: 'uncertain' }
            ]
        };
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ data: syncResult }));

        render(<SyncModelsSection {...baseProps} />);

        // All four merged models render.
        expect(screen.getByText('gpt-4o')).toBeInTheDocument();
        expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
        expect(screen.getByText('gpt-5-preview')).toBeInTheDocument();
        expect(screen.getByText('gpt-oddball')).toBeInTheDocument();

        // Badges present per source.
        expect(screen.getByText('admin-ai.credentials.syncModels.badgeBoth')).toBeInTheDocument();
        expect(
            screen.getByText('admin-ai.credentials.syncModels.badgeCurated')
        ).toBeInTheDocument();
        expect(
            screen.getAllByText('admin-ai.credentials.syncModels.badgeDetected').length
        ).toBeGreaterThanOrEqual(2);

        // Uncertain chip flagged on the oddball model.
        expect(
            screen.getByText('admin-ai.credentials.syncModels.uncertainChip')
        ).toBeInTheDocument();

        // Count summary: detected = both|detected (3), new = detected-only (2).
        expect(
            screen.getByText('admin-ai.credentials.syncModels.summary::{"detected":3,"new":2}')
        ).toBeInTheDocument();
    });

    it('defaults newly-detected models to OFF while keeping previously-enabled models ON (HOS-94 owner adjustment)', () => {
        // `gpt-4o` was already enabled before this sync (via baseProps.selectedModels).
        // `gpt-4o-mini` (curated-only) and `gpt-5-preview` (detected-only) were never
        // enabled and must stay OFF even though the sync surfaces them.
        const syncResult: AiSyncModelsResult = {
            providerId: 'openai',
            fetchedAt: new Date().toISOString(),
            models: [
                { id: 'gpt-4o', source: 'both' },
                { id: 'gpt-4o-mini', source: 'curated' },
                { id: 'gpt-5-preview', source: 'detected' }
            ]
        };
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ data: syncResult }));

        render(
            <SyncModelsSection
                {...baseProps}
                selectedModels={['gpt-4o']}
            />
        );

        const enabledRow = screen.getByText('gpt-4o').closest('div.rounded-md') as HTMLElement;
        const curatedOnlyRow = screen
            .getByText('gpt-4o-mini')
            .closest('div.rounded-md') as HTMLElement;
        const detectedOnlyRow = screen
            .getByText('gpt-5-preview')
            .closest('div.rounded-md') as HTMLElement;

        expect(within(enabledRow).getByRole('switch')).toBeChecked();
        expect(within(curatedOnlyRow).getByRole('switch')).not.toBeChecked();
        expect(within(detectedOnlyRow).getByRole('switch')).not.toBeChecked();
    });

    it('turning on a newly-detected model after sync calls onSelectedModelsChange with it added', () => {
        const syncResult: AiSyncModelsResult = {
            providerId: 'openai',
            fetchedAt: new Date().toISOString(),
            models: [
                { id: 'gpt-4o', source: 'both' },
                { id: 'gpt-5-preview', source: 'detected' }
            ]
        };
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ data: syncResult }));
        const onSelectedModelsChange = vi.fn();

        render(
            <SyncModelsSection
                {...baseProps}
                selectedModels={['gpt-4o']}
                onSelectedModelsChange={onSelectedModelsChange}
            />
        );

        const detectedRow = screen
            .getByText('gpt-5-preview')
            .closest('div.rounded-md') as HTMLElement;
        fireEvent.click(within(detectedRow).getByRole('switch'));

        expect(onSelectedModelsChange).toHaveBeenCalledWith(['gpt-4o', 'gpt-5-preview']);
    });

    it('shows the empty state when the sync result has no models', () => {
        const syncResult: AiSyncModelsResult = {
            providerId: 'openai',
            fetchedAt: new Date().toISOString(),
            models: []
        };
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ data: syncResult }));

        render(<SyncModelsSection {...baseProps} />);

        expect(screen.getByText('admin-ai.credentials.syncModels.empty')).toBeInTheDocument();
    });

    it('renders the 400 (invalid key) error without a retry action', () => {
        const error = new ApiError('Invalid key', { status: 400, code: 'VALIDATION_ERROR' });
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ isError: true, error }));

        render(<SyncModelsSection {...baseProps} />);

        expect(
            screen.getByText('admin-ai.credentials.syncModels.error.invalidKey')
        ).toBeInTheDocument();
        expect(screen.queryByText('admin-ai.credentials.syncModels.error.retry')).toBeNull();
    });

    it('renders the 503 (provider unavailable) error WITH a retry action', () => {
        const error = new ApiError('Unavailable', { status: 503, code: 'SERVICE_UNAVAILABLE' });
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ isError: true, error }));

        render(<SyncModelsSection {...baseProps} />);

        expect(
            screen.getByText('admin-ai.credentials.syncModels.error.providerUnavailable')
        ).toBeInTheDocument();
        expect(screen.getByText('admin-ai.credentials.syncModels.error.retry')).toBeInTheDocument();
    });

    it('clicking retry re-triggers the sync mutation', () => {
        const error = new ApiError('Unavailable', { status: 503, code: 'SERVICE_UNAVAILABLE' });
        const mutate = vi.fn();
        mockUseSyncModelsMutation.mockReturnValue(
            buildMutationMock({ isError: true, error, mutate })
        );

        render(<SyncModelsSection {...baseProps} />);

        fireEvent.click(screen.getByText('admin-ai.credentials.syncModels.error.retry'));
        expect(mutate).toHaveBeenCalledWith('openai');
    });

    it('toggles a curated model on/off via onSelectedModelsChange', () => {
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock());
        const onSelectedModelsChange = vi.fn();

        render(
            <SyncModelsSection
                {...baseProps}
                selectedModels={['gpt-4o']}
                onSelectedModelsChange={onSelectedModelsChange}
            />
        );

        // gpt-4o-mini is not yet enabled — its switch toggles it on.
        const switches = screen.getAllByRole('switch');
        // Order matches curatedModels: [gpt-4o (enabled), gpt-4o-mini (disabled)]
        fireEvent.click(switches[1]);

        expect(onSelectedModelsChange).toHaveBeenCalledWith(['gpt-4o', 'gpt-4o-mini']);
    });

    it('adds a custom model id', () => {
        mockUseSyncModelsMutation.mockReturnValue(buildMutationMock());
        const onSelectedModelsChange = vi.fn();

        render(
            <SyncModelsSection
                {...baseProps}
                selectedModels={['gpt-4o']}
                onSelectedModelsChange={onSelectedModelsChange}
            />
        );

        const input = screen.getByPlaceholderText(
            'admin-ai.credentials.syncModels.addCustomPlaceholder'
        );
        fireEvent.change(input, { target: { value: 'my-custom-model' } });
        fireEvent.click(screen.getByText('admin-ai.credentials.syncModels.addButton'));

        expect(onSelectedModelsChange).toHaveBeenCalledWith(['gpt-4o', 'my-custom-model']);
    });

    describe('auto-removal of denylisted ids on sync (owner follow-up, HOS-94)', () => {
        it('removes a previously-enabled id that the sync now reports as hiddenModelIds', () => {
            // Arrange — `whisper-1` was enabled before this sync (e.g. from an
            // earlier, looser filter version) but the fresh sync result now
            // denylists it and reports it in `hiddenModelIds`.
            const syncResult: AiSyncModelsResult = {
                providerId: 'openai',
                fetchedAt: new Date().toISOString(),
                models: [{ id: 'gpt-4o', source: 'both' }],
                hiddenModelIds: ['whisper-1']
            };
            mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ data: syncResult }));
            const onSelectedModelsChange = vi.fn();

            // Act
            render(
                <SyncModelsSection
                    {...baseProps}
                    selectedModels={['gpt-4o', 'whisper-1']}
                    onSelectedModelsChange={onSelectedModelsChange}
                />
            );

            // Assert
            expect(onSelectedModelsChange).toHaveBeenCalledWith(['gpt-4o']);
        });

        it('preserves a hand-added custom id that is NOT in hiddenModelIds', () => {
            // Arrange — `my-custom-model` was never returned by the provider
            // API at all, so it can never appear in `hiddenModelIds`.
            const syncResult: AiSyncModelsResult = {
                providerId: 'openai',
                fetchedAt: new Date().toISOString(),
                models: [{ id: 'gpt-4o', source: 'both' }],
                hiddenModelIds: ['whisper-1']
            };
            mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ data: syncResult }));
            const onSelectedModelsChange = vi.fn();

            // Act
            render(
                <SyncModelsSection
                    {...baseProps}
                    selectedModels={['gpt-4o', 'my-custom-model']}
                    onSelectedModelsChange={onSelectedModelsChange}
                />
            );

            // Assert — nothing to remove, so the effect must not fire at all.
            expect(onSelectedModelsChange).not.toHaveBeenCalled();
            expect(screen.getByText('my-custom-model')).toBeInTheDocument();
            const customRow = screen
                .getByText('my-custom-model')
                .closest('div.rounded-md') as HTMLElement;
            expect(within(customRow).getByRole('switch')).toBeChecked();
        });

        it('does not call onSelectedModelsChange when hiddenModelIds is absent', () => {
            // Arrange
            const syncResult: AiSyncModelsResult = {
                providerId: 'openai',
                fetchedAt: new Date().toISOString(),
                models: [{ id: 'gpt-4o', source: 'both' }]
            };
            mockUseSyncModelsMutation.mockReturnValue(buildMutationMock({ data: syncResult }));
            const onSelectedModelsChange = vi.fn();

            // Act
            render(
                <SyncModelsSection
                    {...baseProps}
                    selectedModels={['gpt-4o']}
                    onSelectedModelsChange={onSelectedModelsChange}
                />
            );

            // Assert
            expect(onSelectedModelsChange).not.toHaveBeenCalled();
        });
    });
});
