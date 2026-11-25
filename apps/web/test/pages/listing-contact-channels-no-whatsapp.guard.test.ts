/**
 * @file listing-contact-channels-no-whatsapp.guard.test.ts
 * @description AC-2.10 (HOS-2532): the experience and venue contact surfaces carry
 * no WhatsApp element (HOS-363, HOS-1076), and each page wires its bar from the
 * channel builders only. HOS-2579 AC-16 extends it to the one contact block of
 * the three pages (`ListingContactBlock`, `ListingSocialLinks` and their
 * builders). Reads source with comments stripped, so prose that explains the
 * rule does not trip it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../src');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

/** Removes every `open ... close` span, scanning until none is left (no partial-match leftovers). */
function removeSpans({
    source,
    open,
    close
}: {
    readonly source: string;
    readonly open: string;
    readonly close: string;
}): string {
    let result = source;
    for (let from = result.indexOf(open); from !== -1; from = result.indexOf(open)) {
        const to = result.indexOf(close, from + open.length);
        result =
            to === -1
                ? result.slice(0, from)
                : result.slice(0, from) + result.slice(to + close.length);
    }
    return result;
}

/** Removes HTML, block and full-line comments, so prose that explains the rule does not trip the guard. */
function stripComments(source: string): string {
    const html = removeSpans({ source, open: '<!--', close: '-->' });
    const block = removeSpans({ source: html, open: '/*', close: '*/' });
    return block.replace(/^\s*\/\/.*$/gm, '');
}

const experiencePage = stripComments(read('pages/[lang]/experiencias/[slug].astro'));
const venuePage = stripComments(read('pages/[lang]/comer-y-salir/[slug].astro'));
const panel = stripComments(read('components/listing/contact/ListingChannelsPanel.client.tsx'));
const channelsLib = stripComments(read('lib/listing-contact/listing-channels.ts'));
const contactBlockSources = [
    'components/listing/contact/ListingContactBlock.astro',
    'components/listing/contact/ListingSocialLinks.astro',
    'components/listing/contact/listing-contact.types.ts',
    'lib/listing-contact/listing-contact-block.ts'
] as const;

