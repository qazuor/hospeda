/**
 * @repo/feedback - FeedbackFAB (Floating Action Button) component.
 *
 * The primary entry point for the feedback system. Renders a floating button
 * in the bottom-right corner of the viewport. Clicking it (or pressing the
 * configured keyboard shortcut Ctrl+Shift+F) opens the FeedbackModal.
 *
 * The FAB supports a minimized state (a small dot) that persists across page
 * loads via localStorage. When minimized, hovering expands a tooltip preview;
 * clicking the dot opens the form directly.
 *
 * A subtle pulse animation fires every 30 seconds to draw attention. The
 * animation is suppressed when `prefers-reduced-motion: reduce` is set.
 *
 * Rendering is skipped entirely when `FEEDBACK_CONFIG.enabled` is false,
 * acting as a kill switch for the entire feedback system.
 */
import { CloseIcon, DebugIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FEEDBACK_CONFIG, getShortcutLabel } from '../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { useConsoleCapture } from '../hooks/useConsoleCapture.js';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut.js';
import { installRuntimeTrackers } from '../lib/runtime-trackers.js';
import type { AppSourceId, ReportTypeId } from '../schemas/feedback.schema.js';
import { cn } from '../ui/cn.js';
import './FeedbackFAB.css';
import { FeedbackModal } from './FeedbackModal.js';
import '../styles/tokens.css';

/**
 * Payload passed to the optional Sentry feedback bridge callback after a
 * successful submission to the backend (Linear).
 */
