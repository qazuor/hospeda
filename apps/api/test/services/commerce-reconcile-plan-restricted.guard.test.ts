/**
 * Static guard: the commerce reconcile driver must SELECT
 * `entity_subscriptions.plan_restricted` (HOS-1122).
 *
 * ## Why a source guard and not a behavioural test
 *
 * `commerce-reconcile.test.ts` next door asserts that the flag reaches
 * `reconcileCommerceListingVisibility`, and it does — but it cannot notice the
 * column disappearing from the query. That suite replaces `@repo/db` wholesale
 * with a fake whose `select()` ignores its projection and returns the fixture
 * rows verbatim, so removing `planRestricted: entitySubscriptions.planRestricted`
 * from the SELECT leaves all thirteen of its tests green. Measured, not
 * assumed: the mutation was applied and the suite passed.
 *
 * In production that deletion is silent in a worse way. Drizzle simply omits
 * the field; `link.planRestricted` becomes `undefined`; the reconciler's own
 * parameter defaults it to `false` — the permissive value — and every listing a
 * commerce downgrade restricted is republished by the next renewal webhook.
 * No error, no log, and the owner's cut listings quietly come back.
 *
 * So the projection gets the only kind of check that can see it.
 *
 * ## What this guard deliberately does NOT do
 *
 * It does not assert a function name, and it does not assert the shape of the
 * `where`. A rename or a refactor of the surrounding code must not fail it —
 * only the disappearance of the column from a read of this table. The predicate
 * and the message say exactly that and nothing more.
 *
 * @module test/services/commerce-reconcile-plan-restricted.guard
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = join(__dirname, '..', '..', 'src', 'services', 'commerce-reconcile.service.ts');

describe('commerce-reconcile SELECT carries plan_restricted (HOS-1122)', () => {
    const source = readFileSync(SOURCE_PATH, 'utf8');

    it('reads the file it claims to guard', () => {
        // Without this, a moved or renamed module turns the guard below into a
        // vacuous assertion over an empty string that can never fail.
        expect(source.length).toBeGreaterThan(0);
        expect(source).toContain('entitySubscriptions');
    });

    it('projects entitySubscriptions.planRestricted in the link-row read', () => {
        // Anchored on the projection PAIR, not on the bare word: `planRestricted`
        // alone also appears in the `CommerceLink` interface and in the call
        // that forwards it, so matching that would stay green with the column
        // gone from the query.
        expect(source).toMatch(/planRestricted:\s*entitySubscriptions\.planRestricted/);
    });

    it('forwards it into the visibility reconciler call', () => {
        expect(source).toMatch(/planRestricted:\s*link\.planRestricted/);
    });
});
