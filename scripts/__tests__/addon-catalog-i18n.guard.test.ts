import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_ADDON_CATALOG } from '../production-catalog/commercial-catalog.js';

type AddonCopy = Record<string, { name?: string; description?: string }>;

const LOCALES = ['es', 'en', 'pt'] as const;

function addonCopy(locale: string): AddonCopy {
    const file = resolve('packages/i18n/src/locales', locale, 'billing.json');
    const json = JSON.parse(readFileSync(file, 'utf8')) as { addon?: AddonCopy };
    return json.addon ?? {};
}

describe('HOS-2230 every production addon has display copy in every locale', () => {
    it('covers a non-empty catalog', () => {
        expect(PRODUCTION_ADDON_CATALOG.length).toBeGreaterThan(0);
    });

    for (const locale of LOCALES) {
        it(`${locale}: name and description exist for every addon slug`, () => {
            const copy = addonCopy(locale);
            for (const addon of PRODUCTION_ADDON_CATALOG) {
                expect(copy[addon.slug]?.name, `${locale} name ${addon.slug}`).toBeTruthy();
                expect(
                    copy[addon.slug]?.description,
                    `${locale} description ${addon.slug}`
                ).toBeTruthy();
            }
        });
    }

    it('es copy is not the English catalog text', () => {
        const copy = addonCopy('es');
        for (const addon of PRODUCTION_ADDON_CATALOG) {
            expect(copy[addon.slug]?.name).not.toBe(addon.name);
            expect(copy[addon.slug]?.description).not.toBe(addon.description);
        }
    });
});
