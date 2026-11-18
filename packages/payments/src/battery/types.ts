/**
 * Types of the provider watch battery (HOS-1512, AC:B1:15, AC:B1:20).
 *
 * The battery repeats the measurements behind the fake's two closed lists
 * (the lies `M*` and the rules `RP*`) against the real provider, compares the
 * shape of every response against the previous run and reports what changed.
 * It never adjusts anything: the answer to a change is a human reading an email.
 *
 * @module battery/types
 */

/** The two provider accounts a run can target. */
export const WATCH_ACCOUNTS = ['sandbox', 'production'] as const;

/** The provider account a run targets. */
export type WatchAccount = (typeof WATCH_ACCOUNTS)[number];

/** Any JSON-serializable value: what a measurement reads and what a run stores. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };

/** Flattened shape of one response: a path (`a.b`, `a[]`) to the set of types seen there. */
export type ShapeMap = Readonly<Record<string, string>>;

/** Shapes recorded for one measurement, by the label of each request it sent. */
export type MeasurementShapes = Readonly<Record<string, ShapeMap>>;

/** Shapes of a whole run, by measurement id. This is the baseline the next run compares to. */
export type WatchShapeBaseline = Readonly<Record<string, MeasurementShapes>>;

/**
 * What a measurement does at the provider.
 *
 * - `read`: only `GET`s. Needs no guard.
 * - `mutates`: changes something at the provider. Opens with the environment guard.
 * - `moves-money`: may charge. Passes the budget guard and then the environment guard.
 */
export const WATCH_EFFECTS = ['read', 'mutates', 'moves-money'] as const;

/** See {@link WATCH_EFFECTS}. */
export type WatchEffect = (typeof WATCH_EFFECTS)[number];

/** HTTP methods the battery sends. */
export type WatchMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** One raw HTTP request to the provider. */
export interface WatchRequest {
    readonly method: WatchMethod;
    /** Path with its query string, relative to the provider base URL. */
    readonly path: string;
    readonly body?: unknown;
    readonly headers?: Readonly<Record<string, string>>;
}

/** One raw HTTP answer. The status is kept for logs only: no assertion is ever written on it. */
export interface WatchResponse {
    readonly status: number;
    /** The parsed JSON body, or `undefined` when the body was not JSON. */
    readonly body: unknown;
}

/** Sends one authenticated request. Built by {@link createWatchTransport}. */
export type WatchTransport = (request: WatchRequest) => Promise<WatchResponse>;

/** What a measurement sends through; every request is shape-recorded under its label. */
export interface WatchContext {
    /**
     * Sends one request. The response body shape is recorded under `label`.
     *
     * @param args.label - Stable name of this request inside the measurement
     * @param args.request - The request
     * @param args.refundMinor - Amount in minor units a refund request sends out (money OUT:
     *   never subtracted from the charges)
     * @param args.chargeMinor - Amount in minor units this request charges. REQUIRED on every
     *   non-GET request of a `moves-money` measurement (0 for one that charges nothing), and it
     *   must equal what the request body states: the guard does not trust the declaration
     * @returns The answer
     * @throws {WatchGuardError} A non-GET from a `read` entry, a money write from a measurement
     *   that does not move money, an undeclared or mismatching charge, or charges above the maximum
     */
    readonly send: (args: {
        readonly label: string;
        readonly request: WatchRequest;
        readonly chargeMinor?: number;
        readonly refundMinor?: number;
    }) => Promise<WatchResponse>;
    /**
     * Resends, VERBATIM, the last money write this measurement sent under the label `of`: the same
     * method, path, body and derived idempotency key (F4, for measurements such as `EX-58`, where an
     * identical replay must answer the first full response). The request is the stored one, so a
     * replay cannot change it. A replay books no money: if the provider answers a create replay with
     * an object other than the first one (or a lost answer, or a 5xx), money may have moved and the
     * run stops with `WRITE_OUTCOME_UNKNOWN`.
     *
     * @param args.label - The label the replay's answer shape is recorded under
     * @param args.of - The label of the money write to replay
     * @returns The answer
     * @throws {WatchGuardError} `REPLAY_NOT_SENT` when this measurement never sent a money write
     *   under `of`; `WRITE_OUTCOME_UNKNOWN` as described above
     */
    readonly replay: (args: {
        readonly label: string;
        readonly of: string;
    }) => Promise<WatchResponse>;
}

/** One entry of the catalog: a measurement behind one `M*` or `RP*` row. */
export interface WatchEntry {
    /** The row id in `fake-lists.json` (`M1`..`M13`, `RP1`..`RP13`). */
    readonly id: string;
    /** The accounts this measurement is run against. */
    readonly accounts: readonly WatchAccount[];
    readonly effect: WatchEffect;
    /**
     * The most this measurement can charge, in minor units. Required for `moves-money`.
     * The authorized amount must EQUAL the sum of these across the account's money-moving
     * measurements (checked in pre-flight, before the authorization is consumed); the run's total
     * charges are also capped at the authorized amount.
     */
    readonly maxChargeMinor?: number;
    /** The value the fake's list says the provider yields. */
    readonly expected: JsonValue;
    /** Runs the measurement and reads its result. Every request goes through `ctx.send`. */
    readonly measure: (ctx: WatchContext) => Promise<JsonValue>;
}

