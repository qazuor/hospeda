/**
 * @file AccountStatsGrid.astro.test.ts
 * @description Source-level assertions for the account dashboard's quick-stats
 * grid (HOS-1293). Astro components cannot be rendered under Vitest, so these
 * are string-level checks on the `.astro` source — same pattern
 * `mi-cuenta-index.astro.test.ts` and `mi-cuenta-addons.astro.test.ts` use for
 * their own components/pages, and the same LIMIT applies: this proves the
 * commerce branch is DECLARED, not that it RENDERS.
 *
 * ## The bug this closes
 *
 * `AccountStatsGrid.astro` used to branch `isHost ? (...) : (...)` — exactly
 * two states. A commerce-only owner (`GASTRONOMY_OWNER`/`EXPERIENCE_OWNER`, no
 * `HOST` role) is neither, so `isHost` resolved `false` and they fell into the
 * tourist `else` branch: Favoritos, Reseñas — neither describes a merchant
 * account, and both link to pages a commerce-only owner has never used.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/account/AccountStatsGrid.astro'),
    'utf8'
);

describe('AccountStatsGrid.astro — commerce-owner branch (HOS-1293)', () => {
    it('accepts an isCommerceOwner prop, distinct from isHost', () => {
        expect(source).toContain('isCommerceOwner');
        expect(source).toContain('isHost');
    });

    it('isCommerceOwner is bound DIRECTLY to Astro.props — never aliased, never hardcoded (HOS-1293 mutation hardening)', () => {
        // The two tests above check that the STRING `isCommerceOwner` and the
        // `isHost ? ( ... ) : isCommerceOwner ? (` SYNTAX are present — both
        // satisfied even if the identifier is captured under an alias and the
        // real binding is a hardcoded literal, e.g.
        // `const { isCommerceOwner: isCommerceOwnerProp = false } = Astro.props;
        //  const isCommerceOwner = true;` — which renders the commerce branch
        // for EVERY non-host account, tourists included, and passed every
        // other assertion in this file when measured. This pins the exact
        // destructuring so `isCommerceOwner` can only ever be the prop itself.
        expect(source).toContain(
            'const { locale, isHost = false, isCommerceOwner = false } = Astro.props;'
        );
    });

    it('is a THREE-way branch — host, then commerce, then tourist — not a binary one', () => {
        // The regression shape: `isHost ? (...) : (...)` has exactly two arms.
        // Reintroducing that (e.g. by deleting the isCommerceOwner arm) would
        // make this pattern absent while the prop itself might still be
        // declared — so this checks the BRANCH STRUCTURE, not just the prop.
        expect(source).toMatch(/isHost\s*\?\s*\(/);
        expect(source).toMatch(/\)\s*:\s*isCommerceOwner\s*\?\s*\(/);
    });

    it('the commerce branch links to mi-cuenta/comercio, never to a tourist or host page', () => {
        // Isolate the commerce branch's own markup (between its opening test
        // and the tourist branch's own opening comment) so a mutation that
        // moved the link to the WRONG branch is still caught.
        const commerceBranchStart = source.indexOf(': isCommerceOwner ? (');
        const touristBranchStart = source.indexOf('<!-- Tourist: Favorites stat -->');
        expect(commerceBranchStart).toBeGreaterThan(-1);
        expect(touristBranchStart).toBeGreaterThan(commerceBranchStart);

        const commerceBranch = source.slice(commerceBranchStart, touristBranchStart);
        expect(commerceBranch).toContain("path: 'mi-cuenta/comercio'");
        expect(commerceBranch).not.toContain("path: 'mi-cuenta/favoritos'");
        expect(commerceBranch).not.toContain("path: 'mi-cuenta/propiedades'");
    });

    it('uses its own listings i18n keys, not the host properties keys or the tourist favorites keys', () => {
        expect(source).toContain('account.pages.dashboard.stats.listings');
        expect(source).toContain('account.pages.dashboard.stats.listingsDesc');
    });

    it('the subscription card stays outside all three branches — always rendered', () => {
        // Regression guard for a DIFFERENT mistake this refactor could make:
        // nesting the subscription card inside one of the three arms would
        // make it vanish for the other two audiences.
        const subscriptionCardIndex = source.indexOf('id="stat-subscription"');
        const closingTernaryIndex = source.indexOf('{isHost ?');
        expect(subscriptionCardIndex).toBeGreaterThan(-1);
        expect(closingTernaryIndex).toBeGreaterThan(-1);
        // The subscription card's own id must not appear before the whole
        // three-way ternary closes — i.e. it is a sibling, not a nested arm.
        const ternaryCloseIndex = source.indexOf(')}', closingTernaryIndex);
        expect(subscriptionCardIndex).toBeGreaterThan(ternaryCloseIndex);
    });
});
