/**
 * Tests for the plan-category ranking SSOT (HOS-222) — CATEGORY_RANK,
 * compareCategoryRank, and resolvePlanCategory.
 *
 * These back the cross-category upgrade-vs-downgrade classifier in the
 * plan-change route: a move to a HIGHER-ranked category is an upgrade
 * regardless of price.
 */

import { describe, expect, it } from 'vitest';
import {
    CATEGORY_RANK,
    compareCategoryRank,
    type PlanCategory,
    resolvePlanCategory
} from '../../src/types/plan.types.js';

describe('CATEGORY_RANK', () => {
    it('orders tourist < owner < complex', () => {
        expect(CATEGORY_RANK.tourist).toBeLessThan(CATEGORY_RANK.owner);
        expect(CATEGORY_RANK.owner).toBeLessThan(CATEGORY_RANK.complex);
    });

    it('assigns a distinct rank to every category', () => {
        const ranks = Object.values(CATEGORY_RANK);
        expect(new Set(ranks).size).toBe(ranks.length);
    });
});

describe('compareCategoryRank', () => {
    it('returns a negative number when moving up a tier (tourist → owner)', () => {
        expect(compareCategoryRank('tourist', 'owner')).toBeLessThan(0);
        expect(compareCategoryRank('owner', 'complex')).toBeLessThan(0);
        expect(compareCategoryRank('tourist', 'complex')).toBeLessThan(0);
    });

    it('returns 0 for the same category', () => {
        const categories: PlanCategory[] = ['tourist', 'owner', 'complex'];
        for (const category of categories) {
            expect(compareCategoryRank(category, category)).toBe(0);
        }
    });

    it('returns a positive number when moving down a tier (complex → owner)', () => {
        expect(compareCategoryRank('owner', 'tourist')).toBeGreaterThan(0);
        expect(compareCategoryRank('complex', 'owner')).toBeGreaterThan(0);
        expect(compareCategoryRank('complex', 'tourist')).toBeGreaterThan(0);
    });

    it('classifies the HOS-222 repro (tourist-vip → owner-basico) as a rank-UP', () => {
        // tourist-vip is category 'tourist', owner-basico is category 'owner'.
        expect(compareCategoryRank('tourist', 'owner')).toBeLessThan(0);
    });
});

describe('resolvePlanCategory', () => {
    it('resolves each valid category off metadata.category', () => {
        expect(resolvePlanCategory({ category: 'owner' })).toBe('owner');
        expect(resolvePlanCategory({ category: 'complex' })).toBe('complex');
        expect(resolvePlanCategory({ category: 'tourist' })).toBe('tourist');
    });

    it('ignores unrelated metadata keys', () => {
        expect(resolvePlanCategory({ category: 'owner', displayName: 'Basic' })).toBe('owner');
    });

    it('returns undefined when the category is missing', () => {
        expect(resolvePlanCategory({ displayName: 'Basic' })).toBeUndefined();
    });

    it('returns undefined for an unknown category value', () => {
        expect(resolvePlanCategory({ category: 'enterprise' })).toBeUndefined();
        expect(resolvePlanCategory({ category: 42 })).toBeUndefined();
    });

    it('returns undefined for non-object metadata (null/undefined/string/number)', () => {
        expect(resolvePlanCategory(null)).toBeUndefined();
        expect(resolvePlanCategory(undefined)).toBeUndefined();
        expect(resolvePlanCategory('tourist')).toBeUndefined();
        expect(resolvePlanCategory(7)).toBeUndefined();
    });
});
