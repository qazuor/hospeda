/**
 * @file useSearchChat.ts
 * @description State brain for the SPEC-212 conversational AI search panel.
 *
 * Owns: message history (client echo), accumulated filter set (SearchIntentEntities),
 * conversation id, streamed reply text, per-turn loading state, and accommodation
 * results.
 *
 * Per-turn lifecycle driven by `send(message)`:
 *   1. Append user message to history.
 *   2. Call streamSearchChat (T-008 SSE client).
 *   3. On `filters` event — store accumulated filters AND fire
 *      GET /api/v1/public/accommodations with the params.
 *   4. Accumulate `token` deltas into currentReply (shown live).
 *   5. On `done` — finalize assistant message, store nullable conversationId.
 *
 * Architectural constraint (SPEC-212 D-3): the AI route NEVER searches.
 * This hook is the sole caller of the public accommodations endpoint.
 *
 * @module useSearchChat
 */

import { accommodationsApi } from '@/lib/api/endpoints';
import {
    type SearchChatMessage,
    type SearchChatSseEvent,
    streamSearchChat
} from '@/lib/api/search-chat-stream';
import type { PaginatedResponse } from '@/lib/api/types';
import type {
    AccommodationPublic,
    AiSearchChatFiltersEvent,
    SearchIntentEntities
} from '@repo/schemas';
import { useCallback, useRef, useState } from 'react';

// ─── Public types ──────────────────────────────────────────────────────────────

/**
 * A single chat message in the conversation history.
 */
export interface SearchChatHistoryMessage {
    readonly role: 'user' | 'assistant';
    readonly content: string;
}

/**
 * Parameters accepted by {@link useSearchChat}.
 *
 * @property apiUrl - Base URL of the API server (e.g. `http://localhost:3001`).
 * @property locale - Reply and slot-extraction locale. Defaults to `'es'`.
 */
export interface UseSearchChatParams {
    readonly apiUrl: string;
    readonly locale?: 'es' | 'en' | 'pt';
}

/**
 * Object returned by {@link useSearchChat} (RO-RO pattern).
 *
 * @property messages - Full conversation history (user + assistant turns).
 * @property currentFilters - Accumulated SearchIntentEntities from the last `filters` event.
 *   Rendered as chips by T-011. Echoed back as `currentFilters` on the next turn.
 * @property results - Accommodation results from the last successful search.
 * @property resultsLoading - True while the accommodations GET is in flight.
 * @property currentReply - Streamed reply text accumulator (shown live while streaming).
 * @property isStreaming - True from `send()` until `done` / `error` arrives.
 * @property conversationId - Server conversation id from the last `done` event (nullable).
 * @property confidence - Model's self-assessed extraction confidence from the last `filters` event (SPEC-265 A1).
 *   `null` when no turn has completed yet. Used internally to trigger the low-confidence
 *   message — no numeric badge is shown to the user.
 * @property error - Surface-level error message from `error` or `stream_error` events.
 * @property send - Send a user message and start a new streaming turn.
 * @property removeFilter - Drop a key from accumulated filters and re-run the accommodations search without a new LLM turn.
 * @property reset - Clear all state back to the initial idle state.
 */
export interface UseSearchChatReturn {
    readonly messages: ReadonlyArray<SearchChatHistoryMessage>;
    readonly currentFilters: SearchIntentEntities | null;
    readonly results: ReadonlyArray<AccommodationPublic>;
    readonly resultsLoading: boolean;
    readonly currentReply: string;
    readonly isStreaming: boolean;
    readonly conversationId: string | null;
    readonly confidence: number | null;
    readonly error: string | null;
    readonly send: (message: string) => void;
    readonly removeFilter: (key: keyof SearchIntentEntities) => void;
    readonly reset: () => void;
}

// ─── Internal state ────────────────────────────────────────────────────────────

interface SearchChatState {
    readonly messages: ReadonlyArray<SearchChatHistoryMessage>;
    readonly currentFilters: SearchIntentEntities | null;
    /**
     * The last server-resolved, URL-ready accommodation search params from the
     * `filters` event. Kept (alongside the human-readable `currentFilters`
     * intent) so `removeFilter` re-runs the search against the CORRECT params —
     * the intent keys/values are not all 1:1 with the search params (e.g.
     * `accommodationType`→`type`, `amenitySlugs`→`amenities` with resolved UUIDs).
     */
    readonly lastSearchParams: AiSearchChatFiltersEvent['params'] | null;
    readonly results: ReadonlyArray<AccommodationPublic>;
    readonly resultsLoading: boolean;
    readonly currentReply: string;
    readonly isStreaming: boolean;
    readonly conversationId: string | null;
    readonly confidence: number | null;
    readonly error: string | null;
}

