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

import type { SentryFeedbackBridgePayload } from '@repo/feedback';
import { FeedbackFAB as FeedbackFABBase } from '@repo/feedback';
import { captureFeedback, getLastEventId } from '@/lib/observability/sentry-lazy';

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
 *
 * Both helpers below delegate to `sentry-lazy`, which reads the SDK only if it
 * has actually been loaded and initialised, and already swallows any SDK error.
 * They return `undefined` / no-op when Sentry is absent — the same behaviour as
 * before HOS-369, when the SDK was present in the bundle but `init()` had not
 * run without crash-reporting consent.
 */
function getSentryEventId(): string | undefined {
    return getLastEventId();
}

/**
 * Mirrors a successful feedback submission into Sentry's User Feedback channel.
 * Best-effort: any SDK error is swallowed so the Linear flow is unaffected.
 */
function handleSentryFeedback(payload: SentryFeedbackBridgePayload): void {
    captureFeedback({ ...payload });
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
