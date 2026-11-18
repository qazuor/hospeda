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
 * A pending preapproval creation (security review 2026-11-18) is tracked the same way, though it
 * moves no money: someone who opens its approval link could authorize it before the run cancels
 * it. Its key is derived and recorded before it leaves, its id is recorded as it answers, a lost
 * or 5xx answer stops the run, a measurement may send ONE, and only at the amount it declares.
 *
 * @module battery/watch-send
 */
import { createHash } from 'node:crypto';
import { FAKE_AMOUNT_FLOOR_MINOR } from '../fake/fake-rules';
import { projectForShape, shapeOf } from './shape';
import {
    type ShapeMap,
    type WatchContext,
    type WatchEntry,
    WatchGuardError,
    type WatchRequest,
    type WatchTransport
} from './types';
import { assertHeadersAllowed } from './watch-headers';
import { PENDING_CANCEL_RULE, PENDING_CREATE_RULE, pendingAmountMinorOf } from './watch-operations';
import { normalizeRequestPath, WATCH_INTERNAL_ORIGIN } from './watch-path';
import { guardWrite, releaseWrite, type WatchRunState } from './watch-write-guard';

/**
 * The statuses that are a definitive rejection: the provider refused the request and no money
 * moved, so the reservation is given back. Every other status of a money write (408, 409, 425, 429,
 * any other 4xx, 5xx) is an unknown outcome: the reservation stays and the run stops. One exception
 * (G3): a 402 to `orders.create` whose body names the failed order under `data.id` is a definitive
 * decline too, exactly as the adapter reads it (see `declinedOrderIdOf`).
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
 * G3: the id of the failed order a declined `orders.create` answers with a 402 (`EX-30`, `RP16`).
 * Read exactly as the adapter reads it (`mercadopago-order-charge.ts`, `DeclinedOrderSchema`): a
 * non-empty string under `data.id`. Anything else is not a readable decline.
 *
 * @param body - The 402 answer's body
 * @returns The failed order's id, or `undefined` when the body carries none
 */
function declinedOrderIdOf(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null || !('data' in body)) return undefined;
    const data = (body as { readonly data: unknown }).data;
    if (typeof data !== 'object' || data === null || !('id' in data)) return undefined;
    const id = (data as { readonly id: unknown }).id;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/** A money write that left, kept so {@link GuardedSend.replay} can resend it verbatim (F4). */
interface SentMoneyWrite {
    readonly key: string;
    /** The request exactly as it went out: stamped body and derived key header included. */
    readonly request: WatchRequest;
    readonly creates: boolean;
    /** The id the first answer carried, once it answered one. */
    firstId?: string;
}

/** What {@link createGuardedSend} returns: the `send` and the way to close it. */
export interface GuardedSend {
    /** The `send` for the measurement's context; sends run one at a time, in call order. */
    readonly send: WatchContext['send'];
    /** The `replay` for the measurement's context; queued with the sends, in call order. */
    readonly replay: WatchContext['replay'];
    /**
     * Closes the send once the measurement has settled: refuses any send that has not started,
     * waits for the one in flight, and answers the first guard error any send raised (or `null`).
     * Never rejects. The engine calls it BEFORE it reads the measurement's ids or closes the run.
     */
    readonly settle: () => Promise<WatchGuardError | null>;
}

