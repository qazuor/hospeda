// @vitest-environment jsdom
/**
 * @file useAiTextImprove.test.ts
 * @description Unit tests for the `useAiTextImprove` hook (SPEC-198 T-008).
 *
 * Covers the 9 cases listed in spec §9.4:
 *
 *   1. starts in idle state
 *   2. transitions to loading on `improve()`
 *   3. transitions to streaming on first `token` event
 *   4. accumulates tokens in `suggestion`
 *   5. transitions to `done` on `done` event
 *   6. CRITICAL: transitions to `error` AND clears `suggestion` on
 *      mid-stream `error` event (post-drain output moderation)
 *   7. transitions to `idle` on `discard()`
 *   8. `accept()` returns the accumulated suggestion
 *   9. transitions to `idle` after `accept()`
 *
 * The CRITICAL case (#6) is the safety invariant for the whole feature.
 * If this test ever regresses, the host sees partial moderation-blocked
 * content — see spec §5.3.4 "CRITICAL moderation gotcha" and AC-6.
 *
 * ## SSE mocking strategy
 *
 * The route emits `text/event-stream` frames. jsdom does NOT polyfill
 * `ReadableStream` for `Response` in older versions, so we provide a
 * test-side `ReadableStreamDefaultController` and push frames from the
 * test directly. The fetch mock captures the `AbortSignal` passed in
 * `init.signal` so the abort-on-unmount test can assert it was
 * triggered.
 */

import type { AiTextImprove } from '@repo/schemas';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AI_TEXT_IMPROVE_ERROR_CODES,
    normaliseErrorCode,
    parseSseStream,
    useAiTextImprove
} from '../useAiTextImprove';

// ---------------------------------------------------------------------------
// SSE test helpers
// ---------------------------------------------------------------------------

/**
 * A controllable SSE response. The test pushes frames via `enqueueSse`
 * and closes the stream via `closeSse`. The fetch mock returns the
 * `Response` instance; the hook consumes it via `parseSseStream`.
 */
interface ControllableSseResponse {
    readonly response: Response;
    enqueueSse: (event: string, data: unknown) => void;
    closeSse: () => void;
    /** Spy that fires when the consumer releases/cancels the stream. */
    readonly cancelSpy: ReturnType<typeof vi.fn>;
}

const makeSseResponse = (): ControllableSseResponse => {
    const cancelSpy = vi.fn();
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controllerRef = controller;
        },
        cancel() {
            cancelSpy();
        }
    });

    const enqueueSse = (event: string, data: unknown) => {
        if (!controllerRef) throw new Error('Stream controller not initialised');
        // SSE frame: `event: <name>\ndata: <json>\n\n`
        const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controllerRef.enqueue(encoder.encode(frame));
    };

    const closeSse = () => {
        if (!controllerRef) return;
        controllerRef.close();
        controllerRef = null;
    };

    const response = new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
    });

    return { response, enqueueSse, closeSse, cancelSpy };
};

/**
 * JSON error response for pre-stream HTTP error tests.
 */
