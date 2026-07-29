/**
 * @file contacto-whatsapp-degradation.test.ts
 * @description Regression tests for the contact page's WhatsApp channel
 * (HOS-289 follow-up).
 *
 * `buildWhatsAppLink` returns `null` for a value it cannot dial, and Astro
 * DROPS an attribute whose value is `null`. Passing that result straight into
 * `href={...}` therefore ships a fully-styled `<a>` that is not a link and
 * takes no keyboard focus — visually identical to a working one, with no
 * feedback. The two other call sites already degrade (`WhatsAppContact.astro`
 * falls through to the number as text, `ExperienceContactCTA.astro`
 * early-returns); this page did not.
 *
 * Source-read for the markup, matching the convention of the other
 * `.astro` tests in this suite; behavioural for the configured number.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWhatsAppLink } from '@/lib/whatsapp';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/contacto/index.astro'), 'utf8');

/** Locales whose `contact.whatsapp.value` the page renders. */
const LOCALES = ['es', 'en', 'pt'] as const;

/** Reads `contact.whatsapp.value` straight from the shipped locale bundle. */
function readConfiguredNumber(locale: string): string {
    const bundle = JSON.parse(
        readFileSync(
            resolve(__dirname, `../../../../packages/i18n/src/locales/${locale}/contact.json`),
            'utf8'
        )
    ) as { readonly whatsapp?: { readonly value?: string } };
    const value = bundle.whatsapp?.value;
    if (typeof value !== 'string') throw new Error(`contact.whatsapp.value missing for ${locale}`);
    return value;
}

describe('contacto/index.astro — WhatsApp channel', () => {
    describe('configured number', () => {
        it.each(LOCALES)('%s builds a real link, so the CTA is the live path', (locale) => {
            // If a locale's number is ever edited into something undialable this
            // fails HERE, instead of silently degrading the page in production.
            expect(buildWhatsAppLink({ phone: readConfiguredNumber(locale) }).url).toBe(
                'https://wa.me/5493442453797'
            );
        });
    });

    describe('degradation when the link cannot be built', () => {
        it('branches on the nullable href before rendering an anchor', () => {
            expect(src).toContain('if (!channel.href) {');
        });

        it('renders the fallback as a non-anchor card carrying no href', () => {
            const branchStart = src.indexOf('if (!channel.href) {');
            const branchEnd = src.indexOf('return (', src.indexOf('}', branchStart));
            const branch = src.slice(branchStart, branchEnd);

            expect(branch).toContain('contact-channel--static');
            expect(branch).toContain('<div');
            // The whole point: no attribute that Astro could drop into nothing.
            expect(branch).not.toContain('href=');
            // The number itself survives as selectable text (WhatsAppContact's
            // degradation), so the visitor is not left with nothing.
            expect(branch).toContain('contact-channel__value');
        });

        it('drops the social icon entirely instead of linking it nowhere', () => {
            // An icon-only entry has no text to degrade to, so it must not render.
            expect(src).toContain('...(whatsappHref');
        });
    });
});
