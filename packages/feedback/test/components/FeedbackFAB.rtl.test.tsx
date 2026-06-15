/**
 * RTL render tests for FeedbackFAB — rewrite for the current component contract.
 *
 * The component has two setInterval/setTimeout effects that require careful
 * timer management: auto-collapse at 2200ms and pulse at 30000ms (setInterval).
 * We use vi.useFakeTimers() + vi.advanceTimersByTime() to advance to just past
 * the mounted flag (which fires on the next tick via useEffect) without triggering
 * infinite timer loops.
 *
 * Covers lines 157-362 (component body).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackFAB } from '../../src/components/FeedbackFAB.js';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock FeedbackModal to avoid native <dialog> and timer effects that hang jsdom.
vi.mock('../../src/components/FeedbackModal.js', () => ({
    FeedbackModal: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="feedback-modal-dialog">Modal</div> : null
}));

// Mock useConsoleCapture to avoid side effects in test environment.
vi.mock('../../src/hooks/useConsoleCapture.js', () => ({
    useConsoleCapture: vi.fn(() => ({ getErrors: () => [] }))
}));

// Mock runtime trackers so installRuntimeTrackers doesn't mutate history.pushState.
vi.mock('../../src/lib/runtime-trackers.js', () => ({
    installRuntimeTrackers: vi.fn()
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultProps = {
    apiUrl: 'http://localhost:3001',
    appSource: 'web' as const
};

/**
 * Advance timers just enough for useEffect (setMounted) to fire,
 * without triggering the 30s pulse setInterval multiple times.
 * 10ms is enough for all useEffect calls in the component.
 */
function advancePastMount() {
    act(() => {
        vi.advanceTimersByTime(10);
    });
}

// ---------------------------------------------------------------------------
// Tests: basic render
// ---------------------------------------------------------------------------

describe('FeedbackFAB — basic render', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders the FAB button with data-testid="feedback-fab"', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
    });

    it('renders with accessible aria-label containing the tooltip text', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        const fab = screen.getByTestId('feedback-fab');
        expect(fab).toHaveAttribute('aria-label');
        expect(fab.getAttribute('aria-label')).toBeTruthy();
    });

    it('renders the FAB label text from FEEDBACK_STRINGS', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        expect(screen.getByText(FEEDBACK_STRINGS.fab.label)).toBeInTheDocument();
    });

    it('does not render the modal dialog initially', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        expect(screen.queryByTestId('feedback-modal-dialog')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: click opens modal (handleFabClick, lines 280-283)
// ---------------------------------------------------------------------------

describe('FeedbackFAB — FAB click opens modal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should open the modal when FAB button is clicked', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab'));
        });

        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();
    });

    it('should close the modal after click-open when modal triggers handleClose', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        // Open
        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab'));
        });
        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: keyboard shortcut toggles modal (handleToggle, lines 220-226)
// ---------------------------------------------------------------------------

describe('FeedbackFAB — keyboard shortcut', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should open the modal on Ctrl+Shift+F', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        act(() => {
            fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true });
        });

        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();
    });

    it('should toggle modal closed when shortcut pressed while open (prev => !prev branch)', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        // Open
        act(() => {
            fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true });
        });
        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();

        // Close — exercises the `(prev) => !prev` branch (lines 221-225)
        act(() => {
            fireEvent.keyDown(document, { key: 'f', ctrlKey: true, shiftKey: true });
        });
        expect(screen.queryByTestId('feedback-modal-dialog')).not.toBeInTheDocument();
    });

    it('should open modal on Cmd+Shift+F (macOS)', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        act(() => {
            fireEvent.keyDown(document, { key: 'f', metaKey: true, shiftKey: true });
        });

        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: "feedback:open" CustomEvent (lines 234-243)
// ---------------------------------------------------------------------------

describe('FeedbackFAB — feedback:open CustomEvent', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should open the modal in response to a "feedback:open" CustomEvent', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        act(() => {
            window.dispatchEvent(new CustomEvent('feedback:open'));
        });

        expect(screen.getByTestId('feedback-modal-dialog')).toBeInTheDocument();
    });

    it('should dispatch "feedback:ack" after handling "feedback:open" (line 239)', () => {
        const ackHandler = vi.fn();
        window.addEventListener('feedback:ack', ackHandler);

        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        act(() => {
            window.dispatchEvent(new CustomEvent('feedback:open'));
        });

        expect(ackHandler).toHaveBeenCalled();

        window.removeEventListener('feedback:ack', ackHandler);
    });
});

