/**
 * Static guard: every upsert that re-points an `entity_subscriptions` row must
 * clear `plan_restricted` (HOS-1122).
 *
 * ## The invariant
 *
 * `plan_restricted` says "the subscription this row points at no longer covers
 * this listing". Re-pointing the row at a DIFFERENT subscription makes that
 * statement meaningless: the new subscription has its own tier and its own cap,
 * and it has not restricted anything. A restriction is a fact about one
 * subscription, so it cannot survive being handed to another.
 *
 * ## What went wrong without it
 *
 * The only writer that ever cleared the flag was `applyCommerceUpgradeRestorations`,
 * reachable ONLY from a plan change in the upward direction. Every other path
 * that re-points the row set `subscriptionId`, `status` and `updatedAt` and
 * nothing else.
 *
 * So: an owner on premium (cap 5) with 5 listings downgrades to básico (cap 1);
 * 4 rows end up restricted. They cancel, then subscribe to premium again. The
 * checkout re-points the rows, `plan_restricted` stays `true`, and the
 * visibility reconciler reads `planCoversListing = false` and keeps all 4
 * PRIVATE. `applyCommerceUpgradeRestorations` never runs — there was no plan
 * change, there was a new subscription.
 *
 * And it is SILENT. The reconciler's paid-but-incomplete alarm is keyed on
 * `planCoversListing`, deliberately (a restricted listing skips the completeness
 * read, so alarming there would fire on every restricted listing forever). The
 * consequence is that this particular state — four paid listings, invisible —
 * produces not one line of log.
 *
 * ## Why a guard and not six tests
 *
 * There are SIX of these upserts across four files (the review found three).
 * Six tests would each prove one site and say nothing about the seventh someone
 * adds next month. The property is syntactic and total, so it gets the check
 * that is also syntactic and total.
 *
 * The guard deliberately does NOT assert the value is `false` specifically —
 * `sql` expressions and column references are legitimate ways to write it. It
 * asserts the field is CONSIDERED. A site that names it has made a decision; a
 * site that omits it has not.
 *
 * @module test/services/entity-subscription-repoint-clears-restriction.guard
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC = join(__dirname, '..', '..', 'src');

/**
 * Every file that upserts `entity_subscriptions`, with how many
 * `onConflictDoUpdate` blocks each is expected to hold.
 *
 * The counts are frozen on purpose. Without them a file that stopped upserting
 * — because the code moved, or a merge dropped it — would satisfy "every block
 * names the field" vacuously, with zero blocks.
 */
const UPSERT_SITES: ReadonlyArray<{ path: string; blocks: number }> = [
    // TWO, not four: this file also upserts `partner_subscriptions` with a
    // byte-identical `set:` shape. The first version of this guard counted
    // every `onConflictDoUpdate` in the file and demanded the column of all
    // four — `tsc` refused, because `partner_subscriptions` has no such
    // column. Scoping the extraction to the table is what makes the count
    // mean what it says.
    { path: 'services/subscription-checkout.service.ts', blocks: 2 },
    { path: 'services/commerce-subscription-attach.service.ts', blocks: 1 },
    { path: 'services/commerce-reconcile.service.ts', blocks: 1 },
    { path: 'services/entity-subscription-cache.service.ts', blocks: 1 },
    { path: '../src/cron/jobs/entity-subscription-cache-reconcile.job.ts', blocks: 1 }
];

/**
 * Strips `//` line comments and block comments from a source fragment.
 *
 * Load-bearing, and found by mutating this guard rather than by thinking:
 * every one of these upserts carries a comment explaining WHY it clears the
 * field, and those comments name the field. Without this the guard passed a
 * mutation that deleted `planRestricted: false` from the code while leaving
 * the comment describing it — a check that asserted the presence of an
 * explanation instead of the presence of a write.
 */
function stripComments(fragment: string): string {
    return fragment.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Extracts each `onConflictDoUpdate({ … })` argument that belongs to an
 * `entitySubscriptions` insert, by brace matching.
 *
 * Brace matching rather than a regex because the blocks nest object literals
 * and template strings; a lazy `\{[\s\S]*?\}` would stop at the first inner
 * closing brace and read a fragment that happens to exclude the field —
 * reporting a violation that is not there, or missing one that is.
 *
 * Scoped to the TABLE, not merely to the file: `subscription-checkout.service.ts`
 * upserts `partner_subscriptions` with an identical `set:` shape, and a
 * file-wide scan demanded a column that table does not have.
 */
function extractConflictBlocks(source: string): string[] {
    const blocks: string[] = [];
    const marker = '.onConflictDoUpdate(';
    let cursor = source.indexOf(marker);
    while (cursor !== -1) {
        // Which `.insert(...)` this conflict clause hangs off: the nearest one
        // ABOVE it in the source. Anything but `entitySubscriptions` is another
        // table's upsert and none of this guard's business.
        const insertAt = source.lastIndexOf('.insert(', cursor);
        const insertTarget = insertAt === -1 ? '' : source.slice(insertAt, insertAt + 40);
        if (!insertTarget.includes('entitySubscriptions')) {
            cursor = source.indexOf(marker, cursor + marker.length);
            continue;
        }
        const start = source.indexOf('{', cursor + marker.length);
        if (start === -1) break;
        let depth = 0;
        let end = start;
        for (let i = start; i < source.length; i += 1) {
            if (source[i] === '{') depth += 1;
            else if (source[i] === '}') {
                depth -= 1;
                if (depth === 0) {
                    end = i;
                    break;
                }
            }
        }
        blocks.push(source.slice(start, end + 1));
        cursor = source.indexOf(marker, end);
    }
    return blocks;
}

describe('entity_subscriptions re-point clears plan_restricted (HOS-1122)', () => {
    for (const site of UPSERT_SITES) {
        const source = readFileSync(join(API_SRC, site.path), 'utf8');

        it(`${site.path} still upserts entity_subscriptions`, () => {
            // Guards the guard: a file that no longer touches the table would
            // otherwise pass the assertion below with nothing to assert on.
            expect(source).toContain('entitySubscriptions');
            expect(extractConflictBlocks(source)).toHaveLength(site.blocks);
        });

        it(`${site.path} names planRestricted in every conflict set`, () => {
            const offenders = extractConflictBlocks(source).filter(
                (block) => !stripComments(block).includes('planRestricted')
            );

            expect(
                offenders,
                `${site.path}: an onConflictDoUpdate on entity_subscriptions omits planRestricted. ` +
                    'Re-pointing the row at another subscription carries the previous one’s ' +
                    'restriction over to it, and the listing stays PRIVATE with no log.'
            ).toEqual([]);
        });
    }
});