describe('experience and venue contact surfaces carry no WhatsApp', () => {
    it('the experience page has no WhatsApp element at all', () => {
        // The one allowed mention is the explicit opt-out the shared bar requires.
        expect(experiencePage.replaceAll('hasWhatsapp={false}', '')).not.toMatch(
            /whatsapp|wa\.me/i
        );
        expect(experiencePage).toContain('hasWhatsapp={false}');
    });

    it.each(
        contactBlockSources
    )('the shared contact block file %s has no WhatsApp element (AC-16)', (file) => {
        expect(stripComments(read(file))).not.toMatch(/whatsapp|wa\.me/i);
    });

    it('the channel builders have no WhatsApp element', () => {
        expect(channelsLib.replaceAll('hasWhatsapp', '')).not.toMatch(/whatsapp|wa\.me/i);
    });

    it('the panel reaches WhatsApp only through the HOS-2256 button, for venues, never building a link itself', () => {
        expect(panel).toContain("vertical === 'venue' && whatsapp");
        expect(panel).toContain('<VenueWhatsAppButton');
        expect(panel).not.toMatch(/wa\.me|buildWhatsAppLink|contactInfo|socialNetworks/);
    });

    it('the venue page hands the panel the HOS-2256 state, never a number or a form', () => {
        expect(venuePage).toContain('whatsapp={venueWhatsApp ?? null}');
        expect(venuePage).toContain('hasWhatsapp: Boolean(venueWhatsApp)');
        expect(venuePage).not.toMatch(/wa\.me|buildWhatsAppLink/);
    });

    it('the venue page feeds the dock bar only the HOS-2256 WhatsApp state (HOS-2579 AC-29)', () => {
        expect(venuePage).toContain('hasWhatsapp={false}');
        expect(venuePage).not.toMatch(/hasWhatsapp=\{(?!false\})/);
        expect(venuePage).toContain('venueWhatsapp={venueWhatsApp ?? null}');
    });

    it('the action bar builds a wa.me link only from the venue PUBLIC state, never from contact data', () => {
        const bar = stripComments(read('components/listing/contact/ListingActionBarButtons.tsx'));

        expect(bar).toMatch(/vertical === 'venue' && venueWhatsapp\?\.mode === 'PUBLIC'/);
        expect(bar).toContain('phone: venueWhatsapp.number');
        expect(bar).not.toMatch(/contactInfo|socialNetworks/);
        // Accommodation WhatsApp only opens the panel: the number stays behind the HOS-19 gate.
        expect(bar).toMatch(/\(vertical === 'accommodation' && hasWhatsapp\)/);
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

describe('experience and venue contact bar presence (AC-2.8, AC-2.9, HOS-2579 §6.10.1)', () => {
    it('the experience «Consultar» and panel exist only when a public channel exists', () => {
        expect(experiencePage).toMatch(/hasContactBlock\s*\?\s*buildExperienceChannels/);
        expect(experiencePage).toContain(
            "primary={contactChannels.length > 0 ? { kind: 'inquire' } : null}"
        );
        expect(experiencePage).toMatch(/contactChannels\.length > 0 && \(\s*<ListingChannelsPanel/);
    });

    it('the venue primary follows the menu/socials decision and its panel the panel mode or a gated WhatsApp', () => {
        expect(venuePage).toMatch(/contactMode\.kind === 'menu'\s*\?\s*\(\{ kind: 'menu'/);
        // HOS-2607: the menu glyph is decided by the venue type, never hard-coded.
        expect(venuePage).toContain(
            'const { glyph: venueMenuGlyph } = resolveVenueMenuGlyph({ type: venue.type });'
        );
        expect(venuePage).toMatch(
            /\{ kind: 'menu', href: contactMode\.href, glyph: venueMenuGlyph \}/
        );
        expect(venuePage).toMatch(/contactMode\.kind === 'panel'\s*\?\s*\(\{ kind: 'inquire' \}/);
        expect(venuePage).toMatch(
            /contactMode\.kind === 'panel' \|\| venueWhatsApp\?\.mode === 'LOGGED_IN_ONLY'/
        );
        expect(venuePage).toMatch(/hasChannelsPanel && \(\s*<ListingChannelsPanel/);
        expect(venuePage).toContain('price={null}');
    });
});

describe('experience and venue mobile header spacing (same fixes as accommodation F1)', () => {
    const cases = [
        {
            name: 'experience',
            page: 'pages/[lang]/experiencias/[slug].astro',
            cls: 'exp-detail',
            header: 'components/listing/header/ListingHeader.astro',
            hdr: 'listing-header'
        },
        {
            name: 'venue',
            page: 'pages/[lang]/comer-y-salir/[slug].astro',
            cls: 'venue-detail',
            header: 'components/listing/header/ListingHeader.astro',
            hdr: 'listing-header'
        }
    ] as const;

    it.each(cases)('$name page keeps the breadcrumb visible (HOS-2623) and drops the gray strip', ({
        page,
        cls
    }) => {
        const source = read(page);

        // HOS-2623: the per-page hide hack is gone; the shared breadcrumb shows its parent on mobile.
        expect(source).not.toContain(`${cls}-breadcrumbs`);
        expect(source).toMatch(
            new RegExp(
                `:global\\(\\.wave-header \\.detail-page:has\\(\\.${cls}\\)\\)\\s*\\{\\s*padding-top: 0;`
            )
        );
    });

    it.each(cases)('$name header uses the h3 step for the mobile title', ({ header, hdr }) => {
        expect(read(header)).toMatch(
            new RegExp(
                `\\.${hdr}--mobile-gallery \\.${hdr}__title\\s*\\{[^}]*font-size: var\\(--text-h3`
            )
        );
    });
});
