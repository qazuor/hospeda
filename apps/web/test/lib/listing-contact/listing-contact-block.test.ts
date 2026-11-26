/**
 * @file listing-contact-block.test.ts
 * @description Unit tests of the contact block builders (HOS-2579 §6.4,
 * AC-14 to AC-16). They took over the data half of the three deleted wrappers
 * (`AccommodationContactBlock`, `VenueContactBlock`, `ExperienceContactBlock`),
 * so the rules those files carried are asserted here by CALLING the builders.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildAccommodationContactBlock,
    buildExperienceContactBlock,
    buildVenueContactBlock,
    toTelHref
} from '@/lib/listing-contact/listing-contact-block';
import { VENUE_CONTACT_ANCHOR_ID } from '@/lib/venue-contact';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/lib/listing-contact/listing-contact-block.ts'),
    'utf8'
);
const UNSAFE = 'javascript:alert(1)';

describe('buildAccommodationContactBlock (H-118, HOS-2042)', () => {
    it('returns null when there is nothing to show', () => {
        expect(buildAccommodationContactBlock({ listingId: 'a', locale: 'es' })).toBeNull();
        expect(
            buildAccommodationContactBlock({
                listingId: 'a',
                contactInfo: { website: UNSAFE },
                socialNetworks: { facebook: UNSAFE },
                locale: 'es'
            })
        ).toBeNull();
    });

    it('lists phone, landline, email and website in that order, landline after the phone', () => {
        // Arrange / Act
        const block = buildAccommodationContactBlock({
            listingId: 'acc-1',
            contactInfo: {
                phone: '+5493442452345',
                landlinePhone: '+543442452345',
                email: 'hola@cabana.ar',
                website: 'https://cabana.ar'
            },
            locale: 'es'
        });
        // Assert
        expect(block?.channels.map((c) => [c.kind, c.href])).toEqual([
            ['phone', 'tel:+5493442452345'],
            ['phone', 'tel:+543442452345'],
            ['email', 'mailto:hola@cabana.ar'],
            ['website', 'https://cabana.ar']
        ]);
        expect(block?.channels[1]?.srHint).toMatch(/^, /);
        expect(block?.shell).toBe('card');
        expect(block?.trackingData).toEqual({
            'listing-id': 'acc-1',
            vertical: 'accommodation',
            'contact-origin': 'contact_block'
        });
    });

    it('surfaces only Facebook and Instagram, allow-listed', () => {
        const block = buildAccommodationContactBlock({
            listingId: 'acc-1',
            socialNetworks: { facebook: 'https://facebook.com/x', instagram: UNSAFE },
            locale: 'es'
        });
        expect(block?.socialLinks.map((link) => link.href)).toEqual(['https://facebook.com/x']);
        expect(block?.channels).toEqual([]);
    });
});

describe('buildVenueContactBlock (HOS-2042, HOS-2256)', () => {
    const venue = (over: Partial<Parameters<typeof buildVenueContactBlock>[0]> = {}) =>
        buildVenueContactBlock({
            listingId: 'ven-1',
            contactInfo: null,
            socialNetworks: null,
            menuUrl: null,
            locale: 'es',
            ...over
        });

    it('returns null when there is no channel, social profile or menu link', () => {
        expect(venue()).toBeNull();
        expect(venue({ contactInfo: { workPhone: '  ', website: UNSAFE } })).toBeNull();
    });

    it('puts the mobile first, then the landline, both counted as PHONE_CLICK', () => {
        const block = venue({
            contactInfo: { mobilePhone: '+54 9 3442 452345', workPhone: '+54 3442 452345' }
        });
        expect(block?.channels.map((c) => [c.href, c.interactionKind])).toEqual([
            ['tel:+5493442452345', 'PHONE_CLICK'],
            ['tel:+543442452345', 'PHONE_CLICK']
        ]);
        expect(block?.channels[0]?.label).toBe('+54 9 3442 452345');
    });

    it('counts the website channel and the website/Instagram profiles, nothing else', () => {
        const block = venue({
            contactInfo: { website: 'https://bar.ar', workEmail: 'a@bar.ar' },
            socialNetworks: {
                website: 'https://bar.ar',
                instagram: 'https://instagram.com/bar',
                facebook: 'https://facebook.com/bar'
            }
        });
        const website = block?.channels.find((c) => c.kind === 'website');
        const email = block?.channels.find((c) => c.kind === 'email');
        expect(website?.interactionKind).toBe('WEBSITE_CLICK');
        expect(email?.interactionKind).toBeUndefined();
        expect(block?.socialLinks.map((l) => l.interactionKind)).toEqual([
            'WEBSITE_CLICK',
            'INSTAGRAM_CLICK',
            undefined
        ]);
    });

    it('shows website, Instagram, Facebook, X, YouTube and TikTok in that order', () => {
        const block = venue({
            socialNetworks: {
                tiktok: 'https://tiktok.com/@bar',
                youtube: 'https://youtube.com/bar',
                twitter: 'https://x.com/bar',
                facebook: 'https://facebook.com/bar',
                instagram: 'https://instagram.com/bar',
                website: 'https://bar.ar'
            }
        });
        expect(block?.socialLinks.map((l) => l.ariaLabel)).toEqual([
            'Sitio web',
            'Instagram',
            'Facebook',
            'X (Twitter)',
            'YouTube',
            'TikTok'
        ]);
    });

    it.each([
        ['es', 'Sitio web'],
        ['en', 'Website'],
        ['pt', 'Site']
    ] as const)('names the website profile in the page locale (%s)', (locale, expected) => {
        const block = buildVenueContactBlock({
            listingId: 'ven-1',
            contactInfo: null,
            socialNetworks: { website: 'https://bar.ar', tiktok: 'https://tiktok.com/@bar' },
            menuUrl: null,
            locale
        });
        expect(block?.socialLinks.map((l) => l.ariaLabel)).toEqual([expected, 'TikTok']);
    });

    it('takes every social label from i18n, none hardcoded', () => {
        const list = SOURCE.match(/const PUBLIC_SOCIAL_LINKS[\s\S]*?\n\];/)?.[0] ?? '';
        expect(list).not.toContain('label:');
        expect(SOURCE).toContain(`accommodations.detail.listingContact.social.\${key}`);
    });

    it('leaves the menu to the primary action even when the URL is safe', () => {
        expect(venue({ menuUrl: 'https://carta.bar.ar' })).toBeNull();
        expect(
            venue({ menuUrl: UNSAFE, socialNetworks: { instagram: 'https://i.com/b' } })?.menuLink
        ).toBeUndefined();
    });

    it('carries the anchor id, the plain shell and the Umami block marker (D-6)', () => {
        const block = venue({ socialNetworks: { instagram: 'https://i.com/b' } });
        expect(block?.id).toBe(VENUE_CONTACT_ANCHOR_ID);
        expect(block?.shell).toBe('plain');
        expect(block?.blockProps).toEqual({ 'data-umami-block': '' });
        // No channel: no «Contacto» title over an empty row.
        expect(block?.heading).toBeUndefined();
    });
});

describe('buildExperienceContactBlock (HOS-815, HOS-2042)', () => {
    it('lists the mobile before the landline and carries the Umami marker', () => {
        const block = buildExperienceContactBlock({
            listingId: 'exp-1',
            contactInfo: { workPhone: '+543442452345', mobilePhone: '+5493442452345' },
            socialNetworks: null,
            locale: 'es'
        });
        expect(block?.channels.map((c) => c.href)).toEqual([
            'tel:+5493442452345',
            'tel:+543442452345'
        ]);
        expect(block?.blockProps).toEqual({ 'data-umami-block': '' });
        expect(block?.channels.every((c) => c.interactionKind === undefined)).toBe(true);
    });
});

describe('no WhatsApp channel on any vertical (HOS-19, HOS-1076, HOS-363)', () => {
    it('drops a whatsapp key even when the social networks carry one', () => {
        const block = buildExperienceContactBlock({
            listingId: 'exp-1',
            contactInfo: null,
            socialNetworks: { whatsapp: 'https://wa.me/5493442452345' },
            locale: 'es'
        });
        expect(block).toBeNull();
    });

    it('names no whatsapp field and builds no wa.me link in the builder source', () => {
        const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/whatsapp/i);
        expect(code).not.toContain('wa.me');
        expect(code).not.toContain('homePhone');
        expect(code).not.toContain('personalEmail');
    });
});

describe('toTelHref', () => {
    it('keeps digits and the leading plus only', () => {
        expect(toTelHref('+54 (3442) 45-2345')).toBe('tel:+543442452345');
    });
});
