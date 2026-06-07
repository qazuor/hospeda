/**
 * @file useAiTextImprove.ts
 * @description React hook for streaming AI text-improvement suggestions from
 * `POST /api/v1/protected/ai/text-improve` (SPEC-198 T-008).
 *
 * Implements the state machine described in spec §5.3.4 and the SSE
 * consumer pattern from §5.3.5. The hook is a thin orchestration layer
 * over the native `fetch` + `ReadableStream` API — it does NOT use the
 * project's `fetchApi` client because that wrapper is JSON-only and
 * designed for request/response semantics, not server-sent events.
 *
 * ## Critical safety invariant (mod mid-stream)
 *
 * When an `error` SSE event arrives AFTER one or more `token` events have
 * already accumulated, the hook MUST:
 *   1. Discard every accumulated token (set `suggestion = ''`).
 *   2. Transition to `status = 'error'`.
 *   3. Expose the raw `code` from the error event (the i18n translation
 *      is the component's job, not ours).
 *
 * Displaying partial moderation-blocked content would expose policy-
 * violating text to the HOST — see spec §5.3.4 "CRITICAL moderation
 * gotcha" and AC-6.
 *
 * ## Why native `fetch` (not `EventSource`)
 *
 * `EventSource` only supports GET, cannot send JSON bodies, and cannot
 * set custom headers. The protected route is POST + JSON, so we MUST
 * use `fetch` + `ReadableStream`. Auth is via the admin session cookie
 * (`credentials: 'include'`), which is the same mechanism the regular
 * `fetchApi` client uses.
 */
import type { AiTextImprove, AiTextImproveFieldType, LanguageEnum } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The lifecycle of one AI text-improvement request, exposed by
 * {@link useAiTextImprove}. See spec §5.3.4.
 */
export type AiTextImproveStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

/**
 * The set of machine-readable error codes the hook may expose. Mirrors
 * the codes listed in spec §5.6 (HTTP status → UI error state mapping)
 * plus a single internal code for network interruption (R-3).
 *
 * The hook exposes the raw code; the consumer is responsible for mapping
 * it to a user-facing string via `@repo/i18n`.
 */
export const AI_TEXT_IMPROVE_ERROR_CODES = [
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'ENTITLEMENT_REQUIRED',
    'LIMIT_REACHED',
    'MODERATION_BLOCKED',
    'RATE_LIMIT_EXCEEDED',
    'ENGINE_EXHAUSTED',
    'FEATURE_DISABLED',
    'CEILING_HIT',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
    'NETWORK_INTERRUPTED'
] as const;

export type AiTextImproveErrorCode = (typeof AI_TEXT_IMPROVE_ERROR_CODES)[number];

/**
 * The error object exposed by the hook. `httpStatus` is the HTTP status
 * of the initial response — for SSE-level errors (the response opened
 * with 200 but the body emitted an `error` event), this is 200; the
 * semantic distinction is encoded in `code`.
 */
export interface AiTextImproveHookError {
    readonly code: AiTextImproveErrorCode;
    readonly message: string;
    readonly httpStatus: number;
}

/**
 * Progress telemetry — currently just the number of `token` events the
 * hook has consumed. May be extended in V2 (e.g. byte size).
 */
export interface AiTextImproveProgress {
    readonly tokensReceived: number;
}

/**
 * The full return shape of {@link useAiTextImprove}. See spec §5.3.4.
 */
export interface UseAiTextImproveReturn {
    readonly status: AiTextImproveStatus;
    readonly suggestion: string;
    readonly error: AiTextImproveHookError | null;
    readonly progress: AiTextImproveProgress | null;
    readonly improve: (req: AiTextImprove) => Promise<void>;
    readonly accept: () => string;
    readonly discard: () => void;
    readonly abort: () => void;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Path of the protected AI text-improve endpoint. */
const TEXT_IMPROVE_PATH = '/api/v1/protected/ai/text-improve';

// ---------------------------------------------------------------------------
// Pure helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Type guard for a `token` SSE frame. The route emits the token text
 * under the `delta` key (per SPEC-173 `StreamTextChunk`).
 */
const isTokenFrame = (value: unknown): value is { delta: string } => {
    if (typeof value !== 'object' || value === null) return false;
    const delta = (value as { delta?: unknown }).delta;
    return typeof delta === 'string';
};

/**
 * Type guard for an `error` SSE frame. `code` is required, `message` is
 * optional (the route always sends one but we don't want a missing field
 * to crash the hook).
 */
const isErrorFrame = (value: unknown): value is { code: string; message?: string } => {
    if (typeof value !== 'object' || value === null) return false;
    const code = (value as { code?: unknown }).code;
    return typeof code === 'string' && code.length > 0;
};

/**
 * Type guard for a `done` SSE frame. The route sends the engine meta
 * (`usage`, `provider`, `model`, `finishReason`) inside the data; we
 * don't introspect it — we only need the event to know the stream
 * closed cleanly.
 */
const isDoneFrame = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
};

