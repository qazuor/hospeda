/**
 * What the owner authorizes (HOS-1512, N3, owner decision 2026-11-18): the amount of ONE run is
 * EXACTLY the sum of the declared maximum charges of the money-moving measurements of this
 * environment's account. The API computes it from the catalog, shows it for the owner to confirm,
 * and refuses any other value, so the owner never types an amount that the run will then refuse.
 * When the catalog has no money-moving measurement the sum is 0 and 0 is the one valid amount
 * (owner decision F5, 2026-11-18). That is decided by the ABSENCE of money-moving measurements in
 * a VALID catalog, never by the sum alone: a money-moving measurement without its maximum charge
 * would also sum 0, so a catalog `validateWatchCatalog` rejects is never previewed nor authorized.
 *
 * @module utils/provider-watch/provider-watch-authorization
 */
import {
    expectedAuthorizationSum,
    validateWatchCatalog,
    WATCH_CATALOG,
    type WatchAccount,
    type WatchEntry
} from '@repo/payments';
import type { ProviderWatchAuthorizationPreview } from '@repo/schemas';

/** A preview of a valid catalog, or the problems that make it unauthorizable. */
export type AuthorizationPreviewResult =
    | { readonly ok: true; readonly preview: ProviderWatchAuthorizationPreview }
    | { readonly ok: false; readonly problems: readonly string[] };

/**
 * The amount to authorize and the measurements it comes from, for a VALID catalog only.
 *
 * @param args.account - The account this environment watches
 * @param args.catalog - The measurements; the shipped catalog by default
 * @returns The exact amount and the money-moving measurements behind it, or the catalog's
 *   problems when it is invalid (nothing can be authorized against it)
 */
export function previewAuthorization(args: {
    readonly account: WatchAccount;
    readonly catalog?: readonly WatchEntry[];
}): AuthorizationPreviewResult {
    const catalog = args.catalog ?? WATCH_CATALOG;
    const { problems } = validateWatchCatalog({ catalog });
    if (problems.length > 0) return { ok: false, problems };
    return {
        ok: true,
        preview: {
            expectedMaxChargeMinor: expectedAuthorizationSum({ catalog, account: args.account }),
            measurements: catalog
                .filter(
                    (entry) =>
                        entry.accounts.includes(args.account) && entry.effect === 'moves-money'
                )
                .map((entry) => ({ id: entry.id, maxChargeMinor: entry.maxChargeMinor ?? 0 }))
        }
    };
}

/** Why an amount cannot be authorized. */
export type AuthorizedAmountRefusal = 'AMOUNT_DIFFERS' | 'CATALOG_INVALID';

/**
 * Checks the amount the owner submits against the one the catalog requires.
 *
 * @param args.account - The account this environment watches
 * @param args.amountMinor - What the owner submitted
 * @param args.catalog - The measurements; the shipped catalog by default
 * @returns `ok`, the refusal with the amount that would be accepted, or the catalog's problems
 */
export function checkAuthorizedAmount(args: {
    readonly account: WatchAccount;
    readonly amountMinor: number;
    readonly catalog?: readonly WatchEntry[];
}):
    | { readonly ok: true }
    | {
          readonly ok: false;
          readonly refusal: 'AMOUNT_DIFFERS';
          readonly expectedMinor: number;
      }
    | {
          readonly ok: false;
          readonly refusal: 'CATALOG_INVALID';
          readonly problems: readonly string[];
      } {
    const previewed = previewAuthorization(args);
    if (!previewed.ok) {
        return { ok: false, refusal: 'CATALOG_INVALID', problems: previewed.problems };
    }
    const { expectedMaxChargeMinor } = previewed.preview;
    if (args.amountMinor !== expectedMaxChargeMinor) {
        return { ok: false, refusal: 'AMOUNT_DIFFERS', expectedMinor: expectedMaxChargeMinor };
    }
    return { ok: true };
}