const makeJsonErrorResponse = (status: number, code: string, message: string): Response => {
    return new Response(JSON.stringify({ error: { code, message } }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
};

/**
 * Default `improve` request used across most tests.
 */
const DEFAULT_REQUEST: AiTextImprove = {
    fieldValue: 'Un texto cualquiera para mejorar.',
    fieldType: 'description'
};

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

/**
 * Records the most recent `AbortSignal` passed to `fetch` so the
 * abort-on-unmount test can assert it was triggered.
 */
let lastFetchSignal: AbortSignal | null = null;
let lastFetchUrl: string | null = null;
let lastFetchInit: RequestInit | null = null;

/**
 * Installs a `fetch` mock that delegates to the supplied factory. The
 * factory receives the `init` object so it can read the AbortSignal
 * and inspect request shape (method, body, credentials).
 */
const installFetchMock = (
    factory: (url: string, init: RequestInit) => Promise<Response> | Response
) => {
    const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const urlString =
            typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
        lastFetchUrl = urlString;
        lastFetchInit = init ?? null;
        lastFetchSignal = (init?.signal as AbortSignal | undefined) ?? null;
        return factory(urlString, init ?? {});
    });
    vi.stubGlobal('fetch', spy);
    return spy;
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    lastFetchSignal = null;
    lastFetchUrl = null;
    lastFetchInit = null;
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Initial state
// ---------------------------------------------------------------------------

describe('useAiTextImprove — initial state', () => {
    it('starts in idle state with empty suggestion, no error, no progress', () => {
        const { result } = renderHook(() => useAiTextImprove());

        expect(result.current.status).toBe('idle');
        expect(result.current.suggestion).toBe('');
        expect(result.current.error).toBeNull();
        expect(result.current.progress).toBeNull();
        expect(typeof result.current.improve).toBe('function');
        expect(typeof result.current.accept).toBe('function');
        expect(typeof result.current.discard).toBe('function');
        expect(typeof result.current.abort).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// 2. loading transition
// ---------------------------------------------------------------------------

describe('useAiTextImprove — improve() / loading', () => {
    it('transitions to loading on improve() and POSTs to the protected route', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        // Kick off the request but do not await it — the test will push
        // frames synchronously below.
        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });

        // After the request is fired but before the first token arrives,
        // status must be 'loading' (the response is open but no frames
        // have been parsed yet).
        await waitFor(() => expect(result.current.status).toBe('loading'));
        expect(result.current.suggestion).toBe('');
        expect(result.current.error).toBeNull();
        expect(result.current.progress).toEqual({ tokensReceived: 0 });

        // Request shape: POST, JSON body, session cookie, SSE accept.
        expect(lastFetchUrl).toBe('/api/v1/protected/ai/text-improve');
        expect(lastFetchInit?.method).toBe('POST');
        expect(lastFetchInit?.credentials).toBe('include');
        expect(
            (lastFetchInit?.headers as Record<string, string> | undefined)?.['Content-Type']
        ).toBe('application/json');
        expect(lastFetchInit?.body).toBe(JSON.stringify(DEFAULT_REQUEST));

        sse.closeSse();
    });
});

// ---------------------------------------------------------------------------
// 3 + 4. streaming transition and token accumulation
// ---------------------------------------------------------------------------

describe('useAiTextImprove — streaming', () => {
    it('transitions to streaming on the first token and accumulates deltas', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });

        await waitFor(() => expect(result.current.status).toBe('loading'));

        // Push frames with `await act(async ...)` so the async state
        // updates triggered by the stream reader are flushed before the
        // assertion runs.
        await act(async () => {
            sse.enqueueSse('token', { delta: 'Hermoso ' });
        });

        await waitFor(() => expect(result.current.status).toBe('streaming'));
        expect(result.current.suggestion).toBe('Hermoso ');
        expect(result.current.progress?.tokensReceived).toBe(1);

        await act(async () => {
            sse.enqueueSse('token', { delta: 'departamento' });
        });

        await waitFor(() => expect(result.current.suggestion).toBe('Hermoso departamento'));
        expect(result.current.progress?.tokensReceived).toBe(2);

        await act(async () => {
            sse.enqueueSse('token', { delta: ' en el centro.' });
        });

        await waitFor(() =>
            expect(result.current.suggestion).toBe('Hermoso departamento en el centro.')
        );
        expect(result.current.progress?.tokensReceived).toBe(3);

        sse.closeSse();
    });
});

// ---------------------------------------------------------------------------
// 5. done transition
// ---------------------------------------------------------------------------

