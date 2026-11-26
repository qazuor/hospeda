import { describe, expect, it } from 'vitest';
import {
    ENABLED_DYNAMIC_ENTITY_TYPES,
    EntityTypeEnum,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    NewsletterIfBelowMinEnum
} from '../../src/enums/index.js';

describe('Dynamic newsletter enum contracts', () => {
    it('freezes the declared sources, including disabled featured', () => {
        expect(Object.values(NewsletterDynamicSourceEnum)).toEqual([
            'most_viewed',
            'newest',
            'top_rated',
            'featured'
        ]);
    });

    it('freezes below-minimum actions', () => {
        expect(Object.values(NewsletterIfBelowMinEnum)).toEqual([
            'skip_run',
            'hide_block',
            'send_anyway'
        ]);
    });

    it('freezes the six declared entity types', () => {
        expect(Object.values(NewsletterDynamicEntityTypeEnum)).toEqual([
            'ACCOMMODATION',
            'VENUE',
            'POST',
            'EVENT',
            'EXPERIENCE',
            'PARTNER'
        ]);
    });

    it.each(
        Object.values(NewsletterDynamicEntityTypeEnum)
    )('%s exists in EntityTypeEnum', (value) => {
        expect(Object.values(EntityTypeEnum)).toContain(value);
    });

    it('enables only accommodations, as a subset of declared entity types', () => {
        expect(ENABLED_DYNAMIC_ENTITY_TYPES).toEqual(['ACCOMMODATION']);
        for (const value of ENABLED_DYNAMIC_ENTITY_TYPES) {
            expect(Object.values(NewsletterDynamicEntityTypeEnum)).toContain(value);
        }
    });
});