/**
 * Defensive code normaliser: clamps an arbitrary string to one of the
 * known error codes, falling back to `INTERNAL_ERROR` for unknown
 * values. The route only emits the codes listed in spec §5.6, but a
 * misconfigured upstream (or a future V2 code) must not crash the hook.
 */
export const normaliseErrorCode = (raw: string): AiTextImproveErrorCode => {
    return (AI_TEXT_IMPROVE_ERROR_CODES as readonly string[]).includes(raw)
        ? (raw as AiTextImproveErrorCode)
        : 'INTERNAL_ERROR';
};

// ---------------------------------------------------------------------------
// SSE frame parser (pure, async iterator)
// ---------------------------------------------------------------------------

/**
 * Parses an SSE-encoded `ReadableStream` into discrete frame events.
 *
 * The SSE protocol (per WHATWG + SPEC-173) encodes each event as:
 *
 *   event: <name>
 *   data: <json>
 *   <blank line>
 *
 * A blank line terminates a frame. We treat missing `event:` as the
 * default event name `"message"` — the route always emits an explicit
 * name, but we are liberal in what we accept.
 *
 * Multi-line `data:` fields (rare, but valid SSE) are concatenated with
 * `\n`. We don't expect them from this route but handle them defensively.
 *
 * The reader loop exits cleanly when the underlying stream signals
 * `done=true`. The caller is responsible for the `error`/`done` policy.
 *
 * @param body - The `ReadableStream<Uint8Array>` from a `Response.body`.
 * @returns An async iterator that yields `{ event, data }` pairs.
 *          `data` is the raw JSON string from the `data:` line(s).
 */
export const parseSseStream = async function* (
    body: ReadableStream<Uint8Array>
): AsyncGenerator<{ event: string; data: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Per-frame accumulators. Reset on every blank line.
    let currentEvent = '';
    let currentData: string[] = [];

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Split into complete lines; the last entry may be a partial
            // line that we'll re-process after the next chunk.
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const rawLine of lines) {
                // SSE line terminators: \n (LF) or \r (CR). The split above
                // already stripped LF; strip a trailing CR if present.
                const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

                if (line.startsWith('event:')) {
                    currentEvent = line.slice('event:'.length).trim();
                } else if (line.startsWith('data:')) {
                    // SPEC: strip the leading single space if present.
                    const raw = line.slice('data:'.length);
                    currentData.push(raw.startsWith(' ') ? raw.slice(1) : raw);
                } else if (line === '') {
                    // Blank line = end-of-frame.
                    if (currentEvent || currentData.length > 0) {
                        yield {
                            event: currentEvent || 'message',
                            data: currentData.join('\n')
                        };
                    }
                    currentEvent = '';
                    currentData = [];
                }
                // Other lines (comments starting with ':', unknown fields)
                // are ignored — the route doesn't emit them.
            }
        }
    } finally {
        // Always release the reader so the underlying socket can be
        // closed cleanly. Without this the connection leaks on abort.
        try {
            reader.releaseLock();
        } catch {
            // Already released — ignore.
        }
    }
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for streaming AI text-improvement suggestions. See
 * {@link UseAiTextImproveReturn} for the public surface and spec §5.3.4
 * for the state-machine diagram.
 *
 * The hook is intentionally unopinionated about UI: it does NOT call
 * `i18n.t`, does NOT call `toast`, does NOT write to the form. The
 * consumer (the `AiTextImprovePanel` component built in T-009) is
 * responsible for rendering the state and translating the error code.
 */
