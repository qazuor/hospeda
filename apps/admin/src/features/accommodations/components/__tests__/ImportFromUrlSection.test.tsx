// @vitest-environment jsdom
/**
 * @file ImportFromUrlSection.test.tsx
 * @description Component tests for ImportFromUrlSection (SPEC-258 C.1):
 * a 200 response carrying `failureCode` must render the matching localized
 * error as an alert and NOT trigger the success/prefill path.
 *
 * Covers:
 *   1.  invalid_url failureCode → renders error alert, no prefill
 *   2.  source_blocked failureCode → renders error alert, no prefill
 *   3.  credentials_missing failureCode → renders error alert, no prefill
 *   4.  provider_error failureCode → renders error alert, no prefill
 *   5.  timeout failureCode → renders error alert, no prefill
 *   6.  nothing_found failureCode → renders error alert, no prefill
 *   7.  success (no failureCode) → shows review notice, no alert
 *
 * Also covers the HOS-50 / SPEC-277 R3 T-015 async 202+poll flow:
 *   8.  202 response → switches to polling, no prefill yet
 *   9.  poll settles with a draft → prefills the form
 *   10. poll settles with a failureCode → shows the error banner
 *   11. mutation-pending vs polling-in-progress are visually distinguished
 */

import type { AccommodationImportStatusResponse } from '@repo/schemas';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useTranslations — returns the key as the translation (standard admin pattern).
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// Mutable mock mutation state driven by tests.
interface MockMutationState {
    isPending: boolean;
    error: Error | null;
}

let currentMutationState: MockMutationState = {
    isPending: false,
    error: null
};

// mutateAsync is replaced per-test via mockMutateAsync.
const mockMutateAsync = vi.fn();

// `isAsyncImportStart` is re-exported via `vi.importActual` (NOT reimplemented
// here) — a narrow mock factory that omits it would silently return
// `undefined` when the component calls it, breaking the 202 branch with a
// misleading "network error" (HOS-50 T-013 gotcha, see project memory).
vi.mock('../../hooks/useAccommodationImportMutation', async () => {
    const actual = await vi.importActual<
        typeof import('../../hooks/useAccommodationImportMutation')
    >('../../hooks/useAccommodationImportMutation');
    return {
        ...actual,
        useAccommodationImportMutation: () => ({
            ...currentMutationState,
            mutateAsync: (...args: unknown[]) => mockMutateAsync(...args)
        })
    };
});

// Mutable mock status-query state driven by tests (HOS-50 T-014/T-015).
interface MockStatusQueryState {
    data: AccommodationImportStatusResponse | undefined;
}

let currentStatusQueryState: MockStatusQueryState = { data: undefined };
const mockUseAccommodationImportStatusQuery = vi.fn(() => currentStatusQueryState);

vi.mock('../../hooks/useAccommodationImportStatusQuery', () => ({
    useAccommodationImportStatusQuery: () => mockUseAccommodationImportStatusQuery()
}));

// Mock entity-form context — setFieldValue records calls.
const mockSetFieldValue = vi.fn();

