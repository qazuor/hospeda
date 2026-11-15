/**
 * Server-side Umami delivery client (HOS-2119, T-019).
 *
 * Batches events mapped by {@link mapToUmamiBatchItem} and POSTs them to
 * `<url>/api/batch`. Delivery is best-effort and never blocks or throws into
 * the caller. Measured on Umami 3.5.0:
 * - bot User-Agents (anything with "api", node, undici, curl) are dropped with
 *   HTTP 200, so every request carries {@link UMAMI_SYNTHETIC_USER_AGENT};
 * - HTTP 200 is not success: the body reports `{ size, processed, errors, details }`;
 * - the body limit is ~10 MB (12 MB answers 400), hence the byte-based chunking.
 *
 * There are no retries on purpose: analytics are lossy by contract, a retry
 * queue adds memory pressure and duplicate-event risk (Umami has no
 * idempotency key), and the next flush carries fresh data anyway.
 */
import { z } from 'zod';
import type { ServerAnalyticsClient } from '../server.js';
import { sanitizeAnalyticsVisitor } from '../shared.js';
import {
    mapToUmamiBatchItem,
    UMAMI_SYNTHETIC_USER_AGENT,
    type UmamiBatchItem
} from './umami-payload.js';

/** Minimal logger the client needs. Defaults to a silent no-op. */
export interface UmamiServerLogger {
    /** Non-fatal anomalies (dropped items, mapper warnings). */
    warn(message: string, context?: Record<string, unknown>): void;
    /** Delivery problems (HTTP errors, network errors, partial failures). */
    error(message: string, context?: Record<string, unknown>): void;
}

/** Options of {@link createUmamiServerClient}. */
export interface CreateUmamiServerClientOptions {
    /** Umami base url. Blank or missing yields a no-op client. */
    readonly url?: string | undefined;
    /** Umami website id. Blank or missing yields a no-op client. */
    readonly websiteId?: string | undefined;
    /** Host of the surface the events describe (e.g. the API hostname). */
    readonly hostname: string;
    /** Injected fetch; defaults to the global one. */
    readonly fetch?: typeof fetch;
    /** Injected logger; defaults to silent. */
    readonly logger?: UmamiServerLogger;
    /** Queue size that triggers a flush. Default 20. */
    readonly flushAt?: number;
    /** Interval between automatic flushes in ms. Default 10_000. */
    readonly flushIntervalMs?: number;
    /**
     * Per-request abort timeout in ms. Default 2_500, kept below the default
     * shutdown deadline (3_000) so a stuck request is aborted before shutdown gives up.
     */
    readonly timeoutMs?: number;
    /** Max items per request. Default 500. */
    readonly maxBatchItems?: number;
    /** Max request body bytes. Default 9 MB (Umami rejects ~10 MB). */
    readonly maxBatchBytes?: number;
}

/** Server analytics client backed by Umami. */
export interface UmamiServerClient extends ServerAnalyticsClient {
    /** Sends everything queued. Never rejects. */
    flush(): Promise<void>;
    /** Stops the timer, flushes (bounded by `timeoutMs`, default 3000; on the deadline live requests are aborted) and disables capture. Never rejects. */
    shutdown(input?: { readonly timeoutMs?: number }): Promise<void>;
}

const SILENT_LOGGER: UmamiServerLogger = { warn: () => {}, error: () => {} };
const MAX_DETAILS_LOGGED = 3;
const MAX_NOTES = 50;
const ENCODER = new TextEncoder();

const BatchResponseSchema = z.object({
    size: z.number(),
    processed: z.number(),
    errors: z.number(),
    details: z.array(z.unknown()).optional()
});

interface QueueEntry {
    readonly item: UmamiBatchItem;
    readonly bytes: number;
}

function isBlank(value: string | undefined): boolean {
    return value === undefined || value.trim().length === 0;
}

/**
 * Creates the Umami server client.
 *
 * @param options - Connection, batching and injection options.
 * @returns A client; a no-op one when `url` or `websiteId` is blank.
 *
 * @example
 * ```ts
 * const umami = createUmamiServerClient({ url, websiteId, hostname: 'api.hospeda.com.ar' });
 * umami.capture({ distinctId: 'user-1', event: 'ai_feature_used', properties: {} });
 * await umami.shutdown();
 * ```
 */
