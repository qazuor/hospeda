/**
 * The CLOSED list of non-GET operations the watch battery may send (HOS-1512, M1).
 *
 * Whatever is not listed here is refused, whatever the measurement is marked. Open-world
 * classification ("a money route is anything under /v1/payments") let a body that states no amount
 * count as a charge of 0: `PUT /preapproval/{id} {status: 'authorized'}` resumes billing, a
 * `POST /preapproval` with a `preapproval_plan_id` charges the plan's price and
 * `PUT /v1/payments/{id} {capture: true}` captures a held amount, and none of them carries an amount.
 *
 * Each rule has a method, a pattern over the NORMALIZED pathname (case-sensitive) and a kind:
 *
 * - `charge`: the body MUST state the amount, which is compared with what the measurement declares.
 * - `zero-charge`: an exact match on method, path and body (a cancel or a pause); it charges nothing.
 * - `refund`: money going OUT; the body MUST state the amount. Never added to the charged total.
 * - `non-money`: creates something that cannot charge (a customer, a card token, a plan).
 *
 * Amount shapes, as the adapter sends them and as measured against the live API (EX-41, EX-30, EX-58):
 * Payments and Preapproval bodies carry amounts as numbers in PESOS; the Orders API carries them as
 * strings in pesos under `total_amount` and `transactions.payments[].amount` (plural `transactions`),
 * and its refund under `transactions[].amount`.
 *
 * @module battery/watch-operations
 */
import { type WatchGuardCode, WatchGuardError, type WatchRequest } from './types';

/** What an allowed operation does with money. */
export type WatchOperationKind = 'charge' | 'zero-charge' | 'refund' | 'non-money';

/** An allowed operation, matched against one request. */
export interface WatchOperation {
    /** Stable name of the rule, for messages. */
    readonly rule: string;
    readonly kind: WatchOperationKind;
    /** What the body states, in minor units; `null` when the rule needs an amount and the body has none. */
    readonly statedMinor: number | null;
}

type Body = Readonly<Record<string, unknown>>;

interface Rule {
    readonly rule: string;
    readonly method: WatchRequest['method'];
    readonly path: RegExp;
    readonly kind: WatchOperationKind;
    /** Whether the body fits the rule (exact-match rules). */
    readonly accepts?: (body: Body) => boolean;
    /** The pesos amounts the body states, for `charge` and `refund`. */
    readonly amounts?: (body: Body) => readonly unknown[];
}

const ID = '[A-Za-z0-9_-]{1,64}';

