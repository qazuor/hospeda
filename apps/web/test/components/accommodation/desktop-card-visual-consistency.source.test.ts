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
const CONTACT_CARD = read('components/accommodation/ContactCard.astro');
const SHELL = read('components/accommodation/ContactHostShell.astro');
const LOCATION = read('components/listing/location/LocationSection.astro');
const REPUTATION = read('components/accommodation/ExternalReputation.astro');
const REPUTATION_ROW = read('components/accommodation/ExternalReputationSummaryRow.astro');
const MAP_CSS = read('components/maps/LocationMap.module.css');
const DIVIDER = read('components/shared/ui/WaveDivider.astro');

describe('sidebar contact entry (AC-2.7)', () => {
    const sidebar = PAGE.match(/<Fragment slot="sidebar">([\s\S]*?)<\/Fragment>/)?.[1] ?? '';

    it('hydrates the desktop price actions and connects them to the inquiry panel', () => {
        // CARD-022 H-4: the inline form is replaced by Consultar opening the shared panel.
        const pricing = read('components/accommodation/PricingSidebar.astro');
        expect(sidebar).toMatch(/<PricingSidebar\b[^>]*panelId=\{panelId\}/);
        expect(sidebar).not.toMatch(/<(?:ListingContactCard|ContactHost)\b/);
        expect(pricing).toMatch(/<ListingContactActions client:idle\b[^>]*panelId=\{panelId\}/);
        expect(pricing).toMatch(
            /@media \(max-width: 1024px\)[\s\S]*?\.pricing-sidebar\s*\{\s*display: none;/
        );
        expect(PAGE).toMatch(/<ListingContactPanel\s+client:idle\s+panelId=\{panelId\}/);
    });

    it('passes the entitlement flag and the plans href, never a WhatsApp number', () => {
        // CARD-022 H-4: both entry surfaces now share the gated contact panel.
        const panel = PAGE.match(/<ListingContactPanel\b[^>]*\/>/)?.[0];
        expect(sidebar).toContain('hasWhatsapp={accommodation.hasWhatsapp}');
        expect(panel).toContain('hasWhatsapp={accommodation.hasWhatsapp}');
        expect(panel).toContain('whatsappPlansHref={whatsappPlansHref}');
        expect(`${sidebar}${panel}`).not.toMatch(/whatsappNumber|\bwhatsapp=\{/i);
    });

    it('no longer mounts the bare ContactHost or WhatsAppContact in the page', () => {
        // `<ContactHostShell` (HOS-2537) is the no-JS wrapper, not the bare island.
        expect(PAGE).not.toMatch(/<ContactHost[\s>]/);
        expect(PAGE).not.toContain('<WhatsAppContact');
    });
});

describe('single host presentation (owner decision, HOS-2520)', () => {
    it('the sidebar card never shows the host identity, at any width', () => {
        const code = CONTACT_CARD.replace(/\/\*[\s\S]*?\*\//g, '');
        expect(code).not.toMatch(/owner|avatar|initials|memberSince|getMediaUrl/i);
        expect(PAGE).not.toContain('<OwnerCard');
        expect(PAGE).toContain('<HostSection');
    });

    it('hides the card below 768px, where the dock + panel are the contact path', () => {
        expect(CONTACT_CARD).toMatch(
            /@media \(max-width: 767px\)\s*\{\s*\.contact-card\s*\{\s*display: none;\s*\}/
        );
    });

    it('keeps the public channels reachable on mobile when the form cannot be used', () => {
        // Pre-hydration taps on «Consultar» fall back to #contact: :target reveals the channels.
        expect(CONTACT_CARD).toContain('id="contact"');
        expect(CONTACT_CARD).toContain('.contact-card:target [data-contact-fallback]');
        expect(CONTACT_CARD).toContain('.contact-card:target [data-contact-form]');
        // Hydration failed: the shell revealed its fallback inside the card.
        expect(CONTACT_CARD).toContain('.contact-card:has([data-contact-fallback]:not([hidden]))');
        expect(SHELL).toContain('data-contact-fallback');
    });

    it('re-shows the card below 768px without JS so the no-JS contact fallback stays reachable (HOS-2537)', () => {
        expect(CONTACT_CARD).toMatch(
            /<noscript>\s*<style is:inline>\s*@media \(max-width: 767px\)\s*\{\s*\.contact-card\s*\{\s*display: block !important;\s*\}\s*\}\s*<\/style>\s*<\/noscript>/
        );
    });
});

describe('visual consistency (HOS-2533)', () => {
    it('puts a spaced hairline at the top of the after-content slot only with related content', () => {
        // D25 (EXTRA-2) replaces the decorative wave with a hairline.
        const after = PAGE.match(/<Fragment slot="after-content">([\s\S]*?)<RelatedCarousel/)?.[1];
        expect(after).toMatch(
            /\{hasRelatedContent && \(\s*<ListingDetailSlot name="related"[^>]*class="acc-related"/
        );
        expect(PAGE).not.toMatch(/<WaveDivider\b/);
        expect(PAGE).toMatch(
            /\.acc-related\)\s*\{[^}]*border-block-start:\s*1px solid var\(--border\);[^}]*margin-block-start:\s*var\(--space-6\)/
        );
        expect(PAGE).toMatch(
            /const hasRelatedContent =[^;]*similarCards[^;]*ownerCards[^;]*postItems[^;]*eventItems/
        );
    });

    it('keeps the divider decorative and on the hero wave curve', () => {
        expect(DIVIDER).toContain('aria-hidden="true"');
        expect(DIVIDER).toContain('M0,60 C180,120 360,160 540,130');
    });

    it('gives the location map tiles the uniform card radius without clipping the disclaimer', () => {
        // Owner smoke (HOS-2520): the organic radius rounded only two corners of the map.
        expect(LOCATION).toMatch(
            /\.location-section__map\s*\{[^}]*--location-map-tile-radius: var\(--radius-card\)/
        );
        expect(LOCATION).not.toContain('--radius-organic');
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
