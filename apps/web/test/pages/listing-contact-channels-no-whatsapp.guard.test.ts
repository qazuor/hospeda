/**
 * @file listing-contact-channels-no-whatsapp.guard.test.ts
 * @description AC-2.10 (HOS-2532): the experience and venue contact surfaces carry
 * no WhatsApp element (HOS-363, HOS-1076), and each page wires its bar from the
 * channel builders only. Reads source with comments stripped, so prose that
 * explains the rule does not trip it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../src');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

/** Removes JS/TS/CSS block comments, line comments and HTML comments. */
function stripComments(source: string): string {
    return source
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const experiencePage = stripComments(read('pages/[lang]/experiencias/[slug].astro'));
const venuePage = stripComments(read('pages/[lang]/comer-y-salir/[slug].astro'));
const panel = stripComments(read('components/listing/contact/ListingChannelsPanel.client.tsx'));
const channelsLib = stripComments(read('lib/listing-contact/listing-channels.ts'));

describe('experience and venue contact surfaces carry no WhatsApp', () => {
    it('the experience page has no WhatsApp element at all', () => {
        // The one allowed mention is the explicit opt-out the shared bar requires.
        expect(experiencePage.replaceAll('hasWhatsapp={false}', '')).not.toMatch(
            /whatsapp|wa\.me/i
        );
        expect(experiencePage).toContain('hasWhatsapp={false}');
    });

    it('the channel-only panel and builders have no WhatsApp element', () => {
        expect(panel).not.toMatch(/whatsapp|wa\.me/i);
        expect(channelsLib).not.toMatch(/whatsapp|wa\.me/i);
    });

    it('the venue page never feeds WhatsApp to the bar or the panel', () => {
        expect(venuePage).toContain('hasWhatsapp={false}');
        expect(venuePage).not.toMatch(/hasWhatsapp=\{(?!false\})/);
        expect(venuePage).not.toMatch(/WhatsAppContact(?!\s*,)\b(?<!VenueWhatsAppContact)/);
    });

    it('the shared actions render the WhatsApp control for accommodation only', () => {
        const actions = stripComments(read('components/listing/contact/ListingContactActions.tsx'));

        expect(actions).toMatch(/vertical === 'accommodation' && hasWhatsapp/);
    });

    it('both pages mount the bar from the channel builders, never from a form', () => {
        for (const page of [experiencePage, venuePage]) {
            expect(page).toContain('ListingContactBar');
            expect(page).toContain('ListingChannelsPanel');
            expect(page).not.toContain('ListingContactPanel');
            expect(page).not.toContain('ContactHost');
        }
    });
});

describe('experience and venue contact bar presence (AC-2.8, AC-2.9)', () => {
    it('the experience bar renders only when a public channel exists', () => {
        expect(experiencePage).toMatch(/hasContactBlock\s*\?\s*buildExperienceChannels/);
        expect(experiencePage).toMatch(/contactChannels\.length > 0 &&/);
    });

    it('the venue bar is gated by the menu/socials decision and its panel only in panel mode', () => {
        expect(venuePage).toMatch(/contactMode\.kind !== 'none' &&/);
        expect(venuePage).toMatch(/contactMode\.kind === 'panel' &&/);
        expect(venuePage).toContain('price={null}');
    });
});
