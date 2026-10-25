/**
 * @file SupportEditNotice.test.ts
 * @description TEST:V8a:8 (the screen part of "row 26 appears in the owner's
 * account", HOS-1493): the support-edit notice of the editor hubs.
 *
 * Vitest cannot render `.astro` in this repo (no Astro vite plugin in the test
 * pipeline), so the behaviour lives in `buildSupportEditNotice` — the pure
 * function the component renders verbatim — and is asserted here with the REAL
 * Spanish copy. The source assertions below pin the component's own decisions:
 * it renders the builder's output and nothing when the builder returns `null`,
 * it does not fetch, ships no island, and uses no Tailwind.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';
import { buildSupportEditNotice } from '@/lib/listing/support-edits';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/listing/SupportEditNotice.astro'),
    'utf8'
);

const ACCOMMODATION_HUB = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/mi-cuenta/propiedades/[id]/editar/index.astro'),
    'utf8'
);

const LISTING_HUB = readFileSync(
    resolve(
        __dirname,
        '../../../src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/index.astro'
    ),
    'utf8'
);

const es = createTranslations('es');

describe('TEST:V8a:8 SupportEditNotice — row 26 in the owner account', () => {
    it('renders nothing when support never edited the listing', () => {
        // Act
        const notice = buildSupportEditNotice({ locale: 'es', items: [], t: es.t });

        // Assert
        expect(notice).toBeNull();
    });

    it('says when support edited, which parts, that nothing was published/featured/deleted, and where to write', () => {
        // Arrange: 2026-10-10 01:30 UTC is still October 9 in Argentina.
        const items = [
            { occurredAt: '2026-10-01T12:00:00.000Z', parts: ['faq' as const] },
            { occurredAt: '2026-10-10T01:30:00.000Z', parts: ['texts' as const, 'photos' as const] }
        ];

        // Act
        const notice = buildSupportEditNotice({ locale: 'es', items, t: es.t });

        // Assert
        expect(notice).not.toBeNull();
        expect(notice?.edited).toBe(
            'Soporte editó el contenido de esta ficha el 9 de octubre de 2026: los textos y las fotos.'
        );
        expect(notice?.unchanged).toBe('No se publicó, no se destacó ni se borró por eso.');
        expect(notice?.contact).toBe('Si no lo pediste, escribinos.');
        expect(notice?.contactHref).toBe('/es/contacto/');
    });

    it('labels every part and joins three or more in natural language', () => {
        // Arrange
        const items = [
            {
                occurredAt: '2026-10-05T15:00:00.000Z',
                parts: ['hours' as const, 'faq' as const, 'other' as const]
            }
        ];

        // Act
        const notice = buildSupportEditNotice({ locale: 'es', items, t: es.t });

        // Assert
        expect(notice?.edited).toContain('los horarios, las preguntas frecuentes y otros datos.');
    });

    it('localizes the copy and the contact URL', () => {
        // Arrange
        const items = [{ occurredAt: '2026-10-05T15:00:00.000Z', parts: ['photos' as const] }];

        // Act
        const notice = buildSupportEditNotice({
            locale: 'en',
            items,
            t: createTranslations('en').t
        });

        // Assert
        expect(notice?.edited).toBe(
            'Support edited the content of this listing on October 5, 2026: the photos.'
        );
        expect(notice?.contactHref).toBe('/en/contacto/');
    });

    it('the component renders the builder output and nothing without it', () => {
        expect(SOURCE).toContain('buildSupportEditNotice({ locale, items, t })');
        expect(SOURCE).toMatch(/notice\s*&&\s*\(/);
        expect(SOURCE).toContain('{notice.edited}');
        expect(SOURCE).toContain('{notice.unchanged}');
        expect(SOURCE).toContain('href={notice.contactHref}');
        expect(SOURCE).toContain('{notice.contact}');
    });

    it('the component does not fetch, ships no island and uses its CSS Module', () => {
        expect(SOURCE).not.toMatch(/\bfetch\(/);
        expect(SOURCE).not.toMatch(/client:(load|idle|visible|only)/);
        expect(SOURCE).toContain("import styles from './SupportEditNotice.module.css'");
        expect(SOURCE).not.toMatch(/class="[^"]*\b(flex|mt-\d|p-\d|text-sm)\b/);
    });

    it('both editor hubs load the support edits and render the notice above the hub', () => {
        for (const hub of [ACCOMMODATION_HUB, LISTING_HUB]) {
            const parallel = hub.indexOf('Promise.all([');
            expect(parallel).toBeGreaterThanOrEqual(0);
            expect(parallel).toBeLessThan(hub.indexOf('loadSupportEdits({'));
            expect(hub).toContain('loadSupportEdits({');
            expect(hub).toContain(
                '<SupportEditNotice locale={locale} items={supportEdits.items} />'
            );
            expect(hub.indexOf('<SupportEditNotice')).toBeLessThan(hub.indexOf('<EditorHub'));
        }
        expect(ACCOMMODATION_HUB).toContain("vertical: 'accommodation'");
    });
});
