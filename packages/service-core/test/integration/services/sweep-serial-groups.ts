/**
 * Why this exists: parallel workers share one database, and some services act on EVERY eligible
 * row of it rather than on the rows a case seeded. Two files driving the same global service at
 * once step on each other, so every file that drives one takes that service's session-level
 * advisory lock for its whole run and those files execute one at a time. One lock per resource:
 * files of different groups still run in parallel.
 *
 * A group has two kinds of member. A file that DRIVES the service takes the key exclusively. A
 * file that only COMMITS rows the service reads takes the same key in shared mode: those files
 * run in parallel with each other and never alongside a driver. A file matching both is a driver.
 *
 * - The reconciliation sweep owns one global lease: a `single` run refuses while any cycle slice
 *   holds it, and two cycle slices exclude each other. Its zero-call checks also scan the whole
 *   database: `runAddonWithoutShutdownCheck` reads EVERY live addon instance and opens
 *   ADDON_SIN_APAGAR on its complement when A5 calls it orphaned. A pause test that committed
 *   ACTIVE add-ons over a SUSPENDED principal had its complement marked by a sweep file running
 *   in the same second (HOS-2334). So every file that commits live addon instances, directly or
 *   through a support module, is a shared member. `sweep-serial-groups.test.ts` computes that set
 *   from the fixtures and fails when a writer is missing from `shares`.
 * - The S38 due-change batch (`applyDueScheduledChanges`, HOS-2103) applies every due queue entry
 *   in the database. A batch run by one file applied the rows another file had just seeded, so
 *   that file's own run never saw them: no coverage notice for its user, no FAILED result for its
 *   spied row. The group therefore covers BOTH the files that run the batch and every file that
 *   writes queue rows: seeding a row due before the batch clock is enough to have it stolen,
 *   whether or not the file ever names `applyDueScheduledChanges`. Queue rows are written through
 *   three fixtures (`seedScheduledChange`, `seedDifferentScheduledAmount`, `seedPriceIncrease`) or
 *   by a direct `insert(subscriptionScheduledChanges)`, and each of those tokens is listed.
 */
/** The lock mode a file takes on a group key. */
export type SerialLockMode = 'exclusive' | 'shared';

/** One advisory lock a file must hold for its whole run. */
export interface SerialLock {
    readonly key: number;
    readonly mode: SerialLockMode;
}

/** A global service that files must not run against concurrently. */
export interface SerialGroup {
    readonly key: number;
    /** Files whose source matches drive the service and take the key exclusively. */
    readonly drives: RegExp;
    /** Files whose source matches commit rows the service reads and take the key shared. */
    readonly shares?: RegExp;
}

/**
 * Support modules (basename without `-fixtures`) that commit live addon instances, directly or by
 * importing another one. `sweep-serial-groups.test.ts` recomputes this set from the sources and
 * fails when a module is missing, so a new writer fixture cannot slip out of the sweep group.
 */
const ADDON_WRITER_FIXTURES = [
    'addon-a2',
    'addon-a6',
    'addon-free-choice',
    'addon-orphan',
    'addon-purchase',
    'addon-version-publication',
    'addon-withdrawal',
    'admin-subscription-read',
    'b10-exit',
    'branch6',
    'complement',
    'courtesy',
    'coverage',
    'held-charge-refund',
    'next-charge-sync',
    'paid-order',
    'pause',
    'paused-increase',
    'permanent-grant-preview',
    'permanent-grant-revoke',
    'permanent-grant-revoke-scope',
    'permanent-grant-s20',
    'plan-change',
    'plan-migration-exit',
    'plan-migration',
    'plan-migration-increase',
    'plan-migration-s37',
    'price-increase',
    'promo-ending',
    'refund-order',
    'reissue-courtesy',
    'renewal-notice',
    'revocation',
    'service-end-chargeback',
    'service-end',
    'succession-close',
    'succession-dies-alone',
    'succession-s17',
    'successor-cut',
    'upgrade-complete'
] as const;

/** Every serial group, one advisory key per global service. */
export const SERIAL_GROUPS: readonly SerialGroup[] = [
    {
        key: 1_999_001,
        drives: /billing\/reconciliation\/sweep\/|runReconciliationSweep|reconciliation-sweep-fixtures|reconciliation-exit-game-fixtures|(?:paid-order|credited-payments)-fixtures/,
        shares: new RegExp(
            [
                `/(?:${ADDON_WRITER_FIXTURES.join('|')})-fixtures(?:-2)?['.]`,
                String.raw`\bseedOrphanInstance\b`,
                String.raw`\binsert\(addonInstances\)`
            ].join('|')
        )
    },
    {
        key: 1_999_002,
        drives: /\bapplyDueScheduledChanges\b|\bseedScheduledChange\b|\bseedDifferentScheduledAmount\b|\bseedPriceIncrease\b|\binsert\(subscriptionScheduledChanges\)/
    },
    {
        // HOS-2179: the A3 pass (`expireAddonAuthorizationWindows`) expires EVERY pending addon
        // purchase whose window elapsed on the caller's clock. A payment page purchase is anchored
        // on the fixture clock, so another file's A3 run (its clock days ahead) would abandon it
        // mid-case through a fake that never saw its page. Files that drive A3 run one at a time.
        key: 1_999_003,
        drives: /\bexpireAddonAuthorizationWindows\b/
    },
    {
        // HOS-2406: `listProposedRefunds` pages over EVERY `MARK_PROPOSAL` refund in the database.
        // A file that commits, confirms or closes one while the list file pages shifts the offsets
        // (an id listed twice, another skipped). The list file runs alone; the writers share.
        key: 1_999_004,
        drives: /\blistProposedRefunds\(/,
        shares: /held-charge-refund-fixtures|\bMARK_PROPOSAL\b/
    }
];

/**
 * Plans the advisory locks one integration test file must hold, in ascending key order so two
 * files that match several groups can never deadlock.
 */
export function planSerialLocks({ source }: { readonly source: string }): readonly SerialLock[] {
    const locks: SerialLock[] = [];
    for (const group of SERIAL_GROUPS) {
        if (group.drives.test(source)) locks.push({ key: group.key, mode: 'exclusive' });
        else if (group.shares?.test(source)) locks.push({ key: group.key, mode: 'shared' });
    }
    return locks.sort((a, b) => a.key - b.key);
}
