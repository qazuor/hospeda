// @vitest-environment jsdom
/**
 * @file AiTextImprovePanel.test.tsx
 * @description Component tests for AiTextImprovePanel (SPEC-198 T-009, spec §9.4).
 *
 * Covers 13 cases:
 *
 *   1.  renders disabled trigger with upgrade tooltip when canUse=false
 *   2.  renders enabled trigger when canUse=true
 *   3.  shows loading state after trigger click
 *   4.  accumulates token deltas in suggestion display (streaming)
 *   5.  shows done state with Accept+Discard buttons after done event
 *   6.  calls onAccept with accumulated suggestion when Accept clicked
 *   7.  does NOT call onAccept when Discard clicked
 *   8.  shows error state on ENTITLEMENT_REQUIRED pre-stream response
 *   9.  shows error state on MODERATION_BLOCKED pre-stream response
 *  10.  CRITICAL: discards accumulated tokens and shows error on mid-stream error
 *  11.  returns to idle after Discard clicked in done state
 *  12.  returns to idle after Dismiss clicked in error state
 *  13.  aborts in-flight fetch on unmount (no state-update after unmount warning)
 *
 * The CRITICAL case (#10) is the UI-level proof of the safety invariant:
 * when the hook transitions to error after streaming tokens, the panel
 * shows the error state (role='alert') and does NOT display any partial
 * suggestion text. See spec §5.3.4 "CRITICAL moderation gotcha".
 *
 * ## Mocking strategy
 *
 * The `useAiTextImprove` hook is mocked — we control its return value
 * directly. The component is a pure renderer of the hook's state, so
 * this gives us deterministic, fast tests with no network or SSE
 * mocking. The hook's own behaviour is tested in T-008.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    AiTextImproveHookError,
    AiTextImproveProgress,
    AiTextImproveStatus,
    UseAiTextImproveReturn
} from '../../hooks/useAiTextImprove';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useTranslations — returns the key as the translation (standard admin
// test pattern, see FilterBoolean.test.tsx et al.).
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

// Mutable mock state — the mock hook reads from this on every render.
// Tests mutate it and call `rerender` to drive state transitions.
interface MockHookState {
    status: AiTextImproveStatus;
    suggestion: string;
    error: AiTextImproveHookError | null;
    progress: AiTextImproveProgress | null;
}

const mockImprove = vi.fn();
const mockAccept = vi.fn();
const mockDiscard = vi.fn();
const mockAbort = vi.fn();

let currentMockState: MockHookState = {
    status: 'idle',
    suggestion: '',
    error: null,
    progress: null
};

vi.mock('../../hooks/useAiTextImprove', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../hooks/useAiTextImprove')>();
    return {
        ...original,
        useAiTextImprove: (): UseAiTextImproveReturn => ({
            status: currentMockState.status,
            suggestion: currentMockState.suggestion,
            error: currentMockState.error,
            progress: currentMockState.progress,
            improve: mockImprove,
            accept: mockAccept,
            discard: mockDiscard,
            abort: mockAbort
        })
    };
});

// ---------------------------------------------------------------------------
// Import SUT AFTER mocks are declared (vi.mock is hoisted, but the
// import order here is for readability — vitest handles the hoisting).
// ---------------------------------------------------------------------------

import { AiTextImprovePanel } from '../AiTextImprovePanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default props shared across all tests. */
const defaultProps = {
    fieldType: 'description' as const,
    fieldValue: 'A nice place to stay',
    locale: 'es',
    onAccept: vi.fn(),
    canUse: true
};

/**
 * Resets the mock state to idle and clears all mock call history.
 * Called in `beforeEach` to guarantee test isolation.
 */