export function createUmamiServerClient(
    options: CreateUmamiServerClientOptions
): UmamiServerClient {
    if (isBlank(options.url) || isBlank(options.websiteId)) {
        return {
            capture: () => {},
            flush: async () => {},
            shutdown: async () => {}
        };
    }

    const endpoint = `${(options.url as string).trim().replace(/\/+$/, '')}/api/batch`;
    const websiteId = (options.websiteId as string).trim();
    const doFetch = options.fetch ?? fetch;
    const logger = options.logger ?? SILENT_LOGGER;
    const flushAt = options.flushAt ?? 20;
    const timeoutMs = options.timeoutMs ?? 2_500;
    const maxItems = options.maxBatchItems ?? 500;
    const maxBytes = options.maxBatchBytes ?? 9 * 1024 * 1024;

    let queue: QueueEntry[] = [];
    let notes: string[] = [];
    let droppedNotes = 0;
    let closed = false;
    /** Set when the shutdown deadline passes: no further requests are started. */
    let hardStop = false;
    let current: Promise<void> | null = null;
    let pending = false;
    const requests = new Map<AbortController, ReturnType<typeof setTimeout>>();

    function addNote(note: string): void {
        if (notes.length < MAX_NOTES) notes.push(note);
        else droppedNotes++;
    }

    function abortLiveRequests(): void {
        for (const [controller, timer] of requests) {
            clearTimeout(timer);
            controller.abort();
        }
        requests.clear();
    }

    /** Sends one chunk; returns problem descriptions (empty when clean). */
    async function sendChunk(chunk: readonly QueueEntry[]): Promise<string[]> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        timer.unref?.();
        requests.set(controller, timer);
        try {
            const response = await doFetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': UMAMI_SYNTHETIC_USER_AGENT
                },
                body: JSON.stringify(chunk.map((entry) => entry.item)),
                signal: controller.signal
            });
            if (!response.ok) {
                await response.body?.cancel().catch(() => {});
                return [`HTTP ${response.status} for ${chunk.length} event(s), chunk dropped`];
            }
            let parsed: z.infer<typeof BatchResponseSchema>;
            try {
                parsed = BatchResponseSchema.parse(JSON.parse(await response.text()));
            } catch {
                return [
                    `HTTP ${response.status} with an unparseable body for ${chunk.length} event(s)`
                ];
            }
            const details = parsed.details ?? [];
            if (parsed.processed < parsed.size || parsed.errors > 0 || details.length > 0) {
                return [
                    `Partial failure: size=${parsed.size} processed=${parsed.processed} errors=${parsed.errors} details=${JSON.stringify(details.slice(0, MAX_DETAILS_LOGGED))}`
                ];
            }
            return [];
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            return [`Request failed for ${chunk.length} event(s): ${reason}`];
        } finally {
            clearTimeout(timer);
            requests.delete(controller);
        }
    }

    function toChunks(entries: readonly QueueEntry[]): QueueEntry[][] {
        const chunks: QueueEntry[][] = [];
        let current: QueueEntry[] = [];
        let bytes = 2; // brackets
        for (const entry of entries) {
            const comma = current.length > 0 ? 1 : 0;
            if (
                current.length > 0 &&
                (current.length >= maxItems || bytes + entry.bytes + comma > maxBytes)
            ) {
                chunks.push(current);
                current = [];
                bytes = 2;
            }
            bytes += entry.bytes + (current.length > 0 ? 1 : 0);
            current.push(entry);
        }
        if (current.length > 0) chunks.push(current);
        return chunks;
    }

    async function doFlush(): Promise<void> {
        // Take the queue synchronously so a flush never shares items with another.
        const taken = queue;
        const takenNotes = notes;
        const dropped = droppedNotes;
        queue = [];
        notes = [];
        droppedNotes = 0;
        const sendable: QueueEntry[] = [];
        let oversized = 0;
        for (const entry of taken) {
            if (entry.bytes + 2 > maxBytes) oversized++;
            else sendable.push(entry);
        }
        if (oversized > 0) {
            takenNotes.push(`Dropped ${oversized} event(s) larger than ${maxBytes} bytes`);
        }
        if (takenNotes.length > 0) {
            logger.warn('Umami capture notes', {
                count: takenNotes.length,
                dropped,
                notes: takenNotes.slice(0, 5)
            });
        }
        const problems: string[] = [];
        for (const chunk of toChunks(sendable)) {
            if (hardStop) break;
            problems.push(...(await sendChunk(chunk)));
        }
        if (problems.length > 0) {
            logger.error('Umami delivery problem', { problems: problems.slice(0, 5) });
        }
    }

    async function runFlushLoop(): Promise<void> {
        do {
            pending = false;
            await doFlush().catch(() => {});
        } while (pending && !hardStop && (queue.length > 0 || notes.length > 0));
        current = null;
    }

    /** At most one flush runs at a time; calls during a run coalesce into one re-run. */
    function flush(): Promise<void> {
        if (current) {
            pending = true;
            return current;
        }
        current = runFlushLoop();
        return current;
    }

    let shutdownPromise: Promise<void> | null = null;

    const interval = setInterval(() => {
        if (queue.length > 0 || notes.length > 0) void flush();
    }, options.flushIntervalMs ?? 10_000);
    interval.unref?.();

    return {
        capture(input): void {
            if (closed) return;
            try {
                const visitor = sanitizeAnalyticsVisitor(input.visitor);
                const { item, warnings } = mapToUmamiBatchItem({
                    event: input.event,
                    properties: input.properties ?? {},
                    distinctId: input.distinctId,
                    ...(input.uuid === undefined ? {} : { uuid: input.uuid }),
                    ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp }),
                    websiteId,
                    hostname: options.hostname,
                    ...(visitor === undefined ? {} : { visitor })
                });
                for (const warning of warnings) addNote(warning);
                queue.push({ item, bytes: ENCODER.encode(JSON.stringify(item)).byteLength });
            } catch (error) {
                addNote(
                    `Dropped event "${String(input.event).slice(0, 50)}": ${error instanceof Error ? error.name : 'mapping error'}`
                );
                return;
            }
            if (queue.length >= flushAt) void flush();
        },
        flush,
        shutdown(input): Promise<void> {
            if (shutdownPromise) return shutdownPromise;
            closed = true;
            clearInterval(interval);
            const limit = input?.timeoutMs ?? 3_000;
            shutdownPromise = (async () => {
                let timer: ReturnType<typeof setTimeout> | undefined;
                const deadline = new Promise<void>((resolve) => {
                    timer = setTimeout(() => {
                        hardStop = true;
                        abortLiveRequests();
                        resolve();
                    }, limit);
                });
                try {
                    await Promise.race([flush(), deadline]);
                } finally {
                    clearTimeout(timer);
                }
            })();
            return shutdownPromise;
        }
    };
}