/**
 * Builds the `send` of one measurement.
 *
 * Sends are SERIALIZED: each one's guard, record, request and record complete before the next
 * starts, so a measurement that fires two money writes at once (`Promise.all`) books, records and
 * answers them in order, and the ledger snapshots persisted with them are monotonic. A send that
 * trips a guard poisons the rest: the sends not yet started are refused.
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
 * @returns The `send` for the measurement's context and the `settle` that closes it
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
}): GuardedSend {
    const { entry, transport, runId, state, runCap, shapes, providerIds, record } = args;
    let entryCharged = 0;
    let pendingCreates = 0;
    const sequences = new Map<string, number>();
    /** The last money write that left under each label: what a replay may resend. */
    const lastMoneyWrite = new Map<string, SentMoneyWrite>();

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

    const sendOne: WatchContext['send'] = async ({
        label,
        request,
        chargeMinor,
        refundMinor,
        shapePaths
    }) => {
        const shapeOfAnswer = (body: unknown) =>
            shapeOf({
                body: shapePaths === undefined ? body : projectForShape({ body, paths: shapePaths })
            });
        assertHeadersAllowed({ headers: request.headers });
        const { pathname, search } = normalizeRequestPath({
            path: request.path,
            origin: WATCH_INTERNAL_ORIGIN
        });
        if (request.method === 'GET') {
            const response = await transport(request);
            shapes[label] = shapeOfAnswer(response.body);
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
        const pending = operation.rule === PENDING_CREATE_RULE;
        if (pending) {
            if (pendingCreates >= 1) {
                throw new WatchGuardError({
                    code: 'PENDING_CREATE_LIMIT',
                    message: `${entry.id} tried a second pending preapproval creation; a measurement may send one, nothing was sent`
                });
            }
            const declared = entry.pendingAmountMinor ?? FAKE_AMOUNT_FLOOR_MINOR;
            const stated = pendingAmountMinorOf(request.body);
            if (stated !== declared) {
                throw new WatchGuardError({
                    code: 'PENDING_AMOUNT_MISMATCH',
                    message: `${entry.id} tried a pending preapproval of ${String(stated)} centavos but declares ${declared}; nothing was sent`
                });
            }
            pendingCreates += 1;
        }
        if (operation.kind === 'charge') entryCharged += operation.statedMinor ?? 0;

        const movesMoney = operation.kind === 'charge' || operation.kind === 'refund';
        /** Writes whose outcome must be known: money writes and pending creations. */
        const tracked = movesMoney || pending;
        let outgoing: WatchRequest = request;
        let key: string | null = null;
        if (tracked) {
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

        const sent: SentMoneyWrite | null =
            movesMoney && key !== null
                ? { key, request: outgoing, creates: operation.creates }
                : null;
        // Kept the moment it leaves: from here on this run HAS sent the key, whatever the answer.
        if (sent !== null) lastMoneyWrite.set(label, sent);
        let response: Awaited<ReturnType<WatchTransport>>;
        try {
            response = await transport(outgoing);
        } catch (error) {
            if (!tracked) throw error;
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${request.method} ${pathname} (key ${key}) and the answer is lost (${describeError(error)}); ${pending ? 'a pending preapproval may exist' : 'money may have moved'}, the run stops`
            });
        }
        shapes[label] = shapeOfAnswer(response.body);
        // G3: a 402 to `orders.create` whose body names the failed order is a definitive decline
        // (EX-30, RP16), read as the adapter reads it. A 402 without a readable id stays unknown.
        const declinedId =
            operation.rule === 'orders.create' && response.status === 402
                ? declinedOrderIdOf(response.body)
                : undefined;
        if (
            tracked &&
            (DEFINITIVE_REJECTION_STATUSES.has(response.status) || declinedId !== undefined)
        ) {
            // A definitive refusal: nothing moved, so the reservation is given back and the
            // corrected ledger is persisted. (A 5xx or a lost answer keeps it, below.)
            releaseWrite({ operation, state });
            if (operation.kind === 'charge') entryCharged -= operation.statedMinor ?? 0;
            // The provider may still have answered an id (traceability). It goes in `providerIds`
            // only: it is NOT one of this run's objects, so it never becomes a valid target.
            const refusedId = declinedId ?? idOf(response.body);
            if (sent !== null && refusedId !== undefined) sent.firstId = refusedId;
            if (refusedId !== undefined) providerIds.push(refusedId);
            await recordOrAbort(
                `was refused with ${response.status}`,
                refusedId === undefined ? {} : { providerIds: [refusedId] }
            );
            return response;
        }
        const id = idOf(response.body);
        if (tracked && response.status >= 400) {
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${request.method} ${pathname} (key ${key}) and the provider answered ${response.status}; ${pending ? 'a pending preapproval may exist' : 'money may have moved'}, the run stops`
            });
        }
        if (
            operation.rule === PENDING_CANCEL_RULE &&
            operation.targetId !== null &&
            response.status >= 200 &&
            response.status < 300
        ) {
            state.cancelledIds.add(operation.targetId);
        }
        if (id !== undefined) {
            if (sent !== null) sent.firstId = id;
            providerIds.push(id);
            if (operation.creates) {
                state.createdIds.add(id);
                if (pending && key !== null)
                    state.pendingCreated.set(id, { entryId: entry.id, key });
                if (operation.kind === 'charge') {
                    state.chargedById.set(
                        id,
                        (state.chargedById.get(id) ?? 0) + (operation.statedMinor ?? 0)
                    );
                }
            }
            await recordOrAbort(`created provider id ${id}`, { providerIds: [id] });
        } else if (
            tracked &&
            operation.creates &&
            response.status >= 200 &&
            response.status < 300
        ) {
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${request.method} ${pathname} (key ${key}) and the answer carries no id; ${pending ? 'a pending preapproval may exist' : 'money may have moved'}, the run stops`
            });
        }
        return response;
    };

    /** F4: resends the stored request of a money write, verbatim, booking nothing. */
    const replayOne: WatchContext['replay'] = async ({ label, of }) => {
        const original = lastMoneyWrite.get(of);
        if (original === undefined) {
            throw new WatchGuardError({
                code: 'REPLAY_NOT_SENT',
                message: `${entry.id} asked to replay "${of}", which it never sent as a money write; a replay only resends a key this run already sent`
            });
        }
        const where = `${original.request.method} ${original.request.path} (replay of key ${original.key})`;
        let response: Awaited<ReturnType<WatchTransport>>;
        try {
            response = await transport(original.request);
        } catch (error) {
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${where} and the answer is lost (${describeError(error)}); money may have moved, the run stops`
            });
        }
        shapes[label] = shapeOf({ body: response.body });
        if (response.status >= 500) {
            throw new WatchGuardError({
                code: 'WRITE_OUTCOME_UNKNOWN',
                message: `${entry.id} sent ${where} and the provider answered ${response.status}; money may have moved, the run stops`
            });
        }
        if (original.creates && response.status >= 200 && response.status < 300) {
            // A replay books nothing, so it must answer the FIRST object: any other one (or none)
            // means the provider may have created and charged again.
            const id = idOf(response.body);
            if (id === undefined || id !== original.firstId) {
                if (id !== undefined) {
                    providerIds.push(id);
                    await recordOrAbort(`replayed key ${original.key} and got ${id}`, {
                        providerIds: [id]
                    });
                }
                throw new WatchGuardError({
                    code: 'WRITE_OUTCOME_UNKNOWN',
                    message: `${entry.id} sent ${where} and the answer is not the first object (${id ?? 'no id'} instead of ${original.firstId ?? 'none'}); money may have moved, the run stops`
                });
            }
        }
        return response;
    };

    // The queue: each send starts when the previous one has finished (answered or failed).
    let tail: Promise<unknown> = Promise.resolve();
    let closedBecause: string | null = null;
    let settled = false;
    let firstGuardError: WatchGuardError | null = null;

    /**
     * The one send a guard does NOT poison (security review 2026-11-18): the exact cancel of a
     * pending preapproval this run created and has not cancelled yet. It moves no money, and
     * refusing it would leave a live approval link behind. A send after `settle` is still refused.
     */
    const isCleanupCancel = (call: Parameters<WatchContext['send']>[0]): boolean => {
        const { request } = call;
        if (request.method !== 'PUT') return false;
        const body = request.body;
        if (
            typeof body !== 'object' ||
            body === null ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            (body as Record<string, unknown>).status !== 'cancelled'
        ) {
            return false;
        }
        let pathname: string;
        try {
            pathname = normalizeRequestPath({
                path: request.path,
                origin: WATCH_INTERNAL_ORIGIN
            }).pathname;
        } catch {
            return false;
        }
        const id = /^\/preapproval\/([^/]+)$/.exec(pathname)?.[1];
        return id !== undefined && state.pendingCreated.has(id) && !state.cancelledIds.has(id);
    };

    const refuseClosed = (): WatchGuardError =>
        new WatchGuardError({
            code: 'SEND_AFTER_SETTLED',
            message: `${entry.id} tried to send after ${closedBecause ?? 'it settled'}; nothing more is sent`
        });

    // A send the measurement never awaits must not become an unhandled rejection; a measurement
    // that does await still sees the rejection (the no-op handler is a separate branch).
    const unobserved = <T>(promise: Promise<T>): Promise<T> => {
        promise.catch(() => undefined);
        return promise;
    };

    const enqueue = (
        work: () => Promise<Awaited<ReturnType<WatchTransport>>>,
        cleanup: () => boolean = () => false
    ): Promise<Awaited<ReturnType<WatchTransport>>> => {
        const refused = () => settled || (closedBecause !== null && !cleanup());
        if (refused()) return unobserved(Promise.reject(refuseClosed()));
        const result = tail.then(async () => {
            if (refused()) throw refuseClosed();
            try {
                return await work();
            } catch (error) {
                if (error instanceof WatchGuardError) {
                    firstGuardError ??= error;
                    closedBecause = `a guard stopped it (${error.code})`;
                }
                throw error;
            }
        });
        tail = result.catch(() => undefined);
        return unobserved(result);
    };

    const send: WatchContext['send'] = (call) =>
        enqueue(
            () => sendOne(call),
            () => isCleanupCancel(call)
        );
    const replay: WatchContext['replay'] = (call) => enqueue(() => replayOne(call));

    const settle = async (): Promise<WatchGuardError | null> => {
        closedBecause ??= 'the measurement settled';
        settled = true;
        await tail;
        return firstGuardError;
    };

    return { send, replay, settle };
}
