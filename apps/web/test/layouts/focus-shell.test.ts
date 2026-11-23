/**
 * @file focus-shell.test.ts
 * @description Source-level tests for `FocusShell` (HOS-2501, HOS-2416 §6.1).
 * Astro layouts cannot be rendered under Vitest, so these prove what the
 * layout DECLARES; the rendered landmarks are covered by the e2e sweep.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(__dirname, '../../src', file), 'utf8');
const shell = read('layouts/FocusShell.astro');
const css = read('layouts/FocusShell.module.css');

const FOCUS_PAGES = [
    'pages/[lang]/mi-cuenta/completar-perfil/index.astro',
    'pages/[lang]/mi-cuenta/agregar-contrasena/index.astro',
    'pages/[lang]/mi-cuenta/cambiar-contrasena/index.astro'
] as const;

describe('FocusShell.astro', () => {
    it('plugs a compact header and the account footer into the chrome slots', () => {
        expect(shell).toContain('slot="chrome-header"');
        expect(shell).toContain('slot="chrome-footer"');
        expect(shell).toContain('<AccountFooter');
        expect(shell).toContain('slot="chrome-toasts"');
    });

    it('has no sidebar, no bar and no site navigation', () => {
        expect(shell).not.toContain('AccountSidebar');
        expect(shell).not.toContain('AccountBar');
        expect(shell).not.toContain('<nav');
    });

    it('is noindex and reads no session', () => {
        expect(shell).toContain('noindex={true}');
        expect(shell).not.toContain('Astro.locals');
    });

    it('keeps the content at the reading width, in its own container', () => {
        expect(css).toContain('max-inline-size: var(--reading-max)');
        expect(css).toContain('container-type: inline-size');
        expect(shell).toContain('data-template="reading"');
    });
});

describe('the three focus pages', () => {
    it.each(FOCUS_PAGES)('%s renders in FocusShell, not BaseLayout', (page) => {
        const source = read(page);
        expect(source).toContain('<FocusShell');
        expect(source).not.toContain('<BaseLayout');
        expect(source).not.toContain('<SEOHead');
    });
});
