/**
 * Read-only re-reads of real objects (HOS-1512, owner decision 2026-11-18): the provider's search
 * and the most recent real authorizations, their charge records and the most recent payments with
 * their refunds. Every request is a `GET`; in production these are real customers' objects, so
 * nothing here ever writes (the entries are `read`, which the engine refuses to let write).
 *
 * The subjects are picked automatically, the N most recent from a search, and the battery's own
 * authorizations are skipped. A measurement reads only ids and booleans, never a payer's data. The
 * shapes of real objects are recorded over the fields the adapter reads (`shapePaths`), because
 * two real objects carry different optional fields; the adapter's own parse is what catches a
 * required field going missing.
 *
 * @module battery/catalog/real-object-reads
 */
import { readMercadoPagoChargeRecords } from '../../adapters/mercadopago/mercadopago-charges';
import { PaymentProviderError } from '../../provider/errors';
import type { JsonValue, WatchContext, WatchEntry, WatchResponse } from '../types';
import { createWatchAdapterBridge } from './watch-adapter-bridge';
import { isWatchReference, WATCH_REFERENCE_PREFIX } from './watch-subjects';

/** How many recent real subjects each re-read looks at. */
export const RECENT_SUBJECTS = 5;

/** How many recent payments the payment search returns, to pick the subjects from. */
const PAYMENT_SEARCH_PAGE = 30;

/** The authorization search page, as the adapter pages it (`mercadopago-search.ts`). */
const AUTHORIZATION_SEARCH_PAGE = 20;

/**
 * The most search pages a re-read walks, as the adapter's own search (50 pages of 20). The
 * battery's own authorizations are the most recent ones, so they come first; the real ones are
 * found behind them (review of #4538, R1).
 */
const MAX_SEARCH_PAGES = 50;

/** The fields the adapter reads from `GET /preapproval/{id}` (`ReadResponseSchema`). */
const AUTHORIZATION_PATHS = [
    'id',
    'external_reference',
    'status',
    'auto_recurring.frequency',
    'auto_recurring.frequency_type',
    'auto_recurring.transaction_amount',
    'auto_recurring.currency_id',
    'auto_recurring.start_date',
    'auto_recurring.free_trial',
    'summarized.charged_quantity',
    'summarized.last_charged_date',
    'last_modified',
    'next_payment_date',
    'init_point'
] as const;

/** The fields read from `GET /preapproval/search`. */
const AUTHORIZATION_SEARCH_PATHS = [
    'paging.total',
    'results[].id',
    'results[].date_created',
    'results[].external_reference',
    'results[].status'
] as const;

/** The fields the adapter reads from `GET /authorized_payments/search` (`ChargeSearchResponseSchema`). */
const CHARGE_RECORD_PATHS = [
    'paging.total',
    'results[].id',
    'results[].date_created',
    'results[].expire_date',
    'results[].external_reference',
    'results[].payment.id'
] as const;

/** The fields read from `GET /v1/payments/search`. */
const PAYMENT_SEARCH_PATHS = [
    'paging.total',
    'results[].id',
    'results[].status',
    'results[].date_created',
    'results[].transaction_amount_refunded'
] as const;

/** The fields the adapter reads from `GET /v1/payments/{id}` (`ReadChargeResponseSchema`). */
const PAYMENT_PATHS = [
    'id',
    'date_created',
    'external_reference',
    'metadata.preapproval_id',
    'point_of_interaction.transaction_data.subscription_id',
    'status',
    'status_detail',
    'transaction_amount',
    'currency_id',
    'transaction_amount_refunded',
    'refunds[].id',
    'refunds[].amount',
    'refunds[].status'
] as const;

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

function listOf(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
}

function totalOf(response: WatchResponse): number | null {
    const total = recordOf(recordOf(response.body).paging).total;
    return typeof total === 'number' ? total : null;
}

/** A reference nobody ever wrote: the garbage control of RC-1 and EX-57. */
function garbageReference(ctx: WatchContext): string {
    return `${WATCH_REFERENCE_PREFIX}${ctx.runId}-never-written`;
}

/**
 * Whether the `date_created` of every result, in the order the search answered, never increases.
 * The re-reads ask for `date_created` descending and pick the first subjects: an order the
 * provider does not honor would pick other subjects silently (review of #4538, R1). A result
 * without a readable date breaks the order too.
 */
function sortedDescending(results: readonly Readonly<Record<string, unknown>>[]): boolean {
    const dates = results.map((item) =>
        typeof item.date_created === 'string' ? Date.parse(item.date_created) : Number.NaN
    );
    return dates.every(
        (date, index) => !Number.isNaN(date) && (index === 0 || date <= (dates[index - 1] ?? date))
    );
}

/**
 * Walks a search page by page, through `offset`, handing each page to `onPage` as it arrives,
 * until `onPage` answers that it has enough, the search runs out (an empty page, or
 * `paging.total` reached), or {@link MAX_SEARCH_PAGES}. Every page is recorded under the same
 * label: each one but an empty first page has the same shape.
 */
