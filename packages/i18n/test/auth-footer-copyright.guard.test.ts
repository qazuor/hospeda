/**
 * @file auth-footer-copyright.guard.test.ts
 * @description Regression guard for HOS-940 — every authentication and error
 * screen served the Spanish copyright line on `/en/` and `/pt/`.
 *
 * `footer.allRightsReserved` existed in all three locales, so the structural
 * key-coverage checks passed: the value in `en/footer.json` and
 * `pt/footer.json` was the Spanish string copied verbatim. Structure was
 * complete, content was not, and no check looked at content.
 *
 * The same sentence lives under a second key, `footer.bottom.rights`, which WAS
 * translated. That is what made the defect visible as a contradiction: the home
 * page footer printed "All rights reserved" on `/en/` while the sign-in screen,
 * one navigation away, printed "Todos los derechos reservados".
 *
 * Two consumers print the broken key — `AuthLayout.astro` and
 * `ErrorLayout.astro` — so the blast radius was every auth screen and every
 * error screen in English and Portuguese.
 *
 * SCOPE: this guard asserts that the two copyright keys carry a value distinct
 * from the Spanish one in `en` and `pt`. It deliberately does NOT sweep the
 * whole file, and it makes no claim about translation QUALITY — only that the
 * Spanish string was not left in place. A broader value-comparison guard over
 * all of `footer.json` (which needs an exception list for proper nouns, brands
 * and cognates) is proposed on HOS-940 and not built here.
 */

import { describe, expect, it } from 'vitest';

/**
 * The locale files are pulled in as MODULES, not read from disk.
 *
 * `test/setup.ts` mocks `node:fs.readFileSync` package-wide to return a stub for
 * anything under `locales/`, so an fs-based reader here would inspect the stub
 * and report a clean pass over a file it never opened. `import.meta.glob` is
 * resolved by Vite at transform time and never touches that mock.
 */
const FOOTER_MODULES = import.meta.glob<Record<string, unknown>>('../src/locales/*/footer.json', {
    eager: true,
    import: 'default'
});

/** Locales whose copy must not be the Spanish source string. */
const TRANSLATED_LOCALES = ['en', 'pt'] as const;

/**
 * The two keys that render the copyright sentence, as dotted paths within
 * `footer.json`:
 *  - `allRightsReserved` — `AuthLayout.astro` and `ErrorLayout.astro` (the bug).
 *  - `bottom.rights` — `Footer.astro`, the site-wide footer (was already correct,
 *    and is the control: it is what proved the i18n engine itself was fine).
 */
const COPYRIGHT_KEYS = ['allRightsReserved', 'bottom.rights'] as const;

/** Resolve a dotted path inside a parsed locale namespace. */
const readPath = ({
    source,
    path
}: {
    readonly source: Record<string, unknown>;
    readonly path: string;
}): string | undefined => {
    const value = path.split('.').reduce<unknown>((node, segment) => {
        if (node === null || typeof node !== 'object') {
            return undefined;
        }
        return (node as Record<string, unknown>)[segment];
    }, source);

    return typeof value === 'string' ? value : undefined;
};

/** Load one locale's parsed `footer.json` by locale code. */
const loadFooter = ({ locale }: { readonly locale: string }): Record<string, unknown> => {
    const entry = Object.entries(FOOTER_MODULES).find(([path]) =>
        path.endsWith(`/locales/${locale}/footer.json`)
    );

    if (!entry) {
        throw new Error(
            `footer.json not found for locale "${locale}". Globbed: ${Object.keys(FOOTER_MODULES).join(', ')}`
        );
    }

    return entry[1];
};

describe('HOS-940: the auth/error copyright line is translated', () => {
    it('globs a footer.json for every expected locale', () => {
        // Without this the whole suite could pass by matching nothing at all.
        expect(Object.keys(FOOTER_MODULES).length).toBeGreaterThanOrEqual(3);

        for (const locale of ['es', ...TRANSLATED_LOCALES]) {
            expect(() => loadFooter({ locale })).not.toThrow();
        }
    });

    for (const key of COPYRIGHT_KEYS) {
        for (const locale of TRANSLATED_LOCALES) {
            it(`${locale}: footer.${key} is not the Spanish string`, () => {
                const spanish = readPath({ source: loadFooter({ locale: 'es' }), path: key });
                const translated = readPath({ source: loadFooter({ locale }), path: key });

                // Assert both values are actually present, so a renamed or
                // deleted key fails loudly instead of comparing undefined to
                // undefined and passing.
                expect(spanish, `footer.${key} missing in es`).toBeTruthy();
                expect(translated, `footer.${key} missing in ${locale}`).toBeTruthy();

                expect(
                    translated,
                    `footer.${key} in ${locale} still carries the Spanish copy ("${spanish}"). ` +
                        'AuthLayout.astro and ErrorLayout.astro print allRightsReserved, so this ' +
                        'ships the Spanish copyright on every auth and error screen in this locale.'
                ).not.toBe(spanish);
            });
        }
    }
});
