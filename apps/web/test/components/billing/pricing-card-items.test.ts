/**
 * @file pricing-card-items.test.ts
 * @description Executes the rule that decides what a pricing card shows up
 * front and what it hides behind "ver todo lo que incluye".
 *
 * This is the half of the change that a source-reading guard cannot cover. The
 * component can be read to prove it renders a `<details>`; only running the
 * split can prove the summary is the RIGHT five lines, that the disclosure
 * disappears when there is nothing to disclose, and that nothing is dropped on
 * the way.
 */

import { describe, expect, it } from 'vitest';
import type {
    PricingCardFeatureItem,
    PricingCardLimitItem
} from '@/components/billing/pricing-card-items';
import {
    buildPricingCardItems,
    PRICING_CARD_VISIBLE_ITEMS
} from '@/components/billing/pricing-card-items';

/** N entitlement bullets, labelled `f0`… so order is checkable. */
function features(count: number): PricingCardFeatureItem[] {
    return Array.from({ length: count }, (_, i) => ({
        kind: 'feature' as const,
        id: `f${i}`,
        label: `feature ${i}`
    }));
}

/** N numeric caps, labelled `l0`… so order is checkable. */
function limits(count: number): PricingCardLimitItem[] {
    return Array.from({ length: count }, (_, i) => ({
        kind: 'limit' as const,
        id: `l${i}`,
        text: `limit ${i}: 10`,
        help: `what limit ${i} means`
    }));
}

describe('buildPricingCardItems', () => {
    it('shows exactly the first K items and hides the rest', () => {
        // Arrange: the live owner base tier — 14 caps and 8 bullets, 22 rows.
        const split = buildPricingCardItems({ features: features(8), limits: limits(14) });

        // Act / Assert
        expect(split.visible).toHaveLength(PRICING_CARD_VISIBLE_ITEMS);
        expect(split.hidden).toHaveLength(22 - PRICING_CARD_VISIBLE_ITEMS);
    });

    it('loses nothing: visible + hidden is every item, in canonical order', () => {
        const split = buildPricingCardItems({ features: features(3), limits: limits(6) });

        expect([...split.visible, ...split.hidden]).toEqual(split.all);
        expect(split.all).toHaveLength(9);
        expect(split.all.map((item) => item.id)).toEqual([
            'l0',
            'l1',
            'l2',
            'l3',
            'l4',
            'l5',
            'f0',
            'f1',
            'f2'
        ]);
    });

    it('fills the summary with the RANKED items first — caps before bullets', () => {
        // The whole point of the ordering rule: `LIMIT_DISPLAY_ORDER` is the only
        // ranking of card content that exists, so the visible slots go to the
        // items whose position means something. A card with six caps shows five
        // caps and no bullet.
        const split = buildPricingCardItems({ features: features(4), limits: limits(6) });

        expect(split.visible.map((item) => item.kind)).toEqual([
            'limit',
            'limit',
            'limit',
            'limit',
            'limit'
        ]);
        expect(split.hidden[0]?.id).toBe('l5');
    });

    it('falls back to bullets once the caps run out, without reordering either', () => {
        const split = buildPricingCardItems({ features: features(6), limits: limits(2) });

        expect(split.visible.map((item) => item.id)).toEqual(['l0', 'l1', 'f0', 'f1', 'f2']);
        expect(split.hidden.map((item) => item.id)).toEqual(['f3', 'f4', 'f5']);
    });

    it('hides nothing when the card has exactly K items — no "(0 más)" disclosure', () => {
        // The boundary that decides whether the disclosure renders at all.
        const split = buildPricingCardItems({ features: features(2), limits: limits(3) });

        expect(split.visible).toHaveLength(5);
        expect(split.hidden).toEqual([]);
    });

    it('hides nothing when the card has fewer than K items', () => {
        const split = buildPricingCardItems({ features: features(1), limits: limits(1) });

        expect(split.visible).toHaveLength(2);
        expect(split.hidden).toEqual([]);
    });

    it('survives a card with no items at all', () => {
        const split = buildPricingCardItems({ features: [], limits: [] });

        expect(split.all).toEqual([]);
        expect(split.visible).toEqual([]);
        expect(split.hidden).toEqual([]);
    });

    it('honours an explicit visibleCount', () => {
        const split = buildPricingCardItems({
            features: features(2),
            limits: limits(4),
            visibleCount: 2
        });

        expect(split.visible.map((item) => item.id)).toEqual(['l0', 'l1']);
        expect(split.hidden).toHaveLength(4);
    });

    it('treats a non-positive or non-finite visibleCount as the default', () => {
        // A card whose summary is empty and whose every line is buried is worse
        // than a long card, so a bad caller falls back rather than degrading.
        for (const visibleCount of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
            const split = buildPricingCardItems({
                features: features(2),
                limits: limits(6),
                visibleCount
            });
            expect(split.visible, `visibleCount=${String(visibleCount)}`).toHaveLength(
                PRICING_CARD_VISIBLE_ITEMS
            );
        }
    });

    it('keeps the owner-approved summary size at four to five lines', () => {
        // The constant is the contract with the owner ("4-5 líneas"); a silent
        // bump back to a full card would otherwise pass every test above.
        expect(PRICING_CARD_VISIBLE_ITEMS).toBeGreaterThanOrEqual(4);
        expect(PRICING_CARD_VISIBLE_ITEMS).toBeLessThanOrEqual(5);
    });
});
