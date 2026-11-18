/**
 * What a request can charge, read from the request itself (HOS-1512, AC:B1:20).
 *
 * The budget guard does not trust the amount a measurement DECLARES: the declared charge is
 * compared with what the request body says it will charge. Mercado Pago bodies carry amounts
 * in PESOS (`transaction_amount: 1500` is ARS 1,500.00) while the repo and the authorization
 * use minor units, so the body amount is multiplied by 100 before the comparison. A request
 * that mixed the two up, 100 times too much or too little, no longer matches and aborts.
 *
 * @module battery/watch-charge
 */
import { WatchGuardError, type WatchRequest } from './types';

/** Routes that can move money, with their subpaths. Only a `moves-money` measurement may send to them. */
const MONEY_ROUTE =
    /^\/(?:v1\/payments|v1\/advanced_payments|preapproval|v1\/orders|authorized_payments)(?:\/|$)/;

/**
 * Whether a request is a write to a route that can move money.
 *
 * @param args.request - The request
 * @param args.pathname - The normalized pathname
 * @returns True for any non-GET to a money route and its subpaths
 */
export function isMoneyWrite(args: {
    readonly request: WatchRequest;
    /** The NORMALIZED pathname (see `normalizeRequestPath`), never the raw path. */
    readonly pathname: string;
}): boolean {
    if (args.request.method === 'GET') return false;
    return MONEY_ROUTE.test(args.pathname);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Amounts (in pesos) a request body states, wherever Mercado Pago puts them. */
function amountsInBody(body: unknown): readonly number[] {
    if (!isRecord(body)) return [];
    const found: unknown[] = [body.transaction_amount, body.amount, body.total_amount];
    if (isRecord(body.auto_recurring)) found.push(body.auto_recurring.transaction_amount);
    if (isRecord(body.transaction) && Array.isArray(body.transaction.payments)) {
        for (const payment of body.transaction.payments) {
            if (isRecord(payment)) found.push(payment.amount);
        }
    }
    return found
        .filter((value) => value !== undefined && value !== null)
        .map((value) => (typeof value === 'string' ? Number(value) : value))
        .filter((value): value is number => typeof value === 'number');
}

/**
 * The amount, in minor units, a request body will charge.
 *
 * @param args.request - The request
 * @returns The amount; 0 when the body states none (a cancel, for instance)
 * @throws {WatchGuardError} `CHARGE_MISMATCH` when the body states an amount that is not a
 *   finite non-negative number, or states several different ones
 */
export function chargeStatedByRequest(args: { readonly request: WatchRequest }): number {
    const minors = amountsInBody(args.request.body).map((pesos) => {
        if (!Number.isFinite(pesos) || pesos < 0) {
            throw new WatchGuardError({
                code: 'CHARGE_MISMATCH',
                message: 'A request states an amount that is not a finite non-negative number'
            });
        }
        return Math.round(pesos * 100);
    });
    if (new Set(minors).size > 1) {
        throw new WatchGuardError({
            code: 'CHARGE_MISMATCH',
            message: 'A request states several different amounts; the charge is ambiguous'
        });
    }
    return minors[0] ?? 0;
}
