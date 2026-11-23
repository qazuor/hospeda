/**
 * @file desktop-card-visual-consistency.source.test.ts
 * @description HOS-2531 / HOS-2533 (AC-2.7, spec 7.6). Vitest cannot render `.astro` here,
 * so these tests read the comment-stripped SOURCE and pin the wiring that has no branching
 * logic of its own: which island fills the sidebar card, the mobile duplicate-host fix,
 * the wave divider and the token / button migrations.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Removes every match of `pattern`, repeating until none is left so nested fragments cannot re-form a marker. */
function stripUntilStable(source: string, pattern: RegExp): string {
    let current = source;
    let previous: string;
    do {
        previous = current;
        current = current.replace(pattern, '');
    } while (current !== previous);
    return current;
}

function read(relativePath: string): string {
    const source = readFileSync(resolve(__dirname, '../../../src', relativePath), 'utf8');
    // Only HTML comments are stripped: the page holds glob-like strings that a block-comment
    // strip would mistake for a comment opener and swallow whole slots.
    return stripUntilStable(source, /<!--[\s\S]*?-->/g);
}

const PAGE = read('pages/[lang]/alojamientos/[slug].astro');
const OWNER_CARD = read('components/accommodation/OwnerCard.astro');
const LOCATION = read('components/accommodation/LocationSection.astro');
const REPUTATION = read('components/accommodation/ExternalReputation.astro');
const REPUTATION_ROW = read('components/accommodation/ExternalReputationSummaryRow.astro');
const MAP_CSS = read('components/maps/LocationMap.module.css');
const DIVIDER = read('components/shared/ui/WaveDivider.astro');

describe('sidebar contact card (AC-2.7)', () => {
    const sidebar = PAGE.match(/<Fragment slot="sidebar">([\s\S]*?)<\/Fragment>/)?.[1] ?? '';

    it('fills the OwnerCard slot with the card island, hydrated from the desktop breakpoint', () => {
        expect(sidebar).toMatch(/<OwnerCard[\s\S]*<ListingContactCard[\s\S]*<\/OwnerCard>/);
        expect(sidebar).toContain('client:media="(min-width: 768px)"');
    });

    it('passes the entitlement flag and the plans href, never a WhatsApp number', () => {
        expect(sidebar).toContain('hasWhatsapp={accommodation.hasWhatsapp}');
        expect(sidebar).toContain('whatsappPlansHref={whatsappPlansHref}');
        expect(sidebar).not.toMatch(/whatsappNumber|\bwhatsapp=\{/i);
    });

    it('no longer mounts the bare ContactHost or WhatsAppContact in the page', () => {
        // `<ContactHostShell` (HOS-2537) is the no-JS wrapper, not the bare island.
        expect(PAGE).not.toMatch(/<ContactHost[\s>]/);
        expect(PAGE).not.toContain('<WhatsAppContact');
    });
});

describe('duplicate host on mobile', () => {
    it('hides the sidebar OwnerCard below 768px, where HostSection already shows the host', () => {
        expect(OWNER_CARD).toMatch(
            /@media \(max-width: 767px\)\s*\{\s*\.owner-card\s*\{\s*display: none;\s*\}\s*\}/
        );
        expect(PAGE).toContain('<HostSection');
    });

    it('re-shows the OwnerCard below 768px without JS so the no-JS contact fallback stays reachable (HOS-2537)', () => {
        expect(OWNER_CARD).toMatch(
            /<noscript>\s*<style is:inline>\s*@media \(max-width: 767px\)\s*\{\s*\.owner-card\s*\{\s*display: block !important;\s*\}\s*\}\s*<\/style>\s*<\/noscript>/
        );
    });
});

describe('visual consistency (HOS-2533)', () => {
    it('puts the wave divider at the top of the after-content slot, only with related content', () => {
        const after = PAGE.match(/<Fragment slot="after-content">([\s\S]*?)<RelatedCarousel/)?.[1];
        expect(after).toContain('{hasRelatedContent && <WaveDivider />}');
        expect(PAGE).toMatch(
            /const hasRelatedContent =[^;]*similarCards[^;]*ownerCards[^;]*postItems[^;]*eventItems/
        );
    });

    it('keeps the divider decorative and on the hero wave curve', () => {
        expect(DIVIDER).toContain('aria-hidden="true"');
        expect(DIVIDER).toContain('M0,60 C180,120 360,160 540,130');
    });

    it('gives the location map tiles the organic radius without clipping the disclaimer', () => {
        expect(LOCATION).toMatch(
            /\.location-section__map\s*\{[^}]*--location-map-tile-radius: var\(--radius-organic\)/
        );
        expect(MAP_CSS).toMatch(
            /\.mapWrapper\s*\{[^}]*border-radius: var\(--location-map-tile-radius, 0\)/
        );
        expect(MAP_CSS).not.toMatch(/\.root\s*\{[^}]*border-radius: var\(--radius-organic/);
    });

    it('renders the external reputation CTAs through GradientButton', () => {
        for (const source of [REPUTATION, REPUTATION_ROW]) {
            expect(source).toContain(
                "import GradientButton from '@/components/shared/ui/GradientButton.astro'"
            );
            expect(source).toContain('<GradientButton');
            expect(source).toContain('rel="noopener noreferrer"');
        }
        expect(REPUTATION).not.toContain('styles.seeAllLink');
        expect(REPUTATION_ROW).not.toMatch(/<a\s+href=\{deepLinkHref\}/);
    });
});
