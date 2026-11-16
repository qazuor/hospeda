/**
 * HOS-2200: an experience LIST item never carries `contactInfo`; the DETAIL
 * does. These tests execute the real Zod schemas that `stripWithSchema` applies
 * before a payload leaves the API.
 */
import { describe, expect, it } from 'vitest';
import {
    ExperiencePriceUnitEnum,
    ExperiencePublicListItemSchema,
    ExperiencePublicSchema,
    ExperienceTypeEnum
} from '../../src/index.js';

const baseRow = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'paseo-en-kayak',
    name: 'Paseo en kayak',
    type: ExperienceTypeEnum.EXCURSION,
    priceFrom: 1500000,
    priceUnit: ExperiencePriceUnitEnum.PER_PERSON,
    isPriceOnRequest: false,
    summary: 'Un resumen de prueba largo.',
    description: 'Una descripción de prueba suficientemente larga para validar.',
    destinationId: '22222222-2222-4222-8222-222222222222',
    contactInfo: {
        mobilePhone: '+5493442452345',
        workPhone: '+543442452345',
        workEmail: 'work@example.com',
        homePhone: '+543442000001'
    }
};

describe('experience list vs detail contactInfo exposure (HOS-2200)', () => {
    it('a LIST item carries no contactInfo even when the row has one', () => {
        const parsed = ExperiencePublicListItemSchema.parse(baseRow) as Record<string, unknown>;

        expect(parsed).not.toHaveProperty('contactInfo');
        expect(parsed.slug).toBe('paseo-en-kayak');
    });

    it('the DETAIL carries the narrowed contactInfo', () => {
        const parsed = ExperiencePublicSchema.parse(baseRow) as Record<string, unknown>;

        expect(parsed.contactInfo).toStrictEqual({
            mobilePhone: '+5493442452345',
            workPhone: '+543442452345',
            workEmail: 'work@example.com'
        });
    });

    it('the list item schema declares no contactInfo key at all', () => {
        expect(Object.keys(ExperiencePublicListItemSchema.shape)).not.toContain('contactInfo');
        expect(Object.keys(ExperiencePublicSchema.shape)).toContain('contactInfo');
    });
});