async function walkSearch(args: {
    readonly ctx: WatchContext;
    readonly label: string;
    readonly path: (offset: number) => string;
    readonly pageSize: number;
    readonly shapePaths: readonly string[];
    readonly onPage: (found: readonly Readonly<Record<string, unknown>>[]) => Promise<boolean>;
}): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const results: Readonly<Record<string, unknown>>[] = [];
    for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
        const offset = page * args.pageSize;
        const response = await args.ctx.send({
            label: args.label,
            request: { method: 'GET', path: args.path(offset) },
            shapePaths: args.shapePaths
        });
        const found = listOf(recordOf(response.body).results).map(recordOf);
        results.push(...found);
        const total = totalOf(response);
        if (found.length === 0 || (await args.onPage(found))) break;
        if (total !== null && offset + found.length >= total) break;
    }
    return results;
}

/** The ids of the results, in order, without blanks or repeats. */
function idsOf(results: readonly Readonly<Record<string, unknown>>[]): string[] {
    return [...new Set(results.map((item) => String(item.id ?? '')).filter((id) => id !== ''))];
}

/**
 * A re-read that attempted no read of a real subject measures nothing: it is a finding, never a
 * green (review of #4538, R1). A subject the adapter refuses by design (a foreign one) is no read
 * either (re-review, R2). The measurement errors, so the run fails and says why.
 */
function requireSubjects(args: {
    readonly what: string;
    readonly attempted: number;
    readonly foreignSkipped: number;
}): void {
    if (args.attempted === 0) {
        throw new Error(
            `no real ${args.what} to re-read: the search answered none outside the battery's own that the adapter reads (${args.foreignSkipped} skipped as foreign), so this re-read measured nothing`
        );
    }
}

/** Whether an adapter error is a refusal BY DESIGN (a foreign object), not a drift. */
function isByDesign(error: unknown): boolean {
    return error instanceof PaymentProviderError && error.code === 'UNSUPPORTED';
}

/** M4 / RC-1 (sandbox and production): the search ignores our reference. */
const authorizationSearch: WatchEntry = {
    id: 'auth-search',
    rows: ['M4'],
    accounts: ['sandbox', 'production'],
    effect: 'read',
    expected: { referenceFilterIgnored: true },
    measure: async (ctx): Promise<JsonValue> => {
        const all = await ctx.send({
            label: 'unfiltered',
            request: { method: 'GET', path: '/preapproval/search?limit=1&offset=0' },
            shapePaths: AUTHORIZATION_SEARCH_PATHS
        });
        const garbage = await ctx.send({
            label: 'garbage-reference',
            request: {
                method: 'GET',
                path: `/preapproval/search?${new URLSearchParams({
                    external_reference: garbageReference(ctx),
                    limit: '1',
                    offset: '0'
                })}`
            },
            shapePaths: AUTHORIZATION_SEARCH_PATHS
        });
        const unfiltered = totalOf(all);
        if (unfiltered === null) throw new Error('the authorization search answered no total');
        return { referenceFilterIgnored: totalOf(garbage) === unfiltered };
    }
};

/**
 * The most recent real authorizations, re-read by id through the adapter, and their charge
 * records (RP7 / RC-7: every renewal record carries its `expire_date`; the first one, the
 * sign-up's, does not have to).
 */
