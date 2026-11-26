/**
 * @file venue-interaction-attributes.test.ts
 * @description Source-read test (HOS-2256, AC-3): every tracked anchor of the
 * venue page carries the interaction kind the owner panel expects, and the
 * untracked ones carry none. `.astro` cannot be rendered in Vitest, so the
 * source is asserted, the documented approach for `.astro` coverage.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(__dirname, '../../../src', file), 'utf8');

const contact = read('lib/listing-contact/listing-contact-block.ts');
const venueBuilder = contact.slice(contact.indexOf('export function buildVenueContactBlock'));
const block = read('components/listing/contact/ListingContactBlock.astro');
const address = read('components/listing/location/LocationSection.astro');
const locationBuilders = read('lib/listing-location/build-location-section.ts');
const page = read('pages/[lang]/comer-y-salir/[slug].astro');

describe('venue interaction attributes (HOS-2256)', () => {
    it('marks both phones as PHONE_CLICK', () => {
        expect(venueBuilder).toMatch(
            /href: toTelHref\(value\)[\s\S]*?interactionKind: 'PHONE_CLICK'/
        );
    });

    it('keeps the venue-contact__menu-btn hook on the menu link (E2E LISTING-OWNER-01 selector)', () => {
        const menuAnchor = block.slice(
            block.indexOf('href={menuLink.href}'),
            block.indexOf("'contact-channel': 'menu'")
        );
        expect(menuAnchor).toContain('class="venue-contact__menu-btn"');
    });

    it('marks the contactInfo website as WEBSITE_CLICK', () => {
        expect(venueBuilder).toMatch(/href: websiteHref[\s\S]*?interactionKind: 'WEBSITE_CLICK'/);
    });

    it('maps only website and instagram of the social links, and not the menu or email', () => {
        expect(contact).toMatch(/website: 'WEBSITE_CLICK'/);
        expect(contact).toMatch(/instagram: 'INSTAGRAM_CLICK'/);
        expect(contact).not.toMatch(/facebook: '[A-Z_]+_CLICK'/);
        const menuAnchor = block.slice(
            block.indexOf('{menuLink && ('),
            block.indexOf('<ListingSocialLinks')
        );
        expect(menuAnchor).not.toContain('interaction-kind');
        const emailChannel = venueBuilder.slice(
            venueBuilder.indexOf("kind: 'email'"),
            venueBuilder.indexOf("kind: 'website'")
        );
        expect(emailChannel).not.toContain('interactionKind');
    });

    it('renders through the shared ListingContactBlock (GradientButton + IconButton, HOS-2533/HOS-2520/HOS-2579)', () => {
        const social = read('components/listing/contact/ListingSocialLinks.astro');
        expect(page).toContain('Component: VenueContactSection');
        const section = read('components/venue/VenueContactSection.astro');
        expect(section).toContain('<ListingContactBlock');
        expect(section).toContain('{...contactBlock}');
        expect(block).toContain('<GradientButton');
        expect(block).toContain('variant="outline-primary"');
        expect(block).toContain("'interaction-kind': interactionKind");
        expect(social).toContain('<IconButton');
        expect(social).toContain("'interaction-kind': interactionKind");
    });

    it('uses brand logos from @repo/icons for every social network (X, not the old bird)', () => {
        for (const icon of [
            'InstagramIcon',
            'FacebookIcon',
            'XIcon',
            'YoutubeIcon',
            'TiktokIcon'
        ]) {
            expect(contact).toContain(`Icon: ${icon}`);
        }
        expect(contact).not.toContain('TwitterIcon');
        expect(contact).toContain("from '@repo/icons'");
    });

    it('marks "Ver en el mapa" as MAP_CLICK (HOS-2579: builder data on the shared section)', () => {
        expect(locationBuilders).toMatch(
            /externalMapHref: mapUrl,[\s\S]*?trackingData: \{ 'interaction-kind': 'MAP_CLICK' \}/
        );
        expect(address).toMatch(/href=\{externalMapHref\}[\s\S]*?\{\.\.\.linkData\}/);
        expect(address).toMatch(/\[`data-\$\{key\}`, value\]/);
    });

    it('mounts the island with the venue id, on idle', () => {
        expect(page).toMatch(/<VenueInteractionTracker\s+client:idle\s+entityId=\{venue\.id\}/);
    });

    it('keeps the .astro components session-blind: they do not read the session', () => {
        for (const src of [block, address]) {
            expect(src).not.toContain('Astro.locals.user');
            expect(src).not.toContain('Astro.locals.session');
        }
    });
});