describe('useAiTextImprove — done', () => {
    it('transitions to done on the done event and keeps the full suggestion', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });

        await waitFor(() => expect(result.current.status).toBe('loading'));

        await act(async () => {
            sse.enqueueSse('token', { delta: 'Texto mejorado.' });
        });
        await waitFor(() => expect(result.current.status).toBe('streaming'));

        await act(async () => {
            sse.enqueueSse('done', {
                usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
                provider: 'openai',
                model: 'gpt-4o-mini',
                finishReason: 'stop'
            });
            sse.closeSse();
        });

        await waitFor(() => expect(result.current.status).toBe('done'));
        expect(result.current.suggestion).toBe('Texto mejorado.');
        expect(result.current.error).toBeNull();
        expect(result.current.progress?.tokensReceived).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// 6. CRITICAL — mid-stream moderation discards accumulated tokens
// ---------------------------------------------------------------------------

describe('useAiTextImprove — CRITICAL: mid-stream error clears suggestion', () => {
    it('discards all accumulated tokens and transitions to error when an error event arrives after tokens', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });

        await waitFor(() => expect(result.current.status).toBe('loading'));

        // Two partial tokens arrive — these would expose policy-violating
        // content if left in `suggestion` after moderation triggers.
        await act(async () => {
            sse.enqueueSse('token', { delta: 'Texto peligroso ' });
        });
        await waitFor(() => expect(result.current.suggestion).toBe('Texto peligroso '));

        await act(async () => {
            sse.enqueueSse('token', { delta: 'que será bloqueado' });
        });
        await waitFor(() =>
            expect(result.current.suggestion).toBe('Texto peligroso que será bloqueado')
        );

        // Now the route emits an `error` event (post-drain output
        // moderation). The hook MUST clear the accumulated suggestion.
        await act(async () => {
            sse.enqueueSse('error', {
                code: 'MODERATION_BLOCKED',
                message: 'Content policy violation — the request was blocked.'
            });
            sse.closeSse();
        });

        // SAFETY INVARIANT: no moderation-blocked content may remain.
        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.suggestion).toBe('');
        expect(result.current.error?.code).toBe('MODERATION_BLOCKED');
        expect(result.current.error?.httpStatus).toBe(200);
        expect(result.current.error?.message).toMatch(/content policy/i);
        expect(result.current.progress).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 7. discard
// ---------------------------------------------------------------------------

describe('useAiTextImprove — discard', () => {
    it('returns to idle when discard() is called from the done state', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });
        await waitFor(() => expect(result.current.status).toBe('loading'));

        await act(async () => {
            sse.enqueueSse('token', { delta: 'sugerencia' });
            sse.enqueueSse('done', { usage: {}, provider: 'p', model: 'm', finishReason: 'stop' });
            sse.closeSse();
        });
        await waitFor(() => expect(result.current.status).toBe('done'));

        act(() => {
            result.current.discard();
        });

        expect(result.current.status).toBe('idle');
        expect(result.current.suggestion).toBe('');
        expect(result.current.error).toBeNull();
        expect(result.current.progress).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 8. accept returns the suggestion
// ---------------------------------------------------------------------------

describe('useAiTextImprove — accept returns the suggestion', () => {
    it('accept() returns the accumulated suggestion string and resets to idle', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });
        await waitFor(() => expect(result.current.status).toBe('loading'));

        await act(async () => {
            sse.enqueueSse('token', { delta: 'Sugerencia final ' });
            sse.enqueueSse('token', { delta: 'completa.' });
            sse.enqueueSse('done', { usage: {}, provider: 'p', model: 'm', finishReason: 'stop' });
            sse.closeSse();
        });
        await waitFor(() => expect(result.current.status).toBe('done'));
        expect(result.current.suggestion).toBe('Sugerencia final completa.');

        let returned: string | undefined;
        act(() => {
            returned = result.current.accept();
        });
        expect(returned).toBe('Sugerencia final completa.');
    });
});

// ---------------------------------------------------------------------------
// 9. idle after accept
// ---------------------------------------------------------------------------

describe('useAiTextImprove — idle after accept', () => {
    it('transitions to idle after accept() and clears all state', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });
        await waitFor(() => expect(result.current.status).toBe('loading'));

        await act(async () => {
            sse.enqueueSse('token', { delta: 'Texto' });
            sse.enqueueSse('done', { usage: {}, provider: 'p', model: 'm', finishReason: 'stop' });
            sse.closeSse();
        });
        await waitFor(() => expect(result.current.status).toBe('done'));

        act(() => {
            result.current.accept();
        });

        expect(result.current.status).toBe('idle');
        expect(result.current.suggestion).toBe('');
        expect(result.current.error).toBeNull();
        expect(result.current.progress).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Additional safety coverage (extends the 9 spec-mandated cases)
// ---------------------------------------------------------------------------

describe('useAiTextImprove — pre-stream error handling', () => {
    it('transitions to error on a 422 MODERATION_BLOCKED pre-stream response (no SSE bytes)', async () => {
        installFetchMock(async () =>
            makeJsonErrorResponse(422, 'MODERATION_BLOCKED', 'Content policy violation')
        );

        const { result } = renderHook(() => useAiTextImprove());

        await act(async () => {
            await result.current.improve(DEFAULT_REQUEST);
        });

        expect(result.current.status).toBe('error');
        expect(result.current.suggestion).toBe('');
        expect(result.current.error?.code).toBe('MODERATION_BLOCKED');
        expect(result.current.error?.httpStatus).toBe(422);
    });

    it('transitions to error on a 403 LIMIT_REACHED pre-stream response', async () => {
        installFetchMock(async () =>
            makeJsonErrorResponse(403, 'LIMIT_REACHED', 'Monthly limit reached')
        );

        const { result } = renderHook(() => useAiTextImprove());

        await act(async () => {
            await result.current.improve(DEFAULT_REQUEST);
        });

        expect(result.current.status).toBe('error');
        expect(result.current.error?.code).toBe('LIMIT_REACHED');
        expect(result.current.error?.httpStatus).toBe(403);
    });

    it('falls back to INTERNAL_ERROR for unknown error codes from the server', async () => {
        installFetchMock(async () =>
            makeJsonErrorResponse(500, 'SOMETHING_NEW_FROM_V3', 'Future code we do not know')
        );

        const { result } = renderHook(() => useAiTextImprove());

        await act(async () => {
            await result.current.improve(DEFAULT_REQUEST);
        });

        expect(result.current.status).toBe('error');
        expect(result.current.error?.code).toBe('INTERNAL_ERROR');
        expect(result.current.error?.httpStatus).toBe(500);
    });
});

describe('useAiTextImprove — network interruption', () => {
    it('transitions to error and discards partial suggestion when the stream ends without a done event', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });
        await waitFor(() => expect(result.current.status).toBe('loading'));

        await act(async () => {
            sse.enqueueSse('token', { delta: 'Parcial ' });
            sse.enqueueSse('token', { delta: 'sin terminar' });
        });
        await waitFor(() => expect(result.current.suggestion).toBe('Parcial sin terminar'));

        // Close the stream WITHOUT a `done` event. This simulates a
        // network drop mid-stream (R-3).
        await act(async () => {
            sse.closeSse();
        });

        await waitFor(() => expect(result.current.status).toBe('error'));
        expect(result.current.suggestion).toBe('');
        expect(result.current.error?.code).toBe('NETWORK_INTERRUPTED');
    });
});

