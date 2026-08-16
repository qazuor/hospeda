/**
 * Static guard: the two endpoints that tell a user WHICH PLAN THEY HAVE must
 * resolve the subscription through the canonical entitlement-granting status
 * set, never a hand-written `active || trialing` pair (H-70 / H-130).
 *
 * Both panels asked for that pair directly, so a `comp` subscription matched
 * neither and the endpoints answered `plan: null` — which the frontend renders
 * as the free-tier label. An owner on a comped paid plan read "Plan Gratuito".
 *
 * `ENTITLEMENT_GRANTING_STATUSES` / `isEntitlementGrantingStatus` were created
 * in HOS-239 for exactly this drift, and these two call sites were never
 * migrated onto them. This guard is what makes the third occurrence fail loudly
 * instead of silently.
 *
 * ## What this guard does and does NOT claim
 *
 * It covers exactly the two plan-DISPLAY endpoints named below. It is NOT a
 * repo-wide ban on the literal pair: a sweep finds it in ~28 files, most of
 * them comments or filters that exclude `comp` for good reason (you cannot
 * cancel, pause or change the plan of a subscription that has no preapproval).
 * A textual guard over that surface would need a large allowlist, would go
 * stale, and would end up disabled — so the scope is deliberately narrow and
 * the message says only what the predicate proves.
 *
 * @module test/routes/plan-display-uses-canonical-status-set
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const API_SRC = path.resolve(__dirname, '../../src');

/**
 * The endpoints whose entire job is reporting the user's current plan.
 * Each must reference the canonical helper by one of its two exported names.
 */
const PLAN_DISPLAY_FILES = [
    'routes/user/protected/stats.ts',
    'routes/host/protected/dashboard.ts'
] as const;

/** Either canonical name satisfies the rule — the set or the predicate. */
const CANONICAL_REFERENCE = /ENTITLEMENT_GRANTING_STATUSES|isEntitlementGrantingStatus/;

/**
 * The hand-rolled pair, anchored to a status comparison so an unrelated
 * mention of the two words in prose does not trip the guard. Both operand
 * orders are matched: renaming is a different mutation from deleting, and a
 * guard that only catches one of them is half a guard.
 */
const HAND_ROLLED_PAIR = [
    /status\s*===\s*'active'\s*\|\|\s*[\w.]*status\s*===\s*'trialing'/,
    /status\s*===\s*'trialing'\s*\|\|\s*[\w.]*status\s*===\s*'active'/,
    /eq\([\w.]*status,\s*'active'\)[\s\S]{0,80}?eq\([\w.]*status,\s*'trialing'\)/
];

/**
 * Removes block and whole-line comments so both assertions below judge the
 * EXECUTABLE text only.
 *
 * Stripping is safe in both directions here: if it ever ate real code, the
 * positive assertion would stop finding the canonical reference and this guard
 * would fail — never pass by accident.
 *
 * @param source - Raw file contents.
 * @returns The same source with comments blanked out.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('plan-display endpoints resolve the plan via the canonical status set (H-70 / H-130)', () => {
    it('every guarded file exists (a renamed file must not silently empty this scope)', () => {
        // Arrange & Act
        const missing = PLAN_DISPLAY_FILES.filter((rel) => !fs.existsSync(path.join(API_SRC, rel)));
        // Assert
        expect(missing).toEqual([]);
    });

    for (const rel of PLAN_DISPLAY_FILES) {
        it(`${rel} references the canonical entitlement-granting status set in CODE`, () => {
            // Arrange — comments must be stripped for this check too, not just
            // for the negative one below. Both fixes carry a JSDoc block that
            // names the canonical helper, so reading the raw file would let a
            // reverted file pass on its own leftover prose. Verified by
            // mutation: with the fix reverted but the comment left in place,
            // the un-stripped version of this assertion still passed.
            const source = stripComments(fs.readFileSync(path.join(API_SRC, rel), 'utf-8'));
            // Act
            const referencesCanonical = CANONICAL_REFERENCE.test(source);
            // Assert
            expect(referencesCanonical).toBe(true);
        });

        it(`${rel} does not hand-roll the active-or-trialing pair`, () => {
            // Arrange
            const source = stripComments(fs.readFileSync(path.join(API_SRC, rel), 'utf-8'));
            // Act
            const offending = HAND_ROLLED_PAIR.filter((re) => re.test(source));
            // Assert
            expect(offending.map(String)).toEqual([]);
        });
    }
});
