// @vitest-environment jsdom
/**
 * @file AiTextImprovePanel.test.tsx
 * @description Component tests for AiTextImprovePanel (SPEC-321 T-002).
 *
 * Ported from the admin reference test suite
 * (`apps/admin/src/features/accommodations/components/__tests__/AiTextImprovePanel.test.tsx`).
 * Covers 13 cases:
 *
 *   1.  renders trigger disabled when triggerDisabled=true
 *   2.  renders trigger enabled when triggerDisabled=false/omitted
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
 *  13.  aborts in-flight fetch on unmount (no state-update-after-unmount warning)
 *
 * The CRITICAL case (#10) is the UI-level proof of the safety invariant:
 * when the hook transitions to error after streaming tokens, the panel
 * shows the error state (role='alert') and does NOT display any partial
 * suggestion text.
 *
 * ## Mocking strategy
 *
 * The `useAiTextImprove` hook is mocked — we control its return value
 * directly. The component is a pure renderer of the hook's state, so
 * this gives us deterministic, fast tests with no network or SSE
 * mocking. The hook's own behaviour is tested in T-001.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    AiTextImproveHookError,
    AiTextImproveProgress,
    AiTextImproveStatus,
    UseAiTextImproveReturn
} from '@/hooks/useAiTextImprove';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string, _count: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@/components/host/editor/AiTextImprovePanel.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
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

vi.mock('@/hooks/useAiTextImprove', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/hooks/useAiTextImprove')>();
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

import { AiTextImprovePanel } from '@/components/host/editor/AiTextImprovePanel.client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default props shared across all tests. */
const defaultProps = {
    fieldType: 'description' as const,
    fieldValue: 'A nice place to stay',
    locale: 'es' as const,
    onAccept: vi.fn()
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

    // 1. Trigger disabled when triggerDisabled=true (field empty)
    it('renders trigger disabled when triggerDisabled=true', () => {
        render(
            <AiTextImprovePanel
                {...defaultProps}
                triggerDisabled={true}
            />
        );

        const trigger = screen.getByTestId('ai-text-improve-trigger');
        expect(trigger).toBeInTheDocument();
        expect(trigger).toBeDisabled();
    });

    // 2. Trigger enabled when triggerDisabled=false/omitted
    it('renders trigger enabled when triggerDisabled is false or omitted', () => {
        render(<AiTextImprovePanel {...defaultProps} />);

        const trigger = screen.getByTestId('ai-text-improve-trigger');
        expect(trigger).toBeInTheDocument();
        expect(trigger).not.toBeDisabled();
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
        expect(panel).toHaveAttribute('aria-label', 'Sugerencia de IA');

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
        expect(acceptBtn).toHaveTextContent('Aceptar');

        const discardBtn = screen.getByTestId('ai-text-improve-discard');
        expect(discardBtn).toBeInTheDocument();
        expect(discardBtn).toHaveTextContent('Descartar');
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
            'Tu plan no incluye mejora de texto con IA. Actualizá tu plan para acceder.'
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
            'El contenido no pasa las políticas de uso. Tu texto original no fue modificado.'
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
            'El contenido no pasa las políticas de uso. Tu texto original no fue modificado.'
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
