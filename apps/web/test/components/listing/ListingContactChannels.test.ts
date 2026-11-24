/**
 * @file ListingContactChannels.test.ts
 * @description Source-based tests for the shared contact block
 * (`ListingContactChannels.astro`, HOS-2520 items 18 and 19). `.astro` cannot
 * be rendered in Vitest, so the source and its three wrappers are asserted.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPONENTS = resolve(__dirname, '../../../src/components');
const read = (file: string) => readFileSync(resolve(COMPONENTS, file), 'utf8');

const shared = read('listing/contact/ListingContactChannels.astro');
const WRAPPERS = [
    'accommodation/AccommodationContactBlock.astro',
    'venue/VenueContactBlock.astro',
    'experience/ExperienceContactBlock.astro'
] as const;

describe('ListingContactChannels.astro', () => {
    it('renders channels as outline-primary GradientButtons with a leading icon', () => {
        expect(shared).toContain('<GradientButton');
        expect(shared).toContain('variant="outline-primary"');
        expect(shared).toContain('slot="leading"');
        expect(shared).toContain('srHint={srHint}');
    });

    it('renders social profiles as outline IconButtons with a brand icon passed in', () => {
        expect(shared).toContain('<IconButton');
        expect(shared).toContain('as="a"');
        expect(shared).toContain('variant="outline"');
        expect(shared).toContain('<Icon size={18} aria-hidden="true" />');
    });

    it('opens social profiles and websites in a new tab with noopener noreferrer', () => {
        expect(shared).toContain('rel="noopener noreferrer"');
        expect(shared).toContain("target: '_blank', rel: 'noopener noreferrer'");
        expect(shared).not.toContain('rel="sponsored');
    });

    it('takes its icons from @repo/icons only and has no WhatsApp channel', () => {
        expect(shared).toContain("from '@repo/icons'");
        expect(shared).not.toMatch(/WhatsappIcon|wa\.me|whatsapp:/i);
        expect(shared).not.toContain('phosphor');
        expect(shared).not.toContain('<svg');
    });

    it('never reads a raw URL: it receives already-safe hrefs', () => {
        expect(shared).not.toContain('contactInfo');
        expect(shared).not.toContain('socialNetworks');
    });

    it('tracks every link with the wrapper data plus its own contact-channel', () => {
        expect(shared).toContain('...trackingData');
        expect(shared).toContain("'contact-channel': kind");
        expect(shared).toContain("'contact-channel': 'social'");
        expect(shared).toContain("'interaction-kind': interactionKind");
    });

    it('exposes the anchor id, block props, a default slot and both shells', () => {
        expect(shared).toContain('id={id}');
        expect(shared).toContain('{...blockProps}');
        expect(shared).toContain('<slot />');
        expect(shared).toContain('.listing-contact--card');
        expect(shared).toContain('.listing-contact--plain');
    });
});

describe('contact block wrappers', () => {
    it.each(WRAPPERS)('%s renders through the shared component only', (file) => {
        const src = read(file);
        expect(src).toContain('<ListingContactChannels');
        expect(src).toContain('trackingData={trackingData}');
        expect(src).not.toContain('<IconButton');
        expect(src).not.toMatch(/<a\s/);
    });

    it('venue and accommodation pass social links with brand logos to the same component', () => {
        const venue = read('venue/VenueContactBlock.astro');
        const accommodation = read('accommodation/AccommodationContactBlock.astro');
        expect(venue).toContain('socialLinks={socialLinks}');
        expect(accommodation).toContain('socialLinks={socialLinks}');
        expect(venue).toContain('Icon');
        expect(accommodation).toContain('Icon: InstagramIcon');
    });

    it('experience renders no social row and no contact form', () => {
        const experience = read('experience/ExperienceContactBlock.astro');
        expect(experience).toContain('socialLinks={[]}');
        expect(experience).not.toMatch(/<form/);
    });
});
