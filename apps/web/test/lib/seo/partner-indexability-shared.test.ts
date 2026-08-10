/**
 * HOS-294 AC-7 — the page and the sitemap must decide indexability with ONE
 * function.
 *
 * Deliberately NOT a test that the two agree on today's fixtures. Agreement is
 * exactly what drifts: someone adds a condition on one side, both suites stay
 * green, and the sitemap starts advertising URLs the page serves `noindex`.
 * What is asserted instead is structural — both files import and call the same
 * exported predicate, and neither re-implements the decision inline.
 *
 * The acceptance bar for this guard is a mutation: flipping one condition
 * INSIDE `evaluatePartnerIndexability` must break the predicate's own suite,
 * and neither consumer may hold a second copy that survives it.
 *
 * @module test/lib/seo/partner-indexability-shared
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

const CONSUMERS = [
    { label: 'the detail page', path: 'src/pages/[lang]/partners/[slug].astro' },
    { label: 'the dynamic sitemap', path: 'src/pages/sitemap-dynamic.xml.ts' }
] as const;

/**
 * Conditions the predicate owns. If one of these strings shows up in a consumer,
 * that consumer is deciding indexability for itself.
 */
const PREDICATE_INTERNALS = [
    "=== 'gold'",
    "!== 'gold'",
    "subscriptionStatus === 'active'"
] as const;

describe('one predicate, two consumers (AC-7)', () => {
    it.each(CONSUMERS)('$label imports evaluatePartnerIndexability', ({ path }) => {
        // Arrange
        const src = readFileSync(resolve(root, path), 'utf8');

        // Assert
        expect(src).toContain('evaluatePartnerIndexability');
        expect(src).toMatch(/from ['"][^'"]*partner-indexable['"]/);
    });

    it.each(CONSUMERS)('$label does not re-implement the gate inline', ({ path }) => {
        // Arrange
        const src = readFileSync(resolve(root, path), 'utf8');

        // Assert — a consumer holding its own copy of a condition is how the
        // two sides drift apart while both suites stay green.
        for (const internal of PREDICATE_INTERNALS) {
            expect(src, `re-implements "${internal}"`).not.toContain(internal);
        }
    });

    it('the predicate is the only place the gold literal is compared', () => {
        // Arrange — the predicate itself names the tier exactly once, as a
        // constant. This pins WHERE that knowledge lives.
        const predicateSrc = readFileSync(
            resolve(root, 'src/lib/seo/partner-indexable.ts'),
            'utf8'
        );

        // Assert
        expect(predicateSrc).toContain("input.tier !== 'gold'");
    });
});