function isRecord(value: unknown): value is Body {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bodyOf(value: unknown): Body {
    return isRecord(value) ? value : {};
}

function exactKeys(body: Body, keys: readonly string[]): boolean {
    const own = Object.keys(body).sort();
    return own.length === keys.length && own.every((key, index) => key === [...keys].sort()[index]);
}

function nested(body: Body, key: string): Body {
    return bodyOf(body[key]);
}

function listOf(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

const RULES: readonly Rule[] = [
    {
        rule: 'preapproval.create',
        method: 'POST',
        path: /^\/preapproval$/,
        kind: 'charge',
        amounts: (body) => [nested(body, 'auto_recurring').transaction_amount]
    },
    {
        rule: 'preapproval.change-amount',
        method: 'PUT',
        path: new RegExp(`^/preapproval/${ID}$`),
        kind: 'charge',
        accepts: (body) => exactKeys(body, ['auto_recurring']),
        amounts: (body) => [nested(body, 'auto_recurring').transaction_amount]
    },
    {
        rule: 'preapproval.cancel-or-pause',
        method: 'PUT',
        path: new RegExp(`^/preapproval/${ID}$`),
        kind: 'zero-charge',
        accepts: (body) =>
            exactKeys(body, ['status']) && (body.status === 'cancelled' || body.status === 'paused')
    },
    {
        rule: 'payments.create',
        method: 'POST',
        path: /^\/v1\/payments$/,
        kind: 'charge',
        amounts: (body) => [body.transaction_amount]
    },
    {
        rule: 'payments.refund',
        method: 'POST',
        path: new RegExp(`^/v1/payments/${ID}/refunds$`),
        kind: 'refund',
        amounts: (body) => [body.amount]
    },
    {
        rule: 'orders.create',
        method: 'POST',
        path: /^\/v1\/orders$/,
        kind: 'charge',
        amounts: (body) => {
            const payments = listOf(nested(body, 'transactions').payments);
            return [body.total_amount, ...payments.map((payment) => bodyOf(payment).amount)];
        }
    },
    {
        rule: 'orders.refund',
        method: 'POST',
        path: new RegExp(`^/v1/orders/${ID}/refund$`),
        kind: 'refund',
        amounts: (body) => listOf(body.transactions).map((entry) => bodyOf(entry).amount)
    },
    { rule: 'customers.create', method: 'POST', path: /^\/v1\/customers$/, kind: 'non-money' },
    { rule: 'card-tokens.create', method: 'POST', path: /^\/v1\/card_tokens$/, kind: 'non-money' },
    { rule: 'plans.create', method: 'POST', path: /^\/preapproval_plan$/, kind: 'non-money' }
];

function fail(args: { readonly code: WatchGuardCode; readonly message: string }): never {
    throw new WatchGuardError(args);
}

/** A pesos amount as minor units, or `null` when it is not a plain non-negative amount. */
function minorOf(value: unknown): number | null {
    if (typeof value === 'string') {
        if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
        return Math.round(Number(value) * 100);
    }
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.round(value * 100);
    }
    return null;
}

/**
 * What the body states, in minor units. `charge` amounts that appear more than once (an order's
 * total and its payment) must agree; `refund` amounts (one per refunded transaction) are summed.
 *
 * @throws {WatchGuardError} `CHARGE_MISMATCH` for an amount that is not a plain number, or
 *   several charge amounts that disagree
 */
function statedMinorOf(args: { readonly rule: Rule; readonly body: Body }): number | null {
    const raw = (args.rule.amounts?.(args.body) ?? []).filter(
        (value) => value !== undefined && value !== null
    );
    if (raw.length === 0) return null;
    const minors = raw.map((value) => minorOf(value));
    if (minors.some((minor) => minor === null)) {
        return fail({
            code: 'CHARGE_MISMATCH',
            message: `${args.rule.rule} states an amount that is not a plain non-negative number`
        });
    }
    const amounts = minors as number[];
    if (args.rule.kind === 'refund') return amounts.reduce((sum, minor) => sum + minor, 0);
    if (new Set(amounts).size > 1) {
        return fail({
            code: 'CHARGE_MISMATCH',
            message: `${args.rule.rule} states several different amounts; the charge is ambiguous`
        });
    }
    return amounts[0] ?? null;
}

/**
 * Finds the allowed operation a non-GET request is, or `null` when it is not on the list.
 *
 * @param args.request - The request
 * @param args.pathname - The normalized pathname
 * @returns The operation, or `null`: the request must then be refused
 * @throws {WatchGuardError} `CHARGE_MISMATCH` when the body states a malformed or ambiguous amount
 */
export function classifyOperation(args: {
    readonly request: WatchRequest;
    readonly pathname: string;
}): WatchOperation | null {
    const body = bodyOf(args.request.body);
    for (const rule of RULES) {
        if (rule.method !== args.request.method || !rule.path.test(args.pathname)) continue;
        if (rule.accepts && !rule.accepts(body)) continue;
        const stated =
            rule.kind === 'charge' || rule.kind === 'refund' ? statedMinorOf({ rule, body }) : null;
        return { rule: rule.rule, kind: rule.kind, statedMinor: stated };
    }
    return null;
}

/** Routes that can move money. A non-GET to one of them is never anything but a listed operation. */
const MONEY_ROUTE =
    /^\/(?:v1\/payments|v1\/advanced_payments|preapproval|v1\/orders|authorized_payments)(?:\/|$)/;

/**
 * Whether a request is a write to a route that can move money (case-sensitive, on the normalized
 * pathname). Used to say WHY an unlisted write was refused.
 *
 * @param args.request - The request
 * @param args.pathname - The normalized pathname
 */
export function isMoneyWrite(args: {
    readonly request: WatchRequest;
    readonly pathname: string;
}): boolean {
    return args.request.method !== 'GET' && MONEY_ROUTE.test(args.pathname);
}
