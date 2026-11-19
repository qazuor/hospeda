import { describe, expect, it } from 'vitest';
import { AllianceLeadSchema } from '../../../src/entities/alliance-lead/alliance-lead.schema.js';
import { adminSearchPartnerSchema } from '../../../src/entities/partner/partner.admin-search.schema.js';
import { searchPartnerSchema } from '../../../src/entities/partner/partner.query.schema.js';
import {
    PartnerTypeAdminListItemSchema,
    PartnerTypeAdminSearchSchema,
    PartnerTypeCreateInputSchema,
    PartnerTypeRefSchema,
    PartnerTypeSlugSchema,
    PartnerTypeUpdateInputSchema,
    PublicPartnerTypeListSchema
} from '../../../src/entities/partner-type/index.js';

const NAME = { es: 'Medio', en: 'Media outlet', pt: 'Meio de comunicação' };

describe('PartnerTypeSlugSchema (HOS-2336 AC-3.2)', () => {
    it.each(['media', 'ngo', 'radio-fm', 'a1'])('accepts %s', (slug) => {
        expect(PartnerTypeSlugSchema.safeParse(slug).success).toBe(true);
    });

    it.each([
        'Media',
        'media_outlet',
        '-media',
        'media-',
        'me dia',
        'a',
        'x'.repeat(31)
    ])('rejects %s', (slug) => {
        expect(PartnerTypeSlugSchema.safeParse(slug).success).toBe(false);
    });

    it('fits alliance_leads.partner_type varchar(30)', () => {
        expect(PartnerTypeSlugSchema.safeParse('x'.repeat(30)).success).toBe(true);
    });
});

describe('PartnerTypeCreateInputSchema', () => {
    it('accepts slug, nameI18n and weight, defaulting the lifecycle to ACTIVE', () => {
        // Act
        const result = PartnerTypeCreateInputSchema.safeParse({
            slug: 'media',
            nameI18n: NAME,
            displayWeight: 40
        });

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.lifecycleState).toBe('ACTIVE');
            expect(result.data.displayWeight).toBe(40);
        }
    });

    it('requires a non-blank Spanish name', () => {
        const result = PartnerTypeCreateInputSchema.safeParse({
            slug: 'media',
            nameI18n: { es: '  ', en: 'Media', pt: 'Meio' }
        });
        expect(result.success).toBe(false);
    });

    it('does not accept server-owned fields as input', () => {
        const result = PartnerTypeCreateInputSchema.safeParse({
            slug: 'media',
            nameI18n: NAME,
            id: '00000000-0000-4000-a000-000000000001'
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).not.toHaveProperty('id');
    });
});

describe('PartnerTypeUpdateInputSchema (AC-3.3)', () => {
    it('rejects a body that includes slug (immutable)', () => {
        const result = PartnerTypeUpdateInputSchema.safeParse({ slug: 'other', displayWeight: 5 });
        expect(result.success).toBe(false);
    });

    it('does not inject defaults for absent keys', () => {
        const result = PartnerTypeUpdateInputSchema.safeParse({ nameI18n: NAME });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('displayWeight');
            expect(result.data).not.toHaveProperty('lifecycleState');
        }
    });

    it('accepts a deactivation', () => {
        expect(PartnerTypeUpdateInputSchema.safeParse({ lifecycleState: 'INACTIVE' }).success).toBe(
            true
        );
    });
});

describe('PartnerType read schemas', () => {
    it('the ref carries id, slug, nameI18n and lifecycleState only', () => {
        const parsed = PartnerTypeRefSchema.parse({
            id: '00000000-0000-4000-a000-000000000001',
            slug: 'media',
            nameI18n: NAME,
            lifecycleState: 'INACTIVE',
            displayWeight: 40
        });
        expect(Object.keys(parsed).sort()).toEqual(['id', 'lifecycleState', 'nameI18n', 'slug']);
    });

    it('the public list is { items: [{ slug, nameI18n, displayWeight }] }', () => {
        const parsed = PublicPartnerTypeListSchema.parse({
            items: [
                {
                    slug: 'media',
                    nameI18n: NAME,
                    displayWeight: 40,
                    id: '00000000-0000-4000-a000-000000000001'
                }
            ]
        });
        expect(parsed.items[0]).toEqual({ slug: 'media', nameI18n: NAME, displayWeight: 40 });
    });

    it('the admin list item requires a non-negative partnerCount', () => {
        const base = {
            id: '00000000-0000-4000-a000-000000000001',
            slug: 'media',
            nameI18n: NAME,
            displayWeight: 40,
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };
        expect(PartnerTypeAdminListItemSchema.safeParse({ ...base, partnerCount: 2 }).success).toBe(
            true
        );
        expect(
            PartnerTypeAdminListItemSchema.safeParse({ ...base, partnerCount: -1 }).success
        ).toBe(false);
    });

    it('the admin search accepts a lifecycleState filter', () => {
        const parsed = PartnerTypeAdminSearchSchema.parse({ lifecycleState: 'INACTIVE' });
        expect(parsed.lifecycleState).toBe('INACTIVE');
    });
});

describe('Partner list filters take a type SLUG (spec D6, AC-4.2, AC-5.2)', () => {
    it('public search accepts a slug outside the legacy enum', () => {
        expect(searchPartnerSchema.parse({ type: 'media' }).type).toBe('media');
    });

    it('admin search accepts a slug outside the legacy enum', () => {
        expect(adminSearchPartnerSchema.parse({ type: 'person' }).type).toBe('person');
    });
});

describe('AllianceLeadSchema.partnerType is a catalog slug (spec D3)', () => {
    it('accepts a slug the legacy enum never had', () => {
        const shape = AllianceLeadSchema.shape.partnerType;
        expect(shape.safeParse('media').success).toBe(true);
        expect(shape.safeParse(null).success).toBe(true);
    });

    it('rejects a value that is not a slug', () => {
        const shape = AllianceLeadSchema.shape.partnerType;
        expect(shape.safeParse('Media Outlet').success).toBe(false);
        expect(shape.safeParse('x'.repeat(31)).success).toBe(false);
    });
});
