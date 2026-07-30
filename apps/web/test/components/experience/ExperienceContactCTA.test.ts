/**
 * @file ExperienceContactCTA.test.ts
 * @description Source-read tests for ExperienceContactCTA.astro (SPEC-240 T-030).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/experience/ExperienceContactCTA.astro'),
    'utf8'
);

describe('ExperienceContactCTA.astro', () => {
    describe('early return', () => {
        it('returns early when contactInfo.whatsapp is not provided', () => {
            expect(src).toContain('contactInfo?.whatsapp');
            expect(src).toContain('return;');
        });
    });

    describe('WhatsApp deep link', () => {
        it('builds the wa.me URL through the shared builder', () => {
            expect(src).toContain("import { buildWhatsAppLink } from '@/lib/whatsapp'");
            expect(src).toContain('buildWhatsAppLink({ phone: contactInfo.whatsapp');
        });

        it('does not hand-roll phone sanitizing (HOS-289)', () => {
            // This replaces two tests that asserted `replace(/\D/g,` and
            // `startsWith('+')` — the second pinned the defect, since wa.me
            // rejects a leading `+`. URL shape lives in test/lib/whatsapp.test.ts.
            expect(src).not.toContain('replace(/\\D/g,');
            expect(src).not.toContain('wa.me/${');
        });

        it('renders nothing when the stored number has no digits to dial', () => {
            expect(src).toContain('if (!waUrl) return;');
        });

        it('opens in a new tab with noopener', () => {
            expect(src).toContain('target="_blank"');
            expect(src).toContain('rel="noopener noreferrer"');
        });
    });

    describe('i18n', () => {
        it('uses experience.detail.whatsapp key for the CTA label', () => {
            expect(src).toContain("t('experience.detail.whatsapp',");
        });

        it('uses a message key distinct from the button label (HOS-289)', () => {
            // Both used to read `experience.detail.whatsapp`, so the prefilled
            // chat message the visitor sent was literally "Consultar por
            // WhatsApp" and the {{name}} interpolation was a no-op.
            expect(src).toContain("'experience.detail.whatsappMessage'");
        });

        it('injects the experience name into the WhatsApp message template', () => {
            expect(src).toContain('experienceName');
            expect(src).toContain('{{name}}');
        });
    });

    describe('props', () => {
        it('accepts contactInfo (nullable)', () => {
            expect(src).toContain('contactInfo');
        });

        it('accepts experienceName for the message template', () => {
            expect(src).toContain('readonly experienceName: string');
        });

        it('accepts locale for i18n', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });
    });

    describe('accessibility', () => {
        it('has an aria-label on the WhatsApp anchor', () => {
            expect(src).toContain('aria-label=');
        });
    });

    describe('CSS tokens', () => {
        // Was `toContain('#25d366')` before HOS-314. This block is dormant
        // (HOS-363) but stays in lockstep with the accommodation button on
        // purpose: the divergence this issue fixed started with one surface
        // being left behind.
        it('takes the WhatsApp brand colors from the channel tokens (HOS-314)', () => {
            expect(src).toContain('background-color: var(--channel-whatsapp)');
            expect(src).toContain('color: var(--channel-whatsapp-foreground)');
            expect(src).toContain('background-color: var(--channel-whatsapp-hover)');
        });

        it('does not use Tailwind utility classes', () => {
            expect(src).not.toMatch(/class="[^"]*\b(text-|bg-|p-|m-)\w/);
        });
    });
});