// ---------------------------------------------------------------------------
// Tests: auto-collapse timer (lines 251-254)
// ---------------------------------------------------------------------------

describe('FeedbackFAB — auto-collapse timer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should still be mounted after COLLAPSE_DELAY_MS (2200ms) fires', () => {
        render(<FeedbackFAB {...defaultProps} />);

        // Advance past the 2200ms collapse timer
        act(() => {
            vi.advanceTimersByTime(2500);
        });

        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: pulse animation timer — just one cycle (lines 261-274)
// ---------------------------------------------------------------------------

describe('FeedbackFAB — pulse animation timer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should remain mounted after the first 30s pulse fires + 600ms pulse-off', () => {
        render(<FeedbackFAB {...defaultProps} />);

        // Advance exactly one pulse cycle: interval (30000) + pulse-off timeout (600)
        act(() => {
            vi.advanceTimersByTime(30_600);
        });

        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: getSentryEventId integration (lines 208-218)
// ---------------------------------------------------------------------------

describe('FeedbackFAB — getSentryEventId', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should call getSentryEventId when FAB is clicked (line 281)', () => {
        const getSentryEventId = vi.fn(() => 'sentry-event-abc');
        render(
            <FeedbackFAB
                {...defaultProps}
                getSentryEventId={getSentryEventId}
            />
        );
        advancePastMount();

        act(() => {
            fireEvent.click(screen.getByTestId('feedback-fab'));
        });

        expect(getSentryEventId).toHaveBeenCalled();
    });

    it('should not throw when getSentryEventId throws (try/catch guard, line 214)', () => {
        const getSentryEventId = vi.fn(() => {
            throw new Error('Sentry unavailable');
        });

        render(
            <FeedbackFAB
                {...defaultProps}
                getSentryEventId={getSentryEventId}
            />
        );
        advancePastMount();

        expect(() => {
            act(() => {
                fireEvent.click(screen.getByTestId('feedback-fab'));
            });
        }).not.toThrow();
    });

    it('should handle undefined getSentryEventId gracefully (line 210 early return)', () => {
        render(<FeedbackFAB {...defaultProps} />);
        advancePastMount();

        expect(() => {
            act(() => {
                fireEvent.click(screen.getByTestId('feedback-fab'));
            });
        }).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Tests: all optional props accepted without crash
// ---------------------------------------------------------------------------

describe('FeedbackFAB — optional props', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render with all optional props provided', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="web"
                deployVersion="v1.2.3"
                userId="usr_abc"
                userEmail="user@example.com"
                userName="Test User"
                prefillData={{
                    type: 'bug-js',
                    title: 'Pre-filled title',
                    description: 'Pre-filled desc',
                    errorInfo: { message: 'TypeError', stack: 'at App.tsx:10' }
                }}
                featureFlagPrefixes={['feature_']}
                getSentryEventId={() => 'evt-123'}
                onSentryFeedback={vi.fn()}
            />
        );
        advancePastMount();

        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
    });

    it('should render with appSource="admin"', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="admin"
            />
        );
        advancePastMount();

        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
    });

    it('should render with appSource="standalone"', () => {
        render(
            <FeedbackFAB
                apiUrl="http://localhost:3001"
                appSource="standalone"
            />
        );
        advancePastMount();

        expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
    });
});
