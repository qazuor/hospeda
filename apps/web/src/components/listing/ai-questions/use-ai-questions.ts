/**
 * Data of the «Preguntas a la IA» tab (HOS-2101, split out of
 * `AiQuestionsPanel` by HOS-2503): the list request, the date range, the
 * «Ver más» paging and the dismiss / undo mutations.
 *
 * @module components/listing/ai-questions/use-ai-questions
 */

import type {
    AiChatEntityType,
    AiListingQuestion,
    AiListingQuestionsResponse
} from '@repo/schemas';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { TranslationFn } from '@/lib/i18n';
import { AI_LISTING_QUESTIONS_PATH, buildAiQuestionsParams } from './ai-questions-params';

/** Where the list request stands. */
export type AiQuestionsLoadState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'error' }
    | { readonly kind: 'notOwner' }
    | { readonly kind: 'ready'; readonly data: AiListingQuestionsResponse };

/** Input of {@link useAiQuestions}. */
export interface UseAiQuestionsInput {
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    /** Translator for the error copy. */
    readonly t: TranslationFn;
}

/** What {@link useAiQuestions} returns. */
export interface UseAiQuestionsResult {
    readonly state: AiQuestionsLoadState;
    readonly from: string;
    readonly to: string;
    readonly setFrom: (value: string) => void;
    readonly setTo: (value: string) => void;
    /** Clears both dates (refetches the first page). */
    readonly clearRange: () => void;
    /** Set when the API rejected the range (400). */
    readonly filterError: string | null;
    /** Set when a dismiss / undo failed. */
    readonly mutationError: string | null;
    /** True once «Ver más» loaded at least one more page. */
    readonly hasLoadedMore: boolean;
    /** Re-runs the first-page request (the error state's retry). */
    readonly reload: () => void;
    /** Dismisses or restores one question, optimistically. */
    readonly mutateQuestion: (
        item: AiListingQuestion,
        action: 'dismiss' | 'undismiss'
    ) => Promise<void>;
    /** Appends the next page of «other» questions. */
    readonly loadMore: () => Promise<void>;
}

/**
 * Loads and mutates the listing's AI questions.
 *
 * @param input - See {@link UseAiQuestionsInput}.
 * @returns See {@link UseAiQuestionsResult}.
 */
export function useAiQuestions({
    entityType,
    entityId,
    t
}: UseAiQuestionsInput): UseAiQuestionsResult {
    const [state, setState] = useState<AiQuestionsLoadState>({ kind: 'loading' });
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [hasLoadedMore, setHasLoadedMore] = useState(false);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [filterError, setFilterError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    // Changing the range refetches from the first page: the effect always asks
    // without a cursor, which is what resets the pagination.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `t` is rebuilt every render and only used for the error copy; reloadKey is a manual refetch trigger
    useEffect(() => {
        let cancelled = false;
        setHasLoadedMore(false);
        const load = async (): Promise<void> => {
            const result = await apiClient.getProtected<AiListingQuestionsResponse>({
                path: AI_LISTING_QUESTIONS_PATH,
                params: buildAiQuestionsParams({ entityType, entityId, from, to })
            });
            if (cancelled) return;
            if (result.ok) {
                setFilterError(null);
                setState({ kind: 'ready', data: result.data });
                return;
            }
            // 400 is a rejected range (older than 12 months, or from > to):
            // keep what is on screen and say so, instead of a dead panel.
            if (result.error.status === 400) {
                setFilterError(
                    t(
                        'host.properties.editor.aiQuestions.filter.invalidRange',
                        'El rango de fechas no es válido. Podés consultar hasta 12 meses atrás y la fecha "Desde" no puede ser posterior a "Hasta".'
                    )
                );
                setState((prev) => (prev.kind === 'loading' ? { kind: 'error' } : prev));
                return;
            }
            setFilterError(null);
            // 404 is the API's answer for a listing the viewer does not own
            // (e.g. staff opening another owner's editor): not a failure.
            setState(result.error.status === 404 ? { kind: 'notOwner' } : { kind: 'error' });
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [entityType, entityId, from, to, reloadKey]);

    const reload = (): void => {
        setState({ kind: 'loading' });
        setReloadKey((key) => key + 1);
    };

    const clearRange = (): void => {
        setFrom('');
        setTo('');
    };

    const mutateQuestion = async (
        item: AiListingQuestion,
        action: 'dismiss' | 'undismiss'
    ): Promise<void> => {
        if (state.kind !== 'ready') return;
        const data = state.data;
        setMutationError(null);
        const optimistic: AiListingQuestionsResponse = {
            ...data,
            items:
                action === 'dismiss'
                    ? data.items.filter((entry) => entry.id !== item.id)
                    : [...data.items, item].sort((left, right) =>
                          right.askedAt.localeCompare(left.askedAt)
                      ),
            dismissed:
                action === 'dismiss'
                    ? [{ ...item, ownerDismissedAt: new Date().toISOString() }, ...data.dismissed]
                    : data.dismissed.filter((entry) => entry.id !== item.id),
            // Counts come from the GET response below; keep them server-owned.
            unansweredCount: data.unansweredCount,
            total: data.total,
            dismissedCount: data.dismissedCount
        };
        setState({ kind: 'ready', data: optimistic });
        const result = await apiClient.postProtected({
            path: `${AI_LISTING_QUESTIONS_PATH}/${item.id}/${action}`
        });
        if (!result.ok) {
            setState({ kind: 'ready', data });
            setMutationError(
                t(
                    action === 'dismiss'
                        ? 'host.properties.editor.aiQuestions.dismissedError'
                        : 'host.properties.editor.aiQuestions.undoError',
                    action === 'dismiss'
                        ? 'The question could not be dismissed.'
                        : 'The question could not be restored.'
                )
            );
            return;
        }
        const refreshed = await apiClient.getProtected<AiListingQuestionsResponse>({
            path: AI_LISTING_QUESTIONS_PATH,
            params: buildAiQuestionsParams({ entityType, entityId, from, to })
        });
        if (refreshed.ok) setState({ kind: 'ready', data: refreshed.data });
    };

    const loadMore = async (): Promise<void> => {
        if (state.kind !== 'ready' || !state.data.othersNextCursor) return;
        const data = state.data;
        const result = await apiClient.getProtected<AiListingQuestionsResponse>({
            path: AI_LISTING_QUESTIONS_PATH,
            params: buildAiQuestionsParams({
                entityType,
                entityId,
                from,
                to,
                othersCursor: data.othersNextCursor ?? undefined
            })
        });
        if (result.ok) {
            setHasLoadedMore(true);
            setState({
                kind: 'ready',
                data: {
                    ...result.data,
                    total: data.total,
                    unansweredCount: data.unansweredCount,
                    truncated: data.truncated,
                    items: [
                        ...data.items,
                        ...result.data.items.filter((item) => item.answerStatus !== 'unanswered')
                    ]
                }
            });
        }
    };

    return {
        state,
        from,
        to,
        setFrom,
        setTo,
        clearRange,
        filterError,
        mutationError,
        hasLoadedMore,
        reload,
        mutateQuestion,
        loadMore
    };
}