vi.mock('@/components/entity-form/context/EntityFormContext', () => ({
    useEntityFormContext: () => ({
        setFieldValue: mockSetFieldValue
    })
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks are declared (vi.mock is hoisted by vitest).
// ---------------------------------------------------------------------------

import { ImportFromUrlSection } from '../ImportFromUrlSection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run handle echoed back from a `202` async-start response. */
const RUN_HANDLE = {
    runId: 'run-abc123',
    datasetId: 'dataset-xyz789',
    source: 'airbnb' as const,
    startedAt: '2026-07-02T09:20:00.000Z',
    url: 'https://www.airbnb.com.ar/rooms/123'
};

/**
 * Resets all mocks and state before each test.
 */
const resetAll = () => {
    currentMutationState = { isPending: false, error: null };
    currentStatusQueryState = { data: undefined };
    mockMutateAsync.mockReset();
    mockSetFieldValue.mockReset();
    mockUseAccommodationImportStatusQuery.mockClear();
};

/**
 * Renders the component, checks the legal checkbox, fills in a URL,
 * and clicks the import button.
 *
 * The caller must set up mockMutateAsync before calling this helper.
 */
async function renderAndSubmit() {
    render(<ImportFromUrlSection />);

    // Tick legal checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Fill URL
    const urlInput = screen.getByRole('textbox');
    fireEvent.change(urlInput, { target: { value: 'https://www.airbnb.com.ar/rooms/123' } });

    // Click import
    const button = screen.getByTestId('import-submit-btn');
    fireEvent.click(button);

    // Wait for mutateAsync to be called
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ImportFromUrlSection — failureCode branch (SPEC-258 C.1)', () => {
    beforeEach(() => {
        resetAll();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['invalid_url'],
        ['source_blocked'],
        ['credentials_missing'],
        ['provider_error'],
        ['timeout'],
        ['nothing_found']
    ])(
        'renders an error alert for failureCode "%s" and does NOT prefill the form',
        async (failureCode) => {
            // Arrange
            mockMutateAsync.mockResolvedValueOnce({
                draft: {},
                source: 'generic',
                methodsUsed: [],
                partial: false,
                failureCode
            });

            // Act
            await renderAndSubmit();

            // Assert: error alert is shown with the i18n key path
            const alert = await screen.findByRole('alert');
            expect(alert).toBeInTheDocument();
            // The mock t() returns the key as-is; confirm the key path is used
            const expectedKey = `host.importFromUrl.errors.failure.${failureCode.replace(
                /_([a-z])/g,
                (_: string, letter: string) => letter.toUpperCase()
            )}`;
            expect(alert.textContent).toContain(expectedKey);

            // Assert: setFieldValue was NOT called (no form prefill)
            expect(mockSetFieldValue).not.toHaveBeenCalled();

            // Assert: review notice was NOT shown
            expect(screen.queryByTestId('import-review-notice')).not.toBeInTheDocument();
        }
    );

    it('shows the review notice (not an alert) on successful import with no failureCode', async () => {
        // Arrange
        mockMutateAsync.mockResolvedValueOnce({
            draft: {
                name: { value: 'Casa bonita', confidence: 90, source: 'jsonld' }
            },
            source: 'airbnb',
            methodsUsed: ['json_ld'],
            partial: false
        });

        // Act
        await renderAndSubmit();

        // Assert: review notice is shown
        const notice = await screen.findByTestId('import-review-notice');
        expect(notice).toBeInTheDocument();

        // Assert: NO error alert from a failureCode
        expect(screen.queryByTestId('import-failure-error')).not.toBeInTheDocument();
    });
});

describe('R5 manual path invariant (SPEC-277)', () => {
    beforeEach(() => {
        resetAll();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('isPending reverts to false and shows failure-error alert after source_blocked — no prefill, URL stays editable', async () => {
        // Arrange
        mockMutateAsync.mockResolvedValueOnce({
            draft: {},
            source: 'generic',
            methodsUsed: [],
            partial: false,
            failureCode: 'source_blocked'
        });

        // Act
        await renderAndSubmit();

        // Assert: mutation.isPending is false (mocked value, component renders non-pending button)
        const button = screen.getByTestId('import-submit-btn');
        expect(button).not.toBeDisabled();

        // Assert: failure-error alert is shown with the i18n key for source_blocked
        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert.textContent).toContain('host.importFromUrl.errors.failure.sourceBlocked');

        // Assert: setFieldValue was NOT called (no form prefill on classified failure)
        expect(mockSetFieldValue).not.toHaveBeenCalled();

        // Assert: URL input is still editable
        const urlInput = screen.getByRole('textbox');
        expect(urlInput).not.toBeDisabled();
    });

    it('isPending reverts to false and shows failure-error alert after timeout — no prefill, URL stays editable', async () => {
        // Arrange
        mockMutateAsync.mockResolvedValueOnce({
            draft: {},
            source: 'generic',
            methodsUsed: [],
            partial: false,
            failureCode: 'timeout'
        });

        // Act
        await renderAndSubmit();

        // Assert: button is re-enabled (isPending false)
        const button = screen.getByTestId('import-submit-btn');
        expect(button).not.toBeDisabled();

        // Assert: failure-error alert with the timeout i18n key
        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert.textContent).toContain('host.importFromUrl.errors.failure.timeout');

        // Assert: no form prefill on classified failure
        expect(mockSetFieldValue).not.toHaveBeenCalled();

        // Assert: URL input stays editable
        const urlInput = screen.getByRole('textbox');
        expect(urlInput).not.toBeDisabled();
    });

    it('isPending reverts to false and shows network error alert when mutateAsync throws', async () => {
        // Arrange: simulate a network-level throw from the mutation
        mockMutateAsync.mockRejectedValueOnce(new Error('Network failure'));
        // After the throw, the mutation mock surfaces an error via currentMutationState
        currentMutationState.error = new Error('Network failure');

        // Act
        await renderAndSubmit();

        // Assert: mutation.error is set → network error alert is shown
        const alert = await screen.findByRole('alert');
        expect(alert).toBeInTheDocument();

        // Assert: button is re-enabled (isPending is false in currentMutationState)
        const button = screen.getByTestId('import-submit-btn');
        expect(button).not.toBeDisabled();

        // Assert: URL input is still editable
        const urlInput = screen.getByRole('textbox');
        expect(urlInput).not.toBeDisabled();

        // Assert: no form prefill happened
        expect(mockSetFieldValue).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// HOS-50 / SPEC-277 R3 T-015 — async 202+poll flow
// ---------------------------------------------------------------------------

describe('ImportFromUrlSection — async 202+poll flow (HOS-50 T-015)', () => {
    beforeEach(() => {
        resetAll();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('switches to polling mode on a 202 response and does NOT prefill the form yet', async () => {
        // Arrange: the mutation resolves with a run handle (async dispatch), and
        // the status query (still unsettled) is already wired for the next render.
        mockMutateAsync.mockResolvedValueOnce(RUN_HANDLE);
        currentStatusQueryState = { data: { settled: false } };

        // Act
        const { rerender } = render(<ImportFromUrlSection />);
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'https://www.airbnb.com.ar/rooms/123' }
        });
        fireEvent.click(screen.getByTestId('import-submit-btn'));
        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
        rerender(<ImportFromUrlSection />);

        // Assert: button is in the polling state, disabled, no prefill yet
        const button = screen.getByTestId('import-submit-btn');
        expect(button.getAttribute('data-state')).toBe('polling');
        expect(button).toBeDisabled();
        expect(mockSetFieldValue).not.toHaveBeenCalled();
        expect(screen.queryByTestId('import-review-notice')).not.toBeInTheDocument();
        expect(screen.queryByTestId('import-failure-error')).not.toBeInTheDocument();
    });

    it('prefills the form once the polled run settles with a draft', async () => {
        // Arrange
        mockMutateAsync.mockResolvedValueOnce(RUN_HANDLE);
        currentStatusQueryState = { data: { settled: false } };

        const { rerender } = render(<ImportFromUrlSection />);
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'https://www.airbnb.com.ar/rooms/123' }
        });
        fireEvent.click(screen.getByTestId('import-submit-btn'));
        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
        rerender(<ImportFromUrlSection />);
        expect(screen.getByTestId('import-submit-btn').getAttribute('data-state')).toBe('polling');

        // Act: the run settles successfully
        currentStatusQueryState = {
            data: {
                settled: true,
                draft: {
                    draft: {
                        name: { value: 'Casa desde Airbnb', confidence: 88, source: 'text' }
                    },
                    source: 'airbnb',
                    methodsUsed: ['text'],
                    partial: false
                }
            }
        };
        rerender(<ImportFromUrlSection />);

        // Assert: form was prefilled and the review notice is shown
        await waitFor(() =>
            expect(mockSetFieldValue).toHaveBeenCalledWith('name', 'Casa desde Airbnb')
        );
        const notice = await screen.findByTestId('import-review-notice');
        expect(notice).toBeInTheDocument();
        expect(screen.queryByTestId('import-failure-error')).not.toBeInTheDocument();

        // Assert: polling has stopped, button back to idle
        expect(screen.getByTestId('import-submit-btn').getAttribute('data-state')).toBe('idle');
    });

    it('shows the failure-error banner once the polled run settles with a failureCode', async () => {
        // Arrange
        mockMutateAsync.mockResolvedValueOnce(RUN_HANDLE);
        currentStatusQueryState = { data: { settled: false } };

        const { rerender } = render(<ImportFromUrlSection />);
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'https://www.airbnb.com.ar/rooms/123' }
        });
        fireEvent.click(screen.getByTestId('import-submit-btn'));
        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
        rerender(<ImportFromUrlSection />);

        // Act: the run settles with a classified failure (poll ceiling exceeded)
        currentStatusQueryState = { data: { settled: true, failureCode: 'timeout' } };
        rerender(<ImportFromUrlSection />);

        // Assert: failure-error banner is shown with the matching i18n key, no prefill
        const alert = await screen.findByTestId('import-failure-error');
        expect(alert).toBeInTheDocument();
        expect(alert.textContent).toContain('host.importFromUrl.errors.failure.timeout');
        expect(mockSetFieldValue).not.toHaveBeenCalled();
        expect(screen.queryByTestId('import-review-notice')).not.toBeInTheDocument();

        // Assert: polling has stopped, button back to idle and enabled
        const button = screen.getByTestId('import-submit-btn');
        expect(button.getAttribute('data-state')).toBe('idle');
        expect(button).not.toBeDisabled();
    });

    it('visually distinguishes the mutation-pending state from polling-in-progress', async () => {
        // Part 1: mutation.isPending — "submitting" state, independent of any run handle.
        currentMutationState = { isPending: true, error: null };
        const { unmount } = render(<ImportFromUrlSection />);
        const pendingButton = screen.getByTestId('import-submit-btn');
        expect(pendingButton.getAttribute('data-state')).toBe('submitting');
        expect(pendingButton.textContent).toContain('host.importFromUrl.actions.submitting');
        unmount();

        // Part 2: mutation resolved with a 202 — "polling" state, distinct label/text.
        currentMutationState = { isPending: false, error: null };
        mockMutateAsync.mockResolvedValueOnce(RUN_HANDLE);
        currentStatusQueryState = { data: { settled: false } };

        const { rerender } = render(<ImportFromUrlSection />);
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: 'https://www.airbnb.com.ar/rooms/123' }
        });
        fireEvent.click(screen.getByTestId('import-submit-btn'));
        await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
        rerender(<ImportFromUrlSection />);

        const pollingButton = screen.getByTestId('import-submit-btn');
        expect(pollingButton.getAttribute('data-state')).toBe('polling');
        expect(pollingButton.textContent).toContain('host.importFromUrl.actions.polling');
        expect(pollingButton.textContent).not.toContain('host.importFromUrl.actions.submitting');
    });
});
