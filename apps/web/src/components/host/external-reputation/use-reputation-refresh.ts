/**
 * @file use-reputation-refresh.ts
 * @description Refresh action and status polling of the external reputation
 * section (HOS-2515, originally SPEC-250 Phase 7).
 *
 * - 202: Apify runs were enqueued, so polling starts until every platform
 *   settles (OQ-4: the refresh button stays disabled meanwhile).
 * - 200: resolved inline; with nothing queried it says so (HOS-1944).
 * - 429: the rate-limit message, with the minutes the server sent.
 *
 * The refresh is a persisting action, reported through `runEditorAutoSave`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { runEditorAutoSave } from '@/components/account/editor-shell/editor-auto-save-signal';
import { type ReputationPlatformStatus, useReputationStatus } from '@/hooks/use-reputation-status';
import type { TranslationFn } from '@/lib/i18n';
import { type RefreshResult, requestRefresh } from './external-reputation-api';

/** Brief feedback after a refresh. */
export type RefreshFeedback = 'enqueued' | 'inlineSuccess' | 'noPlatforms';

/** Return shape of {@link useReputationRefresh}. */
export interface UseReputationRefreshResult {
    readonly statusPlatforms: Readonly<Partial<Record<string, ReputationPlatformStatus>>>;
    /** True when every platform has `runStatus = 'idle'`. */
    readonly allSettled: boolean;
    readonly statusError: string | null;
    readonly isRefreshing: boolean;
    readonly refreshError: string | null;
    readonly rateLimitMinutes: number | null;
    readonly feedback: RefreshFeedback | null;
    /** Runs the refresh and reloads the listings. */
    readonly refresh: () => Promise<void>;
}

/**
 * Refresh action plus status polling.
 *
 * @param params - The accommodation id, a `reload` callback and a STABLE `t`.
 * @returns The state and the refresh action.
 */
export function useReputationRefresh({
    accommodationId,
    reload,
    t
}: {
    readonly accommodationId: string;
    readonly reload: () => Promise<void>;
    readonly t: TranslationFn;
}): UseReputationRefreshResult {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [rateLimitMinutes, setRateLimitMinutes] = useState<number | null>(null);
    /** Whether the last refresh enqueued async runs (202): drives polling. */
    const [asyncPending, setAsyncPending] = useState(false);
    const [feedback, setFeedback] = useState<RefreshFeedback | null>(null);

    const {
        platforms: statusPlatforms,
        allSettled,
        error
    } = useReputationStatus(accommodationId, asyncPending);

    // Stop polling once every platform has settled.
    useEffect(() => {
        if (allSettled && asyncPending) setAsyncPending(false);
    }, [allSettled, asyncPending]);

    const refreshRef = useRef<() => Promise<void>>(async () => undefined);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        setRefreshError(null);
        setRateLimitMinutes(null);
        setFeedback(null);
        const holder: { outcome: RefreshResult } = { outcome: { kind: 'failed' } };
        const ok = await runEditorAutoSave({
            save: async () => {
                holder.outcome = await requestRefresh({ accommodationId });
                return holder.outcome.kind === 'enqueued' || holder.outcome.kind === 'inline';
            },
            retry: () => void refreshRef.current()
        });
        setIsRefreshing(false);
        const { outcome } = holder;
        if (outcome.kind === 'rateLimited') {
            setRateLimitMinutes(outcome.minutes);
            return;
        }
        if (!ok) {
            setRefreshError(t('external-reputation.errors.refreshFailed'));
            return;
        }
        if (outcome.kind === 'enqueued') {
            setAsyncPending(true);
            setFeedback('enqueued');
        } else if (outcome.kind === 'inline') {
            setAsyncPending(false);
            setFeedback(outcome.nothingToRefresh ? 'noPlatforms' : 'inlineSuccess');
        }
        await reload();
    }, [accommodationId, reload, t]);
    refreshRef.current = refresh;

    return {
        statusPlatforms,
        allSettled,
        statusError: error,
        isRefreshing,
        refreshError,
        rateLimitMinutes,
        feedback,
        refresh
    };
}
