/**
 * The two guards the probes carried and the battery inherits (HOS-1512,
 * AC:B1:20), plus the month check of the production run (AC:B1:15).
 *
 * - The ENVIRONMENT guard: every operation that mutates something at the provider
 *   opens with `GET /users/me` and aborts, sending nothing, against the wrong
 *   account. `live_mode` cannot tell the accounts apart: the test account is the
 *   one whose tags include `test_user`.
 * - The BUDGET guard: a measurement that moves money aborts unless its maximum
 *   charge equals the authorized number EXACTLY. An order of magnitude is not close.
 *
 * @module battery/watch-guards
 */
import {
    type WatchAccount,
    type WatchAuthorization,
    type WatchEntry,
    WatchGuardError,
    type WatchTransport
} from './types';

/** The tag `GET /users/me` carries on a provider TEST account, and only there. */
export const WATCH_TEST_ACCOUNT_TAG = 'test_user';

const MARKET_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/**
 * The month of an instant on the market clock.
 *
 * @param args.at - The instant
 * @returns `YYYY-MM` as read in Buenos Aires
 */
export function marketMonthOf(args: { readonly at: Date }): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: MARKET_TIME_ZONE,
        year: 'numeric',
        month: '2-digit'
    }).formatToParts(args.at);
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    return `${year}-${month}`;
}

/**
 * Environment guard: reads `GET /users/me` and aborts when the token belongs to the
 * wrong kind of account for this run.
 *
 * @param args.account - The account the run targets
 * @param args.transport - The transport the run sends through
 * @throws {WatchGuardError} `UNREADABLE_ACCOUNT` or `WRONG_ACCOUNT`
 */
export async function assertAccountMatches(args: {
    readonly account: WatchAccount;
    readonly transport: WatchTransport;
}): Promise<void> {
    const response = await args.transport({ method: 'GET', path: '/users/me' });
    const body = response.body;
    if (
        response.status < 200 ||
        response.status >= 300 ||
        body === null ||
        typeof body !== 'object'
    ) {
        throw new WatchGuardError({
            code: 'UNREADABLE_ACCOUNT',
            message: 'GET /users/me did not answer an account; nothing was sent'
        });
    }
    const tags = 'tags' in body ? (body as { readonly tags: unknown }).tags : undefined;
    if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
        throw new WatchGuardError({
            code: 'UNREADABLE_ACCOUNT',
            message: 'GET /users/me answered tags that are not a list; nothing was sent'
        });
    }
    const tagList: readonly unknown[] = Array.isArray(tags) ? tags : [];
    const isTestAccount = tagList.includes(WATCH_TEST_ACCOUNT_TAG);
    if (args.account === 'sandbox' && !isTestAccount) {
        throw new WatchGuardError({
            code: 'WRONG_ACCOUNT',
            message: 'A sandbox run reached a token that is not a test account; nothing was sent'
        });
    }
    if (args.account === 'production' && isTestAccount) {
        throw new WatchGuardError({
            code: 'WRONG_ACCOUNT',
            message: 'A production run reached a test account token; nothing was sent'
        });
    }
}

/**
 * Budget guard: a money-moving entry must declare its maximum charge and it must equal
 * the authorized number exactly.
 *
 * @param args.entry - The entry about to run
 * @param args.authorization - The authorization in force, if any
 * @throws {WatchGuardError} `AUTHORIZATION_MISSING`, `BUDGET_UNDECLARED` or `BUDGET_MISMATCH`
 */
export function assertBudgetMatches(args: {
    readonly entry: WatchEntry;
    readonly authorization: WatchAuthorization | null;
}): void {
    const { entry, authorization } = args;
    if (authorization === null) {
        throw new WatchGuardError({
            code: 'AUTHORIZATION_MISSING',
            message: `${entry.id} moves money and there is no authorized maximum charge`
        });
    }
    if (entry.maxChargeMinor === undefined || !Number.isInteger(entry.maxChargeMinor)) {
        throw new WatchGuardError({
            code: 'BUDGET_UNDECLARED',
            message: `${entry.id} moves money and declares no integer maximum charge`
        });
    }
    if (entry.maxChargeMinor !== authorization.maxChargeMinor) {
        throw new WatchGuardError({
            code: 'BUDGET_MISMATCH',
            message: `${entry.id} can charge ${entry.maxChargeMinor} and ${authorization.maxChargeMinor} is authorized; they must be exactly equal`
        });
    }
}

/**
 * The production run does not start without the authorization of the current month.
 *
 * @param args.authorization - The authorization in force, if any
 * @param args.now - The run's instant
 * @throws {WatchGuardError} `AUTHORIZATION_MISSING` or `AUTHORIZATION_STALE`
 */
export function assertProductionAuthorized(args: {
    readonly authorization: WatchAuthorization | null;
    readonly now: Date;
}): void {
    if (args.authorization === null) {
        throw new WatchGuardError({
            code: 'AUTHORIZATION_MISSING',
            message: 'The production run has no monthly authorization; it did not start'
        });
    }
    const month = marketMonthOf({ at: args.now });
    if (args.authorization.month !== month) {
        throw new WatchGuardError({
            code: 'AUTHORIZATION_STALE',
            message: `The production authorization is for ${args.authorization.month} and the month is ${month}; it did not start`
        });
    }
}
