/**
 * The guarded `send` a measurement talks to the provider through (HOS-1512): path normalization,
 * the header list, the write guard, and the safeguards around a write that moves money.
 *
 * A write that charges or refunds is NEVER sent blind: its idempotency key (also stamped as the
 * object's `external_reference`) is derived from the run, the measurement and the request label,
 * and is recorded on the run row BEFORE the request leaves, so the object can be found afterwards
 * even if the answer is lost. A transport failure, a 5xx or an unreadable answer to such a write
 * aborts the run: the engine does not know whether money moved, and it does not go on.
 *
 * @module battery/watch-send
 */
import { createHash } from 'node:crypto';
import { shapeOf } from './shape';
import {
    type ShapeMap,
    type WatchContext,
    type WatchEntry,
    WatchGuardError,
    type WatchRequest,
    type WatchTransport
} from './types';
import { assertHeadersAllowed } from './watch-headers';
import { normalizeRequestPath, WATCH_INTERNAL_ORIGIN } from './watch-path';
import { guardWrite, releaseWrite, type WatchRunState } from './watch-write-guard';

/**
 * The statuses that are a definitive rejection: the provider refused the request and no money
 * moved, so the reservation is given back. Every other status of a money write (408, 409, 425, 429,
 * any other 4xx, 5xx) is an unknown outcome: the reservation stays and the run stops.
 */
const DEFINITIVE_REJECTION_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 404, 422]);

/** Header the provider deduplicates a write by. */
const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';

/**
 * The key of one write: stable for (run, measurement, label, n-th write with that label), and
 * short enough for the provider's limits. Also the `external_reference` of what it creates.
 *
 * @param args.runId - The run
 * @param args.entryId - The measurement
 * @param args.label - The request label
 * @param args.sequence - 0 for the first write with this label in the measurement
 * @returns The key
 */
export function watchWriteKey(args: {
    readonly runId: string;
    readonly entryId: string;
    readonly label: string;
    readonly sequence: number;
}): string {
    const digest = createHash('sha256')
        .update(`${args.runId}|${args.entryId}|${args.label}|${args.sequence}`)
        .digest('hex');
    return `hw-${digest.slice(0, 40)}`;
}

function describeError(error: unknown): string {
    if (error instanceof WatchGuardError) return `${error.code}: ${error.message}`;
    return error instanceof Error ? error.message : String(error);
}

function idOf(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null || !('id' in body)) return undefined;
    const id = (body as { readonly id: unknown }).id;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
}

/**
 * Builds the `send` of one measurement.
 *
 * @param args.entry - The measurement
 * @param args.transport - Sends the raw request
 * @param args.runId - The run
 * @param args.state - The run's state, shared by all its measurements
 * @param args.runCap - The most the whole run may charge
 * @param args.shapes - Filled with the shape of every answer, by label
 * @param args.providerIds - Filled with the ids of what writes created
 * @param args.record - Persists write keys (before sending), provider ids (as they answer) and
 *   the ledger, all in one statement per record
 * @returns The `send` for the measurement's context
 */