describe('useAiTextImprove — abort on unmount', () => {
    it('aborts the in-flight fetch when the consumer unmounts', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result, unmount } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });

        // Wait until the request has been issued so the AbortSignal is
        // captured by the fetch mock.
        await waitFor(() => expect(lastFetchSignal).not.toBeNull());
        expect(lastFetchSignal?.aborted).toBe(false);

        unmount();

        // The cleanup effect must have aborted the signal. Without this
        // assertion the test would pass even if we forgot to wire
        // AbortController into the fetch.
        expect(lastFetchSignal?.aborted).toBe(true);
    });
});

describe('useAiTextImprove — abort() during streaming', () => {
    it('cancels the in-flight request and resets state when abort() is called', async () => {
        const sse = makeSseResponse();
        installFetchMock(async () => sse.response);

        const { result } = renderHook(() => useAiTextImprove());

        act(() => {
            void result.current.improve(DEFAULT_REQUEST);
        });
        await waitFor(() => expect(result.current.status).toBe('loading'));

        act(() => {
            sse.enqueueSse('token', { delta: 'Parcial' });
        });
        await waitFor(() => expect(result.current.suggestion).toBe('Parcial'));

        act(() => {
            result.current.abort();
        });

        expect(result.current.status).toBe('idle');
        expect(result.current.suggestion).toBe('');
        expect(result.current.error).toBeNull();
        expect(lastFetchSignal?.aborted).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Pure helper tests (parseSseStream, normaliseErrorCode)
// ---------------------------------------------------------------------------

describe('parseSseStream — pure SSE parser', () => {
    it('parses a stream of well-formed frames', async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(
                    encoder.encode(
                        'event: token\ndata: {"delta":"a"}\n\n' +
                            'event: token\ndata: {"delta":"b"}\n\n' +
                            'event: done\ndata: {"usage":{}}\n\n'
                    )
                );
                controller.close();
            }
        });

        const frames: Array<{ event: string; data: string }> = [];
        for await (const frame of parseSseStream(body)) {
            frames.push(frame);
        }

        expect(frames).toEqual([
            { event: 'token', data: '{"delta":"a"}' },
            { event: 'token', data: '{"delta":"b"}' },
            { event: 'done', data: '{"usage":{}}' }
        ]);
    });

    it('handles frames split across chunk boundaries', async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                // First chunk cuts a frame in half.
                controller.enqueue(encoder.encode('event: tok'));
                controller.enqueue(encoder.encode('en\ndata: {"delta":"x"}\n\n'));
                controller.close();
            }
        });

        const frames: Array<{ event: string; data: string }> = [];
        for await (const frame of parseSseStream(body)) {
            frames.push(frame);
        }

        expect(frames).toEqual([{ event: 'token', data: '{"delta":"x"}' }]);
    });

    it('defaults the event name to "message" when the event line is absent', async () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode('data: {"hello":"world"}\n\n'));
                controller.close();
            }
        });

        const frames: Array<{ event: string; data: string }> = [];
        for await (const frame of parseSseStream(body)) {
            frames.push(frame);
        }

        expect(frames).toEqual([{ event: 'message', data: '{"hello":"world"}' }]);
    });
});

describe('normaliseErrorCode', () => {
    it('passes through known codes unchanged', () => {
        for (const code of AI_TEXT_IMPROVE_ERROR_CODES) {
            expect(normaliseErrorCode(code)).toBe(code);
        }
    });

    it('falls back to INTERNAL_ERROR for unknown codes', () => {
        expect(normaliseErrorCode('SOMETHING_NEW')).toBe('INTERNAL_ERROR');
        expect(normaliseErrorCode('')).toBe('INTERNAL_ERROR');
    });
});
