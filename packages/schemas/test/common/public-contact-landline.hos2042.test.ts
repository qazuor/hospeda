/**
 * HOS-2042: the landline lives in `contactInfo.workPhone` and is published
 * through the narrowed public contact shapes. These tests execute the real
 * Zod schemas that `stripWithSchema` applies before a payload leaves the API.
 */
import { describe, expect, it } from 'vitest';
import {
    AccommodationPublicSchema,
    AccommodationUpdateHttpSchema,
    httpToDomainAccommodationUpdate,
    VenuePublicListItemSchema,
    VenuePublicSchema
} from '../../src/index.js';

const FULL_CONTACT = {
    personalEmail: 'personal@example.com',
    workEmail: 'work@example.com',
    homePhone: '+543442000001',
    workPhone: '+543442452345',
    mobilePhone: '+5493442452345',
    whatsapp: '+5493442452346',
    website: 'https://example.com',
    preferredEmail: 'work',
    preferredPhone: 'home'
};

describe('public contactInfo shapes (HOS-2042)', () => {
    it('accommodation publishes workPhone and never homePhone', () => {
        const parsed = AccommodationPublicSchema.shape.contactInfo.parse(FULL_CONTACT) as Record<
            string,
            unknown
        >;

        expect(parsed.workPhone).toBe('+543442452345');
        expect(parsed.mobilePhone).toBe('+5493442452345');
        expect(parsed).not.toHaveProperty('homePhone');
        expect(parsed).not.toHaveProperty('whatsapp');
        expect(parsed).not.toHaveProperty('workEmail');
    });

    it('venue now publishes the business channels, including workPhone', () => {
        const field = VenuePublicSchema.shape.contactInfo;
        expect(field, 'VenuePublicSchema must declare contactInfo (HOS-2042)').toBeDefined();
        const parsed = field.parse(FULL_CONTACT) as Record<string, unknown>;

        expect(parsed).toStrictEqual({
            workEmail: 'work@example.com',
            workPhone: '+543442452345',
            mobilePhone: '+5493442452345',
            website: 'https://example.com'
        });
    });

    it('venue never publishes homePhone, personal fields or whatsapp', () => {
        const parsed = VenuePublicSchema.shape.contactInfo.parse(FULL_CONTACT) as Record<
            string,
            unknown
        >;

        for (const key of [
            'homePhone',
            'personalEmail',
            'whatsapp',
            'preferredEmail',
            'preferredPhone'
        ]) {
            expect(parsed).not.toHaveProperty(key);
        }
    });

    it('venue accepts a payload with no contactInfo (cache written before the field)', () => {
        expect(VenuePublicSchema.shape.contactInfo.parse(undefined)).toBeUndefined();
        expect(VenuePublicSchema.shape.contactInfo.parse(null)).toBeNull();
    });
});

describe('accommodation HTTP landlinePhone -> contactInfo.workPhone (HOS-2042)', () => {
    it('maps the flat landlinePhone to workPhone and leaves the mobile phone out', () => {
        const http = AccommodationUpdateHttpSchema.parse({ landlinePhone: '+54 3442 45-2345' });
        const { contactInfo } = httpToDomainAccommodationUpdate(http);

        expect(contactInfo).toStrictEqual({ workPhone: '+54 3442 45-2345' });
    });

    it('maps a cleared landline to an explicit null so the merged column clears it', () => {
        const http = AccommodationUpdateHttpSchema.parse({ landlinePhone: '' });
        const { contactInfo } = httpToDomainAccommodationUpdate(http);

        expect(contactInfo).toStrictEqual({ workPhone: null });
    });

    it('does not touch workPhone when the landline is absent from the patch (AC-3)', () => {
        const http = AccommodationUpdateHttpSchema.parse({ phone: '+54 9 3442 45-2345' });
        const { contactInfo } = httpToDomainAccommodationUpdate(http);

        expect(contactInfo).not.toHaveProperty('workPhone');
    });

    it('rejects a malformed landline with the shared phone message', () => {
        const result = AccommodationUpdateHttpSchema.safeParse({ landlinePhone: 'abc' });
        expect(result.success).toBe(false);
    });
});

describe('venue list vs detail contactInfo exposure (HOS-2042)', () => {
    const baseRow = {
        id: '11111111-1111-4111-8111-111111111111',
        slug: 'la-parrilla',
        name: 'La Parrilla',
        type: 'RESTAURANT',
        summary: 'Un resumen de prueba largo.',
        description: 'Una descripción de prueba suficientemente larga para validar.',
        destinationId: '22222222-2222-4222-8222-222222222222',
        contactInfo: { mobilePhone: '+5493442452345', workPhone: '+543442452345' }
    };

    it('a LIST item carries no contactInfo even when the row has one', () => {
        const parsed = VenuePublicListItemSchema.parse(baseRow) as Record<string, unknown>;

        expect(parsed).not.toHaveProperty('contactInfo');
        expect(parsed.slug).toBe('la-parrilla');
    });

    it('the DETAIL carries contactInfo', () => {
        const parsed = VenuePublicSchema.parse(baseRow) as Record<string, unknown>;

        expect(parsed.contactInfo).toStrictEqual({
            mobilePhone: '+5493442452345',
            workPhone: '+543442452345'
        });
    });

    it('the list item schema declares no contactInfo key at all', () => {
        expect(Object.keys(VenuePublicListItemSchema.shape)).not.toContain('contactInfo');
        expect(Object.keys(VenuePublicSchema.shape)).toContain('contactInfo');
    });
});
