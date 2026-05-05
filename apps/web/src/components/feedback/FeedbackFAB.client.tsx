/**
 * @file FeedbackFAB.client.tsx
 * @description Thin React island wrapper that mounts the @repo/feedback FeedbackFAB
 * in the Astro web app, wiring Sentry correlation defensively so that missing or
 * differently-shaped SDK builds cannot crash the FAB.
 *
 * All Sentry imports live here — the @repo/feedback package stays SDK-agnostic.
 *
 * Hydration strategy: client:idle (mounted in BaseLayout after all other islands)
 */

import { FeedbackFAB as FeedbackFABBase } from '@repo/feedback';
import type { SentryFeedbackBridgePayload } from '@repo/feedback';
import * as Sentry from '@sentry/astro';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props accepted by the web island wrapper.
 * These are resolved on the server side by BaseLayout and passed as island props.
 */
export interface FeedbackFABClientProps {
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
// Sentry bridge helpers
// ---------------------------------------------------------------------------

/**
 * Returns the most recent Sentry event ID, if available.
 * Wrapped in try/catch so SDK changes or pre-init calls cannot crash the FAB.
 *
 * Uses dynamic-dispatch typing to avoid a hard dependency on the exact shape
 * of the @sentry/astro public surface at compile time.
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
// Island component
// ---------------------------------------------------------------------------

/**
 * FeedbackFAB island for the Hospeda web app.
 *
 * Glue layer between the Astro server context (env vars, user locals) and
 * the SDK-agnostic @repo/feedback React component. Hardcodes `appSource="web"`.
 *
 * @param props - Server-resolved props passed from BaseLayout.
 */
export function FeedbackFABClient({
    apiUrl,
    deployVersion,
    userId,
    userEmail,
    userName
}: FeedbackFABClientProps): React.JSX.Element {
    return (
        <FeedbackFABBase
            apiUrl={apiUrl}
            appSource="web"
            deployVersion={deployVersion}
            userId={userId}
            userEmail={userEmail}
            userName={userName}
            getSentryEventId={getSentryEventId}
            onSentryFeedback={handleSentryFeedback}
        />
    );
}