export function useAiTextImprove(): UseAiTextImproveReturn {
    const [status, setStatus] = useState<AiTextImproveStatus>('idle');
    const [suggestion, setSuggestion] = useState<string>('');
    const [error, setError] = useState<AiTextImproveHookError | null>(null);
    const [progress, setProgress] = useState<AiTextImproveProgress | null>(null);

    // Refs that must NOT trigger re-renders. Mounted flag suppresses
    // state updates after unmount (React 19 strict mode + early unmount
    // during in-flight requests).
    const abortControllerRef = useRef<AbortController | null>(null);
    const mountedRef = useRef<boolean>(true);
    const suggestionRef = useRef<string>('');

    // Keep the suggestion in a ref so `accept()` can read the latest
    // value without taking a dependency on `suggestion` (which would
    // change the function identity and re-trigger consumer effects).
    useEffect(() => {
        suggestionRef.current = suggestion;
    }, [suggestion]);

    // -----------------------------------------------------------------
    // Shared reset helper. Centralises the "go back to idle" transition
    // so accept/discard/abort/cleanup all behave identically.
    // -----------------------------------------------------------------
    const reset = useCallback(() => {
        setStatus('idle');
        setSuggestion('');
        setError(null);
        setProgress(null);
        suggestionRef.current = '';
    }, []);

    // -----------------------------------------------------------------
    // Unmount cleanup: abort the in-flight fetch. Without this, React 19
    // strict mode's double-invocation OR a parent route change would
    // leave a hanging POST that the server still drains. See spec §5.3.5.
    // -----------------------------------------------------------------
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    // -----------------------------------------------------------------
    // improve(): kicks off a new request. Aborts any prior in-flight
    // request to keep the state machine single-track.
    // -----------------------------------------------------------------
    const improve = useCallback(
        async (req: AiTextImprove): Promise<void> => {
            // Abort any previous in-flight request before starting a new one.
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            const controller = new AbortController();
            abortControllerRef.current = controller;

            setStatus('loading');
            setSuggestion('');
            setError(null);
            setProgress({ tokensReceived: 0 });
            suggestionRef.current = '';

            let response: Response;
            try {
                response = await fetch(TEXT_IMPROVE_PATH, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'text/event-stream'
                    },
                    body: JSON.stringify(req),
                    signal: controller.signal,
                    // Send the admin session cookie. The protected middleware
                    // on the server validates it; we do not need a Bearer
                    // token in addition.
                    credentials: 'include'
                });
            } catch (err) {
                // AbortError is expected when the user discards/aborts.
                // Surface it as 'idle' rather than 'error' so the panel
                // doesn't flash a red banner for a user-initiated cancel.
                if (err instanceof DOMException && err.name === 'AbortError') {
                    if (mountedRef.current) {
                        reset();
                    }
                    return;
                }
                if (!mountedRef.current) return;
                setStatus('error');
                setProgress(null);
                setError({
                    code: 'NETWORK_INTERRUPTED',
                    message: err instanceof Error ? err.message : 'Network error',
                    httpStatus: 0
                });
                return;
            }

            // Pre-stream HTTP error: the server returned a non-2xx status
            // BEFORE any SSE bytes. The body is a regular JSON error
            // envelope, NOT an SSE stream. See spec §5.6 for the table.
            if (!response.ok) {
                if (!mountedRef.current) return;
                let body: unknown = null;
                try {
                    body = await response.json();
                } catch {
                    body = null;
                }
                const errorBody = (body ?? {}) as {
                    error?: { code?: string; message?: string };
                };
                const rawCode = errorBody.error?.code ?? 'INTERNAL_ERROR';
                setStatus('error');
                setProgress(null);
                setError({
                    code: normaliseErrorCode(rawCode),
                    message:
                        errorBody.error?.message ?? `Request failed with status ${response.status}`,
                    httpStatus: response.status
                });
                return;
            }

            // No body means the server closed the stream without sending
            // a single frame. Treat as network interruption (R-3).
            if (!response.body) {
                if (!mountedRef.current) return;
                setStatus('error');
                setProgress(null);
                setError({
                    code: 'NETWORK_INTERRUPTED',
                    message: 'The server closed the connection without sending any data.',
                    httpStatus: response.status
                });
                return;
            }

            // Stream is open — parse frames until the route closes it.
            // We transition to 'streaming' on the first 'token' frame.
            // We do NOT pre-flip to 'streaming' on response.ok because
            // the server is allowed to open with no body (e.g. keepalive)
            // before the first token arrives — that case is handled by
            // the 'no body' branch above and the network-interruption
            // branch below.
            try {
                let receivedDone = false;
                let receivedAnyToken = false;

                for await (const frame of parseSseStream(response.body)) {
                    if (controller.signal.aborted) break;
                    if (!mountedRef.current) break;

                    if (frame.event === 'token') {
                        let parsed: unknown;
                        try {
                            parsed = JSON.parse(frame.data);
                        } catch {
                            // Malformed frame — skip it but keep reading.
                            continue;
                        }
                        if (!isTokenFrame(parsed)) continue;
                        receivedAnyToken = true;
                        setStatus('streaming');
                        setSuggestion((prev) => {
                            const next = prev + parsed.delta;
                            suggestionRef.current = next;
                            return next;
                        });
                        setProgress((prev) => ({
                            tokensReceived: (prev?.tokensReceived ?? 0) + 1
                        }));
                    } else if (frame.event === 'done') {
                        // `done` confirms a clean drain. We don't need to
                        // parse the meta — the accumulated suggestion is
                        // already complete.
                        try {
                            JSON.parse(frame.data);
                        } catch {
                            // Malformed done frame is non-fatal.
                        }
                        if (isDoneFrame({})) {
                            receivedDone = true;
                        }
                    } else if (frame.event === 'error') {
                        // CRITICAL: mid-stream moderation.
                        //
                        // The route may emit an `error` event AFTER one or
                        // more `token` events (post-drain output moderation).
                        // Per spec §5.3.4 + AC-6, we MUST discard every
                        // accumulated token and surface only the error.
                        // Never expose partial moderation-blocked content.
                        let parsed: unknown;
                        try {
                            parsed = JSON.parse(frame.data);
                        } catch {
                            parsed = null;
                        }
                        const code = isErrorFrame(parsed) ? parsed.code : 'INTERNAL_ERROR';
                        const message = isErrorFrame(parsed)
                            ? (parsed.message ?? 'An error occurred while streaming.')
                            : 'An error occurred while streaming.';

                        setStatus('error');
                        setProgress(null);
                        setSuggestion('');
                        suggestionRef.current = '';
                        setError({
                            code: normaliseErrorCode(code),
                            message,
                            httpStatus: response.status
                        });
                        return;
                    }
                    // Unknown event names are ignored — the route only
                    // emits 'token', 'done', 'error'.
                }

                if (!mountedRef.current) return;

                if (receivedDone) {
                    setStatus('done');
                    return;
                }

                // Stream ended without a `done` event. This is a network
                // interruption per spec §10 R-3 — partial suggestion is
                // discarded.
                if (receivedAnyToken) {
                    setStatus('error');
                    setProgress(null);
                    setSuggestion('');
                    suggestionRef.current = '';
                    setError({
                        code: 'NETWORK_INTERRUPTED',
                        message: 'The connection was interrupted before the suggestion finished.',
                        httpStatus: response.status
                    });
                } else {
                    // Stream closed with no events at all.
                    setStatus('error');
                    setProgress(null);
                    setError({
                        code: 'NETWORK_INTERRUPTED',
                        message: 'The server closed the connection without sending any events.',
                        httpStatus: response.status
                    });
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    if (mountedRef.current) {
                        reset();
                    }
                    return;
                }
                if (!mountedRef.current) return;
                setStatus('error');
                setProgress(null);
                setError({
                    code: 'NETWORK_INTERRUPTED',
                    message: err instanceof Error ? err.message : 'Stream error',
                    httpStatus: response.status
                });
            }
        },
        [reset]
    );

    // -----------------------------------------------------------------
    // accept(): returns the current suggestion (only valid in 'done'
    // state; returns '' in any other state) and resets the hook.
    // -----------------------------------------------------------------
    const accept = useCallback((): string => {
        if (status !== 'done') return '';
        const value = suggestionRef.current;
        reset();
        return value;
    }, [status, reset]);

    // -----------------------------------------------------------------
    // discard(): resets the hook without returning the suggestion.
    // Cancels any in-flight request so a discarded stream can't later
    // sneak a token into the UI.
    // -----------------------------------------------------------------
    const discard = useCallback((): void => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        reset();
    }, [reset]);

    // -----------------------------------------------------------------
    // abort(): cancels the in-flight request (if any) and resets.
    // Distinct from `discard` in that it is the "I want to stop" action
    // — semantically the same in V1 but the API is split so the panel
    // can wire them to different buttons in the future.
    // -----------------------------------------------------------------
    const abort = useCallback((): void => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        reset();
    }, [reset]);

    return {
        status,
        suggestion,
        error,
        progress,
        improve,
        accept,
        discard,
        abort
    };
}

/**
 * Convenience: a fully-typed `improve` request shape derived from the
 * schema, re-exported here so consumers don't have to chase the import
 * from `@repo/schemas`. Mirrors the spec's `AiTextImprove` type.
 */
export type { AiTextImprove, AiTextImproveFieldType, LanguageEnum };
