/**
 * `parseCommercePlanSlugMap` — the boot-time gate on the commerce plan
 * configuration (HOS-688 AC-35).
 *
 * This parser is what `env.ts`'s `.superRefine` runs at startup, and the reason
 * it is strict is stated in the spec: the old `HOSPEDA_COMMERCE_PLAN_ID` was
 * registered but never Zod-validated, so a missing or mistyped value did not
 * fail the deploy — it surfaced as a 503 the first time somebody tried to pay.
 *
 * Every rejection below is therefore a container that refuses to start rather
 * than a customer who gets refused. The cases that matter most are the ones
 * that are *nearly* right: a mapping covering one vertical, or naming a
 * vertical with a typo. Both would leave one vertical selling and the other
 * dead, with every page on the site rendering perfectly.
 *
 * @module test/utils/commerce-plan-config
 */
import { describe, expect, it } from 'vitest';
import { parseCommercePlanSlugMap } from '../../src/utils/commerce-plan-config';

describe('parseCommercePlanSlugMap (HOS-688 AC-35)', () => {
    it('accepts a complete mapping', () => {
        const result = parseCommercePlanSlugMap(
            'gastronomy:gastronomy-premium,experience:experience-premium'
        );

        expect(result).toEqual({
            ok: true,
            map: { gastronomy: 'gastronomy-premium', experience: 'experience-premium' }
        });
    });

    it('tolerates surrounding whitespace, which operators paste in', () => {
        const result = parseCommercePlanSlugMap(
            ' gastronomy : gastronomy-premium , experience : experience-premium '
        );

        expect(result.ok).toBe(true);
    });

    it('rejects a mapping missing a vertical, naming the one that is missing', () => {
        // The half-set failure this single variable exists to make impossible.
        const result = parseCommercePlanSlugMap('gastronomy:gastronomy-premium');

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toContain('experience');
    });

    it('rejects an unknown vertical rather than ignoring it', () => {
        // A typo that silently drops one half of the mapping is exactly the
        // shape of the bug this catches at boot.
        const result = parseCommercePlanSlugMap(
            'gastronmy:gastronomy-premium,experience:experience-premium'
        );

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toContain('unknown vertical');
    });

    it('rejects an entry that is not a vertical:slug pair', () => {
        const result = parseCommercePlanSlugMap('gastronomy=gastronomy-premium');

        expect(result.ok).toBe(false);
    });

    it('rejects a slug that is not slug-shaped', () => {
        const result = parseCommercePlanSlugMap(
            'gastronomy:Gastronomy Premium,experience:experience-premium'
        );

        expect(result.ok).toBe(false);
    });

    it('rejects a duplicated vertical instead of letting the last one win', () => {
        const result = parseCommercePlanSlugMap(
            'gastronomy:a-plan,gastronomy:b-plan,experience:experience-premium'
        );

        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toContain('more than once');
    });

    it('reports empty and undefined as unconfigured', () => {
        expect(parseCommercePlanSlugMap(undefined).ok).toBe(false);
        expect(parseCommercePlanSlugMap('   ').ok).toBe(false);
    });
});
