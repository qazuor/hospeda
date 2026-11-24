/**
 * @file mi-cuenta-no-encontrado.astro.test.ts
 * @description Source-level assertions for the in-layout account 404
 * (HOS-2434, moved to the kit in HOS-2504). Astro pages cannot be rendered in
 * Vitest, so these read the `.astro` source, block comments stripped.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/no-encontrado.astro'),
    'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('mi-cuenta/no-encontrado — kit 404 inside the shell (HOS-2504)', () => {
    it('keeps the real 404 status and the private cache header', () => {
        expect(source).toContain('Astro.response.status = 404;');
        expect(source).toContain("'private, no-store'");
    });

    it('renders the kit PageHeader and EmptyState with a back LinkButton', () => {
        expect(source).toMatch(/<PageHeader\s/);
        expect(source).toMatch(/<EmptyState\s/);
        expect(source).toMatch(/<LinkButton\s+slot="action"/);
        expect(source).toContain('ACCOUNT_NOT_FOUND_BACK_TARGETS[backKey]');
    });

    it('no longer uses the legacy account primitives', () => {
        expect(source).not.toContain('AccountSectionCard');
        expect(source).not.toContain('AccountEmptyState');
    });
});
