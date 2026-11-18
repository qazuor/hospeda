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
 * Every rule also fixes the SHAPE of the body: an exact allowlist of keys, nested keys included, so a
 * charge cannot carry a `preapproval_plan_id`, a held `capture`, a free period or `installments: 12`.
 * A rule that targets an object by id (cancel, pause, change the amount, refund) exposes that id, and
 * the write guard allows it only on an id THIS RUN created: in production a measurement must never
 * be able to cancel, re-price or refund a real customer's object.
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
    /** The id of the object the request acts on, when the rule is id-targeted. */
    readonly targetId: string | null;
    /** Whether the answer creates the object (its id then belongs to this run). */
    readonly creates: boolean;
    /** Whether the engine stamps `external_reference` into the body so the object can be found. */
    readonly stampsReference: boolean;
}

type Body = Readonly<Record<string, unknown>>;

/** An exact allowlist of body keys: `true` is a leaf, an object a nested record, `[shape]` a list. */
type Shape = { readonly [key: string]: true | Shape | readonly [Shape] };

interface Rule {
    readonly rule: string;
    readonly method: WatchRequest['method'];
    /** Over the normalized pathname; the first capture group, when there is one, is the target id. */
    readonly path: RegExp;
    readonly kind: WatchOperationKind;
    /** The EXACT keys the body may carry. */
    readonly shape?: Shape;
    /** Values that are pinned to what the adapter sends. */
    readonly pins?: (body: Body) => boolean;
    /** Whether the body fits the rule beyond its keys (exact-match rules). */
    readonly accepts?: (body: Body) => boolean;
    /** The pesos amounts the body states, for `charge` and `refund`. */
    readonly amounts?: (body: Body) => readonly unknown[];
    readonly creates?: boolean;
    readonly stampsReference?: boolean;
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
    const wanted = [...keys].sort();
    return own.length === wanted.length && own.every((key, index) => key === wanted[index]);
}

/** Whether every key of `value` is in `shape`, recursively. Missing keys are fine; extra ones are not. */
function conforms(value: unknown, shape: Shape): boolean {
    if (!isRecord(value)) return false;
    return Object.keys(value).every((key) => {
        const wanted = shape[key];
        if (wanted === undefined) return false;
        const child = value[key];
        if (wanted === true) return true;
        if (Array.isArray(wanted)) {
            const item = wanted[0] as Shape;
            return Array.isArray(child) && child.every((entry) => conforms(entry, item));
        }
        return conforms(child, wanted as Shape);
    });
}

function nested(body: Body, key: string): Body {
    return bodyOf(body[key]);
}

