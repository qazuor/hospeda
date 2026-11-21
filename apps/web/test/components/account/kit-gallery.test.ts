/**
 * @file kit-gallery.test.ts
 * @description Gallery coverage guard (HOS-2413 T-029): every component exported
 * from `ui/index.ts` must appear in the gallery, so a new kit piece without a
 * gallery entry (and therefore without visual-regression coverage) fails CI.
 * Also pins the page's 404 gate and the `data-visual` naming.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = resolve(__dirname, '../../../src');
const index = readFileSync(resolve(src, 'components/account/ui/index.ts'), 'utf8');
const galleryDir = resolve(src, 'components/account/kit-gallery');
const gallery = readdirSync(galleryDir)
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => readFileSync(resolve(galleryDir, file), 'utf8'))
    .join('\n');
const page = readFileSync(resolve(src, 'pages/[lang]/mi-cuenta/kit/index.astro'), 'utf8');

/** Value exports that are not components: errors, hooks, helpers. */
const NOT_COMPONENTS = new Set(['KitNestingError']);

/** Names exported as values (components start with a capital letter). */
function exportedComponents(): string[] {
    const names = new Set<string>();
    for (const block of index.matchAll(/export\s*{([^}]*)}/g)) {
        for (const raw of (block[1] ?? '').split(',')) {
            const name = raw.trim();
            if (name === '' || name.startsWith('type ')) continue;
            if (/^[A-Z][A-Za-z0-9]*$/.test(name) && !NOT_COMPONENTS.has(name)) names.add(name);
        }
    }
    return [...names].sort();
}

describe('kit gallery coverage', () => {
    it('finds the kit components in index.ts (non-vacuity)', () => {
        expect(exportedComponents().length).toBeGreaterThan(30);
    });

    it.each(exportedComponents())('has an entry for %s', (name) => {
        expect(gallery).toMatch(new RegExp(`<${name}[\\s/>.]`));
    });

    it('wraps every state in a data-visual block named <Component>/<state>', () => {
        const names = [
            ...gallery.matchAll(/<Visual\s+(?:key=\{[^}]*\}\s+)?name=(?:"([^"]+)"|\{`([^`]+)`\})/g)
        ].map((m) => m[1] ?? m[2] ?? '');
        expect(names.length).toBeGreaterThan(40);
        for (const name of names) expect(name).toMatch(/^[A-Za-z]+\/[\w${}.-]+$/);
    });
});

describe('kit gallery page', () => {
    it('answers 404 when the gate is off', () => {
        expect(page).toContain('if (!isAccountKitGalleryEnabled()) {');
        expect(page).toContain('return new Response(null, { status: 404 });');
    });

    it('translates its page title instead of hardcoding it', () => {
        expect(page).toContain("t('account.ui.gallery.title')");
    });

    it('renders inside the new shell and reads only the locale', () => {
        expect(page).toContain('shell="account"');
        expect(page).not.toContain('Astro.locals.user');
    });
});
