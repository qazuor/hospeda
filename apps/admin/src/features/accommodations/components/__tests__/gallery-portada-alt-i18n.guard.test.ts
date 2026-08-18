/**
 * Guard: the portada `alt` fallback must come from @repo/i18n, never a literal.
 *
 * HOS-389 §5. Both portada sections — the accommodation one and its commerce
 * twin — ended their `alt` chain in the hardcoded Spanish string `'Portada'`.
 * That string is announced by a screen reader, so an operator running the admin
 * in English or Portuguese heard Spanish; and because it is the LAST link of an
 * `??` chain it only surfaces for rows carrying neither `alt` nor `caption`,
 * which is exactly the case nobody clicks through while testing.
 *
 * This is a static guard rather than two render tests on purpose: what regresses
 * here is someone re-introducing a literal while adding a third gallery, and a
 * render test only covers the component it renders. The predicate below asserts
 * exactly two things per file — the i18n key is referenced, and no bare
 * `'Portada'` literal survives — and nothing more.
 *
 * @module features/accommodations/components/__tests__/gallery-portada-alt-i18n.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The i18n key both components must resolve their `alt` fallback through. */
const ALT_FALLBACK_KEY = 'admin-pages.gallery.portada.altFallback';

/**
 * Every portada section that renders a featured image, relative to `apps/admin`.
 * Add a row here when a new vertical grows its own portada component.
 */
const PORTADA_SECTIONS: readonly string[] = [
    'src/features/accommodations/components/GalleryPortadaSection.tsx',
    'src/features/commerce/components/CommerceGalleryPortadaSection.tsx'
];

/** Reads a file relative to the `apps/admin` package root. */
function readAdminFile(relativePath: string): string {
    return readFileSync(resolve(__dirname, '../../../../..', relativePath), 'utf8');
}

/**
 * Strips block and line comments so the literal check reads CODE only.
 *
 * Both components legitimately name the concept in prose — the JSDoc says
 * `Renders the "Portada" (featured slot) section`, and that is the UI element's
 * actual name. Asserting over the raw file flagged those, which would make the
 * guard mean "never write this word" instead of "never render this word".
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('portada alt fallback — i18n guard (HOS-389 §5)', () => {
    it.each(PORTADA_SECTIONS)('%s resolves its alt fallback through i18n', (relativePath) => {
        const source = readAdminFile(relativePath);

        expect(source).toContain(ALT_FALLBACK_KEY);
    });

    it.each(PORTADA_SECTIONS)('%s renders no hardcoded Spanish literal', (relativePath) => {
        const code = stripComments(readAdminFile(relativePath));

        // Quoted forms only, over code with comments removed. The word appears
        // legitimately inside i18n KEYS (`admin-pages.gallery.portada.*`), in
        // component names, and in prose — flagging those would make the guard
        // assert something it does not mean.
        expect(code).not.toMatch(/(['"`])Portada\1/);
    });

    it('strips comments without eating the code around them', () => {
        // Non-vacuity for the check above: a `stripComments` that returned '' —
        // or ate the JSX — would make every file "pass" while the literal stayed
        // on screen. So: a commented literal is removed, a rendered one is not.
        const stripped = stripComments(
            ["/** doc 'Portada' */", "// line 'Portada'", "const a = 'Portada';"].join('\n')
        );

        expect(stripped).toContain("const a = 'Portada';");
        expect(stripped.match(/(['"`])Portada\1/g)).toHaveLength(1);
    });

    it('covers every portada section that exists on disk', () => {
        // Without this the guard silently shrinks: deleting a row from
        // PORTADA_SECTIONS would make the tests above pass vacuously while the
        // file it named kept its literal.
        expect(PORTADA_SECTIONS).toHaveLength(2);
        for (const relativePath of PORTADA_SECTIONS) {
            expect(() => readAdminFile(relativePath)).not.toThrow();
        }
    });
});
