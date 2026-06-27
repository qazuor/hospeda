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
        it('builds the wa.me URL with phone and encoded message', () => {
            expect(src).toContain('wa.me/');
            expect(src).toContain('encodeURIComponent');
        });

        it('sanitizes the phone number to strip non-digit characters', () => {
            expect(src).toContain('replace(/\\D/g,');
        });

        it('preserves a leading + in international format', () => {
            expect(src).toContain("startsWith('+')");
        });

        it('opens in a new tab with noopener', () => {
            expect(src).toContain('target="_blank"');
            expect(src).toContain('rel="noopener noreferrer"');
        });
    });

    describe('i18n', () => {
        it('uses experience.detail.whatsapp key for the CTA label', () => {
            expect(src).toContain('experience.detail.whatsapp');
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
        it('uses #25d366 green for WhatsApp brand color', () => {
            expect(src).toContain('#25d366');
        });

        it('does not use Tailwind utility classes', () => {
            expect(src).not.toMatch(/class="[^"]*\b(text-|bg-|p-|m-)\w/);
        });
    });
});
