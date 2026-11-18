/**
 * The catalog of provider measurements (HOS-1512).
 *
 * EMPTY in this release on purpose: the engine, its guards and its run history come
 * first and the twenty measurements plug into {@link WATCH_CATALOG} after. A run over an
 * empty catalog FAILS (see `runWatchBattery`): it can never report green having measured nothing.
 *
 * @module battery/watch-catalog
 */
import { FAKE_LISTS } from '../fake/fake-lists';
import { WATCH_ACCOUNTS, WATCH_EFFECTS, type WatchEntry } from './types';

/** The measurements the battery repeats. Entries are added here, one per `M*` / `RP*` row. */
export const WATCH_CATALOG: readonly WatchEntry[] = [];

/**
 * Checks a catalog before a run uses it.
 *
 * Every id must be a row of the fake's lists (the expected value is sourced from there, so a
 * measurement with no row has nothing to be compared to) and unique; accounts and effects must
 * be known; a money-moving entry must declare an integer maximum charge above zero.
 *
 * @param args.catalog - The catalog to check
 * @returns The problems found, one line each; empty when the catalog is valid
 */
export function validateWatchCatalog(args: { readonly catalog: readonly WatchEntry[] }): {
    readonly problems: readonly string[];
} {
    const knownIds = new Set([
        ...FAKE_LISTS.lies.map((lie) => lie.id),
        ...FAKE_LISTS.rules.map((rule) => rule.id)
    ]);
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const entry of args.catalog) {
        if (!knownIds.has(entry.id)) problems.push(`${entry.id}: not a row of fake-lists.json`);
        if (seen.has(entry.id)) problems.push(`${entry.id}: listed twice`);
        seen.add(entry.id);
        if (entry.accounts.length === 0) problems.push(`${entry.id}: runs against no account`);
        for (const account of entry.accounts) {
            if (!WATCH_ACCOUNTS.includes(account))
                problems.push(`${entry.id}: unknown account ${String(account)}`);
        }
        if (!WATCH_EFFECTS.includes(entry.effect))
            problems.push(`${entry.id}: unknown effect ${String(entry.effect)}`);
        if (
            entry.effect === 'moves-money' &&
            !(Number.isInteger(entry.maxChargeMinor) && (entry.maxChargeMinor ?? 0) > 0)
        ) {
            problems.push(`${entry.id}: moves money without an integer maximum charge above zero`);
        }
    }
    return { problems };
}
