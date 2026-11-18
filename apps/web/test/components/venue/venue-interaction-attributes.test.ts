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
        expect(contact).toMatch(
            /href=\{toTelHref\(value\)\}[^>]*data-interaction-kind="PHONE_CLICK"/
        );
    });

    it('marks the contactInfo website as WEBSITE_CLICK', () => {
        expect(contact).toMatch(
            /href=\{websiteHref\}[\s\S]*?data-interaction-kind="WEBSITE_CLICK"/
        );
    });

    it('maps only website and instagram of the social links, and not the menu or email', () => {
        expect(contact).toContain('data-interaction-kind={SOCIAL_INTERACTION_KINDS[key]}');
        expect(contact).toMatch(/website: 'WEBSITE_CLICK'/);
        expect(contact).toMatch(/instagram: 'INSTAGRAM_CLICK'/);
        expect(contact).not.toMatch(/facebook: '[A-Z_]+_CLICK'/);
        const menuAnchor = contact.slice(
            contact.indexOf('href={menuHref}'),
            contact.indexOf('{menuLabel}')
        );
        expect(menuAnchor).not.toContain('data-interaction-kind');
        const emailAnchor = contact.slice(
            contact.indexOf('href={`mailto:'),
            contact.indexOf('<EmailIcon')
        );
        expect(emailAnchor).not.toContain('data-interaction-kind');
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
