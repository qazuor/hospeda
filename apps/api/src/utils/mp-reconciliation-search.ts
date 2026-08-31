/**
 * Paced, paginated MercadoPago reads for the orphan-payment rescue tool (HOS-765).
 *
 * ## Why this is not just `fetch` in a loop
 *
 * MercadoPago enforces a rate limit it does not publish. Measured 2026-08-31: a
 * sweep of roughly 60 sequential `GET`s answered `429` on several of them, with
 * no `Retry-After` header and no documented budget to plan against. The same
 * sweep with **350 ms between calls plus a retry** completed with zero failures.
 * So the pacing here is an empirical constant, not a guess, and it is the reason
 * this module exists as a module instead of being inlined into the service that
 * needs it.
 *
 * The pacing is enforced by SERIALIZING every call through a single promise
 * chain ({@link MpPacedClient}), not by sleeping between iterations of a caller's
 * loop. That distinction matters: the divergence report fans out (one preapproval
 * page, then a payment lookup per orphan), and a per-loop sleep in one of those
 * fan-outs does nothing to stop the other from firing concurrently. One gate for
 * the whole request is what actually bounds the call rate.
 *
 * ## What MercadoPago will and will not let us ask
 *
 * Measured, and load-bearing for the whole design:
 *
 * - `/v1/payments/search` **accepts** `payer.id` and `external_reference`
 *   (unlike the preapproval search, which silently ignores
 *   `external_reference`).
 * - It **rejects** `preapproval_id`, `subscription_id`, `payer.email` and
 *   `payer_email`. There is therefore NO server-side way to ask "which payments
 *   belong to this preapproval", which is why {@link searchApprovedPayments}
 *   sweeps a DATE WINDOW and correlates client-side. A future reader tempted to
 *   "optimise" this into a targeted query should know the targeted query does not
 *   exist.
 *
 * @module utils/mp-reconciliation-search
 */

const MP_API_BASE = 'https://api.mercadopago.com';

/**
 * Minimum gap between two MercadoPago calls, in milliseconds.
 *
 * 350 ms is the measured floor at which a ~60-call sweep produced zero `429`s.
 * Raising it is always safe; lowering it re-enters the band where the sweep
 * started failing.
 */
const MIN_CALL_INTERVAL_MS = 350;

/** How many times a single call is retried after a `429`. */
const MAX_RETRIES_ON_RATE_LIMIT = 3;

/**
 * Backoff before retry N (1-indexed) of a rate-limited call.
 *
 * Deliberately much larger than {@link MIN_CALL_INTERVAL_MS}: a `429` means the
 * pacing guess was wrong for this moment, so the response is to back off hard,
 * not to nudge.
 */
const RETRY_BACKOFF_MS = [1_000, 3_000, 8_000] as const;

/** Per-call network timeout. */
const DEFAULT_TIMEOUT_MS = 15_000;

/** MercadoPago's own maximum page size on both search endpoints. */
const MP_MAX_PAGE_SIZE = 50;

/**
 * Hard ceiling on how many pages a single sweep will pull.
 *
 * A bound rather than a preference: without it, a wide `since` on a busy account
 * turns one admin request into an unbounded, paced (therefore slow) crawl that
 * holds an HTTP connection open for minutes. When the ceiling is hit the result
 * says so explicitly ({@link MpSweepResult.truncated}) so the screen can tell the
 * operator the report is partial instead of quietly under-reporting divergences.
 */
const MAX_PAGES_PER_SWEEP = 20;

/**
 * Serializes MercadoPago calls behind a minimum inter-call interval and retries
 * rate-limited ones.
 *
 * One instance per logical sweep. Instances do NOT share a gate with each other,
 * so do not create several for the same request.
 */
export class MpPacedClient {
    private readonly accessToken: string;
    private readonly fetchImpl: typeof fetch;
    private readonly timeoutMs: number;
    private readonly minIntervalMs: number;
    private readonly sleep: (ms: number) => Promise<void>;

    /** Tail of the serialization chain. Every call awaits the previous one. */
    private gate: Promise<void> = Promise.resolve();

    /** How many MercadoPago requests this client has issued, for observability. */
    private callCountInternal = 0;

    /** How many of those were retried after a `429`. */
    private rateLimitedCountInternal = 0;

    constructor(params: {
        readonly accessToken: string;
        /** Injection seam for tests. Defaults to the global `fetch`. */
        readonly fetchImpl?: typeof fetch;
        readonly timeoutMs?: number;
        /** Override the pacing. Tests set this to 0; production must not. */
        readonly minIntervalMs?: number;
        /** Injection seam so tests do not actually wait out the backoff. */
        readonly sleepImpl?: (ms: number) => Promise<void>;
    }) {
        this.accessToken = params.accessToken;
        this.fetchImpl = params.fetchImpl ?? fetch;
        this.timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.minIntervalMs = params.minIntervalMs ?? MIN_CALL_INTERVAL_MS;
        this.sleep =
            params.sleepImpl ??
            ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    }

