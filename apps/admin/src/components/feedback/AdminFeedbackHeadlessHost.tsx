/**
 * @file AdminFeedbackHeadlessHost.tsx
 * @description Headless React component for the admin feedback system (SPEC-301 T-010).
 *
 * Replaces the visible FeedbackFAB in __root.tsx. Preserves every integration
 * surface of the old FAB without rendering any visible button:
 * - Ctrl+Shift+F keyboard shortcut opens the in-page FeedbackModal.
 * - `feedback:open` CustomEvent opens the modal and replies `feedback:ack`.
 * - Sentry correlation bridge (lastEventId / captureFeedback) is wired
 *   identically to the old FeedbackFAB integration in __root.tsx.
 * - Console capture and runtime trackers are installed so diagnostic context
 *   is available when the modal opens.
 *
 * The admin uses `@sentry/react` (not `@sentry/astro` like the web app).
 * The Sentry bridge is identical: SDK-agnostic try/catch wrappers on
 * `Sentry.lastEventId` and `Sentry.captureFeedback`.
 *
 * Renders: FeedbackModal via portal to document.body. Zero visible UI at rest.
 * Gate: callers MUST check `import.meta.env.VITE_FEEDBACK_ENABLED !== 'false'`
 * before mounting this component.
 */

import {
    FeedbackModal,
    installRuntimeTrackers,
    useConsoleCapture,
    useKeyboardShortcut
} from '@repo/feedback';
import type { SentryFeedbackBridgePayload } from '@repo/feedback';
import * as Sentry from '@sentry/react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for the headless admin feedback host.
 * Values are resolved and threaded from __root.tsx (same surface as FeedbackFAB).
 */
export interface AdminFeedbackHeadlessHostProps {
    /** API base URL for feedback submission. */
    readonly apiUrl: string;
    /** Git commit SHA or release tag for the current deploy. */
    readonly deployVersion?: string;
    /** Authenticated user ID — undefined when not logged in. */
    readonly userId?: string;
    /** Authenticated user email — undefined when not logged in. */
    readonly userEmail?: string;
    /** Authenticated user display name — undefined when not logged in. */
    readonly userName?: string;
    /**
     * Cloudflare Turnstile site key for the invisible bot-detection widget.
     * Passed through to FeedbackForm via formProps. When undefined, the widget
     * is not rendered and the server applies its own fail-closed policy.
     */
    readonly turnstileSiteKey?: string;
}

// ---------------------------------------------------------------------------
// Sentry bridge helpers
// ---------------------------------------------------------------------------

/**
 * Returns the most recent Sentry event ID, if available.
 * Wrapped in try/catch so SDK changes or pre-init calls cannot crash the host.
 */
function getSentryEventId(): string | undefined {
    try {
        const fn = (Sentry as { lastEventId?: () => string | undefined }).lastEventId;
        return typeof fn === 'function' ? fn() : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Mirrors a successful feedback submission into Sentry's User Feedback channel.
 * Best-effort: any SDK error is swallowed so the Linear flow is unaffected.
 */
function bridgeSentryFeedback(payload: SentryFeedbackBridgePayload): void {
    try {
        const fn = (
            Sentry as {
                captureFeedback?: (data: {
                    name: string;
                    email: string;
                    message: string;
                    associatedEventId?: string;
                }) => void;
            }
        ).captureFeedback;
        fn?.(payload);
    } catch {
        // Intentional no-op — Sentry failure must not block feedback submission
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AdminFeedbackHeadlessHost
 *
 * Invisible at rest. Activates when the user presses Ctrl+Shift+F or when
 * any part of the admin dispatches a `feedback:open` CustomEvent (e.g., the
 * "Reportar un problema" button in the user dropdown menu).
 *
 * @param props - Server-resolved props threaded from __root.tsx.
 */
export function AdminFeedbackHeadlessHost({
    apiUrl,
    deployVersion,
    userId,
    userEmail,
    userName,
    turnstileSiteKey
}: AdminFeedbackHeadlessHostProps): React.JSX.Element | null {
    // Install console.error interceptor once at mount time so errors that
    // occur before the modal is opened are still captured.
    useConsoleCapture();

    // Install navigation history + last-interaction trackers. Idempotent —
    // safe to call multiple times if the component remounts.
    useEffect(() => {
        installRuntimeTrackers();
    }, []);

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [sentryEventId, setSentryEventId] = useState<string | undefined>(undefined);

    // Defer portal to after mount so the hydrated tree matches the server tree
    // (no portal on SSR since document.body doesn't exist server-side).
    const [mounted, setMounted] = useState<boolean>(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // ------------------------------------------------------------------
    // Sentry event ID capture
    // ------------------------------------------------------------------

    const captureSentryEventId = useCallback(() => {
        try {
            setSentryEventId(getSentryEventId());
        } catch {
            setSentryEventId(undefined);
        }
    }, []);

    // ------------------------------------------------------------------
    // Keyboard shortcut: Ctrl+Shift+F (Cmd+Shift+F on macOS)
    // ------------------------------------------------------------------

    const handleToggle = useCallback(() => {
        setIsOpen((prev) => {
            const next = !prev;
            if (next) captureSentryEventId();
            return next;
        });
    }, [captureSentryEventId]);

    useKeyboardShortcut({ onToggle: handleToggle });

    // ------------------------------------------------------------------
    // External open request via CustomEvent (user menu, error pages, etc.)
    // ------------------------------------------------------------------

    useEffect(() => {
        const handleExternalOpen = () => {
            captureSentryEventId();
            setIsOpen(true);
            // Acknowledge so the caller knows the host handled the request
            window.dispatchEvent(new CustomEvent('feedback:ack'));
        };
        window.addEventListener('feedback:open', handleExternalOpen);
        return () => window.removeEventListener('feedback:open', handleExternalOpen);
    }, [captureSentryEventId]);

    // ------------------------------------------------------------------
    // Close handler
    // ------------------------------------------------------------------

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    // ------------------------------------------------------------------
    // Render: modal via portal only, no visible button
    // ------------------------------------------------------------------

    if (!mounted) return null;

    return createPortal(
        <FeedbackModal
            isOpen={isOpen}
            onClose={handleClose}
            formProps={{
                apiUrl,
                appSource: 'admin',
                deployVersion,
                userId,
                userEmail,
                userName,
                sentryEventId,
                onSentryFeedback: bridgeSentryFeedback,
                turnstileSiteKey
            }}
        />,
        document.body
    );
}
