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
import { useCallback, useEffect, useState } from 'react';
import { FEEDBACK_CONFIG } from '../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut.js';
import type { AppSourceId, ReportTypeId } from '../schemas/feedback.schema.js';
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
// Inline SVG icon
// ---------------------------------------------------------------------------

/**
 * Simple bug SVG icon rendered inline to keep the feedback package
 * self-contained with no dependency on @repo/icons.
 */
function BugIcon(): React.JSX.Element {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
            <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Minimize icon (small X)
// ---------------------------------------------------------------------------

function MinimizeIcon(): React.JSX.Element {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <line
                x1="2"
                y1="2"
                x2="10"
                y2="10"
            />
            <line
                x1="10"
                y1="2"
                x2="2"
                y2="10"
            />
        </svg>
    );
}

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------

const FAB_BASE: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease'
};

const FAB_FULL: React.CSSProperties = {
    ...FAB_BASE,
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.45), 0 2px 6px rgba(0, 0, 0, 0.2)'
};

const FAB_MINIMIZED: React.CSSProperties = {
    ...FAB_BASE,
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#93c5fd',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
};

const FAB_MINIMIZED_HOVERED: React.CSSProperties = {
    ...FAB_MINIMIZED,
    width: '48px',
    height: '48px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.45)'
};

const MINIMIZE_BTN: React.CSSProperties = {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    backgroundColor: '#1e40af',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 1,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)'
};

const TOOLTIP: React.CSSProperties = {
    position: 'absolute',
    right: '56px',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    fontSize: '13px',
    lineHeight: '1.4',
    padding: '6px 10px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
};

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
    // Kill switch
    // ------------------------------------------------------------------

    if (!FEEDBACK_CONFIG.enabled) return null;

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [isHovered, setIsHovered] = useState<boolean>(false);
    const [isPulsing, setIsPulsing] = useState<boolean>(false);

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

        const interval = setInterval(() => {
            setIsPulsing(true);
            const timeout = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS);
            return () => clearTimeout(timeout);
        }, PULSE_INTERVAL_MS);

        return () => clearInterval(interval);
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
    // We apply it via an inline style override using a media-safe approach.
    // Since inline styles cannot target media queries, we use a size state.
    // ------------------------------------------------------------------

    const [isDesktop, setIsDesktop] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mql = window.matchMedia('(min-width: 640px)');
        const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

        setIsDesktop(mql.matches);
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);

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
    // Render: minimized state
    // ------------------------------------------------------------------

    if (isMinimized) {
        return (
            <>
                <button
                    type="button"
                    style={minimizedStyle}
                    onClick={handleMinimizedClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onFocus={() => setIsHovered(true)}
                    onBlur={() => setIsHovered(false)}
                    aria-label={FEEDBACK_STRINGS.fab.tooltip}
                    title={FEEDBACK_STRINGS.fab.tooltip}
                    data-testid="feedback-fab-minimized"
                >
                    {isHovered && <BugIcon />}
                    {isHovered && <span style={TOOLTIP}>{FEEDBACK_STRINGS.fab.tooltip}</span>}
                </button>

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
            </>
        );
    }

    // ------------------------------------------------------------------
    // Render: full FAB
    // ------------------------------------------------------------------

    return (
        <>
            {/* Style tag ensures the pulse class works without a CSS file */}
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
                    data-testid="feedback-fab"
                >
                    <BugIcon />

                    {/* Tooltip on hover */}
                    {isHovered && (
                        <span
                            style={TOOLTIP}
                            role="tooltip"
                        >
                            {FEEDBACK_STRINGS.fab.tooltip}
                        </span>
                    )}
                </button>

                {/* Minimize button: small circle in top-right corner of the FAB */}
                <button
                    type="button"
                    style={MINIMIZE_BTN}
                    onClick={handleMinimize}
                    aria-label={FEEDBACK_STRINGS.fab.minimizeTooltip}
                    data-testid="feedback-fab-minimize"
                >
                    <MinimizeIcon />
                </button>
            </div>

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
        </>
    );
}