    /** Total MercadoPago requests issued so far. */
    get callCount(): number {
        return this.callCountInternal;
    }

    /** How many requests came back `429` and had to be retried. */
    get rateLimitedCount(): number {
        return this.rateLimitedCountInternal;
    }

    /**
     * Issue one paced `GET` and parse the JSON body.
     *
     * @param path - Path plus query string, e.g. `/v1/payments/search?limit=50`.
     * @returns The decoded body, or `null` when MercadoPago answered 404.
     * @throws When MercadoPago answers a non-404 error status, or the call
     *   exhausts its rate-limit retries. Callers that must not fail (the
     *   best-effort per-orphan payment lookup) catch this themselves.
     */
    async getJson(path: string): Promise<Record<string, unknown> | null> {
        // Chain onto the gate so concurrent callers queue instead of racing.
        const run = this.gate.then(() => this.executeWithRetry(path));
        // The gate must not reject: one failed call would poison every
        // subsequent one on this client. Swallow here only — `run` still
        // carries the real outcome to the caller.
        this.gate = run.then(
            () => undefined,
            () => undefined
        );
        return run;
    }

    private async executeWithRetry(path: string): Promise<Record<string, unknown> | null> {
        let attempt = 0;

        for (;;) {
            await this.sleep(this.minIntervalMs);
            this.callCountInternal += 1;

            const response = await this.fetchOnce(path);

            if (response.status === 429) {
                this.rateLimitedCountInternal += 1;
                if (attempt >= MAX_RETRIES_ON_RATE_LIMIT) {
                    throw new Error(
                        `MercadoPago rate-limited ${path} after ${attempt + 1} attempts`
                    );
                }
                await this.sleep(RETRY_BACKOFF_MS[attempt] ?? 8_000);
                attempt += 1;
                continue;
            }

            if (response.status === 404) {
                return null;
            }
            if (!response.ok) {
                throw new Error(`MercadoPago ${path} returned HTTP ${response.status}`);
            }

            return (await response.json()) as Record<string, unknown>;
        }
    }

