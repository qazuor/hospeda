/**
 * @file mi-cuenta-cambiar-contrasena.astro.test.ts
 * @description Source-level regression test for the change-password page
 * (BETA-143 review). The page used to pre-suffix `title` with `| Hospeda`
 * before passing it to both `BaseLayout` and `SEOHead`, and `SEOHead`
 * appends `| Hospeda` again itself — producing a duplicated
 * "Cambiar contraseña | Hospeda | Hospeda" browser tab title.
 *
 * Astro pages cannot be rendered via Vitest, so we lean on string-level
 * assertions on the .astro source — same pattern used elsewhere in this
 * repo for Astro components (see mi-cuenta-editar.astro.test.ts).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/cambiar-contrasena/index.astro'),
    'utf8'
);

/** The page renders in `FocusShell` (HOS-2416), which owns BaseLayout and SEOHead. */
const shell = readFileSync(resolve(__dirname, '../../src/layouts/FocusShell.astro'), 'utf8');

describe('mi-cuenta/cambiar-contrasena/index.astro (BETA-143 title fix)', () => {
    it('does not manually suffix the title with "| Hospeda" (SEOHead already does)', () => {
        expect(source).not.toMatch(/\$\{title\}\s*\|\s*Hospeda/);
    });

    it('passes the raw title to FocusShell, which passes it to BaseLayout', () => {
        expect(source).toMatch(/<FocusShell[\s\S]*?title=\{title\}/);
        expect(shell).toMatch(/<BaseLayout[\s\S]*?title=\{title\}/);
        expect(shell).not.toMatch(/\$\{title\}\s*\|\s*Hospeda/);
    });

    it('passes the raw title to SEOHead (through FocusShell)', () => {
        expect(shell).toMatch(/<SEOHead[\s\S]*?title=\{title\}/);
    });
});