/** The authorization the owner custodies for money-moving measurements. */
export interface WatchAuthorization {
    /** Market-time month it covers, `YYYY-MM`. */
    readonly month: string;
    /**
     * The amount authorized for ONE run, in minor units (ARS centavos): EXACTLY the sum of the
     * declared maximum charges of the account's money-moving measurements, and the cap of the
     * whole run's charges.
     */
    readonly maxChargeMinor: number;
    /**
     * The Mercado Pago account id the owner confirmed. The production run aborts, sending
     * nothing, when `GET /users/me` answers another id, or when this is absent.
     */
    readonly accountId?: string;
    /** The run that consumed this authorization. One authorization allows ONE run. */
    readonly consumedByRunId?: string;
}

/** What went wrong in one measurement. */
export type WatchMeasurementOutcome = 'matched' | 'changed' | 'errored';

/** The stored result of one measurement. */
export interface WatchMeasurementRecord {
    readonly outcome: WatchMeasurementOutcome;
    readonly expected: JsonValue;
    /** What the measurement read; `null` when it errored before reading. */
    readonly obtained: JsonValue;
    readonly shapes: MeasurementShapes;
    /**
     * Ids the provider answered for every write this measurement sent (preapprovals,
     * payments, orders): what a human needs to find and refund or cancel them.
     */
    readonly providerIds: readonly string[];
    readonly error?: string;
}

/** What kind of change an alert reports. */
export type WatchAlertKind = 'value_changed' | 'shape_changed' | 'shape_baseline_missing';

/** One change the run found, ready to be mailed. */
export interface WatchAlert {
    readonly measurementId: string;
    readonly kind: WatchAlertKind;
    /**
     * For `shape_changed`: the request label whose response changed. A `shape_baseline_missing`
     * alert has no label: it covers every response of the measurement.
     */
    readonly label?: string;
    readonly expected: JsonValue;
    readonly obtained: JsonValue;
    /** Human-readable lines: which fields were added, removed or retyped. */
    readonly details: readonly string[];
}

/**
 * How a run ended.
 *
 * - `completed`: every measurement ran and was read (alerts may exist).
 * - `failed`: the catalog was empty or invalid, or a measurement could not be read.
 * - `aborted`: a guard stopped the run before sending what it protects.
 * - `refused`: production without the authorization of the current month; nothing was sent.
 */
export type WatchRunOutcome = 'completed' | 'failed' | 'aborted' | 'refused';

/** The record of one run, written whole by the run itself. */
export interface WatchRunRecord {
    readonly account: WatchAccount;
    readonly startedAt: Date;
    readonly finishedAt: Date;
    readonly outcome: WatchRunOutcome;
    /** Why the run did not complete, in one line. */
    readonly reason?: string;
    readonly measurements: Readonly<Record<string, WatchMeasurementRecord>>;
    readonly alerts: readonly WatchAlert[];
    /** Money the run moved: charges and refunds, kept apart. A refund never offsets a charge. */
    readonly ledger: { readonly charged: number; readonly refunded: number };
}

/** Codes of {@link WatchGuardError}. */
export type WatchGuardCode =
    | 'WRONG_ACCOUNT'
    | 'UNREADABLE_ACCOUNT'
    | 'AUTHORIZATION_MISSING'
    | 'AUTHORIZATION_STALE'
    | 'AUTHORIZATION_CONSUMED'
    | 'ACCOUNT_ID_MISSING'
    | 'ACCOUNT_ID_MISMATCH'
    | 'BUDGET_MISMATCH'
    | 'BUDGET_UNDECLARED'
    | 'BUDGET_EXCEEDED'
    | 'CHARGE_MISMATCH'
    | 'CHARGE_UNDECLARED'
    | 'MONEY_ROUTE_FORBIDDEN'
    | 'OPERATION_NOT_ALLOWED'
    | 'PATH_REJECTED'
    | 'PROGRESS_NOT_RECORDED'
    | 'HEADER_REJECTED'
    | 'TARGET_NOT_CREATED_BY_RUN'
    | 'WRITE_OUTCOME_UNKNOWN'
    | 'AUTHORIZATION_SUM_MISMATCH'
    | 'READ_ENTRY_MUTATED'
    | 'SEND_AFTER_SETTLED'
    | 'REPLAY_NOT_SENT';

/** Raised when a guard stops an operation. A guard never retries and never adjusts. */
export class WatchGuardError extends Error {
    readonly code: WatchGuardCode;

    constructor(args: { readonly code: WatchGuardCode; readonly message: string }) {
        super(args.message);
        this.name = 'WatchGuardError';
        this.code = args.code;
    }
}
