import {
    DYNAMIC_SOURCES_BY_ENTITY_TYPE,
    ENABLED_DYNAMIC_ENTITY_TYPES,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    CARD_LOADERS,
    SOURCE_RESOLVERS
} from '../../../../src/services/newsletter/dynamic/registries.js';

describe('dynamic registry completeness', () => {
    it.each(
        Object.values(NewsletterDynamicEntityTypeEnum)
    )('declares source and card decisions for %s', (entity) => {
        expect(Object.hasOwn(SOURCE_RESOLVERS, entity)).toBe(true);
        expect(Object.hasOwn(CARD_LOADERS, entity)).toBe(true);
        if (ENABLED_DYNAMIC_ENTITY_TYPES.includes(entity)) {
            expect(Object.keys(SOURCE_RESOLVERS[entity]).length).toBeGreaterThan(0);
            expect(CARD_LOADERS[entity]).toBeTypeOf('function');
            expect(Object.keys(SOURCE_RESOLVERS[entity]).sort()).toEqual(
                DYNAMIC_SOURCES_BY_ENTITY_TYPE[entity]
                    .filter((source) => source !== NewsletterDynamicSourceEnum.FEATURED)
                    .sort()
            );
        } else {
            expect(SOURCE_RESOLVERS[entity]).toEqual({});
            expect(CARD_LOADERS[entity]).toBeNull();
        }
    });
});
