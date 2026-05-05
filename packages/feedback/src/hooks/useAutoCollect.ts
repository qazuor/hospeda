/**
 * @repo/feedback - useAutoCollect hook.
 *
 * Combines the environment collector and console capture to provide
 * auto-collected data when the feedback form opens. Exposes a mutable
 * environment object so the user can review and edit values before submission.
 */
import { useCallback, useEffect, useState } from 'react';
import { collectEnvironmentData } from '../lib/collector.js';
import {
    getLastInteractions,
    getNavigationHistory,
    installRuntimeTrackers
} from '../lib/runtime-trackers.js';
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
    /** Optional override for which localStorage prefixes are scanned for feature flags */
    featureFlagPrefixes?: ReadonlyArray<string>;
    /** Most recent Sentry event ID (typically supplied by the FAB on open) */
    sentryEventId?: string;
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
 * Combines browser detection, console error capture, runtime ring buffers
 * (navigation + interactions), and optional auth context into a mutable
 * environment object that the user can review and edit before submission.
 * The `consoleErrors`, `navigationHistory`, and `lastInteractions` fields
 * are refreshed on mount.
 *
 * @param input - App source, optional version/user context, and pre-filled error info
 * @returns Mutable environment object, an `updateField` setter, and pass-through user fields
 */
export function useAutoCollect(input: UseAutoCollectInput): UseAutoCollectResult {
    const { getErrors } = useConsoleCapture();

    // Make sure runtime trackers are installed (idempotent) so the buffers
    // start filling as soon as the FAB mounts.
    useEffect(() => {
        installRuntimeTrackers();
    }, []);

    const [environment, setEnvironment] = useState<FeedbackEnvironment>(() =>
        collectEnvironmentData({
            appSource: input.appSource,
            deployVersion: input.deployVersion,
            userId: input.userId,
            consoleErrors: getErrors(),
            errorInfo: input.errorInfo,
            featureFlagPrefixes: input.featureFlagPrefixes,
            navigationHistory: getNavigationHistory(),
            lastInteractions: getLastInteractions(),
            sentryEventId: input.sentryEventId
        })
    );

    // Refresh dynamic data on mount so the user sees the most recent
    // console errors / navigation / interactions.
    useEffect(() => {
        setEnvironment((prev) => ({
            ...prev,
            consoleErrors: getErrors(),
            navigationHistory: getNavigationHistory(),
            lastInteractions: getLastInteractions()
        }));
    }, [getErrors]);

    // Update environment when auth props or sentry event id change.
    useEffect(() => {
        setEnvironment((prev) => ({
            ...prev,
            userId: input.userId,
            appSource: input.appSource,
            deployVersion: input.deployVersion,
            sentryEventId: input.sentryEventId
        }));
    }, [input.userId, input.appSource, input.deployVersion, input.sentryEventId]);

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