export interface SentryFeedbackBridgePayload {
    /** Reporter display name */
    readonly name: string;
    /** Reporter email */
    readonly email: string;
    /** Free-form description */
    readonly message: string;
    /** Sentry event ID associated with this feedback, if any */
    readonly associatedEventId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for persisting the minimized state */
const MINIMIZED_STORAGE_KEY = 'feedback-fab-minimized';

// ---------------------------------------------------------------------------
// localStorage helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Reads the minimized preference from localStorage.
 *
 * @returns The persisted boolean value, or `false` when unavailable/SSR.
 */
export function readMinimizedFromStorage(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return globalThis.localStorage.getItem(MINIMIZED_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

/**
 * Writes the minimized preference to localStorage.
 *
 * @param value - Whether the FAB should be in minimized state.
 */
export function writeMinimizedToStorage(value: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        globalThis.localStorage.setItem(MINIMIZED_STORAGE_KEY, String(value));
    } catch {
        // Silently ignore (e.g. private browsing quota errors)
    }
}

// ---------------------------------------------------------------------------
// Prop types
// ---------------------------------------------------------------------------

/**
 * Props for the FeedbackFAB component.
 *
 * @example
 * ```tsx
 * <FeedbackFAB
 *   apiUrl="http://localhost:3001"
 *   appSource="web"
 *   userId={session?.userId}
 *   userEmail={session?.email}
 *   userName={session?.name}
 * />
 * ```
 */
export interface FeedbackFABProps {
    /** Base URL of the feedback API endpoint */
    readonly apiUrl: string;
    /** Identifier for the application this FAB is rendered in */
    readonly appSource: AppSourceId;
    /** Git commit hash or release tag for the current deploy */
    readonly deployVersion?: string;
    /** Authenticated user ID (pre-fills the form when provided) */
    readonly userId?: string;
    /** Authenticated user email (pre-fills the form when provided) */
    readonly userEmail?: string;
    /** Authenticated user display name (pre-fills the form when provided) */
    readonly userName?: string;
    /**
     * Optional pre-fill data, typically supplied by an error boundary.
     * When present the form opens pre-filled with the error details.
     */
    readonly prefillData?: {
        /** Pre-selected report type */
        readonly type?: ReportTypeId;
        /** Pre-filled issue title */
        readonly title?: string;
        /** Pre-filled issue description */
        readonly description?: string;
        /** JavaScript error info captured by an error boundary */
        readonly errorInfo?: { readonly message: string; readonly stack?: string };
    };
    /**
     * Optional override for which localStorage prefixes should be scanned
     * to extract feature flags. Defaults to `['feature_', 'ff_']`.
     */
    readonly featureFlagPrefixes?: ReadonlyArray<string>;
    /**
     * Optional getter the FAB calls when the modal opens, to capture the
     * latest Sentry event ID and correlate the feedback with a Sentry event.
     *
     * The package stays SDK-agnostic — the consumer wires Sentry.lastEventId().
     */
    readonly getSentryEventId?: () => string | undefined;
    /**
     * Optional bridge callback invoked after a successful submission. The
     * consumer can forward this to `Sentry.captureFeedback({ ... })` so the
     * report also appears in Sentry's User Feedback panel.
     *
     * The package never imports a Sentry SDK directly. Errors thrown by the
     * callback are caught and logged but do not block the Linear flow.
     */
    readonly onSentryFeedback?: (payload: SentryFeedbackBridgePayload) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FeedbackFAB - Floating Action Button for the feedback system.
 *
 * Renders a fixed, bottom-right button that opens the FeedbackModal when
 * clicked or when the Ctrl+Shift+F keyboard shortcut is pressed.
 *
 * Features:
 * - Kill switch: renders nothing when `FEEDBACK_CONFIG.enabled` is false
 * - Minimized state persisted in localStorage
 * - Hover-to-expand preview when minimized
 * - Subtle 30-second pulse animation (respects prefers-reduced-motion)
 * - Keyboard shortcut (Ctrl+Shift+F / Cmd+Shift+F) to toggle modal
 * - Tooltip with shortcut hint on hover
 *
 * @param props - See {@link FeedbackFABProps}
 */
export function FeedbackFAB({
    apiUrl,
    appSource,
    deployVersion,
    userId,
    userEmail,
    userName,
    prefillData,
    featureFlagPrefixes,
    getSentryEventId,
    onSentryFeedback
}: FeedbackFABProps): React.JSX.Element | null {
    // ------------------------------------------------------------------
    // State (all hooks MUST be before any conditional return)
    // ------------------------------------------------------------------

    // Install console.error interceptor at FAB mount time (app startup)
    // so errors are captured before the form is opened (GAP-031-04).
    useConsoleCapture();

    // Install runtime trackers (navigation history + last interactions) once
    // when the FAB mounts. Idempotent — multiple FAB mounts won't
    // double-register listeners.
    useEffect(() => {
        installRuntimeTrackers();
    }, []);

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const [isPulsing, setIsPulsing] = useState<boolean>(false);
    const [sentryEventId, setSentryEventId] = useState<string | undefined>(undefined);

    // ------------------------------------------------------------------
    // Keyboard shortcut
    // ------------------------------------------------------------------

    /**
     * Captures the most recent Sentry event ID from the consumer-provided
     * getter. Wrapped in try/catch so any SDK failure cannot crash the FAB.
     */
    const captureSentryEventId = useCallback(() => {
        if (!getSentryEventId) {
            setSentryEventId(undefined);
            return;
        }
        try {
            setSentryEventId(getSentryEventId());
        } catch {
            setSentryEventId(undefined);
        }
    }, [getSentryEventId]);

    const handleToggle = useCallback(() => {
        setIsOpen((prev) => {
            const next = !prev;
            if (next) captureSentryEventId();
            return next;
        });
    }, [captureSentryEventId]);

    useKeyboardShortcut({ onToggle: handleToggle });

    // ------------------------------------------------------------------
    // Listen for external open requests via CustomEvent
    // ------------------------------------------------------------------

    useEffect(() => {
        const handleExternalOpen = () => {
            captureSentryEventId();
            setIsOpen(true);
            if (isMinimized) setIsMinimized(false);
            // Acknowledge so the caller knows the FAB handled the request
            window.dispatchEvent(new CustomEvent('feedback:ack'));
        };
        window.addEventListener('feedback:open', handleExternalOpen);
        return () => window.removeEventListener('feedback:open', handleExternalOpen);
    }, [isMinimized, captureSentryEventId]);

    // ------------------------------------------------------------------
    // Restore minimized state from localStorage after hydration
    // ------------------------------------------------------------------

    useEffect(() => {
        const stored = readMinimizedFromStorage();
        if (stored) setIsMinimized(true);
    }, []);

    // ------------------------------------------------------------------
    // Persist minimized state
    // ------------------------------------------------------------------

    useEffect(() => {
        writeMinimizedToStorage(isMinimized);
    }, [isMinimized]);

    // ------------------------------------------------------------------
    // Pulse animation: trigger every 30 seconds when not minimized
    // ------------------------------------------------------------------

    useEffect(() => {
        if (isMinimized) return;

        const PULSE_INTERVAL_MS = 30_000;
        const PULSE_DURATION_MS = 600;
        let pulseTimeout: ReturnType<typeof setTimeout> | undefined;

        const interval = setInterval(() => {
            setIsPulsing(true);
            pulseTimeout = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS);
        }, PULSE_INTERVAL_MS);

        return () => {
            clearInterval(interval);
            if (pulseTimeout) clearTimeout(pulseTimeout);
        };
    }, [isMinimized]);

    // ------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------

    const handleFabClick = useCallback(() => {
        captureSentryEventId();
        setIsOpen(true);
    }, [captureSentryEventId]);

    const handleMinimize = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsMinimized(true);
    }, []);

