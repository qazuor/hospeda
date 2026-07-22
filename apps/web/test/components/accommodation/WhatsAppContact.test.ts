/**
 * @file WhatsAppContact.test.ts
 * @description Source-read tests for WhatsAppContact.astro (HOS-19), mirroring
 * the ExperienceContactCTA.astro convention. The authoritative VIEWER-gating
 * logic is unit-tested server-side (`resolveWhatsAppPayload`); this asserts the
 * component's three render branches and key rendering details.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/WhatsAppContact.astro'),
    'utf8'
);

describe('WhatsAppContact.astro', () => {
    describe('early return', () => {
        it('renders nothing when there is neither a number nor an upsell', () => {
            expect(src).toContain('if (!showUpsell && !number) return;');
        });
    });

    describe('direct (wa.me) branch', () => {
        it('only builds the wa.me URL when the viewer has the direct entitlement', () => {
            expect(src).toContain('if (number && direct)');
            expect(src).toContain('wa.me/');
            expect(src).toContain('encodeURIComponent');
        });

        it('sanitizes the phone number and preserves a leading +', () => {
            expect(src).toContain('replace(/\\D/g,');
            expect(src).toContain("startsWith('+')");
        });

        it('opens the deep link in a new tab with noopener', () => {
            expect(src).toContain('target="_blank"');
            expect(src).toContain('rel="noopener noreferrer"');
        });
    });

    describe('display-only branch', () => {
        it('renders the number as text when not entitled to the direct link', () => {
            expect(src).toContain('acc-whatsapp__number');
            expect(src).toContain('{number}');
        });
    });

    describe('upsell branch', () => {
        it('renders the upsell CTA pointing at the plans href', () => {
            expect(src).toContain('showUpsell ?');
            expect(src).toContain('acc-whatsapp__upsell');
            expect(src).toContain('href={plansHref}');
        });
    });

    describe('i18n', () => {
        it('uses the accommodations.detail.whatsapp namespace', () => {
            expect(src).toContain('accommodations.detail.whatsapp.title');
            expect(src).toContain('accommodations.detail.whatsapp.cta');
            expect(src).toContain('accommodations.detail.whatsapp.upsellText');
        });

        it('injects the accommodation name into the message template', () => {
            expect(src).toContain('accommodationName');
            expect(src).toContain('{{name}}');
        });
    });

    describe('props', () => {
        it('accepts number (nullable), direct, showUpsell, plansHref', () => {
            expect(src).toContain('readonly number: string | null');
            expect(src).toContain('readonly direct: boolean');
            expect(src).toContain('readonly showUpsell: boolean');
            expect(src).toContain('readonly plansHref: string');
        });
    });

    describe('accessibility', () => {
        it('has aria-labels on the WhatsApp anchor and the number', () => {
            expect(src).toContain('aria-label=');
        });
    });

    describe('CSS', () => {
        it('uses #25d366 green for the WhatsApp brand color', () => {
            expect(src).toContain('#25d366');
        });

        it('does not use Tailwind utility classes (web is vanilla CSS)', () => {
            expect(src).not.toMatch(/class="[^"]*\b(text-|bg-|p-|m-)\w/);
        });
    });
});
