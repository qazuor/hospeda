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
            'phone phone email website'
        ],
        ['experience', 'Experience', 'experiencias', 'experience', 'phone email website'],
        ['venue', 'Venue', 'comer-y-salir', 'venue', 'phone email website']
    ])('annotates each %s contact channel with its kind and listing context', (_directory, component, route, vertical, kinds) => {
        const builders = readSource('lib/listing-contact/listing-contact-block.ts');
        const builderName = `build${component}ContactBlock`;
        const start = builders.indexOf(`export function ${builderName}`);
        const next = builders.indexOf('\nexport function', start + 1);
        const body = builders.slice(start, next === -1 ? undefined : next);
        const page = pageSource(route);

        // The builder owns the channel kinds and the tracking context...
        const declared = [...body.matchAll(/kind: '(phone|email|website)'/g)].map(
            ([, kind]) => kind
        );
        expect(new Set(declared)).toEqual(new Set(kinds.split(' ')));
        expect(body).toContain(
            `trackingDataFor({ listingId: input.listingId, vertical: '${vertical}' })`
        );
        expect(builders).toContain("const origin: ContactOrigin = 'contact_block';");
        expect(builders).toContain("'listing-id': input.listingId");
        expect(builders).toContain("'contact-origin': origin");
        // ...and the page hands it the listing id and renders the shared block.
        expect(page).toContain(`${builderName}({`);
        expect(page).toMatch(new RegExp(`listingId: ${vertical}\\.id`));
        expect(page).toContain('ListingContactBlock');
    });

    it('stamps every shared channel and social link with the wrapper tracking data', () => {
        const shared = readSource('components/listing/contact/ListingContactBlock.astro');
        const social = readSource('components/listing/contact/ListingSocialLinks.astro');

        expect(shared).toContain('...trackingData');
        expect(shared).toContain("'contact-channel': kind");
        expect(shared).toContain("'contact-channel': 'menu'");
        expect(shared).toContain('trackingData={trackingData}');
        expect(social).toContain('...trackingData');
        expect(social).toContain("'contact-channel': 'social'");
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
