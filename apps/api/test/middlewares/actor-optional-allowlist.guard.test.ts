/**
 * HOS-1141 — the actor-optional allowlist is FROZEN.
 *
 * ## Why a guard and not more behaviour tests
 *
 * `ACTOR_OPTIONAL_PATH_PATTERNS` turns off `actorMiddleware`'s fail-loud
 * identity policy (HOS-296) for the paths it matches. A behaviour test can only
 * assert the paths it happens to name, so a SECOND entry is invisible to the
 * entire suite. Measured, by planting one entry:
 *
 * ```
 * const ACTOR_OPTIONAL_PATH_PATTERNS: readonly RegExp[] = [
 *     /^\/api\/v1\/public\/qr\/[^/]+\/?$/,
 *     /^\/api\/v1\/admin\/.*$/          // <-- planted
 * ];
 *
 * vitest run test/routes/qr-code/resolve-actor-degradation.test.ts test/middlewares
 * → EXIT 0 · 56 files · 2679 tests · ALL GREEN
 * ```
 *
 * That entry hands the fail-open to every admin route in the product and
 * nothing said a word. This is the textbook case for a guard rather than N
 * tests: what has to be pinned is the CONTENT of the array — its length and its
 * literal pattern — not the behaviour of one member.
 *
 * ## Why it imports the value instead of grepping the source
 *
 * A source-scanning guard anchored on the constant's NAME dies silently the day
 * somebody renames it: the regex stops matching, it finds nothing to check, and
 * it passes. An import cannot fail that way — a rename breaks the import and
 * this file goes red immediately, loudly, naming the symbol. The parse floor
 * below (`length > 0`) closes the remaining hole, where an import that resolved
 * to `undefined` or `[]` would make every assertion vacuous.
 *
 * ## Changing this deliberately
 *
 * Adding a path is a claim that a signed-out and a signed-in caller get the
 * SAME response there. If that is genuinely true, update `EXPECTED` below in
 * the same commit as the middleware — the point is that it cannot happen
 * without a reviewer seeing this file in the diff.
 */

import { describe, expect, it } from 'vitest';
import { ACTOR_OPTIONAL_PATH_PATTERNS } from '../../src/middlewares/actor';

/**
 * The allowlist, frozen literally.
 *
 * `source` is compared as a string rather than the `RegExp` being compared by
 * identity, so ANY edit to the pattern — widening `[^/]+` to `.*`, dropping an
 * anchor, adding a flag — shows up as a diff on this constant.
 */
const EXPECTED: ReadonlyArray<{ readonly source: string; readonly flags: string }> = [
    { source: '^\\/api\\/v1\\/public\\/qr\\/[^/]+\\/?$', flags: '' }
];

describe('ACTOR_OPTIONAL_PATH_PATTERNS is frozen', () => {
    it('is a non-empty array (parse floor)', () => {
        // Without this, an import resolving to undefined or [] would make every
        // assertion below vacuously true — the exact shape of a guard that has
        // quietly stopped guarding.
        expect(Array.isArray(ACTOR_OPTIONAL_PATH_PATTERNS)).toBe(true);
        expect(ACTOR_OPTIONAL_PATH_PATTERNS.length).toBeGreaterThan(0);
    });

    it('holds EXACTLY the expected number of entries', () => {
        // Direction 1: an entry ADDED. This is the assertion the planted admin
        // pattern trips.
        expect(ACTOR_OPTIONAL_PATH_PATTERNS).toHaveLength(EXPECTED.length);
    });

    it('holds exactly the expected patterns, literally', () => {
        // Direction 2: an entry REMOVED or MODIFIED. Whole-array equality on
        // `source` + `flags`, so a widened or unanchored pattern is a failure
        // here even though the length is unchanged.
        expect(
            ACTOR_OPTIONAL_PATH_PATTERNS.map((pattern) => ({
                source: pattern.source,
                flags: pattern.flags
            }))
        ).toEqual(EXPECTED);
    });

    it('does not match any admin or protected path', () => {
        // The semantic half. A future pattern could satisfy neither of the
        // literal assertions' spirit while still being spelled differently from
        // what is frozen — so this states the actual invariant in terms of the
        // routes that must never inherit the fail-open.
        const mustNeverDegrade = [
            '/api/v1/admin/qr-codes',
            '/api/v1/admin/qr-codes/11111111-1111-4111-8111-111111111111',
            '/api/v1/admin/accommodations',
            '/api/v1/admin/users',
            '/api/v1/protected/accommodations',
            '/api/v1/protected/host-trades/mine',
            '/api/v1/public/auth/me'
        ];

        for (const path of mustNeverDegrade) {
            expect(
                ACTOR_OPTIONAL_PATH_PATTERNS.some((pattern) => pattern.test(path)),
                `${path} must NOT be actor-optional`
            ).toBe(false);
        }
    });

    it('still matches the one path it exists for', () => {
        // Non-vacuity for the block above: an empty or never-matching allowlist
        // would satisfy every "must not match" assertion trivially.
        expect(
            ACTOR_OPTIONAL_PATH_PATTERNS.some((pattern) =>
                pattern.test('/api/v1/public/qr/Live2345')
            )
        ).toBe(true);
    });
});
