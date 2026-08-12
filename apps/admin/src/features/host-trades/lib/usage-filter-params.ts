/**
 * @file usage-filter-params.ts
 * @description Turns the audit screen's filter bar into API query params
 * (HOS-376 T-056).
 *
 * Pure, so the page component holds no translation logic — and so the date
 * handling below is testable at all.
 */

import type {
    HostTradeUsageFilters,
    UsageChannelFilter,
    UsageDeclaredByFilter,
    UsageStatusFilter
} from '@/hooks/use-host-trade-usages';

/** The filter bar's raw state: every field a string, `''` meaning unset. */
export interface RawUsageFilters {
    readonly status: string;
    readonly declaredBy: string;
    readonly creationChannel: string;
    readonly hostTradeId: string;
    readonly hostUserId: string;
    readonly createdAfter: string;
    readonly createdBefore: string;
}

const STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED'] as const;
const DECLARED_BY = ['HOST', 'PROVIDER'] as const;
const CHANNELS = ['QR', 'LINKED_SELECTOR', 'EMAIL_LOOKUP'] as const;

/** A `YYYY-MM-DD` value as `<input type="date">` produces it. */
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Narrows a raw string to one of the accepted values, or `undefined`.
 *
 * Matching against the list rather than asserting the type keeps an unexpected
 * value — a stale URL, a hand-edited input — from travelling to an endpoint
 * that answers 400 for it.
 */
function toEnumValue<TValue extends string>(
    allowed: readonly TValue[],
    value: string
): TValue | undefined {
    return allowed.find((candidate) => candidate === value);
}

/**
 * Converts a date-input value into an instant at one edge of that day.
 *
 * `<input type="date">` yields a bare `YYYY-MM-DD`, which `z.coerce.date()`
 * reads as MIDNIGHT UTC. That is right for a lower bound and wrong for an upper
 * one: "up to August 1st" would end at July 31st 23:59, excluding precisely the
 * day the admin asked about.
 *
 * A value that is not a well-formed date yields `undefined` rather than an
 * `Invalid Date`, which would serialise to `null` and be rejected by the route.
 *
 * @param value - The raw input value.
 * @param edge - Which end of the day to land on.
 * @returns An ISO instant, or `undefined` when there is nothing usable.
 */
function toDayBoundary(value: string, edge: 'start' | 'end'): string | undefined {
    if (!DATE_INPUT_PATTERN.test(value)) {
        return undefined;
    }
    const suffix = edge === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
    const instant = new Date(`${value}${suffix}`);
    return Number.isNaN(instant.getTime()) ? undefined : instant.toISOString();
}

/** Returns the trimmed value, or `undefined` when nothing is left of it. */
function toOptionalText(value: string): string | undefined {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Builds the query params for `GET /admin/host-trades/usages`.
 *
 * Unset filters are OMITTED rather than sent empty: `createAdminListRoute`
 * validates every param it receives, so an empty `status=` is a 400 and not an
 * ignored field.
 *
 * @param input.filters - The filter bar's current state.
 * @param input.page - The page to read.
 * @param input.pageSize - Rows per page.
 * @returns The filters as the hook (and the API) expect them.
 */
export function buildUsageQueryParams(input: {
    readonly filters: RawUsageFilters;
    readonly page: number;
    readonly pageSize: number;
}): HostTradeUsageFilters {
    const { filters, page, pageSize } = input;

    const status: UsageStatusFilter | undefined = toEnumValue(STATUSES, filters.status);
    const declaredBy: UsageDeclaredByFilter | undefined = toEnumValue(
        DECLARED_BY,
        filters.declaredBy
    );
    const creationChannel: UsageChannelFilter | undefined = toEnumValue(
        CHANNELS,
        filters.creationChannel
    );
    const hostTradeId = toOptionalText(filters.hostTradeId);
    const hostUserId = toOptionalText(filters.hostUserId);
    const createdAfter = toDayBoundary(filters.createdAfter, 'start');
    const createdBefore = toDayBoundary(filters.createdBefore, 'end');

    return {
        page,
        pageSize,
        ...(status ? { status } : {}),
        ...(declaredBy ? { declaredBy } : {}),
        ...(creationChannel ? { creationChannel } : {}),
        ...(hostTradeId ? { hostTradeId } : {}),
        ...(hostUserId ? { hostUserId } : {}),
        ...(createdAfter ? { createdAfter } : {}),
        ...(createdBefore ? { createdBefore } : {})
    };
}
