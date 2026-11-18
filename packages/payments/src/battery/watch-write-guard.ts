/**
 * The write guard of the watch battery (HOS-1512, M1, M2, N1): every non-GET request is checked here,
 * before it is sent, against the closed list of allowed operations, the objects THIS RUN created and
 * the money ledger.
 *
 * @module battery/watch-write-guard
 */
import { type WatchEffect, WatchGuardError, type WatchRequest } from './types';
import { classifyOperation, isMoneyWrite, type WatchOperation } from './watch-operations';

/** Money moved so far. Charges and refunds are tracked apart: a refund never offsets a charge. */
export interface WatchLedger {
    /** Minor units charged. */
    charged: number;
    /** Minor units refunded: money going out, NEVER subtracted from `charged`. */
    refunded: number;
}

/** What one run has done to the provider, shared by all its measurements. */
export interface WatchRunState {
    readonly ledger: WatchLedger;
    /** Provider ids of objects THIS RUN created. Id-targeted writes are allowed on these only. */
    readonly createdIds: Set<string>;
    /** Minor units charged on each object this run created (a refund is capped by it). */
    readonly chargedById: Map<string, number>;
    /** Minor units refunded on each object. */
    readonly refundedById: Map<string, number>;
}

/** A fresh state for one run. */
export function createWatchRunState(): WatchRunState {
    return {
        ledger: { charged: 0, refunded: 0 },
        createdIds: new Set(),
        chargedById: new Map(),
        refundedById: new Map()
    };
}

function refuse(code: ConstructorParameters<typeof WatchGuardError>[0]['code'], message: string) {
    return new WatchGuardError({ code, message });
}

/**
 * Checks one non-GET request and RESERVES its money on the run state: the amount is booked before
 * the request leaves, so the cap holds across concurrent and in-flight writes. The caller then
 * confirms the reservation (a 2xx: nothing to do, it stays booked), keeps it (an unknown outcome,
 * which aborts the run) or gives it back with {@link releaseWrite} (a definitive 4xx: nothing moved).
 *
 * @param args.entryId - The measurement sending it
 * @param args.effect - What the measurement is marked as
 * @param args.request - The request
 * @param args.pathname - The normalized pathname
 * @param args.search - The query string of the request, `''` when there is none
 * @param args.chargeMinor - What the measurement declares it charges (a `charge`)
 * @param args.refundMinor - What the measurement declares it refunds (a `refund`)
 * @param args.state - The run's state: ledger, created ids, charges and refunds by id
 * @param args.chargeCap - The most the ledger may hold in `charged`
 * @returns The allowed operation the request is
 * @throws {WatchGuardError} when the operation is not on the list, is not allowed for this
 *   measurement, targets an object this run did not create, declares a charge or refund the body does
 *   not state, or would pass a cap
 */