function listOf(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

/** `installments`, when stated, is 1: what the adapter sends. */
function installmentsPinned(value: unknown): boolean {
    return value === undefined || value === 1;
}

const RULES: readonly Rule[] = [
    {
        rule: 'preapproval.create',
        method: 'POST',
        path: /^\/preapproval$/,
        kind: 'charge',
        creates: true,
        stampsReference: true,
        // No `preapproval_plan_id` (it charges the plan's price), no `start_date` (a future first
        // charge makes the provider grant a free trial on its own, M9).
        shape: {
            reason: true,
            external_reference: true,
            payer_email: true,
            card_token_id: true,
            back_url: true,
            auto_recurring: {
                frequency: true,
                frequency_type: true,
                transaction_amount: true,
                currency_id: true
            }
        },
        pins: (body) => {
            const recurring = nested(body, 'auto_recurring');
            return (
                (recurring.frequency_type === undefined || recurring.frequency_type === 'months') &&
                (recurring.currency_id === undefined || recurring.currency_id === 'ARS')
            );
        },
        amounts: (body) => [nested(body, 'auto_recurring').transaction_amount]
    },
    {
        rule: 'preapproval.change-amount',
        method: 'PUT',
        path: new RegExp(`^/preapproval/(${ID})$`),
        kind: 'charge',
        shape: { auto_recurring: { transaction_amount: true, currency_id: true } },
        accepts: (body) => exactKeys(body, ['auto_recurring']),
        pins: (body) => {
            const currency = nested(body, 'auto_recurring').currency_id;
            return currency === undefined || currency === 'ARS';
        },
        amounts: (body) => [nested(body, 'auto_recurring').transaction_amount]
    },
    {
        rule: 'preapproval.cancel-or-pause',
        method: 'PUT',
        path: new RegExp(`^/preapproval/(${ID})$`),
        kind: 'zero-charge',
        accepts: (body) =>
            exactKeys(body, ['status']) && (body.status === 'cancelled' || body.status === 'paused')
    },
    {
        rule: 'payments.create',
        method: 'POST',
        path: /^\/v1\/payments$/,
        kind: 'charge',
        creates: true,
        stampsReference: true,
        shape: {
            transaction_amount: true,
            description: true,
            payment_method_id: true,
            token: true,
            installments: true,
            payer: { email: true },
            external_reference: true
        },
        pins: (body) => installmentsPinned(body.installments),
        amounts: (body) => [body.transaction_amount]
    },
    {
        rule: 'payments.refund',
        method: 'POST',
        path: new RegExp(`^/v1/payments/(${ID})/refunds$`),
        kind: 'refund',
        shape: { amount: true },
        amounts: (body) => [body.amount]
    },
    {
        rule: 'orders.create',
        method: 'POST',
        path: /^\/v1\/orders$/,
        kind: 'charge',
        creates: true,
        stampsReference: true,
        shape: {
            type: true,
            external_reference: true,
            total_amount: true,
            processing_mode: true,
            payer: { email: true },
            transactions: {
                payments: [
                    {
                        amount: true,
                        payment_method: { id: true, type: true, token: true, installments: true }
                    }
                ]
            }
        },
        pins: (body) => {
            const payments = listOf(nested(body, 'transactions').payments);
            return (
                (body.type === undefined || body.type === 'online') &&
                (body.processing_mode === undefined || body.processing_mode === 'automatic') &&
                payments.every((payment) =>
                    installmentsPinned(nested(bodyOf(payment), 'payment_method').installments)
                )
            );
        },
        // The charge is ONE payment worth the total: several payments (even of equal amounts), or
        // none, are not the order the adapter sends and are not on the list.
        accepts: (body) => listOf(nested(body, 'transactions').payments).length === 1,
        amounts: (body) => {
            const payments = listOf(nested(body, 'transactions').payments);
            return [body.total_amount, ...payments.map((payment) => bodyOf(payment).amount)];
        }
    },
    {
        rule: 'orders.refund',
        method: 'POST',
        path: new RegExp(`^/v1/orders/(${ID})/refund$`),
        kind: 'refund',
        shape: { transactions: [{ id: true, amount: true }] },
        amounts: (body) => listOf(body.transactions).map((entry) => bodyOf(entry).amount)
    },
    {
        rule: 'customers.create',
        method: 'POST',
        path: /^\/v1\/customers$/,
        kind: 'non-money',
        creates: true
    },
    {
        rule: 'card-tokens.create',
        method: 'POST',
        path: /^\/v1\/card_tokens$/,
        kind: 'non-money',
        creates: true
    },
    {
        rule: 'plans.create',
        method: 'POST',
        path: /^\/preapproval_plan$/,
        kind: 'non-money',
        creates: true
    }
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
        // The same rule as a string: at most 2 decimals. `1.005` is not an amount of pesos and cents.
        const cents = value * 100;
        if (Math.abs(cents - Math.round(cents)) > 1e-6) return null;
        return Math.round(cents);
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
        if (rule.method !== args.request.method) continue;
        const match = rule.path.exec(args.pathname);
        if (!match) continue;
        if (rule.shape && !conforms(args.request.body ?? {}, rule.shape)) continue;
        if (rule.pins && !rule.pins(body)) continue;
        if (rule.accepts && !rule.accepts(body)) continue;
        const stated =
            rule.kind === 'charge' || rule.kind === 'refund' ? statedMinorOf({ rule, body }) : null;
        return {
            rule: rule.rule,
            kind: rule.kind,
            statedMinor: stated,
            targetId: match[1] ?? null,
            creates: rule.creates === true,
            stampsReference: rule.stampsReference === true
        };
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
