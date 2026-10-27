/**
 * @file GastronomyMenu.translations.test.ts
 * @description Source-read guards for the carta's language switcher on the
 * public detail page (HOS-1043).
 *
 * Same source-read strategy as `GastronomyMenu.photo.test.ts` and for the
 * same reason: Biome does not lint `.astro`, and this component needs a
 * listing payload, a locale and a translation table to mount.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/gastronomy/GastronomyMenu.astro'),
    'utf8'
);

describe('GastronomyMenu.astro — the language switcher (HOS-1043)', () => {
    it('only renders the switcher when a translation is actually present', () => {
        // `hasTranslations` gates the switcher block — a switcher with
        // nothing to switch to would be a dead control on every `-pro` and
        // `-basico` listing, which is the overwhelming majority.
        expect(src).toContain('{hasStructuredMenu && hasTranslations && (');
    });

    it('carries every locale leg as a data attribute for the client-side swap', () => {
        // The switcher is vanilla JS, not a re-render: it needs the EN/PT text
        // already in the DOM to swap into, which is what `nameLangAttrs`/
        // `descLangAttrs` provide.
        expect(src).toContain('{...nameLangAttrs(section.nameI18n, section.name)}');
        expect(src).toContain('{...nameLangAttrs(item.nameI18n, item.name)}');
        expect(src).toContain('{...descLangAttrs(section.descriptionI18n, section.description)}');
        expect(src).toContain('{...descLangAttrs(item.descriptionI18n, item.description)}');
    });

    it('scopes the click listener to this carta, not the whole document', () => {
        // Two gastronomy listings never share a page, but the guard is cheap
        // and the alternative (a document-level listener) would be wrong the
        // day that changes.
        expect(src).toContain("document.getElementById('gastro-menu')");
    });

    it('resolves the displayed text through resolveI18nText with the legacy field as fallback', () => {
        expect(src).toContain('function localeText(');
        expect(src).toContain('return i18n ? resolveI18nText(i18n, lang) || legacy : legacy;');
    });
});
