import { describe, expect, it } from 'vitest';
import {
    DYNAMIC_SOURCES_BY_ENTITY_TYPE,
    DynamicBlockConfigSchema
} from '../../../src/entities/newsletter/index.js';
import {
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum
} from '../../../src/enums/index.js';

const validConfig = {
    blockKey: 'newest-01',
    entityType: 'ACCOMMODATION',
    source: 'newest',
    count: 4,
    params: {},
    minItems: 1,
    ifBelowMin: 'skip_run',
    excludeRecentEditions: 0,
    fillWithRepeats: false
};

describe('DynamicBlockConfigSchema', () => {
    it('accepts the stored config of a newest block (AC-F1-1)', () => {
        expect(DynamicBlockConfigSchema.parse(validConfig)).toEqual(validConfig);
    });

    it.each(['most_viewed', 'newest', 'top_rated'])('accepts operational source %s', (source) => {
        expect(DynamicBlockConfigSchema.safeParse({ ...validConfig, source }).success).toBe(true);
    });

    it('rejects featured with its stable code and field path (AC-F1-3)', () => {
        const result = DynamicBlockConfigSchema.safeParse({ ...validConfig, source: 'featured' });
        expect(result.success).toBe(false);
        expect(result.error?.issues).toEqual([
            expect.objectContaining({
                code: 'custom',
                path: ['source'],
                message: 'FEATURED_SOURCE_DISABLED'
            })
        ]);
    });

    it.each([
        'VENUE',
        'POST',
        'EVENT',
        'EXPERIENCE',
        'PARTNER'
    ])('rejects disabled %s and its unsupported source', (entityType) => {
        const result = DynamicBlockConfigSchema.safeParse({
            ...validConfig,
            entityType,
            source: 'top_rated'
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues).toEqual([
            expect.objectContaining({
                code: 'custom',
                path: ['entityType'],
                message: 'ENTITY_TYPE_NOT_ENABLED'
            }),
            expect.objectContaining({
                code: 'custom',
                path: ['source'],
                message: 'SOURCE_NOT_SUPPORTED_FOR_ENTITY'
            })
        ]);
    });

    it('declares support for every entity, with only accommodations populated', () => {
        expect(Object.keys(DYNAMIC_SOURCES_BY_ENTITY_TYPE)).toEqual(
            Object.values(NewsletterDynamicEntityTypeEnum)
        );
        expect(DYNAMIC_SOURCES_BY_ENTITY_TYPE.ACCOMMODATION).toEqual(
            Object.values(NewsletterDynamicSourceEnum)
        );
        for (const entityType of Object.values(NewsletterDynamicEntityTypeEnum)) {
            if (entityType !== NewsletterDynamicEntityTypeEnum.ACCOMMODATION) {
                expect(DYNAMIC_SOURCES_BY_ENTITY_TYPE[entityType]).toEqual([]);
            }
        }
    });

    it.each([
        ['count', 1],
        ['count', 12],
        ['minItems', 1],
        ['minItems', 4],
        ['excludeRecentEditions', 0],
        ['excludeRecentEditions', 12]
    ])('accepts %s boundary %s', (field, value) => {
        expect(DynamicBlockConfigSchema.safeParse({ ...validConfig, [field]: value }).success).toBe(
            true
        );
    });

    it.each([
        ['count', 0],
        ['count', 13],
        ['count', 1.5],
        ['count', '4'],
        ['minItems', 0],
        ['minItems', 5],
        ['minItems', 1.5],
        ['excludeRecentEditions', -1],
        ['excludeRecentEditions', 13],
        ['excludeRecentEditions', 1.5],
        ['fillWithRepeats', 'false'],
        ['ifBelowMin', 'unknown'],
        ['entityType', 'USER'],
        ['source', 'unknown']
    ])('rejects invalid %s = %s', (field, value) => {
        expect(DynamicBlockConfigSchema.safeParse({ ...validConfig, [field]: value }).success).toBe(
            false
        );
    });

    it('reports minItems exceeding count at the minItems path', () => {
        const result = DynamicBlockConfigSchema.safeParse({ ...validConfig, minItems: 5 });
        expect(result.error?.issues).toContainEqual(
            expect.objectContaining({ code: 'custom', path: ['minItems'] })
        );
    });

    it.each([
        ['windowDays', 1],
        ['windowDays', 90],
        ['minReviews', 1],
        ['minReviews', 100],
        ['destinationId', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa']
    ])('accepts params.%s = %s', (field, value) => {
        expect(
            DynamicBlockConfigSchema.safeParse({ ...validConfig, params: { [field]: value } })
                .success
        ).toBe(true);
    });

    it.each([
        ['windowDays', 0],
        ['windowDays', 91],
        ['windowDays', 1.5],
        ['windowDays', '30'],
        ['minReviews', 0],
        ['minReviews', 101],
        ['minReviews', 1.5],
        ['destinationId', 'not-a-uuid'],
        ['unknownParam', 1]
    ])('rejects params.%s = %s', (field, value) => {
        expect(
            DynamicBlockConfigSchema.safeParse({ ...validConfig, params: { [field]: value } })
                .success
        ).toBe(false);
    });

    it.each([
        'a'.repeat(8),
        'a'.repeat(64),
        'block-01'
    ])('accepts valid blockKey %s', (blockKey) => {
        expect(DynamicBlockConfigSchema.safeParse({ ...validConfig, blockKey }).success).toBe(true);
    });

    it.each([
        'a'.repeat(7),
        'a'.repeat(65),
        'Block-01',
        'block_01',
        'block 01'
    ])('rejects invalid blockKey %s', (blockKey) => {
        expect(DynamicBlockConfigSchema.safeParse({ ...validConfig, blockKey }).success).toBe(
            false
        );
    });

    it.each(Object.keys(validConfig))('requires %s in persisted configs', (field) => {
        const incomplete = Object.fromEntries(
            Object.entries(validConfig).filter(([key]) => key !== field)
        );
        expect(DynamicBlockConfigSchema.safeParse(incomplete).success).toBe(false);
    });
});
