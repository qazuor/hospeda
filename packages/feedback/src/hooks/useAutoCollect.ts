/**
 * @repo/feedback - useAutoCollect hook.
 *
 * Combines the environment collector and console capture to provide
 * auto-collected data when the feedback form opens. Exposes a mutable
 * environment object so the user can review and edit values before submission.
 */
import { useCallback, useEffect, useState } from 'react';
import { collectEnvironmentData } from '../lib/collector.js';
import type { AppSourceId, FeedbackEnvironment } from '../schemas/feedback.schema.js';
import { useConsoleCapture } from './useConsoleCapture.js';

/**
 * Input for auto-collecting environment data.
 *
 * @example
 * ```tsx
 * const result = useAutoCollect({
 *   appSource: 'web',
 *   deployVersion: 'abc1234',
 *   userId: 'usr_123',
 *   userEmail: 'user@example.com',
 *   userName: 'Jane Doe',
 * });
 * ```
 */
export interface UseAutoCollectInput {
    /** Application source identifier */
    appSource: AppSourceId;
    /** Deploy version (git hash or release tag) */
    deployVersion?: string;
    /** Authenticated user ID */
    userId?: string;
    /** Authenticated user email (pre-fills the reporter email field) */
    userEmail?: string;
    /** Authenticated user name (pre-fills the reporter name field) */
    userName?: string;
    /** Pre-filled error info from an error boundary */
    errorInfo?: { message: string; stack?: string };
}

/**
 * Return value of useAutoCollect.
 */
export interface UseAutoCollectResult {
    /** Collected environment data, mutable via updateField */
    environment: FeedbackEnvironment;
    /**
     * Updates a single field in the environment object.
     *
     * @param key - The FeedbackEnvironment field to update
     * @param value - The new value for that field
     */
    updateField: <K extends keyof FeedbackEnvironment>(
        key: K,
        value: FeedbackEnvironment[K]
    ) => void;
    /** Pre-filled user email passed from auth context */
    userEmail?: string;
    /** Pre-filled user name passed from auth context */
    userName?: string;
}

/**
 * Auto-collects environment data when mounted.
 *
 * Combines browser detection, console error capture, and optional auth context
 * into a mutable environment object that the user can review and edit before
 * submission. The `consoleErrors` field is refreshed on mount to capture any
 * errors that occurred since page load.
 *
 * @param input - App source, optional version/user context, and pre-filled error info
 * @returns Mutable environment object, an `updateField` setter, and pass-through user fields
 *
 * @example
 * ```tsx
 * function FeedbackForm({ appSource }: { appSource: AppSourceId }) {
 *   const { environment, updateField, userEmail, userName } = useAutoCollect({
 *     appSource,
 *     deployVersion: import.meta.env.PUBLIC_VERSION,
 *   });
 *
 *   return (
 *     <input
 *       value={environment.currentUrl ?? ''}
 *       onChange={(e) => updateField('currentUrl', e.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function useAutoCollect(input: UseAutoCollectInput): UseAutoCollectResult {
    const { getErrors } = useConsoleCapture();

    const [environment, setEnvironment] = useState<FeedbackEnvironment>(() =>
        collectEnvironmentData({
            appSource: input.appSource,
            deployVersion: input.deployVersion,
            userId: input.userId,
            consoleErrors: getErrors(),
            errorInfo: input.errorInfo
        })
    );

    // Refresh console errors on mount to capture any errors since page load.
    useEffect(() => {
        setEnvironment((prev) => ({
            ...prev,
            consoleErrors: getErrors()
        }));
    }, [getErrors]);

    // Update environment when auth props change (e.g., user logs in/out).
    useEffect(() => {
        setEnvironment((prev) => ({
            ...prev,
            userId: input.userId,
            appSource: input.appSource,
            deployVersion: input.deployVersion
        }));
    }, [input.userId, input.appSource, input.deployVersion]);

    const updateField = useCallback(
        <K extends keyof FeedbackEnvironment>(key: K, value: FeedbackEnvironment[K]) => {
            setEnvironment((prev) => ({ ...prev, [key]: value }));
        },
        []
    );

    return {
        environment,
        updateField,
        userEmail: input.userEmail,
        userName: input.userName
    };
}