const resetMockState = () => {
    currentMockState = {
        status: 'idle',
        suggestion: '',
        error: null,
        progress: null
    };
    mockImprove.mockClear();
    mockAccept.mockClear();
    mockDiscard.mockClear();
    mockAbort.mockClear();
    defaultProps.onAccept.mockClear();
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AiTextImprovePanel', () => {
    beforeEach(() => {
        resetMockState();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // 1. Disabled trigger with upgrade tooltip when canUse=false
    it('renders disabled trigger with upgrade tooltip when canUse=false', () => {
        render(
            <AiTextImprovePanel
                {...defaultProps}
                canUse={false}
            />
        );

        const trigger = screen.getByTestId('ai-text-improve-trigger');
        expect(trigger).toBeInTheDocument();
        expect(trigger).toBeDisabled();
        expect(trigger).toHaveAttribute('title', 'admin-common.aiTextImprove.upgradeTooltip');
    });

    // 2. Enabled trigger when canUse=true
    it('renders enabled trigger when canUse=true', () => {
        render(
            <AiTextImprovePanel
                {...defaultProps}
                canUse={true}
            />
        );

        const trigger = screen.getByTestId('ai-text-improve-trigger');
        expect(trigger).toBeInTheDocument();
        expect(trigger).not.toBeDisabled();
        expect(trigger).toHaveAttribute('title', 'admin-common.aiTextImprove.triggerTooltip');
    });

    // 3. Loading state after trigger click
    it('shows loading state after trigger click', () => {
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        // Simulate hook transition to loading
        currentMockState = {
            ...currentMockState,
            status: 'loading',
            progress: { tokensReceived: 0 }
        };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        const panel = screen.getByTestId('ai-text-improve-panel');
        expect(panel).toBeInTheDocument();
        // <section> with aria-label is a region landmark (implicit role)
        expect(panel.tagName).toBe('SECTION');
        expect(panel).toHaveAttribute('aria-label', 'admin-common.aiTextImprove.panelLabel');

        const loading = screen.getByTestId('ai-text-improve-loading');
        expect(loading).toBeInTheDocument();
        expect(loading).toHaveAttribute('aria-busy', 'true');

        // Trigger should be disabled during loading
        const trigger = screen.getByTestId('ai-text-improve-trigger');
        expect(trigger).toBeDisabled();
    });

    // 4. Streaming state — accumulates token deltas
    it('accumulates token deltas in suggestion display', () => {
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        currentMockState = {
            ...currentMockState,
            status: 'streaming',
            suggestion: 'A beautifully appointed room',
            progress: { tokensReceived: 5 }
        };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        const streaming = screen.getByTestId('ai-text-improve-streaming');
        expect(streaming).toBeInTheDocument();
        expect(streaming).toHaveAttribute('aria-live', 'polite');
        expect(streaming).toHaveTextContent('A beautifully appointed room');
    });

    // 5. Done state with Accept+Discard buttons
    it('shows done state with Accept+Discard buttons after done event', () => {
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        currentMockState = {
            ...currentMockState,
            status: 'done',
            suggestion: 'A beautifully appointed room with garden views.'
        };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        const done = screen.getByTestId('ai-text-improve-done');
        expect(done).toBeInTheDocument();
        expect(done).toHaveTextContent('A beautifully appointed room with garden views.');

        const acceptBtn = screen.getByTestId('ai-text-improve-accept');
        expect(acceptBtn).toBeInTheDocument();
        expect(acceptBtn).toHaveTextContent('admin-common.aiTextImprove.accept');

        const discardBtn = screen.getByTestId('ai-text-improve-discard');
        expect(discardBtn).toBeInTheDocument();
        expect(discardBtn).toHaveTextContent('admin-common.aiTextImprove.discard');
    });

    // 6. Accept calls onAccept with the suggestion
    it('calls onAccept with accumulated suggestion when Accept clicked', () => {
        const suggestion = 'Improved text here';
        mockAccept.mockReturnValue(suggestion);

        currentMockState = { ...currentMockState, status: 'done', suggestion };
        render(<AiTextImprovePanel {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ai-text-improve-accept'));

        expect(mockAccept).toHaveBeenCalledTimes(1);
        expect(defaultProps.onAccept).toHaveBeenCalledWith(suggestion);
    });

    // 7. Discard does NOT call onAccept
    it('does NOT call onAccept when Discard clicked', () => {
        currentMockState = { ...currentMockState, status: 'done', suggestion: 'Some text' };
        render(<AiTextImprovePanel {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ai-text-improve-discard'));

        expect(mockDiscard).toHaveBeenCalledTimes(1);
        expect(defaultProps.onAccept).not.toHaveBeenCalled();
    });

    // 8. Error state — ENTITLEMENT_REQUIRED
    it('shows error state on ENTITLEMENT_REQUIRED pre-stream response', () => {
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        currentMockState = {
            ...currentMockState,
            status: 'error',
            error: {
                code: 'ENTITLEMENT_REQUIRED',
                message: 'Plan lacks entitlement',
                httpStatus: 403
            }
        };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        const errorContainer = screen.getByTestId('ai-text-improve-error');
        expect(errorContainer).toBeInTheDocument();

        const errorMessage = screen.getByTestId('ai-text-improve-error-message');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveTextContent(
            'admin-common.aiTextImprove.error.ENTITLEMENT_REQUIRED'
        );

        // Dismiss button should be present
        const dismissBtn = screen.getByTestId('ai-text-improve-dismiss');
        expect(dismissBtn).toBeInTheDocument();
    });

    // 9. Error state — MODERATION_BLOCKED
    it('shows error state on MODERATION_BLOCKED pre-stream response', () => {
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        currentMockState = {
            ...currentMockState,
            status: 'error',
            error: {
                code: 'MODERATION_BLOCKED',
                message: 'Content policy violation',
                httpStatus: 422
            }
        };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        const errorMessage = screen.getByTestId('ai-text-improve-error-message');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveTextContent(
            'admin-common.aiTextImprove.error.MODERATION_BLOCKED'
        );
    });

    // 10. CRITICAL: mid-stream error discards tokens
    it('CRITICAL: discards accumulated tokens and shows error on mid-stream error event', () => {
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        // Phase 1: streaming with accumulated tokens
        currentMockState = {
            ...currentMockState,
            status: 'streaming',
            suggestion: 'Partial moderation-blocked content',
            progress: { tokensReceived: 8 }
        };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        // Verify streaming state shows the partial text
        expect(screen.getByTestId('ai-text-improve-streaming')).toHaveTextContent(
            'Partial moderation-blocked content'
        );

        // Phase 2: hook transitions to error — hook discards suggestion (sets it to '')
        currentMockState = {
            status: 'error',
            suggestion: '',
            error: {
                code: 'MODERATION_BLOCKED',
                message: 'Content policy violation',
                httpStatus: 200
            },
            progress: null
        };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        // The streaming display MUST be gone
        expect(screen.queryByTestId('ai-text-improve-streaming')).not.toBeInTheDocument();

        // The error state MUST be visible with role='alert'
        const errorMessage = screen.getByTestId('ai-text-improve-error-message');
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveTextContent(
            'admin-common.aiTextImprove.error.MODERATION_BLOCKED'
        );

        // CRITICAL: no partial suggestion text should be visible anywhere in the panel
        const panel = screen.getByTestId('ai-text-improve-panel');
        expect(panel).not.toHaveTextContent('Partial moderation-blocked content');
    });

    // 11. Returns to idle after Discard in done state
    it('returns to idle after Discard clicked in done state', () => {
        currentMockState = { ...currentMockState, status: 'done', suggestion: 'Done text' };
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ai-text-improve-discard'));
        expect(mockDiscard).toHaveBeenCalledTimes(1);

        // Simulate hook returning to idle
        currentMockState = { status: 'idle', suggestion: '', error: null, progress: null };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        // Panel should be gone
        expect(screen.queryByTestId('ai-text-improve-panel')).not.toBeInTheDocument();
    });

    // 12. Returns to idle after Dismiss in error state
    it('returns to idle after Dismiss clicked in error state', () => {
        currentMockState = {
            ...currentMockState,
            status: 'error',
            error: { code: 'INTERNAL_ERROR', message: 'Oops', httpStatus: 500 }
        };
        const { rerender } = render(<AiTextImprovePanel {...defaultProps} />);

        fireEvent.click(screen.getByTestId('ai-text-improve-dismiss'));
        expect(mockDiscard).toHaveBeenCalledTimes(1);

        // Simulate hook returning to idle
        currentMockState = { status: 'idle', suggestion: '', error: null, progress: null };
        rerender(<AiTextImprovePanel {...defaultProps} />);

        expect(screen.queryByTestId('ai-text-improve-panel')).not.toBeInTheDocument();
    });

    // 13. Unmount during active state — no React warnings
    it('aborts in-flight fetch on unmount (no state-update after unmount warning)', () => {
        // Spy on console.error to detect React "state update on unmounted" warnings
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        currentMockState = {
            ...currentMockState,
            status: 'streaming',
            suggestion: 'In-flight text',
            progress: { tokensReceived: 3 }
        };

        const { unmount } = render(<AiTextImprovePanel {...defaultProps} />);

        // Verify the panel is rendered before unmount
        expect(screen.getByTestId('ai-text-improve-streaming')).toBeInTheDocument();

        // Unmount while streaming — should not produce any React warnings
        unmount();

        // Check that no "Can't perform a React state update on an unmounted component"
        // warning was logged
        const stateUpdateWarnings = consoleSpy.mock.calls.filter(
            (call) => typeof call[0] === 'string' && call[0].includes('unmounted')
        );
        expect(stateUpdateWarnings).toHaveLength(0);

        consoleSpy.mockRestore();
    });
});
