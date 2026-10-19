/**
 * Source checks for the legal withdrawal page. Astro pages do not render in Vitest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/legal/arrepentimiento/index.astro');
const LOCALES_DIR = resolve(__dirname, '../../../../packages/i18n/src/locales');
const PAGE_SOURCE = readFileSync(PAGE_PATH, 'utf8');
const LOCALES = ['es', 'en', 'pt'] as const;

function readLocale(locale: (typeof LOCALES)[number], file: string): Record<string, unknown> {
    return JSON.parse(readFileSync(resolve(LOCALES_DIR, locale, file), 'utf8')) as Record<
        string,
        unknown
    >;
}

function nestedValue(value: Record<string, unknown>, path: readonly string[]): unknown {
    let current: unknown = value;
    for (const key of path) {
        if (!current || typeof current !== 'object' || !(key in current)) return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

describe('TEST:1700:2 AC:1700:1 AC:1700:2 AC:1700:3 withdrawal page source and catalogs', () => {
    it('TEST:1700:2 AC:1700:1 AC:1700:2 uses every required withdrawal translation key by name', () => {
        for (const key of [
            'terms.withdrawal.title',
            'terms.withdrawal.intro',
            'terms.withdrawal.effects',
            'terms.withdrawal.howTo',
            'terms.withdrawal.cta',
            'terms.withdrawal.mailAlternative',
            'terms.withdrawal.mailSubject',
            'terms.withdrawal.messageTemplate'
        ]) {
            expect(PAGE_SOURCE, key).toContain(`t('${key}'`);
        }
    });

    it('TEST:1700:2 AC:1700:2 links to the public form and provides the support mail alternative', () => {
        expect(PAGE_SOURCE).toMatch(
            /href=\{`\$\{buildUrl\(\{ locale, path: '\/contacto\/' \}\)\}\?type=revocation&message=\$\{encodeURIComponent\(t\('terms\.withdrawal\.messageTemplate'\)\)\}`\}/
        );
        expect(PAGE_SOURCE).toMatch(/href=\{`mailto:\$\{email\}\?subject=/);
        expect(PAGE_SOURCE).toContain("t('footer.contactEmail')");
    });

    it('TEST:1700:2 AC:1700:1 AC:1700:2 AC:1700:3 has every new catalog value in es, en, and pt', () => {
        const required: Readonly<Record<string, readonly string[]>> = {
            'footer.json': ['withdrawal'],
            'terms.json': [
                ['withdrawal', 'title'],
                ['withdrawal', 'description'],
                ['withdrawal', 'intro'],
                ['withdrawal', 'effects'],
                ['withdrawal', 'howTo'],
                ['withdrawal', 'cta'],
                ['withdrawal', 'mailAlternative'],
                ['withdrawal', 'mailSubject'],
                ['withdrawal', 'messageTemplate']
            ].map((path) => path.join('.')),
            'contact.json': ['form.typeRevocation']
        };

        for (const locale of LOCALES) {
            for (const [file, paths] of Object.entries(required)) {
                const catalog = readLocale(locale, file);
                for (const path of paths) {
                    const value = nestedValue(catalog, path.split('.'));
                    expect(typeof value, `${locale}/${file}:${path}`).toBe('string');
                    expect((value as string).trim(), `${locale}/${file}:${path}`).not.toBe('');
                }
            }
        }
    });

    it('TEST:1700:2 AC:1700:3 publishes the ten-day window cited by S36', () => {
        // S36's source constant: packages/service-core/src/services/billing/subscription/revocation-payment.ts:30 (REVOCATION_WINDOW_DAYS = 10).
        for (const locale of LOCALES) {
            const terms = readLocale(locale, 'terms.json');
            const intro = nestedValue(terms, ['withdrawal', 'intro']) as string;
            expect(intro).toMatch(/\b10\b/);
            expect(intro).not.toMatch(/\b(?!10\b)\d+\s+(?:calendar\s+)?(?:days?|d[ií]as?)\b/i);
        }
    });

    it('TEST:1700:2 AC:1700:2 does not read session state or inject HTML', () => {
        expect(PAGE_SOURCE).not.toContain('Astro.locals.user');
        expect(PAGE_SOURCE).not.toContain('set:html');
    });
});
