/**
 * @file account-settings-single-source.test.ts
 * @description HOS-2479 (D11): every account on/off setting has ONE source, the
 * Preferences page. No account page or island outside Preferences may render a
 * switch (AC-5), and the two product names decided by the owner on 2026-11-22
 * are applied in es, en and pt (sidebar item and page titles).
 *
 * @module test/static-guards/account-settings-single-source
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = resolve(__dirname, '../../src');
const I18N = resolve(__dirname, '../../../../packages/i18n/src/locales');

/** Where a switch is allowed: the kit itself and the Preferences islands. */
const ALLOWED = [
    'components/account/ui/',
    'components/account/preferences/',
    'components/account/PreferenceToggles.client.tsx'
];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

describe('account on/off settings live only in Preferences (HOS-2479, AC-5)', () => {
    const files = [
        ...walk(join(WEB_SRC, 'components/account')),
        ...walk(join(WEB_SRC, 'components/newsletter')),
        ...walk(join(WEB_SRC, 'pages/[lang]/mi-cuenta'))
    ].filter((file) => /\.(tsx|astro)$/.test(file));

    it('scans a non-trivial set of files', () => {
        expect(files.length).toBeGreaterThan(50);
    });

    it('renders no role="switch" and no kit Switch outside Preferences and the kit', () => {
        const offenders = files
            .filter((file) => {
                const rel = relative(WEB_SRC, file);
                return !ALLOWED.some((allowed) => rel.startsWith(allowed));
            })
            .filter((file) => {
                const source = readFileSync(file, 'utf8');
                return (
                    /role=["']switch["']/.test(source) ||
                    /\b(Switch|SwitchRow)\b[^;\n]*from ['"][^'"]*\/ui['"]/.test(source)
                );
            })
            .map((file) => relative(WEB_SRC, file));
        expect(offenders).toEqual([]);
    });
});

describe('product names decided by the owner on 2026-11-22 (HOS-2479)', () => {
    const NAMES = {
        es: { updates: 'Novedades de Hospeda', newsletter: 'Newsletter por mail' },
        en: { updates: 'Hospeda updates', newsletter: 'Email newsletter' },
        pt: { updates: 'Novidades do Hospeda', newsletter: 'Newsletter por e-mail' }
    } as const;

    it.each(
        Object.keys(NAMES) as (keyof typeof NAMES)[]
    )('%s: sidebar item and page titles carry the names', (locale) => {
        const account = JSON.parse(readFileSync(join(I18N, locale, 'account.json'), 'utf8')) as {
            nav: { newsletter: string; whatsNew: string };
            newsletter: { title: string };
            pages: { whatsNew: { title: string } };
            preferences: { sections: { newsletter: string } };
        };
        expect(account.nav.whatsNew).toBe(NAMES[locale].updates);
        expect(account.pages.whatsNew.title).toBe(NAMES[locale].updates);
        expect(account.nav.newsletter).toBe(NAMES[locale].newsletter);
        expect(account.newsletter.title).toBe(NAMES[locale].newsletter);
        expect(account.preferences.sections.newsletter).toBe(NAMES[locale].newsletter);
    });
});