export function createGuardedSend(args: {
    readonly entry: WatchEntry;
    readonly transport: WatchTransport;
    readonly runId: string;
    readonly state: WatchRunState;
    readonly runCap: number;
    readonly shapes: Record<string, ShapeMap>;
    readonly providerIds: string[];
    readonly record: (arg: {
        readonly providerIds?: readonly string[];
        readonly writeKeys?: readonly string[];
        readonly ledger: { readonly charged: number; readonly refunded: number };
    }) => Promise<void>;
}): WatchContext['send'] {
    const { entry, transport, runId, state, runCap, shapes, providerIds, record } = args;
    let entryCharged = 0;
    const sequences = new Map<string, number>();

    const recordOrAbort = async (
        what: string,
        arg: { providerIds?: readonly string[]; writeKeys?: readonly string[] }
    ): Promise<void> => {
        try {
            // Every progress record carries the ledger as it stands, written in the same statement.
            await record({
                ...arg,
                ledger: { charged: state.ledger.charged, refunded: state.ledger.refunded }
            });
        } catch (error) {
            throw new WatchGuardError({
                code: 'PROGRESS_NOT_RECORDED',
                message: `${entry.id} ${what} and it could not be recorded (${describeError(error)}); nothing more is sent`
            });
        }
    };

    return async ({ label, request, chargeMinor, refundMinor }) => {
        assertHeadersAllowed({ headers: request.headers });
        const { pathname, search } = normalizeRequestPath({
            path: request.path,
            origin: WATCH_INTERNAL_ORIGIN
        });
        if (request.method === 'GET') {
            const response = await transport(request);
            shapes[label] = shapeOf({ body: response.body });
            return response;
        }
        const operation = guardWrite({
            entryId: entry.id,
            effect: entry.effect,
            request,
            pathname,
            search,
            chargeMinor,
            refundMinor,
            state,
            chargeCap: runCap,
            entryCharged,
            entryCap: entry.maxChargeMinor ?? 0
        });
        if (operation.kind === 'charge') entryCharged += operation.statedMinor ?? 0;

        const movesMoney = operation.kind === 'charge' || operation.kind === 'refund';
        let outgoing: WatchRequest = request;
        let key: string | null = null;
        if (movesMoney) {
            const sequence = sequences.get(label) ?? 0;
            sequences.set(label, sequence + 1);
            key = watchWriteKey({ runId, entryId: entry.id, label, sequence });
            // Recorded BEFORE it is sent: if the answer is lost, the key finds the object.
            await recordOrAbort(`is about to send ${pathname} with key ${key}`, {
                writeKeys: [key]
            });
            const body =
                operation.stampsReference &&
                typeof request.body === 'object' &&
                request.body !== null
                    ? { ...(request.body as Record<string, unknown>), external_reference: key }
                    : request.body;
            outgoing = {
                ...request,
                ...(body === undefined ? {} : { body }),
                headers: {
                    // Whatever key the measurement chose is replaced by the derived one.
                    ...Object.fromEntries(
                        Object.entries(request.headers ?? {}).filter(
                            ([name]) => name.toLowerCase() !== IDEMPOTENCY_HEADER.toLowerCase()
                        )
                    ),
                    [IDEMPOTENCY_HEADER]: key
                }
            };
        }

        let response: Awaited<ReturnType<WatchTransport>>;
        try {
            response = await transport(outgoing);
        } catch (error) {
            if (!movesMoney) throw error;
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${request.method} ${pathname} (key ${key}) and the answer is lost (${describeError(error)}); money may have moved, the run stops`
            });
        }
        shapes[label] = shapeOf({ body: response.body });
        if (movesMoney && DEFINITIVE_REJECTION_STATUSES.has(response.status)) {
            // A definitive refusal: nothing moved, so the reservation is given back and the
            // corrected ledger is persisted. (A 5xx or a lost answer keeps it, below.)
            releaseWrite({ operation, state });
            if (operation.kind === 'charge') entryCharged -= operation.statedMinor ?? 0;
            await recordOrAbort(`was refused with ${response.status}`, {});
            return response;
        }
        const id = idOf(response.body);
        if (movesMoney && response.status >= 400) {
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${request.method} ${pathname} (key ${key}) and the provider answered ${response.status}; money may have moved, the run stops`
            });
        }
        if (id !== undefined) {
            providerIds.push(id);
            if (operation.creates) {
                state.createdIds.add(id);
                if (operation.kind === 'charge') {
                    state.chargedById.set(
                        id,
                        (state.chargedById.get(id) ?? 0) + (operation.statedMinor ?? 0)
                    );
                }
            }
            await recordOrAbort(`created provider id ${id}`, { providerIds: [id] });
        } else if (
            movesMoney &&
            operation.creates &&
            response.status >= 200 &&
            response.status < 300
        ) {
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${request.method} ${pathname} (key ${key}) and the answer carries no id; money may have moved, the run stops`
            });
        }
        return response;
    };
}
