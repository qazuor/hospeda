/**
 * @file ContactHostShell.test.ts
 * @description Source-based tests for `ContactHostShell.astro` (HOS-2537).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '../../../src', p), 'utf8');
const src = read('components/accommodation/ContactHostShell.astro');
const page = read('pages/[lang]/alojamientos/[slug].astro');

describe('ContactHostShell.astro (source-based)', () => {
    it('keeps the fallback hidden by default so JS-enabled visitors see no change', () => {
        expect(src).toContain('data-contact-fallback hidden');
    });

    it('swaps form for fallback inside <noscript>', () => {
        expect(src).toMatch(/<noscript>[\s\S]*\[data-contact-form\] \{ display: none; \}/);
        expect(src).toMatch(/\[data-contact-fallback\] \{ display: block; \}/);
    });

    it('renders phone, landline, email and website only; never WhatsApp', () => {
        expect(src).toContain('tel:${contactInfo.phone}');
        expect(src).toContain('tel:${contactInfo.landlinePhone}');
        expect(src).toContain('mailto:${contactInfo.email}');
        expect(src.split('---')[2] ?? '').not.toMatch(/whatsapp/i);
        expect(src).not.toContain('contactInfo.whatsapp');
    });

    it('sanitizes the host-authored website through the allow-list', () => {
        expect(src).toContain('resolveSafeExternalUrl(contactInfo?.website)');
        expect(src).not.toContain('href={contactInfo.website}');
    });

    it('is wrapped around the sidebar ContactHost island on the page', () => {
        expect(page).toMatch(/<ContactHostShell[^>]*>\s*<ContactHost\s+client:idle/);
    });
});
