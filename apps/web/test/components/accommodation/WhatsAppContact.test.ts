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
            expect(src).toContain('buildWhatsAppLink');
        });

        it('delegates phone sanitizing to the shared builder (HOS-289)', () => {
            // This replaces a test that asserted `startsWith('+')`, i.e. it pinned
            // the defect: with the `+`, wa.me does not resolve the recipient. The
            // URL shape itself is asserted in test/lib/whatsapp.test.ts; here we
            // only require that the component does not hand-roll it again.
            expect(src).toContain("import { buildWhatsAppLink } from '@/lib/whatsapp'");
            expect(src).not.toContain('replace(/\\D/g,');
            expect(src).not.toContain('wa.me/${');
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
        // Until HOS-314 this suite asserted `toContain('#25d366')`, which meant
        // CI was certifying the hard-coded brand hex — and with it the 1.98:1
        // white-on-green pairing — rather than catching it.
        it('takes the WhatsApp brand colors from the channel tokens (HOS-314)', () => {
            expect(src).toContain('background-color: var(--channel-whatsapp)');
            expect(src).toContain('color: var(--channel-whatsapp-foreground)');
            expect(src).toContain('background-color: var(--channel-whatsapp-hover)');
            expect(src).toContain('color: var(--channel-whatsapp-text)');
        });

        it('does not fade the CTA on hover (opacity dims ink and fill alike)', () => {
            const buttonRule = src.slice(
                src.indexOf('.acc-whatsapp__btn:hover'),
                src.indexOf('.acc-whatsapp__number')
            );
            expect(buttonRule).not.toContain('opacity');
        });

        it('does not use Tailwind utility classes (web is vanilla CSS)', () => {
            expect(src).not.toMatch(/class="[^"]*\b(text-|bg-|p-|m-)\w/);
        });
    });
});
