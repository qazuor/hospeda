/**
 * @file plan-watermark-icon.test.ts
 * @description Executes the plan → corner-glyph mapping.
 *
 * The value of this suite is almost entirely the FALLBACK. The card renders the
 * resolved component unconditionally, so a slug the table has never heard of
 * must still produce one: `undefined` would render `<undefined />` and take down
 * an otherwise healthy pricing page. And the catalogue is editable from admin —
 * a new tier is an ordinary Tuesday, not an exceptional case.
 */

import { describe, expect, it } from 'vitest';
import {
    PLAN_WATERMARK_FALLBACK_ICON,
    PLAN_WATERMARK_ICONS,
    resolvePlanWatermarkIcon
} from '@/components/billing/plan-watermark-icon';

describe('resolvePlanWatermarkIcon', () => {
    it('maps every slug the table declares to that slug’s own glyph', () => {
        for (const [slug, icon] of Object.entries(PLAN_WATERMARK_ICONS)) {
            expect(resolvePlanWatermarkIcon({ slug }), slug).toBe(icon);
        }
    });

    it('falls back for a slug the table has never seen', () => {
        // The case that matters: an operator adds a tier in admin and this file
        // is not redeployed. The card must still render.
        expect(resolvePlanWatermarkIcon({ slug: 'owner-enterprise-2027' })).toBe(
            PLAN_WATERMARK_FALLBACK_ICON
        );
    });

    it('falls back for an empty slug rather than returning nothing', () => {
        expect(resolvePlanWatermarkIcon({ slug: '' })).toBe(PLAN_WATERMARK_FALLBACK_ICON);
    });

    it('never returns undefined, for any input', () => {
        // Total by construction. `<undefined />` is an Astro render error, and
        // it would take the whole pricing page down over decoration.
        for (const slug of ['owner-basico', 'nope', '', '__proto__', 'toString']) {
            expect(resolvePlanWatermarkIcon({ slug }), slug).toBeDefined();
        }
    });

    it('covers both audiences and every tier currently sold', () => {
        // Not a restatement of the table: these five slugs are what the public
        // catalogue actually returns today, so a rename that leaves the table
        // behind shows up here as a silent fallback rather than never at all.
        for (const slug of [
            'owner-basico',
            'owner-pro',
            'owner-premium',
            'tourist-free',
            'tourist-vip'
        ]) {
            expect(resolvePlanWatermarkIcon({ slug }), slug).not.toBe(PLAN_WATERMARK_FALLBACK_ICON);
        }
    });

    it('gives the tiers of one audience DIFFERENT glyphs — the progression is the point', () => {
        const owner = ['owner-basico', 'owner-pro', 'owner-premium'].map((slug) =>
            resolvePlanWatermarkIcon({ slug })
        );
        const tourist = ['tourist-free', 'tourist-vip'].map((slug) =>
            resolvePlanWatermarkIcon({ slug })
        );

        expect(new Set(owner).size).toBe(owner.length);
        expect(new Set(tourist).size).toBe(tourist.length);
    });
});
