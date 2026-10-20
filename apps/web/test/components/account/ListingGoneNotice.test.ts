/**
 * @file ListingGoneNotice.test.ts
 * @description TEST:V8a:6 / TEST:V8a:7 (component level, HOS-1492, rows 28 and
 * 35): what a conversation thread says when its listing no longer admits new
 * messages.
 *
 * Vitest cannot render `.astro` in this repo, so these assertions read the
 * SOURCE for the component's own decisions (an exhaustive `Record` per
 * availability, nothing for `AVAILABLE`, no fetch, no island, no Tailwind) and
 * read the real locale files for the copy each availability resolves to.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/account/ListingGoneNotice.astro'),
    'utf8'
);

type Locale = 'es' | 'en' | 'pt';

function readThreadAvailabilityCopy(locale: Locale): Record<string, string> {
    const json = JSON.parse(
        readFileSync(
            resolve(
                __dirname,
                `../../../../../packages/i18n/src/locales/${locale}/conversations.json`
            ),
            'utf8'
        )
    ) as { thread: { listingAvailability: Record<string, string> } };
    return json.thread.listingAvailability;
}

describe('ListingGoneNotice.astro — one line per availability, decides nothing', () => {
    it('TEST:V8a:6 — GONE reads the "this listing no longer exists" key (row 28)', () => {
        expect(SOURCE).toContain("GONE: 'conversations.thread.listingAvailability.gone'");
        expect(readThreadAvailabilityCopy('es').gone).toBe('Esta ficha ya no existe.');
    });

    it('TEST:V8a:7 — NOT_PUBLISHED reads the "cannot write for now" key (row 35)', () => {
        expect(SOURCE).toContain(
            "NOT_PUBLISHED: 'conversations.thread.listingAvailability.notPublished'"
        );
        expect(readThreadAvailabilityCopy('es').notPublished).toBe(
            'Por ahora no podés mandar mensajes sobre esta ficha.'
        );
    });

    it('TEST:V8a:7 — the row 35 copy never says why, in any locale', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const copy = readThreadAvailabilityCopy(locale);
            expect(copy.notPublished).toBeTruthy();
            expect(copy.gone).toBeTruthy();
            expect(copy.notPublished).not.toMatch(
                /borrador|archiv|moder|billing|suscrip|pago|draft|archive|subscri|payment|rascunho|assinatura|pagamento/i
            );
        }
    });

    it('AVAILABLE renders nothing', () => {
        expect(SOURCE).toContain('AVAILABLE: null,');
        expect(SOURCE).toContain('noticeKey && (');
    });

    it('dispatches through an exhaustive Record over the schema type, no comparisons', () => {
        expect(SOURCE).toContain(
            'const NOTICE_KEY_BY_AVAILABILITY: Readonly<Record<ConversationListingAvailability, string | null>>'
        );
        expect(SOURCE).not.toMatch(/availability\s*===|as unknown as/);
    });

    it('does not fetch, ships no island and styles with its CSS module', () => {
        expect(SOURCE).not.toMatch(/fetch\(|Api\./);
        expect(SOURCE).not.toMatch(/client:/);
        expect(SOURCE).toContain("import styles from './ListingGoneNotice.module.css';");
        expect(SOURCE).not.toMatch(/class="[^"]*\b(?:flex|p-\d|text-sm|bg-)/);
    });
});
