/**
 * The write guard of the watch battery (HOS-1512, M1, M2): every non-GET request is checked here,
 * before it is sent, against the closed list of allowed operations and the money ledger.
 *
 * @module battery/watch-write-guard
 */
import { type WatchEffect, WatchGuardError, type WatchRequest } from './types';
import { classifyOperation, isMoneyWrite } from './watch-operations';

/** Money moved so far. Charges and refunds are tracked apart: a refund never offsets a charge. */
export interface WatchLedger {
    /** Minor units charged. */
    charged: number;
    /** Minor units refunded: money going out, NEVER subtracted from `charged`. */
    refunded: number;
}

function refuse(code: ConstructorParameters<typeof WatchGuardError>[0]['code'], message: string) {
    return new WatchGuardError({ code, message });
}

/**
 * Checks one non-GET request and books its money on the ledger.
 *
 * @param args.entryId - The measurement sending it
 * @param args.effect - What the measurement is marked as
 * @param args.request - The request
 * @param args.pathname - The normalized pathname
 * @param args.chargeMinor - What the measurement declares it charges (a `charge`)
 * @param args.refundMinor - What the measurement declares it refunds (a `refund`)
 * @param args.ledger - The ledger the charge or refund is booked on
 * @param args.chargeCap - The most the ledger may hold in `charged`
 * @throws {WatchGuardError} when the operation is not on the list, is not allowed for this
 *   measurement, declares a charge the body does not state, or would pass the cap
 */
export function guardWrite(args: {
    readonly entryId: string;
    readonly effect: WatchEffect;
    readonly request: WatchRequest;
    readonly pathname: string;
    readonly chargeMinor?: number | undefined;
    readonly refundMinor?: number | undefined;
    readonly ledger: WatchLedger;
    readonly chargeCap: number;
}): void {
    const { entryId, effect, request, pathname, ledger } = args;
    const where = `${request.method} ${pathname}`;
    if (effect === 'read') {
        throw refuse('READ_ENTRY_MUTATED', `${entryId} is declared read-only and tried a ${where}`);
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
        return;
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
        ledger.charged += operation.statedMinor;
        if (ledger.charged > args.chargeCap) {
            throw refuse(
                'BUDGET_EXCEEDED',
                `${entryId} would bring the charges to ${ledger.charged}, above the cap of ${args.chargeCap}`
            );
        }
        return;
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
    ledger.refunded += operation.statedMinor;
}
