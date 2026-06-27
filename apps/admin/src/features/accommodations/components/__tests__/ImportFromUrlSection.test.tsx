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
 */

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

vi.mock('../../hooks/useAccommodationImportMutation', () => ({
    useAccommodationImportMutation: () => ({
        ...currentMutationState,
        mutateAsync: (...args: unknown[]) => mockMutateAsync(...args)
    })
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

/**
 * Resets all mocks and state before each test.
 */
const resetAll = () => {
    currentMutationState = { isPending: false, error: null };
    mockMutateAsync.mockReset();
    mockSetFieldValue.mockReset();
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
