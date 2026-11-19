/**
 * The two guards the probes carried and the battery inherits (HOS-1512,
 * AC:B1:20), plus the month check of the production run (AC:B1:15).
 *
 * - The ENVIRONMENT guard: every operation that mutates something at the provider
 *   opens with `GET /users/me` and aborts, sending nothing, against the wrong
 *   account. `live_mode` cannot tell the accounts apart: the test account is the
 *   one whose tags include `test_user`.
 * - The BUDGET guard, in two layers. (1) The authorized amount is EXACT at run level: in pre-flight,
 *   before it is consumed, it must equal the sum of the declared maximum charges of the account's
 *   money-moving measurements (owner decision, 2026-11-18); a mismatch refuses the run and burns
 *   nothing. A read-only battery has a sum of 0 and is authorized with 0 (owner decision F5, 2026-11-18). (2) It also caps the WHOLE run: the engine keeps one running total of charges, and a
 *   measurement whose own maximum is above the authorized amount aborts. Refunds are tracked apart.
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
 * The day of an instant on the market clock (owner decision on B1, 2026-11-19): a zero-sum
 * authorization covers one run per market day.
 *
 * @param args.at - The instant
 * @returns `YYYY-MM-DD` as read in Buenos Aires
 */
export function marketDayOf(args: { readonly at: Date }): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: MARKET_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(args.at);
}

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
 * A production run is also pinned to the account id the owner confirmed in the authorization:
 * another id, or no id at all, aborts. The test-account tag check stays as it is.
 *
 * @param args.account - The account the run targets
 * @param args.transport - The transport the run sends through
 * @param args.expectedAccountId - The confirmed account id (required for a production run)
 * @throws {WatchGuardError} `UNREADABLE_ACCOUNT`, `WRONG_ACCOUNT`, `ACCOUNT_ID_MISSING` or
 *   `ACCOUNT_ID_MISMATCH`
 */
export async function assertAccountMatches(args: {
    readonly account: WatchAccount;
    readonly transport: WatchTransport;
    readonly expectedAccountId?: string | undefined;
}): Promise<void> {
    if (args.account === 'production' && !args.expectedAccountId) {
        throw new WatchGuardError({
            code: 'ACCOUNT_ID_MISSING',
            message: 'The production authorization carries no account id; nothing was sent'
        });
    }
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
    if (args.account === 'production') {
        const id = 'id' in body ? (body as { readonly id: unknown }).id : undefined;
        if (id === undefined || id === null || String(id) !== args.expectedAccountId) {
            throw new WatchGuardError({
                code: 'ACCOUNT_ID_MISMATCH',
                message:
                    'GET /users/me answered another account than the one the owner confirmed; nothing was sent'
            });
        }
    }
}

/**
 * Budget guard: a money-moving entry must declare an integer maximum charge, and it must fit under
 * the authorized number, which caps the WHOLE RUN. No entry has to equal it: the sum of all charges
 * of the run is what the engine keeps under the cap.
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
            message: `${entry.id} moves money and there is no authorized cap for the run`
        });
    }
    if (
        entry.maxChargeMinor === undefined ||
        !Number.isInteger(entry.maxChargeMinor) ||
        entry.maxChargeMinor <= 0
    ) {
        throw new WatchGuardError({
            code: 'BUDGET_UNDECLARED',
            message: `${entry.id} moves money and declares no integer maximum charge above zero`
        });
    }
    if (entry.maxChargeMinor > authorization.maxChargeMinor) {
        throw new WatchGuardError({
            code: 'BUDGET_MISMATCH',
            message: `${entry.id} can charge ${entry.maxChargeMinor}, above the ${authorization.maxChargeMinor} that caps the whole run`
        });
    }
}

/**
 * The sum of the declared maximum charges of the money-moving measurements that run against an
 * account: the exact amount the owner authorizes for ONE run of it (D3, decision 2026-11-18).
 *
 * @param args.catalog - The measurements
 * @param args.account - The account
 * @returns The sum, in minor units; 0 when the account has no money-moving measurement
 */
export function expectedAuthorizationSum(args: {
    readonly catalog: readonly WatchEntry[];
    readonly account: WatchAccount;
}): number {
    return args.catalog
        .filter((entry) => entry.accounts.includes(args.account) && entry.effect === 'moves-money')
        .reduce((sum, entry) => sum + (entry.maxChargeMinor ?? 0), 0);
}

/**
 * The authorized amount must EQUAL the sum of the money-moving measurements of the account. Checked in
 * pre-flight, BEFORE the authorization is consumed: a mismatch (the owner authorized an amount of
 * another catalog, or the catalog changed) refuses the run and burns nothing. The per-run cap stays
 * as a second layer.
 *
 * @param args.entries - The measurements to sum
 * @param args.account - The account the run targets
 * @param args.authorization - The authorization in force
 * @throws {WatchGuardError} `AUTHORIZATION_SUM_MISMATCH`, naming both numbers
 */
export function assertAuthorizationCoversMoneyCatalog(args: {
    readonly entries: readonly WatchEntry[];
    readonly account: WatchAccount;
    readonly authorization: WatchAuthorization;
}): void {
    const expected = expectedAuthorizationSum({ catalog: args.entries, account: args.account });
    if (expected !== args.authorization.maxChargeMinor) {
        throw new WatchGuardError({
            code: 'AUTHORIZATION_SUM_MISMATCH',
            message: `The authorized amount is ${args.authorization.maxChargeMinor} and the money-moving measurements add up to ${expected}; they must be exactly equal, so the authorization was not consumed`
        });
    }
}

/**
 * The production run does not start without the authorization of the current month.
 *
 * @param args.authorization - The authorization in force, if any
 * @param args.now - The run's instant
 * @throws {WatchGuardError} `AUTHORIZATION_MISSING`, `AUTHORIZATION_CONSUMED`, `ACCOUNT_ID_MISSING`
 *   or `AUTHORIZATION_STALE`
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
    if (args.authorization.consumedByRunId !== undefined) {
        throw new WatchGuardError({
            code: 'AUTHORIZATION_CONSUMED',
            message: `The production authorization was consumed by run ${args.authorization.consumedByRunId}; a new run needs a new authorization`
        });
    }
    if (!args.authorization.accountId) {
        throw new WatchGuardError({
            code: 'ACCOUNT_ID_MISSING',
            message: 'The production authorization carries no account id; it did not start'
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
