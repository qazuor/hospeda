import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { applyDynamicBlockDefaults } from '../../../src/entities/newsletter/index.js';
import {
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    NewsletterIfBelowMinEnum
} from '../../../src/enums/index.js';

const config = {
    blockKey: 'newest-01',
    entityType: NewsletterDynamicEntityTypeEnum.ACCOMMODATION,
    source: NewsletterDynamicSourceEnum.NEWEST,
    count: 4
};

describe('applyDynamicBlockDefaults', () => {
    it.each([
        [NewsletterDynamicSourceEnum.NEWEST, 0, false, {}],
        [NewsletterDynamicSourceEnum.MOST_VIEWED, 2, true, { windowDays: 30 }],
        [NewsletterDynamicSourceEnum.TOP_RATED, 3, true, { minReviews: 3 }]
    ] as const)('applies %s source defaults', (source, excludeRecentEditions, fillWithRepeats, params) => {
        expect(
            applyDynamicBlockDefaults({ config: { ...config, source }, dynamicBlockCount: 1 })
        ).toEqual({
            ...config,
            source,
            excludeRecentEditions,
            fillWithRepeats,
            params,
            minItems: 1,
            ifBelowMin: 'skip_run'
        });
    });

    it('recalculates both automatic policies when adding a second block (AC-F1-2)', () => {
        const first = applyDynamicBlockDefaults({ config, dynamicBlockCount: 1 });
        const blocks = [first, { ...config, blockKey: 'newest-02' }].map((block) =>
            applyDynamicBlockDefaults({ config: block, dynamicBlockCount: 2 })
        );
        expect(blocks.map((block) => block.ifBelowMin)).toEqual(['hide_block', 'hide_block']);
        expect(first.ifBelowMin).toBe('skip_run');
        expect(
            applyDynamicBlockDefaults({ config: blocks[0]!, dynamicBlockCount: 1 }).ifBelowMin
        ).toBe('skip_run');
    });

    it.each(
        Object.values(NewsletterIfBelowMinEnum)
    )('preserves manual %s when adding or removing blocks', (ifBelowMin) => {
        for (const dynamicBlockCount of [1, 2]) {
            expect(
                applyDynamicBlockDefaults({
                    config: { ...config, ifBelowMin },
                    dynamicBlockCount,
                    ifBelowMinManuallyChanged: true
                }).ifBelowMin
            ).toBe(ifBelowMin);
        }
    });

    it('preserves explicit zero, false, minimum and source parameters without mutation', () => {
        const custom = {
            ...config,
            source: NewsletterDynamicSourceEnum.MOST_VIEWED,
            excludeRecentEditions: 0,
            fillWithRepeats: false,
            minItems: 3,
            params: { windowDays: 7, destinationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' }
        };
        const original = structuredClone(custom);
        expect(applyDynamicBlockDefaults({ config: custom, dynamicBlockCount: 1 })).toMatchObject(
            custom
        );
        expect(custom).toEqual(original);
    });

    it('preserves explicit minimum reviews', () => {
        expect(
            applyDynamicBlockDefaults({
                config: {
                    ...config,
                    source: NewsletterDynamicSourceEnum.TOP_RATED,
                    params: { minReviews: 10 }
                },
                dynamicBlockCount: 1
            }).params
        ).toEqual({ minReviews: 10 });
    });

    it.each([0, -1, 1.5])('rejects invalid document block count %s', (dynamicBlockCount) => {
        expect(() => applyDynamicBlockDefaults({ config, dynamicBlockCount })).toThrow(ZodError);
    });

    it('does not enable featured by defaulting its config', () => {
        expect(() =>
            applyDynamicBlockDefaults({
                config: { ...config, source: NewsletterDynamicSourceEnum.FEATURED },
                dynamicBlockCount: 1
            })
        ).toThrow('FEATURED_SOURCE_DISABLED');
    });
});
