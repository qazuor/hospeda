import { describe, expect, it } from 'vitest';
import {
    buildExperienceChannels,
    buildExperienceContactPrice,
    buildVenueChannels,
    resolveVenueContactMode
} from '@/lib/listing-contact/listing-channels';

const contact = {
    workPhone: null,
    mobilePhone: null,
    workEmail: null,
    website: null
};

describe('buildExperienceChannels', () => {
    it('returns nothing without contact info', () => {
        expect(buildExperienceChannels({ contactInfo: null })).toEqual([]);
        expect(buildExperienceChannels({ contactInfo: contact })).toEqual([]);
    });

    it('lists only the channels present, mobile before landline, as native links', () => {
        const channels = buildExperienceChannels({
            contactInfo: {
                workPhone: '03442 42-1234',
                mobilePhone: '+54 3447 412233',
                workEmail: ' hola@ejemplo.com ',
                website: 'https://ejemplo.com/tour'
            }
        });

        expect(channels.map(({ kind, href }) => [kind, href])).toEqual([
            ['phone', 'tel:+543447412233'],
            ['phone', 'tel:03442421234'],
            ['email', 'mailto:hola@ejemplo.com'],
            ['website', 'https://ejemplo.com/tour']
        ]);
        expect(channels.at(-1)).toMatchObject({ external: true, text: 'ejemplo.com/tour' });
    });

    it('drops whitespace values and unsafe website schemes instead of rendering them', () => {
        const channels = buildExperienceChannels({
            contactInfo: { ...contact, mobilePhone: '   ', website: 'javascript:alert(1)' }
        });

        expect(channels).toEqual([]);
    });

    it('never produces a whatsapp channel', () => {
        const channels = buildExperienceChannels({
            contactInfo: { ...contact, mobilePhone: '+54 3447 412233' }
        });

        expect(channels.map(({ kind }) => kind)).toEqual(['phone']);
        expect(JSON.stringify(channels)).not.toMatch(/whatsapp|wa\.me/i);
    });
});

describe('buildVenueChannels', () => {
    it('keeps only safe social links, in a stable order', () => {
        const channels = buildVenueChannels({
            socialNetworks: {
                tiktok: 'https://tiktok.com/@bar',
                instagram: 'https://instagram.com/bar',
                facebook: 'javascript:alert(1)',
                youtube: null
            }
        });

        expect(channels.map(({ network }) => network)).toEqual(['instagram', 'tiktok']);
        expect(channels.every(({ kind, external }) => kind === 'social' && external)).toBe(true);
    });

    it('returns nothing without networks', () => {
        expect(buildVenueChannels({ socialNetworks: null })).toEqual([]);
        expect(buildVenueChannels({ socialNetworks: undefined })).toEqual([]);
    });
});

describe('resolveVenueContactMode', () => {
    const social = buildVenueChannels({
        socialNetworks: { instagram: 'https://instagram.com/bar' }
    });

    it('links the menu when a safe menuUrl exists, even with socials', () => {
        expect(
            resolveVenueContactMode({ menuUrl: 'https://bar.com/carta', channels: social })
        ).toEqual({
            kind: 'menu',
            href: 'https://bar.com/carta'
        });
    });

    it('falls back to the socials panel without a menu', () => {
        expect(resolveVenueContactMode({ menuUrl: null, channels: social })).toEqual({
            kind: 'panel'
        });
        expect(resolveVenueContactMode({ menuUrl: 'javascript:x', channels: social })).toEqual({
            kind: 'panel'
        });
    });

    it('renders the panel when WhatsApp is the only channel', () => {
        expect(resolveVenueContactMode({ menuUrl: null, channels: [], hasWhatsapp: true })).toEqual(
            {
                kind: 'panel'
            }
        );
    });

    it('still prefers the menu link over a WhatsApp-only panel', () => {
        expect(
            resolveVenueContactMode({
                menuUrl: 'https://bar.com/carta',
                channels: [],
                hasWhatsapp: true
            })
        ).toEqual({ kind: 'menu', href: 'https://bar.com/carta' });
    });

    it('renders no bar with neither menu, socials nor WhatsApp', () => {
        expect(resolveVenueContactMode({ menuUrl: undefined, channels: [] })).toEqual({
            kind: 'none'
        });
    });
});

describe('buildExperienceContactPrice', () => {
    it('converts centavos to major units with the unit key', () => {
        expect(
            buildExperienceContactPrice({
                priceFrom: 1500000,
                priceUnit: 'per_person',
                isPriceOnRequest: false
            })
        ).toEqual({
            amount: 15000,
            currency: 'ARS',
            unitLabelKey: 'accommodations.detail.listingContact.units.perPerson',
            onRequest: false
        });
    });

    it.each([
        { priceFrom: null, isPriceOnRequest: false },
        { priceFrom: 0, isPriceOnRequest: false },
        { priceFrom: 500000, isPriceOnRequest: true }
    ])('asks for the price when %o', (input) => {
        expect(buildExperienceContactPrice({ ...input, priceUnit: 'per_day' })).toEqual({
            amount: null,
            currency: null,
            unitLabelKey: null,
            onRequest: true
        });
    });
});
