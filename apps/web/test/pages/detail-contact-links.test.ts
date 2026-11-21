import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');
const pageSource = (route: string) => readSource(`pages/[lang]/${route}/[slug].astro`);

describe('rendered contact-link contracts (Astro source)', () => {
    it.each([
        [
            'accommodation',
            'Accommodation',
            'alojamientos',
            'accommodation',
            'phone phone email website social social'
        ],
        ['experience', 'Experience', 'experiencias', 'experience', 'phone email website'],
        ['venue', 'Venue', 'comer-y-salir', 'venue', 'phone email website menu social']
    ])('annotates each %s contact anchor with its channel and listing context', (directory, component, route, vertical, channels) => {
        const block = readSource(`components/${directory}/${component}ContactBlock.astro`);
        const page = pageSource(route);

        const anchors = [...block.matchAll(/<a\s+[^>]*>/g)].map(([tag]) => tag);

        expect(anchors).toHaveLength(channels.split(' ').length);
        for (const [index, anchor] of anchors.entries()) {
            expect(anchor).toContain(`data-contact-channel="${channels.split(' ')[index]}"`);
            expect(anchor).toContain('{...trackingAttributes}');
        }
        expect(block).toContain(`'data-vertical': '${vertical}'`);
        expect(block).toContain("'data-listing-id': listingId");
        expect(block).toContain("'data-contact-origin': contactOrigin");
        expect(block).toContain("contactOrigin: ContactOrigin = 'contact_block'");
        expect(page).toMatch(new RegExp(`listingId(?:=\\{|: )${vertical}\\.id`));
    });

    it('renders partner phone and email using the resolver, preserving text for other fields', () => {
        const page = pageSource('partners');

        const anchor = page.match(/<a\s+href=\{row\.link\.href\}[^>]*>/)?.[0];

        expect(page).toContain('resolvePartnerContactLink({ field, value');
        expect(page).toContain('row.link ?');
        expect(page).toContain(': row.value');
        expect(anchor).toContain('data-contact-channel={row.link.channel}');
        expect(anchor).toContain('data-listing-id={partnerId}');
        expect(anchor).toContain('data-vertical="partner"');
        expect(anchor).toContain('data-contact-origin={contactOrigin}');
        expect(page).toContain("contactOrigin: ContactOrigin = 'contact_block'");
    });

    it.each([
        'alojamientos',
        'experiencias',
        'comer-y-salir',
        'partners'
    ])('mounts one processed tracker script on %s', (route) => {
        const page = pageSource(route);

        const mounts = page.match(
            /<script>\s*import \{ initContactLinkTracking \} from '@\/lib\/listing-contact\/track-contact-links';\s*initContactLinkTracking\(\{ document \}\);\s*<\/script>/g
        );

        expect(mounts).toHaveLength(1);
    });
});
