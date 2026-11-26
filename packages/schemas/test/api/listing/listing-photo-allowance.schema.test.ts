import { describe, expect, it } from 'vitest';
import { ListingPhotoAllowanceSchema, UNLIMITED_LIMIT_VALUE } from '../../../src/index.js';

describe('ListingPhotoAllowanceSchema', () => {
    const limited = {
        limitKey: 'max_photos_per_venue',
        status: 'LIMITED',
        cap: 50,
        source: 'EFFECTIVE_SET',
        used: 53,
        hiddenCount: 2,
        coverAllowed: true,
        breakdown: {
            contributions: [
                { kind: 'PLAN', value: 30, sources: 1 },
                { kind: 'ADDON', value: 20, sources: 1 }
            ]
        }
    };

    it.each([
        limited,
        {
            limitKey: 'max_photos_per_experience',
            status: 'LIMITED',
            cap: 1,
            source: 'PRE_TRIAL_DRAFT',
            used: 0,
            hiddenCount: 0,
            coverAllowed: true,
            breakdown: { contributions: [{ kind: 'PRE_TRIAL_DRAFT', value: 1, sources: 1 }] }
        },
        {
            limitKey: 'max_photos_per_accommodation',
            status: 'UNLIMITED',
            cap: null,
            source: 'EFFECTIVE_SET',
            used: 75,
            hiddenCount: 0,
            coverAllowed: true,
            breakdown: {
                contributions: [{ kind: 'PERMANENT_GRANT', value: 'unlimited', sources: 1 }]
            }
        },
        {
            limitKey: 'max_photos_per_experience',
            status: 'NONE',
            cap: 0,
            source: 'EFFECTIVE_SET',
            used: 4,
            hiddenCount: 3,
            coverAllowed: false,
            breakdown: null
        }
    ])('accepts $status from $source', (payload) => {
        const result = ListingPhotoAllowanceSchema.safeParse(payload);

        expect(result).toStrictEqual({ success: true, data: payload });
    });

    it.each([
        ['NONE', 1],
        ['NONE', null],
        ['UNLIMITED', 50],
        ['UNLIMITED', UNLIMITED_LIMIT_VALUE],
        ['LIMITED', null],
        ['LIMITED', 0],
        ['LIMITED', -1],
        ['LIMITED', 1.5],
        ['LIMITED', Infinity],
        ['LIMITED', UNLIMITED_LIMIT_VALUE],
        ['LIMITED', UNLIMITED_LIMIT_VALUE + 1]
    ])('rejects %s with cap %s', (status, cap) => {
        const payload = { ...limited, status, cap };

        const result = ListingPhotoAllowanceSchema.safeParse(payload);

        expect(result.error?.issues.map(({ path }) => path)).toStrictEqual([['cap']]);
    });

    it.each([
        { overrides: { status: 'LIMIT' }, path: ['status'] },
        { overrides: { limitKey: 'max_venues' }, path: ['limitKey'] },
        { overrides: { source: 'TRIAL' }, path: ['source'] },
        { overrides: { used: -1 }, path: ['used'] },
        { overrides: { hiddenCount: 1.5 }, path: ['hiddenCount'] },
        { overrides: { coverAllowed: 'yes' }, path: ['coverAllowed'] },
        { overrides: { breakdown: undefined }, path: ['breakdown'] },
        {
            overrides: {
                breakdown: { contributions: [{ kind: 'UNKNOWN', value: 30, sources: 1 }] }
            },
            path: ['breakdown', 'contributions', 0, 'kind']
        },
        {
            overrides: {
                breakdown: { contributions: [{ kind: 'PLAN', value: '30', sources: 1 }] }
            },
            path: ['breakdown', 'contributions', 0, 'value']
        },
        {
            overrides: { breakdown: { contributions: [{ kind: 'PLAN', value: 30, sources: 0 }] } },
            path: ['breakdown', 'contributions', 0, 'sources']
        }
    ])('rejects an invalid value at $path', ({ overrides, path }) => {
        const payload = { ...limited, ...overrides };

        const result = ListingPhotoAllowanceSchema.safeParse(payload);

        expect(result.error?.issues.map((issue) => issue.path)).toStrictEqual([path]);
    });
});