    private async fetchOnce(path: string): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            return await this.fetchImpl(`${MP_API_BASE}${path}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    Accept: 'application/json'
                },
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

/** Outcome of a paginated sweep. */
export interface MpSweepResult<T> {
    /** Everything the sweep collected, oldest page first. */
    readonly items: readonly T[];
    /**
     * True when {@link MAX_PAGES_PER_SWEEP} cut the sweep short, so `items` is a
     * PREFIX of what MercadoPago holds. The caller must surface this: a
     * truncated divergence report that presents itself as complete is worse than
     * no report at all.
     */
    readonly truncated: boolean;
    /** MercadoPago's own reported total for the query, when it gave one. */
    readonly reportedTotal: number | null;
}

/** A MercadoPago payment, reduced to the fields the rescue tool reads. */
export interface MpPaymentRecord {
    readonly id: string;
    readonly status: string;
    readonly statusDetail: string | null;
    /** MAJOR units, exactly as MercadoPago reports them. Converted by the caller. */
    readonly transactionAmount: number;
    readonly currencyId: string;
    readonly dateCreated: string;
    readonly dateApproved: string | null;
    /** `payer.email` — the real account that paid. See the module JSDoc. */
    readonly payerEmail: string | null;
    readonly payerId: string | null;
    /** Resolved from metadata or `point_of_interaction`; see {@link extractPreapprovalId}. */
    readonly preapprovalId: string | null;
    readonly externalReference: string | null;
    readonly description: string | null;
}

/** A MercadoPago preapproval, reduced to the fields the rescue tool reads. */
export interface MpPreapprovalRecord {
    readonly id: string;
    readonly status: string;
    readonly reason: string | null;
    /** MAJOR units from `auto_recurring.transaction_amount`. */
    readonly transactionAmount: number | null;
    readonly currencyId: string | null;
    readonly dateCreated: string;
    readonly nextPaymentDate: string | null;
    readonly externalReference: string | null;
    readonly preapprovalPlanId: string | null;
    readonly payerId: string | null;
    /** Measured EMPTY on every real preapproval — kept so the operator can see that. */
    readonly payerEmail: string | null;
}

/**
 * Read the preapproval a payment belongs to.
 *
 * MercadoPago reports it in two different places depending on the flow, and
 * neither is guaranteed:
 *
 * - `metadata.preapproval_id` on a subscription charge;
 * - `point_of_interaction.transaction_data.subscription_id` on others.
 *
 * `null` is a real, common answer — notably on the $0 authorization charge,
 * which carries the payer email but reports no subscription at all. That is the
 * documented limit of day-1 attribution, not a parsing failure.
 *
 * @param raw - The raw payment object from MercadoPago.
 * @returns The preapproval id, or `null` when the payment names none.
 */
export function extractPreapprovalId(raw: Record<string, unknown>): string | null {
    const metadata = raw.metadata;
    if (metadata && typeof metadata === 'object') {
        const fromMetadata = (metadata as Record<string, unknown>).preapproval_id;
        if (typeof fromMetadata === 'string' && fromMetadata.length > 0) {
            return fromMetadata;
        }
    }

    const poi = raw.point_of_interaction;
    if (poi && typeof poi === 'object') {
        const txData = (poi as Record<string, unknown>).transaction_data;
        if (txData && typeof txData === 'object') {
            const subscriptionId = (txData as Record<string, unknown>).subscription_id;
            if (typeof subscriptionId === 'string' && subscriptionId.length > 0) {
                return subscriptionId;
            }
        }
    }

    return null;
}

/** Read a non-empty string field, normalising `""` and non-strings to `null`. */
function optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Map a raw MercadoPago payment into {@link MpPaymentRecord}.
 *
 * @param raw - The raw payment object.
 * @returns The reduced record, or `null` when it lacks an id (unusable).
 */
export function parsePaymentRecord(raw: Record<string, unknown>): MpPaymentRecord | null {
    const id = raw.id;
    if (typeof id !== 'string' && typeof id !== 'number') {
        return null;
    }

    const payer = (raw.payer ?? {}) as Record<string, unknown>;

    return {
        id: String(id),
        status: typeof raw.status === 'string' ? raw.status : 'unknown',
        statusDetail: optionalString(raw.status_detail),
        transactionAmount: typeof raw.transaction_amount === 'number' ? raw.transaction_amount : 0,
        currencyId: typeof raw.currency_id === 'string' ? raw.currency_id : 'ARS',
        dateCreated:
            typeof raw.date_created === 'string' ? raw.date_created : new Date().toISOString(),
        dateApproved: optionalString(raw.date_approved),
        payerEmail: optionalString(payer.email),
        payerId: payer.id === undefined || payer.id === null ? null : String(payer.id),
        preapprovalId: extractPreapprovalId(raw),
        externalReference: optionalString(raw.external_reference),
        description: optionalString(raw.description)
    };
}

/**
 * Map a raw MercadoPago preapproval into {@link MpPreapprovalRecord}.
 *
 * @param raw - The raw preapproval object.
 * @returns The reduced record, or `null` when it lacks an id (unusable).
 */
export function parsePreapprovalRecord(raw: Record<string, unknown>): MpPreapprovalRecord | null {
    const id = raw.id;
    if (typeof id !== 'string' && typeof id !== 'number') {
        return null;
    }

    const autoRecurring = (raw.auto_recurring ?? {}) as Record<string, unknown>;

    return {
        id: String(id),
        status: typeof raw.status === 'string' ? raw.status : 'unknown',
        reason: optionalString(raw.reason),
        transactionAmount:
            typeof autoRecurring.transaction_amount === 'number'
                ? autoRecurring.transaction_amount
                : null,
        currencyId: optionalString(autoRecurring.currency_id),
        dateCreated:
            typeof raw.date_created === 'string' ? raw.date_created : new Date().toISOString(),
        nextPaymentDate: optionalString(raw.next_payment_date),
        externalReference: optionalString(raw.external_reference),
        preapprovalPlanId: optionalString(raw.preapproval_plan_id),
        payerId: raw.payer_id === undefined || raw.payer_id === null ? null : String(raw.payer_id),
        payerEmail: optionalString(raw.payer_email)
    };
}

/** Pull `paging.total` off a search response, when present. */
function readReportedTotal(body: Record<string, unknown>): number | null {
    const paging = body.paging;
    if (paging && typeof paging === 'object') {
        const total = (paging as Record<string, unknown>).total;
        if (typeof total === 'number') {
            return total;
        }
    }
    return null;
}

/** Pull `results` off a search response as an array of raw objects. */
function readResults(body: Record<string, unknown>): Record<string, unknown>[] {
    const results = body.results;
    return Array.isArray(results)
        ? results.filter(
              (entry): entry is Record<string, unknown> =>
                  typeof entry === 'object' && entry !== null
          )
        : [];
}

/**
 * Sweep approved MercadoPago payments created since a given instant.
 *
 * Uses a DATE WINDOW because there is no way to ask MercadoPago for the payments
 * of a given preapproval — see the module JSDoc. Correlation to a subscription
 * happens client-side, off {@link MpPaymentRecord.preapprovalId}.
 *
 * @param params - Paced client, window start, and optional status filter.
 * @returns Every matching payment up to {@link MAX_PAGES_PER_SWEEP} pages.
 */
export async function searchApprovedPayments(params: {
    readonly client: MpPacedClient;
    readonly since: Date;
    /** MercadoPago `status` filter. Defaults to `approved`. */
    readonly status?: string;
}): Promise<MpSweepResult<MpPaymentRecord>> {
    const { client, since, status = 'approved' } = params;

    const items: MpPaymentRecord[] = [];
    let reportedTotal: number | null = null;
    let truncated = false;

    for (let page = 0; page < MAX_PAGES_PER_SWEEP; page += 1) {
        const query = new URLSearchParams({
            status,
            sort: 'date_created',
            criteria: 'desc',
            range: 'date_created',
            begin_date: since.toISOString(),
            end_date: 'NOW',
            offset: String(page * MP_MAX_PAGE_SIZE),
            limit: String(MP_MAX_PAGE_SIZE)
        });

        const body = await client.getJson(`/v1/payments/search?${query.toString()}`);
        if (!body) {
            break;
        }

        reportedTotal ??= readReportedTotal(body);

        const rawResults = readResults(body);
        for (const raw of rawResults) {
            const record = parsePaymentRecord(raw);
            if (record) {
                items.push(record);
            }
        }

        if (rawResults.length < MP_MAX_PAGE_SIZE) {
            return { items, truncated: false, reportedTotal };
        }

        // A full page means there may be more; if this was the last allowed
        // page, the sweep is a prefix and must say so.
        truncated = page === MAX_PAGES_PER_SWEEP - 1;
    }

    return { items, truncated, reportedTotal };
}

/**
 * Sweep MercadoPago preapprovals in a given status.
 *
 * The preapproval search ignores `external_reference` (measured), so filtering
 * by it here would silently return everything. Only `status` is passed.
 *
 * @param params - Paced client and the preapproval status to sweep.
 * @returns Every matching preapproval up to {@link MAX_PAGES_PER_SWEEP} pages.
 */
export async function searchPreapprovals(params: {
    readonly client: MpPacedClient;
    /** MercadoPago preapproval `status`. Defaults to `authorized`. */
    readonly status?: string;
}): Promise<MpSweepResult<MpPreapprovalRecord>> {
    const { client, status = 'authorized' } = params;

    const items: MpPreapprovalRecord[] = [];
    let reportedTotal: number | null = null;
    let truncated = false;

    for (let page = 0; page < MAX_PAGES_PER_SWEEP; page += 1) {
        const query = new URLSearchParams({
            status,
            offset: String(page * MP_MAX_PAGE_SIZE),
            limit: String(MP_MAX_PAGE_SIZE)
        });

        const body = await client.getJson(`/preapproval/search?${query.toString()}`);
        if (!body) {
            break;
        }

        reportedTotal ??= readReportedTotal(body);

        const rawResults = readResults(body);
        for (const raw of rawResults) {
            const record = parsePreapprovalRecord(raw);
            if (record) {
                items.push(record);
            }
        }

        if (rawResults.length < MP_MAX_PAGE_SIZE) {
            return { items, truncated: false, reportedTotal };
        }

        truncated = page === MAX_PAGES_PER_SWEEP - 1;
    }

    return { items, truncated, reportedTotal };
}

/**
 * Fetch one payment by id.
 *
 * @param params - Paced client and the MercadoPago payment id.
 * @returns The reduced record, or `null` when MercadoPago has no such payment.
 */
export async function fetchPaymentById(params: {
    readonly client: MpPacedClient;
    readonly mpPaymentId: string;
}): Promise<MpPaymentRecord | null> {
    const body = await params.client.getJson(
        `/v1/payments/${encodeURIComponent(params.mpPaymentId)}`
    );
    return body ? parsePaymentRecord(body) : null;
}

/**
 * Fetch one preapproval by id.
 *
 * @param params - Paced client and the MercadoPago preapproval id.
 * @returns The reduced record, or `null` when MercadoPago has no such preapproval.
 */
export async function fetchPreapprovalById(params: {
    readonly client: MpPacedClient;
    readonly preapprovalId: string;
}): Promise<MpPreapprovalRecord | null> {
    const body = await params.client.getJson(
        `/preapproval/${encodeURIComponent(params.preapprovalId)}`
    );
    return body ? parsePreapprovalRecord(body) : null;
}

/** Exposed for tests that assert the pacing contract rather than re-deriving it. */
export const MP_RECONCILIATION_TUNING = {
    MIN_CALL_INTERVAL_MS,
    MAX_RETRIES_ON_RATE_LIMIT,
    MAX_PAGES_PER_SWEEP,
    MP_MAX_PAGE_SIZE
} as const;
