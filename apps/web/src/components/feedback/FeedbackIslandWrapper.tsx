/**
 * FeedbackIslandWrapper - Error boundary wrapper for React islands.
 *
 * Wraps complex interactive islands (search, filters, forms) with
 * FeedbackErrorBoundary so that JS crashes show a recoverable error
 * UI instead of a blank section.
 *
 * Usage in Astro:
 * ```astro
 * ---
 * import FeedbackIslandWrapper from '@/components/feedback/FeedbackIslandWrapper';
 * import { getApiUrl } from '@/lib/env';
 * ---
 * <FeedbackIslandWrapper client:load apiUrl={getApiUrl()}>
 *   <MyComplexIsland />
 * </FeedbackIslandWrapper>
 * ```
 *
 * NOTE: Do not wrap every island. Reserve this for complex interactive
 * components where a crash would leave a visible blank section.
 * Simple display-only islands do not need it.
 */
import { FeedbackErrorBoundary } from '@repo/feedback';
import type { ReactNode } from 'react';

/** Props for FeedbackIslandWrapper */
export interface FeedbackIslandWrapperProps {
    /** Child island components to protect */
    children: ReactNode;
    /** Base URL of the feedback API endpoint */
    apiUrl: string;
    /** Authenticated user's email (optional, prefills error reports) */
    userEmail?: string;
    /** Authenticated user's name (optional, prefills error reports) */
    userName?: string;
    /** Authenticated user's ID (optional, attached to error reports) */
    userId?: string;
    /** Locale for the feedback page URL (defaults to 'es') */
    locale?: string;
}

/**
 * Wraps a React island with FeedbackErrorBoundary.
 *
 * When the child tree throws, the boundary renders an inline error UI
 * with a link to the standalone feedback page so users can report the crash.
 *
 * @param props - See {@link FeedbackIslandWrapperProps}
 */
export function FeedbackIslandWrapper({
    children,
    apiUrl,
    userEmail,
    userName,
    userId,
    locale = 'es'
}: FeedbackIslandWrapperProps): React.JSX.Element {
    return (
        <FeedbackErrorBoundary
            appSource="web"
            apiUrl={apiUrl}
            feedbackPageUrl={`/${locale}/feedback/`}
            userEmail={userEmail}
            userName={userName}
            userId={userId}
        >
            {children}
        </FeedbackErrorBoundary>
    );
}