const recentAuthorizations: WatchEntry = {
    id: 'recent-auths',
    rows: ['RP7'],
    accounts: ['sandbox', 'production'],
    effect: 'read',
    expected: {
        subjectsRead: RECENT_SUBJECTS,
        sortedDescending: true,
        unreadableByAdapter: [],
        renewalsWithoutExpiry: []
    },
    reportedOnly: ['foreignSkipped'],
    measure: async (ctx): Promise<JsonValue> => {
        const bridge = createWatchAdapterBridge({ ctx });
        const unreadable: string[] = [];
        const withoutExpiry: string[] = [];
        const seen = new Set<string>();
        // Re-review of #4538 (R2): a subject counts once the adapter really read it. The walk goes
        // on until RECENT_SUBJECTS real reads were attempted or the search runs out.
        let attempted = 0;
        let subjectsRead = 0;
        let foreignSkipped = 0;
        const readOne = async (id: string): Promise<void> => {
            const read = await bridge.call(
                'authorization',
                (provider) => provider.readAuthorization({ authorizationId: id }),
                { shapePaths: AUTHORIZATION_PATHS, oneLabel: true }
            );
            // Review of #4538 (L1): an authorization the adapter refuses BY DESIGN (a foreign one:
            // no reference of ours, or a cadence it does not support) is not a drift, and its
            // charge records are not ours to judge either: they are not read.
            if (read.error !== undefined && isByDesign(read.error)) {
                foreignSkipped += 1;
                return;
            }
            attempted += 1;
            if (read.error === undefined) subjectsRead += 1;
            else unreadable.push(id);
            const records = await bridge.callWithSend(
                'charge-records',
                (send) => readMercadoPagoChargeRecords({ authorizationId: id, send }),
                { shapePaths: CHARGE_RECORD_PATHS, oneLabel: true }
            );
            if (records.value === undefined) {
                if (!isByDesign(records.error)) unreadable.push(id);
                return;
            }
            const renewals = [...records.value]
                .sort((left, right) =>
                    String(left.date_created ?? '').localeCompare(String(right.date_created ?? ''))
                )
                .slice(1);
            if (renewals.some((record) => !record.expire_date)) withoutExpiry.push(id);
        };
        const results = await walkSearch({
            ctx,
            label: 'recent',
            path: (offset) =>
                `/preapproval/search?limit=${AUTHORIZATION_SEARCH_PAGE}&offset=${offset}&sort=date_created:desc`,
            pageSize: AUTHORIZATION_SEARCH_PAGE,
            shapePaths: AUTHORIZATION_SEARCH_PATHS,
            onPage: async (found) => {
                const real = idsOf(
                    found.filter((item) => !isWatchReference(item.external_reference))
                );
                for (const id of real) {
                    if (attempted >= RECENT_SUBJECTS) break;
                    if (seen.has(id)) continue;
                    seen.add(id);
                    await readOne(id);
                }
                return attempted >= RECENT_SUBJECTS;
            }
        });
        requireSubjects({ what: 'authorization', attempted, foreignSkipped });
        return {
            subjectsRead,
            foreignSkipped,
            sortedDescending: sortedDescending(results),
            unreadableByAdapter: [...new Set(unreadable)],
            renewalsWithoutExpiry: withoutExpiry
        };
    }
};

/**
 * The most recent real payments, and the most recent ones with a refund, re-read by id through
 * the adapter. A drift watch: it re-checks no row, it catches a payment or refund the adapter can
 * no longer read.
 */
const recentPayments: WatchEntry = {
    id: 'recent-payments',
    rows: [],
    accounts: ['sandbox', 'production'],
    effect: 'read',
    expected: { subjectsRead: RECENT_SUBJECTS, sortedDescending: true, unreadableByAdapter: [] },
    reportedOnly: ['foreignSkipped'],
    measure: async (ctx): Promise<JsonValue> => {
        const bridge = createWatchAdapterBridge({ ctx });
        const unreadable: string[] = [];
        const seen = new Set<string>();
        // Re-review of #4538 (R2): as in `recent-auths`, a payment counts once the adapter read it.
        let attempted = 0;
        let subjectsRead = 0;
        let foreignSkipped = 0;
        /** Reads one payment; answers whether it was a real read (attempted, not foreign). */
        const readOne = async (id: string): Promise<'read' | 'unreadable' | 'foreign'> => {
            const read = await bridge.call(
                'payment',
                (provider) => provider.readCharge({ chargeId: id }),
                { shapePaths: PAYMENT_PATHS, oneLabel: true }
            );
            if (read.error === undefined) return 'read';
            if (isByDesign(read.error)) return 'foreign';
            unreadable.push(id);
            return 'unreadable';
        };
        // The battery creates no payment: every payment the search answers is a real one.
        const results = await walkSearch({
            ctx,
            label: 'recent',
            path: (offset) =>
                `/v1/payments/search?sort=date_created&criteria=desc&limit=${PAYMENT_SEARCH_PAGE}&offset=${offset}`,
            pageSize: PAYMENT_SEARCH_PAGE,
            shapePaths: PAYMENT_SEARCH_PATHS,
            onPage: async (found) => {
                for (const id of idsOf(found)) {
                    if (attempted >= RECENT_SUBJECTS) break;
                    if (seen.has(id)) continue;
                    seen.add(id);
                    const outcome = await readOne(id);
                    if (outcome === 'foreign') foreignSkipped += 1;
                    else attempted += 1;
                    if (outcome === 'read') subjectsRead += 1;
                }
                return attempted >= RECENT_SUBJECTS;
            }
        });
        requireSubjects({ what: 'payment', attempted, foreignSkipped });
        // The most recent refunded payments among those the walk saw, also re-read by id.
        const refunded = idsOf(
            results.filter(
                (item) =>
                    typeof item.transaction_amount_refunded === 'number' &&
                    item.transaction_amount_refunded > 0
            )
        )
            .filter((id) => !seen.has(id))
            .slice(0, RECENT_SUBJECTS);
        for (const id of refunded) await readOne(id);
        return {
            subjectsRead,
            foreignSkipped,
            sortedDescending: sortedDescending(results),
            unreadableByAdapter: unreadable
        };
    }
};

/** The read-only re-reads. */
export const REAL_OBJECT_READ_ENTRIES: readonly WatchEntry[] = [
    authorizationSearch,
    recentAuthorizations,
    recentPayments
];
