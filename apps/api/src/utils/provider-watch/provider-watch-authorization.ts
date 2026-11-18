/**
 * What the owner authorizes (HOS-1512, N3, owner decision 2026-11-18): the amount of ONE run is
 * EXACTLY the sum of the declared maximum charges of the money-moving measurements of this
 * environment's account. The API computes it from the catalog, shows it for the owner to confirm,
 * and refuses any other value, so the owner never types an amount that the run will then refuse.
 *
 * @module utils/provider-watch/provider-watch-authorization
 */
import {
    expectedAuthorizationSum,
    WATCH_CATALOG,
    type WatchAccount,
    type WatchEntry
} from '@repo/payments';
import type { ProviderWatchAuthorizationPreview } from '@repo/schemas';

/**
 * The amount to authorize and the measurements it comes from.
 *
 * @param args.account - The account this environment watches
 * @param args.catalog - The measurements; the shipped catalog by default
 * @returns The exact amount and the money-moving measurements behind it
 */
export function previewAuthorization(args: {
    readonly account: WatchAccount;
    readonly catalog?: readonly WatchEntry[];
}): ProviderWatchAuthorizationPreview {
    const catalog = args.catalog ?? WATCH_CATALOG;
    return {
        expectedMaxChargeMinor: expectedAuthorizationSum({ catalog, account: args.account }),
        measurements: catalog
            .filter(
                (entry) => entry.accounts.includes(args.account) && entry.effect === 'moves-money'
            )
            .map((entry) => ({ id: entry.id, maxChargeMinor: entry.maxChargeMinor ?? 0 }))
    };
}

/** Why an amount cannot be authorized. */
export type AuthorizedAmountRefusal = 'NO_MONEY_MEASUREMENTS' | 'AMOUNT_DIFFERS';

/**
 * Checks the amount the owner submits against the one the catalog requires.
 *
 * @param args.account - The account this environment watches
 * @param args.amountMinor - What the owner submitted
 * @param args.catalog - The measurements; the shipped catalog by default
 * @returns `ok`, or the refusal with the amount that would be accepted
 */
export function checkAuthorizedAmount(args: {
    readonly account: WatchAccount;
    readonly amountMinor: number;
    readonly catalog?: readonly WatchEntry[];
}):
    | { readonly ok: true }
    | {
          readonly ok: false;
          readonly refusal: AuthorizedAmountRefusal;
          readonly expectedMinor: number;
      } {
    const { expectedMaxChargeMinor } = previewAuthorization(args);
    if (expectedMaxChargeMinor === 0) {
        return { ok: false, refusal: 'NO_MONEY_MEASUREMENTS', expectedMinor: 0 };
    }
    if (args.amountMinor !== expectedMaxChargeMinor) {
        return { ok: false, refusal: 'AMOUNT_DIFFERS', expectedMinor: expectedMaxChargeMinor };
    }
    return { ok: true };
}
