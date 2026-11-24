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

const contact = read('components/venue/VenueContactBlock.astro');
const address = read('components/venue/VenueAddress.astro');
const page = read('pages/[lang]/comer-y-salir/[slug].astro');

describe('venue interaction attributes (HOS-2256)', () => {
    it('marks both phones as PHONE_CLICK', () => {
        expect(contact).toMatch(/href: toTelHref\(value\)[\s\S]*?interactionKind: 'PHONE_CLICK'/);
    });

    it('keeps the venue-contact__menu-btn hook on the menu link (E2E LISTING-OWNER-01 selector)', () => {
        const menuAnchor = contact.slice(
            contact.indexOf('href={menuHref}'),
            contact.indexOf("'contact-channel': 'menu'")
        );
        expect(menuAnchor).toContain('class="venue-contact__menu-btn"');
    });

    it('marks the contactInfo website as WEBSITE_CLICK', () => {
        expect(contact).toMatch(/href: websiteHref[\s\S]*?interactionKind: 'WEBSITE_CLICK'/);
    });

    it('maps only website and instagram of the social links, and not the menu or email', () => {
        expect(contact).toContain('interactionKind');
        expect(contact).toMatch(/website: 'WEBSITE_CLICK'/);
        expect(contact).toMatch(/instagram: 'INSTAGRAM_CLICK'/);
        expect(contact).not.toMatch(/facebook: '[A-Z_]+_CLICK'/);
        const menuAnchor = contact.slice(
            contact.indexOf('href={menuHref}'),
            contact.indexOf('menuLabel} ↗')
        );
        expect(menuAnchor).not.toContain('interaction-kind');
        const emailChannel = contact.slice(
            contact.indexOf("kind: 'email'"),
            contact.indexOf("kind: 'website'")
        );
        expect(emailChannel).not.toContain('interactionKind');
    });

    it('renders through the shared ListingContactChannels (GradientButton + IconButton, HOS-2533/HOS-2520)', () => {
        expect(contact).toContain('<ListingContactChannels');
        expect(contact).not.toContain('<IconButton');
        const shared = read('components/listing/contact/ListingContactChannels.astro');
        expect(shared).toContain('<GradientButton');
        expect(shared).toContain('<IconButton');
        expect(shared).toContain('variant="outline-primary"');
        expect(shared).toContain("'interaction-kind': interactionKind");
    });

    it('uses brand logos from @repo/icons for every social network', () => {
        for (const icon of [
            'InstagramIcon',
            'FacebookIcon',
            'TwitterIcon',
            'YoutubeIcon',
            'TiktokIcon'
        ]) {
            expect(contact).toContain(`Icon: ${icon}`);
        }
        expect(contact).toContain("from '@repo/icons'");
    });

    it('marks "Ver en el mapa" as MAP_CLICK', () => {
        expect(address).toMatch(/href=\{mapUrl\}[\s\S]*?data-interaction-kind="MAP_CLICK"/);
    });

    it('mounts the island with the venue id, on idle', () => {
        expect(page).toMatch(/<VenueInteractionTracker\s+client:idle\s+entityId=\{venue\.id\}/);
    });

    it('keeps the .astro components session-blind: they do not read the session', () => {
        for (const src of [contact, address]) {
            expect(src).not.toContain('Astro.locals.user');
            expect(src).not.toContain('Astro.locals.session');
        }
    });
});
