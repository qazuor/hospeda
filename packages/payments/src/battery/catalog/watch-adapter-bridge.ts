/**
 * The bridge that runs the REAL Mercado Pago adapter over a measurement's guarded `send`
 * (HOS-1512, owner decision 2026-11-18).
 *
 * The battery's core measurements build their requests with the adapter itself, not with
 * hand-written bodies: a drift in our own adapter (a field renamed in `authorize`, a response the
 * read schema no longer parses) is then caught by the same run that watches the provider. Every
 * request the adapter makes goes through `ctx.send`, so every guard still applies: the closed
 * operation list, the objects-this-run-created rule, the header list and the shape record.
 *
 * The adapter's own bearer token and content type are dropped: the watch transport sets both.
 * Retries are off (one attempt per request) so the sequence of labels is the same on every run.
 *
 * @module battery/catalog/watch-adapter-bridge
 */
import type { MercadoPagoSend } from '../../adapters/mercadopago/mercadopago-http';
import { MercadoPagoPaymentProvider } from '../../adapters/mercadopago/mercadopago-payment-provider';
import type { WatchContext, WatchMethod, WatchResponse } from '../types';

/** Placeholder: the adapter refuses to send without a token, and the bridge drops its header. */
const BRIDGE_TOKEN = 'watch-transport-sets-the-real-token';

/** Headers the adapter sets that the watch transport owns. */
const DROPPED_HEADERS: ReadonlySet<string> = new Set(['authorization', 'content-type']);

/** One adapter call made through the bridge. */
export interface BridgeCall<T> {
    /** What the adapter returned, when it did not throw. */
    readonly value?: T;
    /** What the adapter threw, when it did. */
    readonly error?: unknown;
    /** Every raw answer the call received, in order. */
    readonly responses: readonly WatchResponse[];
}

/** What {@link createWatchAdapterBridge} returns. */
export interface WatchAdapterBridge {
    /**
     * Runs one adapter call. Its requests are recorded as `label`, `label#2`, `label#3`...
     *
     * @param label - The label of the call's first request
     * @param call - The adapter call
     * @param options - See {@link BridgeCallOptions}
     * @returns The value or the error, with the raw answers
     */
    readonly call: <T>(
        label: string,
        call: (provider: MercadoPagoPaymentProvider) => Promise<T>,
        options?: BridgeCallOptions
    ) => Promise<BridgeCall<T>>;
    /** The adapter's low-level `send`, for the module functions that take one. Same labels. */
    readonly callWithSend: <T>(
        label: string,
        call: (send: MercadoPagoSend) => Promise<T>,
        options?: BridgeCallOptions
    ) => Promise<BridgeCall<T>>;
}

/** Options of one bridge call. */
export interface BridgeCallOptions {
    /** Records the shapes over only these paths (real-object re-reads). */
    readonly shapePaths?: readonly string[];
    /**
     * Records EVERY request of the call under the one label. For re-reads of real objects, whose
     * number of requests (pages, follow-up reads) depends on the object: numbered labels would
     * appear and disappear from one run to the next without the provider changing anything.
     */
    readonly oneLabel?: boolean;
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
    const kept: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
        if (!DROPPED_HEADERS.has(name.toLowerCase())) kept[name] = value;
    });
    return kept;
}

function urlOf(input: Parameters<typeof globalThis.fetch>[0]): URL {
    if (input instanceof URL) return input;
    if (typeof input === 'string') return new URL(input);
    return new URL(input.url);
}

/**
 * Builds the bridge over one measurement's context.
 *
 * @param args.ctx - The measurement's context
 * @returns The bridge
 */
export function createWatchAdapterBridge(args: { readonly ctx: WatchContext }): WatchAdapterBridge {
    const { ctx } = args;
    let current: {
        readonly label: string;
        count: number;
        readonly shapePaths: readonly string[] | undefined;
        readonly oneLabel: boolean;
        readonly responses: WatchResponse[];
    } | null = null;

    const forward = async (request: {
        readonly method: WatchMethod;
        readonly path: string;
        readonly body?: unknown;
        readonly headers: Record<string, string>;
    }): Promise<Response> => {
        const active = current;
        if (active === null) throw new Error('the adapter sent outside a bridge call');
        active.count += 1;
        const label =
            active.count === 1 || active.oneLabel
                ? active.label
                : `${active.label}#${active.count}`;
        const answer = await ctx.send({
            label,
            request: {
                method: request.method,
                path: request.path,
                ...(request.body === undefined ? {} : { body: request.body }),
                ...(Object.keys(request.headers).length === 0 ? {} : { headers: request.headers })
            },
            ...(active.shapePaths === undefined ? {} : { shapePaths: active.shapePaths })
        });
        active.responses.push(answer);
        return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
            status: answer.status,
            headers: { 'content-type': 'application/json' }
        });
    };

    const fetchThroughWatch: typeof globalThis.fetch = async (input, init) => {
        const url = urlOf(input);
        const rawBody = init?.body;
        return forward({
            method: (init?.method ?? 'GET').toUpperCase() as WatchMethod,
            path: `${url.pathname}${url.search}`,
            ...(typeof rawBody === 'string' ? { body: JSON.parse(rawBody) as unknown } : {}),
            headers: headersOf(init)
        });
    };

    const provider = new MercadoPagoPaymentProvider({
        clock: { now: ctx.now },
        accessToken: BRIDGE_TOKEN,
        fetch: fetchThroughWatch,
        // One attempt per request: a retry would change the labels from one run to the next.
        readRetry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, maxTotalDelayMs: 0 },
        sleep: async () => undefined,
        timeoutMs: 60_000
    });

    const send: MercadoPagoSend = (request) =>
        forward({
            method: request.method,
            path: request.path,
            ...(request.body === undefined ? {} : { body: request.body }),
            headers: Object.fromEntries(
                Object.entries(request.headers ?? {}).filter(
                    ([name]) => !DROPPED_HEADERS.has(name.toLowerCase())
                )
            )
        });

    const run = async <T>(
        label: string,
        work: () => Promise<T>,
        options: BridgeCallOptions | undefined
    ): Promise<BridgeCall<T>> => {
        const responses: WatchResponse[] = [];
        current = {
            label,
            count: 0,
            shapePaths: options?.shapePaths,
            oneLabel: options?.oneLabel === true,
            responses
        };
        try {
            return { value: await work(), responses };
        } catch (error) {
            return { error, responses };
        } finally {
            current = null;
        }
    };

    return {
        call: (label, call, options) => run(label, () => call(provider), options),
        callWithSend: (label, call, options) => run(label, () => call(send), options)
    };
}
