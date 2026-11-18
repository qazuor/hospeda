import { describe, expect, it } from 'vitest';
import {
    HostTradeCategoryCreateInputSchema,
    HostTradeCategoryGroupCreateInputSchema,
    HostTradeCategoryGroupUpdateInputSchema,
    HostTradeCategoryRefSchema,
    HostTradeCategorySchema,
    HostTradeCategoryUpdateInputSchema,
    PublicHostTradeCatalogSchema
} from '../../../src/entities/host-trade-category/index.js';

const NAME = { es: 'Plomería', en: 'Plumbing', pt: 'Encanamento' } as const;
const GROUP_ID = '11111111-1111-4111-8111-111111111111';

const validCategoryInput = {
    slug: 'destapaciones-desagotes',
    groupId: GROUP_ID,
    nameI18n: NAME,
    keywordsI18n: { es: ['pozo ciego', 'cloaca'] },
    displayWeight: 10
};

describe('HostTradeCategoryCreateInputSchema', () => {
    it('accepts a valid category', () => {
        // Arrange / Act
        const result = HostTradeCategoryCreateInputSchema.safeParse(validCategoryInput);
        // Assert
        expect(result.success).toBe(true);
    });

    it('defaults keywordsI18n to an empty object', () => {
        const { keywordsI18n: _omit, ...input } = validCategoryInput;
        const result = HostTradeCategoryCreateInputSchema.parse(input);
        expect(result.keywordsI18n).toEqual({});
    });

    it.each([
        'Plomeria',
        'plomeria_',
        'plo meria',
        'plomería',
        '-plomeria',
        'ab'
    ])('rejects the non-kebab slug %s', (slug) => {
        const result = HostTradeCategoryCreateInputSchema.safeParse({
            ...validCategoryInput,
            slug
        });
        expect(result.success).toBe(false);
    });

    it('rejects a nameI18n with an empty es', () => {
        const result = HostTradeCategoryCreateInputSchema.safeParse({
            ...validCategoryInput,
            nameI18n: { ...NAME, es: '   ' }
        });
        expect(result.success).toBe(false);
    });

    it('rejects a missing groupId', () => {
        const { groupId: _omit, ...input } = validCategoryInput;
        expect(HostTradeCategoryCreateInputSchema.safeParse(input).success).toBe(false);
    });

    it('rejects more than 30 keywords for one locale', () => {
        const keywords = Array.from({ length: 31 }, (_, i) => `palabra${i}`);
        const result = HostTradeCategoryCreateInputSchema.safeParse({
            ...validCategoryInput,
            keywordsI18n: { es: keywords }
        });
        expect(result.success).toBe(false);
    });

    it('accepts exactly 30 keywords for one locale', () => {
        const keywords = Array.from({ length: 30 }, (_, i) => `palabra${i}`);
        const result = HostTradeCategoryCreateInputSchema.safeParse({
            ...validCategoryInput,
            keywordsI18n: { es: keywords }
        });
        expect(result.success).toBe(true);
    });

    it('rejects a keyword longer than 40 characters', () => {
        const result = HostTradeCategoryCreateInputSchema.safeParse({
            ...validCategoryInput,
            keywordsI18n: { es: ['a'.repeat(41)] }
        });
        expect(result.success).toBe(false);
    });

    it('rejects an uppercase keyword', () => {
        const result = HostTradeCategoryCreateInputSchema.safeParse({
            ...validCategoryInput,
            keywordsI18n: { es: ['Pozo'] }
        });
        expect(result.success).toBe(false);
    });

    it('rejects an unknown locale in keywordsI18n', () => {
        const result = HostTradeCategoryCreateInputSchema.safeParse({
            ...validCategoryInput,
            keywordsI18n: { fr: ['plomberie'] }
        });
        expect(result.success).toBe(false);
    });
});

describe('HostTradeCategoryUpdateInputSchema', () => {
    it('accepts a partial update without slug', () => {
        const result = HostTradeCategoryUpdateInputSchema.safeParse({ displayWeight: 20 });
        expect(result.success).toBe(true);
    });

    it('does not inject defaults on an empty update', () => {
        const result = HostTradeCategoryUpdateInputSchema.parse({});
        expect(result).toEqual({});
    });

    it('rejects a slug in the update (slugs are immutable, D8)', () => {
        const result = HostTradeCategoryUpdateInputSchema.safeParse({ slug: 'otro-slug' });
        expect(result.success).toBe(false);
    });
});

describe('HostTradeCategoryGroup CRUD schemas', () => {
    it('accepts a valid group', () => {
        const result = HostTradeCategoryGroupCreateInputSchema.safeParse({
            slug: 'instalaciones',
            nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalações' },
            displayWeight: 10
        });
        expect(result.success).toBe(true);
    });

    it('rejects a slug in the group update (D8)', () => {
        const result = HostTradeCategoryGroupUpdateInputSchema.safeParse({ slug: 'otro' });
        expect(result.success).toBe(false);
    });
});

describe('HostTradeCategorySchema', () => {
    it('exposes the lifecycle state', () => {
        expect(HostTradeCategorySchema.shape).toHaveProperty('lifecycleState');
    });
});

describe('HostTradeCategoryRefSchema', () => {
    it('parses the embedded reference shape', () => {
        const result = HostTradeCategoryRefSchema.safeParse({
            id: '22222222-2222-4222-8222-222222222222',
            slug: 'plomeria',
            nameI18n: NAME,
            groupSlug: 'instalaciones'
        });
        expect(result.success).toBe(true);
    });
});

describe('PublicHostTradeCatalogSchema', () => {
    it('parses a nested catalog sample', () => {
        const result = PublicHostTradeCatalogSchema.safeParse({
            groups: [
                {
                    slug: 'instalaciones',
                    nameI18n: { es: 'Instalaciones', en: 'Installations', pt: 'Instalações' },
                    displayWeight: 10,
                    categories: [
                        {
                            id: '22222222-2222-4222-8222-222222222222',
                            slug: 'plomeria',
                            nameI18n: NAME,
                            keywordsI18n: { es: ['plomero'] },
                            displayWeight: 10
                        }
                    ]
                }
            ]
        });
        expect(result.success).toBe(true);
    });

    it('does not leak admin fields into public categories', () => {
        const parsed = PublicHostTradeCatalogSchema.parse({
            groups: [
                {
                    slug: 'exterior',
                    nameI18n: { es: 'Exterior', en: 'Outdoors', pt: 'Área externa' },
                    displayWeight: 40,
                    categories: [
                        {
                            id: '22222222-2222-4222-8222-222222222222',
                            slug: 'piletas',
                            nameI18n: { es: 'Piletas', en: 'Pools', pt: 'Piscinas' },
                            keywordsI18n: {},
                            displayWeight: 10,
                            adminInfo: { notes: 'secret' }
                        }
                    ]
                }
            ]
        });
        expect(parsed.groups[0]?.categories[0]).not.toHaveProperty('adminInfo');
    });
});
