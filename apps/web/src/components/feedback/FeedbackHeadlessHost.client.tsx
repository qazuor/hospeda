/**
 * @file FeedbackHeadlessHost.client.tsx
 * @description Headless React island for the feedback system.
 *
 * Replaces the visible FeedbackFABClient in BaseLayout. Preserves every
 * integration surface of the old FAB without rendering any visible button:
 * - Ctrl+Shift+F keyboard shortcut opens the in-page FeedbackModal.
 * - `feedback:open` CustomEvent opens the modal and replies `feedback:ack`.
 * - Sentry correlation bridge (lastEventId / captureFeedback) is wired
 *   identically to FeedbackFABClient.
 * - Console capture and runtime trackers (navigation history, last
 *   interactions) are installed so diagnostic context is available when the
 *   modal opens via the shortcut or the footer link.
 *
 * Design choice: in-page modal (not navigate to /[lang]/feedback/).
 * Rationale: the standalone page is reserved for error pages and direct links.
 * Using the modal preserves the shortcut UX exactly (instant, no navigation,
 * no scroll-to-top) and avoids a UX regression for keyboard users. The slim
 * form (T-005) renders automatically inside FeedbackModal/FeedbackForm.
 *
 * Renders: FeedbackModal via portal to document.body. Zero visible UI at rest.
 * Gate: callers MUST check isFeedbackEnabled() before mounting.
 * Hydration strategy: client:idle (same as the old FeedbackFABClient).
 */

import {
    FeedbackModal,
    installRuntimeTrackers,
    useConsoleCapture,
    useKeyboardShortcut
} from '@repo/feedback';
import type { SentryFeedbackBridgePayload } from '@repo/feedback';
import * as Sentry from '@sentry/astro';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for the headless feedback host island.
 * Same server-resolved values that BaseLayout previously passed to FeedbackFABClient.
 */
export interface FeedbackHeadlessHostProps {
    /** Base URL of the feedback API (resolved server-side via getApiUrl()) */
    readonly apiUrl: string;
    /** Git commit SHA or release tag for the current deploy */
    readonly deployVersion?: string;
    /** Authenticated user ID — undefined when not logged in */
    readonly userId?: string;
    /** Authenticated user email — undefined when not logged in */
    readonly userEmail?: string;
    /** Authenticated user display name — undefined when not logged in */
    readonly userName?: string;
}

// ---------------------------------------------------------------------------
// Sentry bridge helpers (identical to FeedbackFABClient — package stays SDK-agnostic)
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
function handleSentryFeedback(payload: SentryFeedbackBridgePayload): void {
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
 * FeedbackHeadlessHost island for the Hospeda web app.
 *
 * Invisible at rest. Activates when the user presses Ctrl+Shift+F or when
 * any part of the page dispatches a `feedback:open` CustomEvent (e.g., the
 * 404/500 error pages).
 *
 * @param props - Server-resolved props passed from BaseLayout.
 */
export function FeedbackHeadlessHost({
    apiUrl,
    deployVersion,
    userId,
    userEmail,
    userName
}: FeedbackHeadlessHostProps): React.JSX.Element | null {
    // Install console.error interceptor once at mount time so errors that
    // occur before the modal is opened are still captured (GAP-031-04).
    useConsoleCapture();

    // Install navigation history + last-interaction trackers. Idempotent —
    // safe to call multiple times if the component remounts.
    useEffect(() => {
        installRuntimeTrackers();
    }, []);

    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [sentryEventId, setSentryEventId] = useState<string | undefined>(undefined);

    // SPEC-099 B-1: emit `null` on SSR + first client render so the hydrated
    // tree matches the server tree. Flip to `true` after mount to allow portal.
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
    // External open request via CustomEvent (error pages, footer link, etc.)
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
                appSource: 'web',
                deployVersion,
                userId,
                userEmail,
                userName,
                sentryEventId,
                onSentryFeedback: handleSentryFeedback
            }}
        />,
        document.body
    );
}
