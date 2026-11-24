/**
 * @file ListingContactBlock.test.ts
 * @description Source tests of the shared contact block (HOS-2579 §6.4,
 * AC-13 to AC-16): `ListingContactBlock.astro` and `ListingSocialLinks.astro`.
 * `.astro` cannot be rendered in Vitest here, so the source is asserted; the
 * data rules live in `listing-contact-block.ts` and are unit tested in
 * `test/lib/listing-contact/listing-contact-block.test.ts`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../../src');
const read = (file: string): string => readFileSync(resolve(SRC, file), 'utf8');

const block = read('components/listing/contact/ListingContactBlock.astro');
const social = read('components/listing/contact/ListingSocialLinks.astro');
const PAGES = [
    'pages/[lang]/alojamientos/[slug].astro',
    'pages/[lang]/comer-y-salir/[slug].astro',
    'pages/[lang]/experiencias/[slug].astro'
] as const;

describe('ListingContactBlock.astro', () => {
    it('renders channels as outline-primary GradientButtons with a leading icon', () => {
        expect(block).toContain('<GradientButton');
        expect(block).toContain('variant="outline-primary"');
        expect(block).toContain('slot="leading"');
        expect(block).toContain('srHint={srHint}');
    });

    it('opens only the website channel in a new tab, noopener noreferrer, never sponsored', () => {
        expect(block).toContain("target: '_blank', rel: 'noopener noreferrer'");
        expect(block).not.toContain('rel="sponsored');
    });

    it('draws the menu link with ExternalLinkIcon instead of a ↗ glyph', () => {
        const menu = block.slice(
            block.indexOf('{menuLink && ('),
            block.indexOf('<ListingSocialLinks')
        );
        expect(menu).toContain('<ExternalLinkIcon slot="trailing"');
        expect(menu).toContain('label={menuLink.label}');
        expect(block).not.toContain('↗');
    });

    it('delegates the social row to ListingSocialLinks with its own tracking data', () => {
        expect(block).toMatch(
            /<ListingSocialLinks\s+links=\{socialLinks\}\s+heading=\{socialHeading\}\s+trackingData=\{trackingData\}/
        );
        expect(block).not.toContain('<IconButton');
    });

    it('exposes the anchor id and the block props on its root section', () => {
        expect(block).toContain('id={id}');
        expect(block).toContain('{...blockProps}');
        expect(block).toContain('.listing-contact--card');
        expect(block).toContain('.listing-contact--plain');
    });

    it('takes icons from @repo/icons only and never reads a raw URL field', () => {
        expect(block).toContain("from '@repo/icons'");
        expect(block).not.toContain('<svg');
        const code = block.replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toContain('contactInfo');
        expect(code).not.toContain('socialNetworks');
        expect(code).not.toContain('resolveSafeExternalUrl');
    });
});

describe('ListingSocialLinks.astro', () => {
    it('renders outline IconButtons with the brand logo, opened in a new tab', () => {
        expect(social).toContain('<IconButton');
        expect(social).toContain('as="a"');
        expect(social).toContain('variant="outline"');
        expect(social).toContain('rel="noopener noreferrer"');
        expect(social).toContain('<Icon size={18} aria-hidden="true" />');
    });

    it('tracks each profile as social, with the owner-panel kind when counted', () => {
        expect(social).toContain('...trackingData');
        expect(social).toContain("'contact-channel': 'social'");
        expect(social).toContain("'interaction-kind': interactionKind");
    });

    it('renders nothing without links', () => {
        expect(social).toMatch(/\{links\.length > 0 && \(/);
    });
});

describe('the three pages use the shared block only (HOS-2579 §6.4, AC-14)', () => {
    it.each(PAGES)('%s renders ListingContactBlock behind its builder result', (page) => {
        const src = read(page);
        expect(src).toContain(
            "import ListingContactBlock from '@/components/listing/contact/ListingContactBlock.astro'"
        );
        expect(src).toMatch(/build(Accommodation|Venue|Experience)ContactBlock\(\{/);
        expect(src).not.toMatch(/(Accommodation|Venue|Experience)ContactBlock\.astro/);
    });

    it('deleted the three wrappers', () => {
        for (const file of [
            'components/accommodation/AccommodationContactBlock.astro',
            'components/venue/VenueContactBlock.astro',
            'components/experience/ExperienceContactBlock.astro',
            'components/listing/contact/ListingContactChannels.astro'
        ]) {
            expect(existsSync(resolve(SRC, file))).toBe(false);
        }
    });

    it('ExperienceInfo is gone, so no social row is left outside the block (HOS-2579)', () => {
        expect(
            existsSync(
                resolve(__dirname, '../../../../src/components/experience/ExperienceInfo.astro')
            )
        ).toBe(false);
        const description = read('components/experience/ExperienceDescription.astro');
        expect(description).not.toContain('socialNetworks');
        expect(description).not.toContain('exp-info__social');
    });
});