const INITIAL_STATE: SearchChatState = {
    messages: [],
    currentFilters: null,
    lastSearchParams: null,
    results: [],
    resultsLoading: false,
    currentReply: '',
    isStreaming: false,
    conversationId: null,
    confidence: null,
    error: null
};

/**
 * Intent → search-param key map for the keys whose names differ between
 * `SearchIntentEntities` (human-readable, used by the chips) and
 * `AccommodationSearchHttp` (the resolved search params). Keys not listed are
 * identical in both shapes.
 */
const INTENT_TO_PARAM_KEY: Partial<Record<keyof SearchIntentEntities, string>> = {
    accommodationType: 'type',
    amenitySlugs: 'amenities',
    featureSlugs: 'features'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert an AccommodationSearchHttp params object from the `filters` event
 * into a plain `Record<string, unknown>` suitable for `accommodationsApi.list()`.
 *
 * The `filters.params` shape from the SSE event is `AccommodationSearchHttp`
 * (post-Zod-coercion). The public API client's `list()` accepts the same
 * field names as optional params; we pass the object through directly after
 * stripping `undefined` entries so `serializeParams` in `client.ts` doesn't
 * append empty query string pairs.
 */
function filtersParamsToApiParams(
    params: AiSearchChatFiltersEvent['params']
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            // Date instances from Zod coercion — serialize to ISO date string
            // so `serializeParams` in client.ts forwards them as strings.
            if (value instanceof Date) {
                out[key] = value.toISOString().slice(0, 10);
            } else if (Array.isArray(value)) {
                // amenities/features arrays — join as comma-separated string
                if (value.length > 0) {
                    out[key] = (value as unknown[]).join(',');
                }
            } else {
                out[key] = value;
            }
        }
    }
    return out;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * State brain for the conversational AI search panel (SPEC-212 T-009).
 *
 * Manages message history, accumulated filters, accommodation results,
 * streamed reply, and conversation id threading across turns.
 *
 * @param params - API URL and optional locale.
 * @returns Typed state + `send`, `removeFilter`, `reset` controls.
 *
 * @example
 * ```tsx
 * const {
 *   messages, currentFilters, results, resultsLoading,
 *   currentReply, isStreaming, error, send, removeFilter, reset
 * } = useSearchChat({ apiUrl: 'http://localhost:3001', locale: 'es' });
 * ```
 */
