/**
 * @repo/feedback - FeedbackFAB (Floating Action Button) component.
 *
 * The primary entry point for the feedback system. Renders a labelled pill
 * button in the bottom-right corner that, after a short delay, auto-collapses
 * to an icon-only circle so it stops competing with page content. Hovering
 * (or focusing) expands the pill back so the user always sees the affordance
 * before clicking.
 *
 * Clicking the FAB or pressing the configured keyboard shortcut
 * (Ctrl+Shift+F) opens the FeedbackModal.
 *
 * A subtle pulse animation fires every 30 seconds to draw attention. The
 * animation is suppressed when `prefers-reduced-motion: reduce` is set.
 *
 * Rendering is skipped entirely when `FEEDBACK_CONFIG.enabled` is false,
 * acting as a kill switch for the entire feedback system.
 */
import { DebugIcon } from '@repo/icons';
import type { AppSourceId, ReportTypeId } from '@repo/schemas';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FEEDBACK_CONFIG, getShortcutLabel } from '../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../config/strings.js';
import { useConsoleCapture } from '../hooks/useConsoleCapture.js';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut.js';
import { installRuntimeTrackers } from '../lib/runtime-trackers.js';
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

/** Delay before the FAB collapses from labelled pill to icon-only. */
const COLLAPSE_DELAY_MS = 2200;

/**
 * Legacy localStorage key for the previous "user-pinned minimize" feature.
 * The new behavior is auto-collapse-on-timer with no persistence, so we
 * defensively clear any leftover value that might still trigger old code
 * in cached bundles. Safe to remove once cached clients have rotated.
 */
const LEGACY_MINIMIZED_STORAGE_KEY = 'feedback-fab-minimized';

function clearLegacyMinimizedFlag(): void {
    if (typeof window === 'undefined') return;
    try {
        globalThis.localStorage.removeItem(LEGACY_MINIMIZED_STORAGE_KEY);
    } catch {
        // Ignore — private browsing or storage quota errors.
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
        // Drop the legacy persisted-minimize flag; the new FAB auto-collapses
        // on a timer and never persists user-driven state.
        clearLegacyMinimizedFlag();
    }, []);

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const [isPulsing, setIsPulsing] = useState<boolean>(false);
    const [sentryEventId, setSentryEventId] = useState<string | undefined>(undefined);

    // SPEC-099 B-1: gate the portal render with a post-mount flag so SSR and
    // the first client render both emit `null` for the modal subtree. Once
    // hydration completes we flip `mounted` and createPortal moves the modal
    // into document.body without React seeing a structural diff.
    const [mounted, setMounted] = useState<boolean>(false);
    useEffect(() => {
        setMounted(true);
    }, []);

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
            // Acknowledge so the caller knows the FAB handled the request
            window.dispatchEvent(new CustomEvent('feedback:ack'));
        };
        window.addEventListener('feedback:open', handleExternalOpen);
        return () => window.removeEventListener('feedback:open', handleExternalOpen);
    }, [captureSentryEventId]);

    // ------------------------------------------------------------------
    // Auto-collapse: shrink labelled pill to icon-only after a short delay
    // so the FAB stops competing with page content. Hover/focus expands it
    // back via CSS.
    // ------------------------------------------------------------------

    useEffect(() => {
        const timer = setTimeout(() => setIsCollapsed(true), COLLAPSE_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    // ------------------------------------------------------------------
    // Pulse animation: trigger every 30 seconds.
    // ------------------------------------------------------------------

    useEffect(() => {
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
    }, []);

    // ------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------

    const handleFabClick = useCallback(() => {
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
    // ARIA / native title text
    // ------------------------------------------------------------------

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
    // SPEC-099 B-1: emit `null` on SSR + first client render, then portal
    // after mount. This keeps the hydrated tree identical to the server
    // tree and avoids React re-rendering the entire FAB subtree.
    const modalElement = mounted ? createPortal(modalContent, document.body) : null;

    // ------------------------------------------------------------------
    // Render: single labelled pill that auto-collapses to icon-only after a
    // short delay. Hover/focus expands it back via CSS using `:hover` /
    // `:focus-visible` so no extra React state is needed.
    // ------------------------------------------------------------------

    return (
        <>
            <div
                className={cn('feedback-root', 'fabWrapper')}
                data-feedback-root=""
            >
                <button
                    type="button"
                    className={cn('fab', isCollapsed && 'fabCollapsed', isPulsing && 'pulsing')}
                    onClick={handleFabClick}
                    aria-label={tooltipText}
                    title={tooltipText}
                    data-testid="feedback-fab"
                >
                    <DebugIcon
                        size={24}
                        aria-hidden="true"
                    />
                    <span className="fabLabel">{FEEDBACK_STRINGS.fab.label}</span>
                </button>
            </div>

            {modalElement}
        </>
    );
}
