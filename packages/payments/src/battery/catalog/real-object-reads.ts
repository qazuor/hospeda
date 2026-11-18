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

/** RP13 / EX-57: the order search window may span at most 30 days. */
const ORDER_WINDOW_MAX_DAYS = 30;

const DAY_MS = 86_400_000;

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

/** The fields the adapter reads from `GET /v1/orders` (`OrderSearchSchema`). */
const ORDER_SEARCH_PATHS = [
    'paging.total',
    'data[].id',
    'data[].external_reference',
    'data[].created_date',
    'data[].date_created'
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
 * RP13 / EX-57: the order search needs both creation dates, spans at most 30 days and matches the
 * reference exactly. Measured in sandbox; EX-57 leaves production to be measured without mutating,
 * which is what this does there.
 */
const orderSearchBounds: WatchEntry = {
    id: 'order-search',
    rows: ['RP13'],
    accounts: ['sandbox', 'production'],
    effect: 'read',
    expected: {
        withoutDatesNames: 'missing_required_params',
        overAMonthNames: 'invalid_search_params',
        exactReferenceMatches: 0
    },
    measure: async (ctx): Promise<JsonValue> => {
        const reference = garbageReference(ctx);
        const now = ctx.now().getTime();
        const iso = (ms: number) => new Date(ms).toISOString();
        const withoutDates = await ctx.send({
            label: 'without-dates',
            request: {
                method: 'GET',
                path: `/v1/orders?${new URLSearchParams({ external_reference: reference })}`
            }
        });
        const overAMonth = await ctx.send({
            label: 'over-a-month',
            request: {
                method: 'GET',
                path: `/v1/orders?${new URLSearchParams({
                    begin_date: iso(now - (ORDER_WINDOW_MAX_DAYS + 1) * DAY_MS),
                    end_date: iso(now),
                    external_reference: reference
                })}`
            }
        });
        const bridge = createWatchAdapterBridge({ ctx });
        const within = await bridge.call(
            'within-a-month',
            (provider) =>
                provider.searchOrders({
                    reference,
                    createdFrom: iso(now - (ORDER_WINDOW_MAX_DAYS - 1) * DAY_MS),
                    createdTo: iso(now)
                }),
            { shapePaths: ORDER_SEARCH_PATHS, oneLabel: true }
        );
        if (within.value === undefined) {
            throw new Error(`the adapter could not search orders: ${String(within.error)}`);
        }
        const names = (response: WatchResponse, code: string): string =>
            JSON.stringify(response.body ?? null).includes(code) ? code : 'another answer';
        return {
            withoutDatesNames: names(withoutDates, 'missing_required_params'),
            overAMonthNames: names(overAMonth, 'invalid_search_params'),
            exactReferenceMatches: within.value.orders.length
        };
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
    expected: { unreadableByAdapter: [], renewalsWithoutExpiry: [] },
    measure: async (ctx): Promise<JsonValue> => {
        const search = await ctx.send({
            label: 'recent',
            request: {
                method: 'GET',
                path: `/preapproval/search?limit=${RECENT_SUBJECTS * 4}&offset=0&sort=date_created:desc`
            },
            shapePaths: AUTHORIZATION_SEARCH_PATHS
        });
        const subjects = listOf(recordOf(search.body).results)
            .map(recordOf)
            .filter((item) => !isWatchReference(item.external_reference))
            .map((item) => String(item.id ?? ''))
            .filter((id) => id !== '')
            .slice(0, RECENT_SUBJECTS);
        const bridge = createWatchAdapterBridge({ ctx });
        const unreadable: string[] = [];
        const withoutExpiry: string[] = [];
        for (const id of subjects) {
            const read = await bridge.call(
                'authorization',
                (provider) => provider.readAuthorization({ authorizationId: id }),
                { shapePaths: AUTHORIZATION_PATHS, oneLabel: true }
            );
            if (read.error !== undefined && !isByDesign(read.error)) unreadable.push(id);
            const records = await bridge.callWithSend(
                'charge-records',
                (send) => readMercadoPagoChargeRecords({ authorizationId: id, send }),
                { shapePaths: CHARGE_RECORD_PATHS, oneLabel: true }
            );
            if (records.value === undefined) {
                unreadable.push(id);
                continue;
            }
            const renewals = [...records.value]
                .sort((left, right) =>
                    String(left.date_created ?? '').localeCompare(String(right.date_created ?? ''))
                )
                .slice(1);
            if (renewals.some((record) => !record.expire_date)) withoutExpiry.push(id);
        }
        return { unreadableByAdapter: unreadable, renewalsWithoutExpiry: withoutExpiry };
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
    expected: { unreadableByAdapter: [] },
    measure: async (ctx): Promise<JsonValue> => {
        const search = await ctx.send({
            label: 'recent',
            request: {
                method: 'GET',
                path: `/v1/payments/search?sort=date_created&criteria=desc&limit=${PAYMENT_SEARCH_PAGE}`
            },
            shapePaths: PAYMENT_SEARCH_PATHS
        });
        const results = listOf(recordOf(search.body).results).map(recordOf);
        const idOf = (item: Readonly<Record<string, unknown>>) => String(item.id ?? '');
        const recent = results.slice(0, RECENT_SUBJECTS).map(idOf);
        const refunded = results
            .filter((item) => typeof item.transaction_amount_refunded === 'number')
            .filter((item) => (item.transaction_amount_refunded as number) > 0)
            .slice(0, RECENT_SUBJECTS)
            .map(idOf);
        const subjects = [...new Set([...recent, ...refunded])].filter((id) => id !== '');
        const bridge = createWatchAdapterBridge({ ctx });
        const unreadable: string[] = [];
        for (const id of subjects) {
            const read = await bridge.call(
                'payment',
                (provider) => provider.readCharge({ chargeId: id }),
                {
                    shapePaths: PAYMENT_PATHS,
                    oneLabel: true
                }
            );
            if (read.error !== undefined && !isByDesign(read.error)) unreadable.push(id);
        }
        return { unreadableByAdapter: unreadable };
    }
};

/** The read-only re-reads. */
export const REAL_OBJECT_READ_ENTRIES: readonly WatchEntry[] = [
    authorizationSearch,
    orderSearchBounds,
    recentAuthorizations,
    recentPayments
];