export function useSearchChat(params: UseSearchChatParams): UseSearchChatReturn {
    const { apiUrl, locale = 'es' } = params;

    const [state, setState] = useState<SearchChatState>(INITIAL_STATE);

    // Stable ref so callbacks always read the latest state without stale closure.
    const stateRef = useRef(state);
    stateRef.current = state;

    // Abort controller for the current streaming turn.
    const abortControllerRef = useRef<AbortController | null>(null);

    // ─── Accommodation search helper ─────────────────────────────────────────

    /**
     * Fire a GET /api/v1/public/accommodations with the given params object
     * and merge the results into state. Runs concurrently with token streaming
     * (D-9: filters event arrives before the reply finishes).
     */
    const fetchAccommodations = useCallback(
        async (searchParams: AiSearchChatFiltersEvent['params']): Promise<void> => {
            setState((prev) => ({ ...prev, resultsLoading: true, error: null }));
            const apiParams = filtersParamsToApiParams(searchParams);
            const result = await accommodationsApi.list(
                apiParams as Parameters<typeof accommodationsApi.list>[0]
            );
            if (result.ok) {
                const paginatedData = result.data as PaginatedResponse<AccommodationPublic>;
                setState((prev) => ({
                    ...prev,
                    results: paginatedData.items ?? [],
                    resultsLoading: false
                }));
            } else {
                // Accommodation search failure is non-fatal: surface error but keep streaming.
                setState((prev) => ({
                    ...prev,
                    resultsLoading: false,
                    error: result.error.message
                }));
            }
        },
        []
    );

    // ─── send ────────────────────────────────────────────────────────────────

    /**
     * Send a user message and start a new conversational search turn.
     * Appends the user message immediately, then streams the AI reply.
     *
     * @param message - The user's natural-language input.
     */
    const send = useCallback(
        (message: string): void => {
            // Abort any in-flight turn before starting a new one.
            abortControllerRef.current?.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;

            const current = stateRef.current;

            const userMessage: SearchChatHistoryMessage = { role: 'user', content: message };
            const updatedMessages: ReadonlyArray<SearchChatHistoryMessage> = [
                ...current.messages,
                userMessage
            ];

            setState({
                ...current,
                messages: updatedMessages,
                currentReply: '',
                isStreaming: true,
                error: null
            });

            // Build the SSE client payload — echo full history and accumulated filters.
            const clientMessages: ReadonlyArray<SearchChatMessage> = updatedMessages.map((m) => ({
                role: m.role,
                content: m.content
            }));

            void streamSearchChat({
                apiUrl,
                messages: clientMessages,
                locale,
                conversationId: current.conversationId,
                currentFilters:
                    current.currentFilters !== null
                        ? (current.currentFilters as AiSearchChatFiltersEvent['intent'])
                        : undefined,
                signal: controller.signal,
                onEvent: (event: SearchChatSseEvent) => {
                    if (event.type === 'filters') {
                        // Store the accumulated intent (used by chips T-011)
                        // and immediately fire the accommodations search.
                        // Store confidence (SPEC-265 A1) for the low-confidence UI.
                        const newFilters = event.filters.intent;
                        const newConfidence = event.filters.confidence ?? null;
                        setState((prev) => ({
                            ...prev,
                            currentFilters: newFilters,
                            lastSearchParams: event.filters.params,
                            confidence: newConfidence
                        }));
                        void fetchAccommodations(event.filters.params);
                        return;
                    }

                    if (event.type === 'token') {
                        setState((prev) => ({
                            ...prev,
                            currentReply: prev.currentReply + event.delta
                        }));
                        return;
                    }

                    if (event.type === 'done') {
                        setState((prev) => {
                            const assistantMessage: SearchChatHistoryMessage = {
                                role: 'assistant',
                                content: prev.currentReply
                            };
                            return {
                                ...prev,
                                messages: [...prev.messages, assistantMessage],
                                currentReply: '',
                                isStreaming: false,
                                // Null conversationId is a legitimate state (best-effort persistence).
                                // Store it as-is; next turn's send() checks for non-null before passing.
                                conversationId: event.conversationId
                            };
                        });
                        return;
                    }

                    if (event.type === 'error') {
                        setState((prev) => ({
                            ...prev,
                            currentReply: '',
                            isStreaming: false,
                            error: event.message
                        }));
                        return;
                    }

                    if (event.type === 'stream_error') {
                        setState((prev) => ({
                            ...prev,
                            currentReply: '',
                            isStreaming: false,
                            error: event.error.message
                        }));
                    }
                }
            }).catch(() => {
                // streamSearchChat handles errors internally; this is a safety net
                // for unexpected promise rejections (should not happen in practice).
            });
        },
        [apiUrl, locale, fetchAccommodations]
    );

    // ─── removeFilter ────────────────────────────────────────────────────────

    /**
     * Drop a single slot from the accumulated filters and re-run the
     * accommodations search without starting a new LLM turn.
     *
     * Called by the filter chips (T-011) when the user removes an active filter.
     * The LLM context is NOT updated — only the local state and the search results.
     *
     * @param key - The SearchIntentEntities key to remove.
     */
    const removeFilter = useCallback(
        (key: keyof SearchIntentEntities): void => {
            const current = stateRef.current;
            if (current.currentFilters === null) return;

            const updatedFilters = { ...current.currentFilters };
            delete updatedFilters[key];

            // Drop the corresponding key from the server-resolved params (renamed
            // where the intent and param keys differ). This re-runs the search
            // against the CORRECT params instead of treating raw intent fields as
            // params — so renamed/resolved filters (type, amenities, features) are
            // not silently lost on chip removal.
            const paramKey = INTENT_TO_PARAM_KEY[key] ?? key;
            const updatedParams = { ...(current.lastSearchParams ?? {}) } as Record<
                string,
                unknown
            >;
            delete updatedParams[paramKey];
            const nextParams = updatedParams as AiSearchChatFiltersEvent['params'];

            setState((prev) => ({
                ...prev,
                currentFilters: updatedFilters,
                lastSearchParams: nextParams
            }));
            void fetchAccommodations(nextParams);
        },
        [fetchAccommodations]
    );

    // ─── reset ───────────────────────────────────────────────────────────────

    /**
     * Clear all state back to the initial idle state and abort any in-flight turn.
     */
    const reset = useCallback((): void => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setState(INITIAL_STATE);
    }, []);

    // ─── Return ──────────────────────────────────────────────────────────────

    return {
        messages: state.messages,
        currentFilters: state.currentFilters,
        results: state.results,
        resultsLoading: state.resultsLoading,
        currentReply: state.currentReply,
        isStreaming: state.isStreaming,
        conversationId: state.conversationId,
        confidence: state.confidence,
        error: state.error,
        send,
        removeFilter,
        reset
    };
}
