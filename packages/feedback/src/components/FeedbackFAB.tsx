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
import { FEEDBACK_CONFIG, getShortcutLabel } from '../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { useConsoleCapture } from '../hooks/useConsoleCapture.js';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut.js';
import type { AppSourceId, ReportTypeId } from '../schemas/feedback.schema.js';
import {
    FAB_FULL,
    FAB_MINIMIZED,
    FAB_MINIMIZED_HOVERED,
    MINIMIZE_BTN,
    TOOLTIP
} from '../styles/fab.js';
import { FeedbackModal } from './FeedbackModal.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key for persisting the minimized state */
const MINIMIZED_STORAGE_KEY = 'feedback-fab-minimized';

/** CSS keyframes injected once into <head> for the pulse animation */
const PULSE_KEYFRAMES_ID = 'feedback-fab-pulse-keyframes';

const PULSE_CSS = `
@keyframes feedbackFabPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
@media (prefers-reduced-motion: reduce) {
  .feedback-fab-pulse {
    animation: none !important;
  }
}
`;

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
// CSS injection helper
// ---------------------------------------------------------------------------

/**
 * Injects the pulse keyframe CSS into the document <head> once.
 * Safe to call multiple times; a guard element ID prevents duplicates.
 */
function injectPulseStyles(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(PULSE_KEYFRAMES_ID)) return;
    const style = document.createElement('style');
    style.id = PULSE_KEYFRAMES_ID;
    style.textContent = PULSE_CSS;
    document.head.appendChild(style);
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
    apiUrl: string;
    /** Identifier for the application this FAB is rendered in */
    appSource: AppSourceId;
    /** Git commit hash or release tag for the current deploy */
    deployVersion?: string;
    /** Authenticated user ID (pre-fills the form when provided) */
    userId?: string;
    /** Authenticated user email (pre-fills the form when provided) */
    userEmail?: string;
    /** Authenticated user display name (pre-fills the form when provided) */
    userName?: string;
    /**
     * Optional pre-fill data, typically supplied by an error boundary.
     * When present the form opens pre-filled with the error details.
     */
    prefillData?: {
        /** Pre-selected report type */
        type?: ReportTypeId;
        /** Pre-filled issue title */
        title?: string;
        /** Pre-filled issue description */
        description?: string;
        /** JavaScript error info captured by an error boundary */
        errorInfo?: { message: string; stack?: string };
    };
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
    prefillData
}: FeedbackFABProps): React.JSX.Element | null {
    // ------------------------------------------------------------------
    // State (all hooks MUST be before any conditional return)
    // ------------------------------------------------------------------

    // Install console.error interceptor at FAB mount time (app startup)
    // so errors are captured before the form is opened (GAP-031-04).
    useConsoleCapture();

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const [isPulsing, setIsPulsing] = useState<boolean>(false);
    const [isDesktop, setIsDesktop] = useState<boolean>(false);

    // ------------------------------------------------------------------
    // Keyboard shortcut
    // ------------------------------------------------------------------

    const handleToggle = useCallback(() => {
        setIsOpen((prev) => !prev);
    }, []);

    useKeyboardShortcut({ onToggle: handleToggle });

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
    // Inject pulse CSS keyframes once
    // ------------------------------------------------------------------

    useEffect(() => {
        injectPulseStyles();
    }, []);

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
        setIsOpen(true);
    }, []);

    const handleMinimize = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        setIsMinimized(true);
    }, []);

    const handleMinimizedClick = useCallback(() => {
        setIsOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    // ------------------------------------------------------------------
    // Desktop FAB size upgrade via media query (48px -> 56px)
    // ------------------------------------------------------------------

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mql = window.matchMedia('(min-width: 640px)');
        const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

        setIsDesktop(mql.matches);
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);

    // ------------------------------------------------------------------
    // Kill switch (AFTER all hooks to satisfy Rules of Hooks)
    // ------------------------------------------------------------------

    if (!FEEDBACK_CONFIG.enabled) return null;

    // ------------------------------------------------------------------
    // Derived styles
    // ------------------------------------------------------------------

    const fabSize = isDesktop ? '56px' : '48px';

    const fullFabStyle: React.CSSProperties = {
        ...FAB_FULL,
        width: fabSize,
        height: fabSize,
        ...(isPulsing
            ? {
                  animation: 'feedbackFabPulse 0.6s ease-in-out'
              }
            : {})
    };

    const minimizedStyle: React.CSSProperties = isHovered ? FAB_MINIMIZED_HOVERED : FAB_MINIMIZED;

    // ------------------------------------------------------------------
    // Tooltip: derive shortcut label from config instead of hardcoding
    // ------------------------------------------------------------------

    const tooltipId = 'feedback-fab-tooltip';
    const tooltipText = `${FEEDBACK_STRINGS.fab.tooltipBase} (${getShortcutLabel()})`;

    // ------------------------------------------------------------------
    // Shared modal props
    // ------------------------------------------------------------------

    const modalElement = (
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
                prefillData
            }}
        />
    );

    // ------------------------------------------------------------------
    // Render: minimized state
    // ------------------------------------------------------------------

    if (isMinimized) {
        return (
            <>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                        type="button"
                        style={minimizedStyle}
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
                            style={TOOLTIP}
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
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                    type="button"
                    style={fullFabStyle}
                    className={isPulsing ? 'feedback-fab-pulse' : undefined}
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
                        size={24}
                        aria-hidden="true"
                    />
                </button>

                {/* Tooltip rendered outside button to avoid duplicate screen reader announcement */}
                {isHovered && (
                    <span
                        id={tooltipId}
                        style={TOOLTIP}
                        role="tooltip"
                    >
                        {tooltipText}
                    </span>
                )}

                {/* Minimize button: small circle in top-right corner of the FAB */}
                <button
                    type="button"
                    style={MINIMIZE_BTN}
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
