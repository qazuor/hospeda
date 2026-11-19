/**
 * The catalog of provider measurements (HOS-1512, owner decision 2026-11-18).
 *
 * The battery moves NO money. It measures, in both accounts, the subscription path production
 * uses (a no-token preapproval created, read back and cancelled in the same run, built by the
 * adapter itself) and read-only re-reads of real objects; in sandbox it also measures what else
 * the lists show without money and without a person. Everything else is declared by name in
 * {@link WATCHED_BY_HAND}. With no money-moving measurement the authorized amount is 0.
 *
 * A run over an empty catalog FAILS (see `runWatchBattery`): it can never report green having
 * measured nothing.
 *
 * @module battery/watch-catalog
 */
import { FAKE_LISTS } from '../fake/fake-lists';
import { REAL_OBJECT_READ_ENTRIES } from './catalog/real-object-reads';
import { SUBSCRIPTION_PATH_ENTRIES } from './catalog/subscription-path';
import { WATCHED_BY_HAND, type WatchedByHand } from './catalog/watched-by-hand';
import { WATCH_ACCOUNTS, WATCH_EFFECTS, type WatchEntry } from './types';
import { PENDING_AMOUNTS_MINOR } from './watch-operations';

/** The measurements the battery repeats. */
export const WATCH_CATALOG: readonly WatchEntry[] = [
    ...SUBSCRIPTION_PATH_ENTRIES,
    ...REAL_OBJECT_READ_ENTRIES
];

export { WATCHED_BY_HAND, type WatchedByHand };

/** A measurement id: the accepted-baseline key is at most 16 characters. */
const MEASUREMENT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,15}$/;

function knownRows(): ReadonlySet<string> {
    return new Set([
        ...FAKE_LISTS.lies.map((lie) => lie.id),
        ...FAKE_LISTS.rules.map((rule) => rule.id)
    ]);
}

/**
 * The rows an entry re-checks: its `rows`, or its id when it declares none.
 *
 * @param entry - The measurement
 * @returns The row ids
 */
export function rowsOf(entry: WatchEntry): readonly string[] {
    return entry.rows ?? [entry.id];
}

/**
 * The only keys a measurement may record without comparing them (`reportedOnly`): counts of what a
 * re-read could not judge. Widening it hides a comparison, so a new key must be added here and
 * reviewed (follow-up of #4538, RO1).
 */
export const REPORTED_ONLY_KEYS: ReadonlySet<string> = new Set(['foreignSkipped']);

/**
 * Checks a catalog before a run uses it.
 *
 * Every id must be unique and fit the baseline key (16 characters); every row an entry re-checks
 * must be a row of the fake's lists (an entry without `rows` is itself a row); accounts and
 * effects must be known; a money-moving entry must declare an integer maximum charge above zero;
 * a declared pending amount must be one of `PENDING_AMOUNTS_MINOR`, on an entry that mutates; a
 * `reportedOnly` key must be in {@link REPORTED_ONLY_KEYS} and never also expected.
 *
 * @param args.catalog - The catalog to check
 * @returns The problems found, one line each; empty when the catalog is valid
 */
export function validateWatchCatalog(args: { readonly catalog: readonly WatchEntry[] }): {
    readonly problems: readonly string[];
} {
    const known = knownRows();
    const problems: string[] = [];
    const seen = new Set<string>();
    for (const entry of args.catalog) {
        if (entry.rows === undefined && !known.has(entry.id)) {
            problems.push(`${entry.id}: not a row of fake-lists.json`);
        }
        if (!MEASUREMENT_ID.test(entry.id)) {
            problems.push(`${entry.id}: not a measurement id of at most 16 characters`);
        }
        for (const row of entry.rows ?? []) {
            if (!known.has(row)) {
                problems.push(`${entry.id}: re-checks ${row}, not a row of fake-lists.json`);
            }
        }
        if (
            entry.pendingAmountMinor !== undefined &&
            !(entry.effect === 'mutates' && PENDING_AMOUNTS_MINOR.has(entry.pendingAmountMinor))
        ) {
            problems.push(`${entry.id}: declares a pending amount that is not allowed`);
        }
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
        const expectedKeys =
            entry.expected !== null &&
            typeof entry.expected === 'object' &&
            !Array.isArray(entry.expected)
                ? Object.keys(entry.expected)
                : [];
        for (const key of entry.reportedOnly ?? []) {
            if (expectedKeys.includes(key)) {
                problems.push(`${entry.id}: ${key} is both expected and reported only`);
            }
            if (!REPORTED_ONLY_KEYS.has(key)) {
                problems.push(`${entry.id}: ${key} is not a key that may be reported only`);
            }
        }
    }
    return { problems };
}

/**
 * Checks that every row of the fake's lists is accounted for: re-checked by a measurement or
 * declared watched by hand, never both and never neither (AC:B1:15).
 *
 * @param args.catalog - The measurements
 * @param args.watchedByHand - The rows declared watched by hand
 * @returns The problems found, one line each; empty when every row is accounted for once
 */
export function validateWatchCoverage(args: {
    readonly catalog: readonly WatchEntry[];
    readonly watchedByHand: readonly WatchedByHand[];
}): { readonly problems: readonly string[] } {
    const known = knownRows();
    const measured = new Set(args.catalog.flatMap((entry) => rowsOf(entry)));
    const byHand = new Set(args.watchedByHand.map((item) => item.row));
    const problems: string[] = [];
    for (const row of [...known].sort()) {
        if (measured.has(row) && byHand.has(row)) {
            problems.push(`${row}: both measured and watched by hand`);
        } else if (!measured.has(row) && !byHand.has(row)) {
            problems.push(`${row}: neither measured nor watched by hand`);
        }
    }
    for (const item of args.watchedByHand) {
        if (!known.has(item.row)) problems.push(`${item.row}: not a row of fake-lists.json`);
        if (item.reason.trim() === '')
            problems.push(`${item.row}: watched by hand without a reason`);
    }
    return { problems };
}