    const handleMinimizedClick = useCallback(() => {
        captureSentryEventId();
        setIsOpen(true);
    }, [captureSentryEventId]);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    // ------------------------------------------------------------------
    // Kill switch (AFTER all hooks to satisfy Rules of Hooks)
    // ------------------------------------------------------------------

    if (!FEEDBACK_CONFIG.enabled) return null;

    // ------------------------------------------------------------------
    // Tooltip: derive shortcut label from config instead of hardcoding
    // ------------------------------------------------------------------

    const tooltipId = 'feedback-fab-tooltip';
    const tooltipText = `${FEEDBACK_STRINGS.fab.tooltipBase} (${getShortcutLabel()})`;

    // ------------------------------------------------------------------
    // Shared modal props
    // ------------------------------------------------------------------

    const modalContent = (
        <FeedbackModal
            isOpen={isOpen}
            onClose={handleClose}
            formProps={{
                apiUrl,
                appSource,
                deployVersion,
                userId,
                userEmail,
                userName,
                prefillData,
                featureFlagPrefixes,
                sentryEventId,
                onSentryFeedback
            }}
        />
    );

    // Render the modal via portal to document.body so it escapes any
    // ancestor `overflow: hidden` or `transform` that would clip it.
    const modalElement =
        typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;

    // ------------------------------------------------------------------
    // Render: minimized state
    // ------------------------------------------------------------------

    if (isMinimized) {
        return (
            <>
                <div
                    className={cn('feedback-root', 'fabWrapper')}
                    data-feedback-root=""
                >
                    <button
                        type="button"
                        className={cn('minimizedDot', isHovered && 'minimizedDotExpanded')}
                        onClick={handleMinimizedClick}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onFocus={() => setIsHovered(true)}
                        onBlur={() => setIsHovered(false)}
                        aria-label={tooltipText}
                        aria-describedby={isHovered ? tooltipId : undefined}
                        data-testid="feedback-fab-minimized"
                    >
                        {isHovered && (
                            <DebugIcon
                                size={24}
                                aria-hidden="true"
                            />
                        )}
                    </button>
                    {isHovered && (
                        <span
                            id={tooltipId}
                            className="minimizedTooltip"
                            role="tooltip"
                        >
                            {FEEDBACK_STRINGS.fab.tooltip}
                        </span>
                    )}
                </div>

                {modalElement}
            </>
        );
    }

    // ------------------------------------------------------------------
    // Render: full FAB
    // ------------------------------------------------------------------

    return (
        <>
            <div
                className={cn('feedback-root', 'fabWrapper')}
                data-feedback-root=""
            >
                <button
                    type="button"
                    className={cn('fab', isPulsing && 'pulsing')}
                    onClick={handleFabClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onFocus={() => setIsHovered(true)}
                    onBlur={() => setIsHovered(false)}
                    aria-label={FEEDBACK_STRINGS.fab.tooltip}
                    aria-describedby={isHovered ? tooltipId : undefined}
                    data-testid="feedback-fab"
                >
                    <DebugIcon
                        size={20}
                        aria-hidden="true"
                    />
                    <span className="fabLabel">{FEEDBACK_STRINGS.fab.label}</span>
                </button>

                {/* Tooltip rendered outside button to avoid duplicate screen reader announcement */}
                {isHovered && (
                    <span
                        id={tooltipId}
                        className="tooltip"
                        role="tooltip"
                    >
                        {tooltipText}
                    </span>
                )}

                {/* Minimize button: small circle in top-right corner of the FAB */}
                <button
                    type="button"
                    className="minimizeBtn"
                    onClick={handleMinimize}
                    aria-label={FEEDBACK_STRINGS.fab.minimizeTooltip}
                    data-testid="feedback-fab-minimize"
                >
                    <CloseIcon
                        size={12}
                        aria-hidden="true"
                    />
                </button>
            </div>

            {modalElement}
        </>
    );
}
