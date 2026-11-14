/**
 * @file landline-public-contact.hos2042.test.ts
 * @description HOS-2042: the optional landline (`contactInfo.workPhone`) reaches
 * the public pages of accommodation, venue and experience, next to the main
 * (mobile) phone, and the venue page now has a contact block.
 *
 * Vitest cannot render `.astro` in this repo, so the render decision is asserted
 * through the pure predicates and transforms the components delegate to, and the
 * component/page WIRING through static source guards (the only layer a source
 * test can reach). Same approach as `experience-contact-block.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    toAccommodationDetailPageProps,
    toExperienceDetailPageProps,
    toVenueDetailPageProps
} from '@/lib/api/transforms';
import { hasPublicContactChannel } from '@/lib/experience-contact';
import { hasVenueContactInfoChannel, hasVenuePublicContact } from '@/lib/venue-contact';

const read = (rel: string): string => readFileSync(resolve(__dirname, '../../', rel), 'utf8');

/** Strips comments so wiring assertions read CODE, not the prose about it. */
const code = (source: string): string =>
    source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '');

const ACCOMMODATION_ITEM = {
    id: 'acc-001',
    slug: 'casa',
    name: 'Casa',
    summary: 'Resumen',
    description: 'Descripción',
    type: 'HOTEL',
    createdAt: '2026-01-01T00:00:00.000Z',
    owner: { id: 'owner-1', name: 'Owner', createdAt: '2026-01-01T00:00:00.000Z' }
};

describe('accommodation public page (HOS-2042)', () => {
    it('carries the landline next to the mobile phone when present', () => {
        const result = toAccommodationDetailPageProps({
            item: {
                ...ACCOMMODATION_ITEM,
                contactInfo: { mobilePhone: '+5493442452345', workPhone: '+543442452345' }
            }
        });

        expect(result.contactInfo?.phone).toBe('+5493442452345');
        expect(result.contactInfo?.landlinePhone).toBe('+543442452345');
    });

    it('has no landline when the value is absent', () => {
        const result = toAccommodationDetailPageProps({
            item: { ...ACCOMMODATION_ITEM, contactInfo: { mobilePhone: '+5493442452345' } }
        });

        expect(result.contactInfo?.phone).toBe('+5493442452345');
        expect(result.contactInfo?.landlinePhone).toBeUndefined();
    });

    it('still renders a contact block for a listing whose only channel is the landline', () => {
        const result = toAccommodationDetailPageProps({
            item: { ...ACCOMMODATION_ITEM, contactInfo: { workPhone: '+543442452345' } }
        });

        expect(result.contactInfo).toEqual(
            expect.objectContaining({ landlinePhone: '+543442452345' })
        );
    });

    it('wires the landline link with its own localized aria-label', () => {
        const src = code(read('src/components/accommodation/AccommodationContactBlock.astro'));

        expect(src).toContain('contactInfo.landlinePhone');
        expect(src).toContain("'accommodations.detail.contact.landlineAriaLabel'");
    });
});

describe('venue public page (HOS-2042)', () => {
    it('transforms the narrowed contactInfo, mobile first and landline included', () => {
        const result = toVenueDetailPageProps({
            item: {
                slug: 'la-parrilla',
                name: 'La Parrilla',
                contactInfo: {
                    mobilePhone: ' +5493442452345 ',
                    workPhone: '+543442452345',
                    workEmail: 'hola@laparrilla.com',
                    homePhone: '+543442000001',
                    personalEmail: 'dueno@example.com',
                    whatsapp: '+5493442452346'
                }
            }
        });

        expect(result.contactInfo).toStrictEqual({
            workEmail: 'hola@laparrilla.com',
            workPhone: '+543442452345',
            mobilePhone: '+5493442452345',
            website: null
        });
    });

    it('returns null contactInfo when only unpublished keys are present', () => {
        const result = toVenueDetailPageProps({
            item: {
                slug: 'x',
                name: 'X',
                contactInfo: { homePhone: '+543442000001', whatsapp: '+5493442452346' }
            }
        });

        expect(result.contactInfo).toBeNull();
    });

    it('returns null contactInfo when the payload predates the field', () => {
        expect(toVenueDetailPageProps({ item: { slug: 'x', name: 'X' } }).contactInfo).toBeNull();
    });

    it('treats a landline-only venue as having a contact block', () => {
        expect(hasVenueContactInfoChannel({ contactInfo: { workPhone: '+543442452345' } })).toBe(
            true
        );
        expect(
            hasVenuePublicContact({
                contactInfo: { workPhone: '+543442452345' },
                socialNetworks: null,
                menuUrl: null
            })
        ).toBe(true);
    });

    it('renders nothing when there is no channel, social profile or menu link', () => {
        expect(
            hasVenuePublicContact({
                contactInfo: { workPhone: '  ', mobilePhone: null, website: 'javascript:alert(1)' },
                socialNetworks: null,
                menuUrl: null
            })
        ).toBe(false);
    });

    it('wires the page gate, the CTA predicate and the block to one shared predicate', () => {
        const page = code(read('src/pages/[lang]/comer-y-salir/[slug].astro'));
        const block = code(read('src/components/venue/VenueContactBlock.astro'));

        expect(page).toContain("from '@/lib/venue-contact'");
        expect(page).toContain('contactInfo: venue.contactInfo');
        expect(block).toContain('hasVenuePublicContact({ contactInfo, socialNetworks, menuUrl })');
    });

    it('renders the landline with its own aria-label and never reads homePhone or whatsapp', () => {
        const block = code(read('src/components/venue/VenueContactBlock.astro'));

        expect(block).toContain('contactInfo?.workPhone');
        expect(block).toContain("'venue.detail.contactLandlineAriaLabel'");
        expect(block).not.toContain('homePhone');
        expect(block).not.toMatch(/contactInfo\??\.whatsapp/);
        expect(block).not.toContain('personalEmail');
        expect(block).not.toContain('set:html');
    });
});

describe('experience public page (HOS-2042)', () => {
    it('keeps the landline and lists the mobile phone first in the block', () => {
        const detail = toExperienceDetailPageProps({
            item: {
                id: '4d2b0b1a-0000-4000-a000-000000000001',
                slug: 'kayak',
                name: 'Kayak',
                contactInfo: { workPhone: '+543442452345', mobilePhone: '+5493442452345' }
            },
            locale: 'es'
        });

        expect(detail.contactInfo?.workPhone).toBe('+543442452345');
        expect(hasPublicContactChannel({ contactInfo: detail.contactInfo })).toBe(true);

        const block = code(read('src/components/experience/ExperienceContactBlock.astro'));
        expect(block.indexOf("key: 'mobile'")).toBeLessThan(block.indexOf("key: 'work'"));
        expect(block).toContain("'experience.detail.contactLandlineAriaLabel'");
    });
});
