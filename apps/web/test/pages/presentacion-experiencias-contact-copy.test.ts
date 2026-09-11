/**
 * @file presentacion-experiencias-contact-copy.test.ts
 * @description The experiences pitch page must describe the contact rule that
 * the code actually enforces (HOS-924).
 *
 * Until HOS-924 the page carried a written warning instead of a fix: "el
 * sistema te va a dejar publicar aunque hayas cargado sólo el WhatsApp — y tu
 * ficha va a salir sin ningún dato de contacto a la vista". That sentence was
 * TRUE, which is the problem — a captación document was patching a
 * mis-calibrated gate. Now the gate refuses, so the sentence became a lie in
 * the other direction, and a promise nobody would notice going stale.
 *
 * This is a copy-veracity guard, not a rendering test: what it protects is the
 * agreement between a hand-edited marketing page and
 * `resolveListingCompleteness`. It asserts the page states the live rule and no
 * longer states the retired one — and it executes the gate itself, so the claim
 * cannot pass by being merely well-worded.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CommerceEntityTypeEnum, resolveListingCompleteness } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

/**
 * Whitespace-collapsed source. The page wraps its prose at ~95 columns, so a
 * sentence-level assertion against the raw bytes would break on a reflow that
 * changed nothing a reader can see.
 */
const PAGE_SRC = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/presentacion/experiencias/index.astro'),
    'utf8'
).replace(/\s+/g, ' ');

describe('HOS-924 — the experiences pitch page describes the contact rule it enforces', () => {
    it('no longer promises that a WhatsApp-only listing can publish', () => {
        // The exact retired claim. It was accurate when written; the fix is
        // what made it false.
        expect(PAGE_SRC).not.toContain('dejar publicar aunque hayas cargado sólo el WhatsApp');
    });

    it('says the WhatsApp is not shown on the listing', () => {
        expect(PAGE_SRC).toContain('El WhatsApp <strong>no</strong> se muestra');
    });

    it('says a WhatsApp alone does not let you publish', () => {
        expect(PAGE_SRC).toContain('el sistema no te va a dejar publicar');
    });

    it('and the gate agrees — WhatsApp alone really does not publish', () => {
        // Executes the rule the copy describes. Without this the two tests
        // above only prove the page is worded a certain way.
        const listing = {
            name: 'Kayak al atardecer',
            summary: 'Una salida guiada de dos horas por la costa.',
            description:
                'Recorremos la costa del río Uruguay en kayak con un guía local certificado, con todo el equipo de seguridad incluido.',
            destinationId: '00000000-0000-4000-a000-000000000002',
            ownerId: '00000000-0000-4000-a000-000000000001',
            type: 'TOUR_GUIDE',
            media: { featuredImage: { url: 'https://example.com/kayak.jpg' } },
            priceFrom: 1_500_000,
            isPriceOnRequest: false
        };

        const whatsappOnly = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing: { ...listing, contactInfo: { whatsapp: '+5493447412233' } }
        });
        const withMobile = resolveListingCompleteness({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            listing: { ...listing, contactInfo: { mobilePhone: '+5493447412233' } }
        });

        expect(whatsappOnly.missing).toContain('contactInfo');
        expect(withMobile.missing).not.toContain('contactInfo');
    });
});
