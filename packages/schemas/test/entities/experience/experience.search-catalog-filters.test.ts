import { describe, expect, it } from 'vitest';
import {
    ExperiencePublicFilterOptionsQuerySchema,
    ExperienceSearchHttpSchema,
    httpToDomainExperienceSearch
} from '../../../src/entities/experience/index.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('ExperienceSearchHttpSchema amenities and features (HOS-2085)', () => {
    it.each(['amenities', 'features'] as const)('splits a comma-separated %s list', (key) => {
        const parsed = ExperienceSearchHttpSchema.parse({ [key]: `${A}, ${B}` });
        expect(parsed[key]).toEqual([A, B]);
    });

    it.each(['amenities', 'features'] as const)('accepts a repeated-param array for %s', (key) => {
        const parsed = ExperienceSearchHttpSchema.parse({ [key]: [A, B] });
        expect(parsed[key]).toEqual([A, B]);
    });

    it.each(['amenities', 'features'] as const)('rejects a non-UUID in %s', (key) => {
        expect(ExperienceSearchHttpSchema.safeParse({ [key]: 'nope' }).success).toBe(false);
    });

    it('maps both filters onto the domain search input', () => {
        const http = ExperienceSearchHttpSchema.parse({ amenities: A, features: B });
        const domain = httpToDomainExperienceSearch(http);
        expect(domain.amenities).toEqual([A]);
        expect(domain.features).toEqual([B]);
    });
});

describe('ExperiencePublicFilterOptionsQuerySchema', () => {
    it('accepts no params and rejects strays', () => {
        expect(ExperiencePublicFilterOptionsQuerySchema.safeParse({}).success).toBe(true);
        expect(ExperiencePublicFilterOptionsQuerySchema.safeParse({ x: '1' }).success).toBe(false);
    });
});