export function guardWrite(args: {
    readonly entryId: string;
    readonly effect: WatchEffect;
    readonly request: WatchRequest;
    readonly pathname: string;
    readonly search: string;
    readonly chargeMinor?: number | undefined;
    readonly refundMinor?: number | undefined;
    readonly state: WatchRunState;
    readonly chargeCap: number;
    /** What this measurement has charged so far, and the most it declared it would. */
    readonly entryCharged: number;
    readonly entryCap: number;
}): WatchOperation {
    const { entryId, effect, request, pathname, state } = args;
    const { ledger } = state;
    const where = `${request.method} ${pathname}`;
    if (effect === 'read') {
        throw refuse('READ_ENTRY_MUTATED', `${entryId} is declared read-only and tried a ${where}`);
    }
    if (args.search !== '') {
        throw refuse(
            'OPERATION_NOT_ALLOWED',
            `${entryId} sent ${where} with a query string; a write carries everything in its body`
        );
    }
    const operation = classifyOperation({ request, pathname });
    if (operation === null) {
        throw refuse(
            isMoneyWrite({ request, pathname }) && effect !== 'moves-money'
                ? 'MONEY_ROUTE_FORBIDDEN'
                : 'OPERATION_NOT_ALLOWED',
            `${entryId} tried ${where}, which is not on the list of allowed operations`
        );
    }
    if (operation.kind !== 'non-money' && effect !== 'moves-money') {
        throw refuse(
            'MONEY_ROUTE_FORBIDDEN',
            `${entryId} is not marked moves-money and tried ${where} (${operation.rule})`
        );
    }
    // An id-targeted write acts on ONE object: it must be one this run created, never a real
    // customer's cancel, re-price or refund.
    if (operation.targetId !== null && !state.createdIds.has(operation.targetId)) {
        throw refuse(
            'TARGET_NOT_CREATED_BY_RUN',
            `${entryId} tried ${where} (${operation.rule}) on an object this run did not create`
        );
    }
    if (operation.kind === 'non-money' || operation.kind === 'zero-charge') {
        if (args.chargeMinor !== undefined && args.chargeMinor !== 0) {
            throw refuse(
                'BUDGET_EXCEEDED',
                `${entryId} declares a charge on ${where} (${operation.rule}), which charges nothing`
            );
        }
        if (args.refundMinor !== undefined && args.refundMinor !== 0) {
            throw refuse(
                'BUDGET_EXCEEDED',
                `${entryId} declares a refund on ${where} (${operation.rule}), which refunds nothing`
            );
        }
        return operation;
    }
    if (operation.kind === 'charge') {
        if (args.chargeMinor === undefined) {
            throw refuse(
                'CHARGE_UNDECLARED',
                `${entryId} sent ${where} without declaring what it charges`
            );
        }
        if (operation.statedMinor === null || operation.statedMinor !== args.chargeMinor) {
            throw refuse(
                'CHARGE_MISMATCH',
                `${entryId} declared a charge of ${args.chargeMinor} and ${operation.rule} states ${operation.statedMinor ?? 'no amount'} (minor units)`
            );
        }
        // Checked BEFORE booking: a charge that is refused never reaches the ledger.
        if (args.entryCharged + operation.statedMinor > args.entryCap) {
            throw refuse(
                'BUDGET_EXCEEDED',
                `${entryId} would charge ${args.entryCharged + operation.statedMinor}, above the ${args.entryCap} it declared`
            );
        }
        if (ledger.charged + operation.statedMinor > args.chargeCap) {
            throw refuse(
                'BUDGET_EXCEEDED',
                `${entryId} would bring the charges to ${ledger.charged + operation.statedMinor}, above the cap of ${args.chargeCap}`
            );
        }
        ledger.charged += operation.statedMinor;
        return operation;
    }
    // refund
    if (args.refundMinor === undefined) {
        throw refuse(
            'CHARGE_UNDECLARED',
            `${entryId} sent ${where} without declaring what it refunds`
        );
    }
    if (operation.statedMinor === null || operation.statedMinor !== args.refundMinor) {
        throw refuse(
            'CHARGE_MISMATCH',
            `${entryId} declared a refund of ${args.refundMinor} and ${operation.rule} states ${operation.statedMinor ?? 'no amount'} (minor units)`
        );
    }
    // A refund returns at most what THIS RUN charged on that same object.
    const target = operation.targetId ?? '';
    const refundedAfter = (state.refundedById.get(target) ?? 0) + operation.statedMinor;
    if (refundedAfter > (state.chargedById.get(target) ?? 0)) {
        throw refuse(
            'BUDGET_EXCEEDED',
            `${entryId} would refund ${refundedAfter} on ${target}, above the ${state.chargedById.get(target) ?? 0} this run charged on it`
        );
    }
    state.refundedById.set(target, refundedAfter);
    ledger.refunded += operation.statedMinor;
    return operation;
}

/**
 * Gives back the reservation {@link guardWrite} made for a write the provider definitively
 * refused (a 4xx): nothing moved, so the ledger and the per-object refund map must not keep it.
 * Never call it for an unknown outcome (transport error, 5xx, a 2xx create without an id): there the
 * money may have moved and the reservation stays.
 *
 * @param args.operation - The operation {@link guardWrite} returned
 * @param args.state - The run's state
 */
export function releaseWrite(args: {
    readonly operation: WatchOperation;
    readonly state: WatchRunState;
}): void {
    const { operation, state } = args;
    const minor = operation.statedMinor ?? 0;
    if (operation.kind === 'charge') {
        state.ledger.charged -= minor;
    } else if (operation.kind === 'refund') {
        const target = operation.targetId ?? '';
        state.refundedById.set(target, (state.refundedById.get(target) ?? 0) - minor);
        state.ledger.refunded -= minor;
    }
}
