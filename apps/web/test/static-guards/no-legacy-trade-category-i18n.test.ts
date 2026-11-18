/**
 * @file no-legacy-trade-category-i18n.test.ts
 * @description The web app no longer resolves provider category labels through
 * the legacy `host-trades.categories.<ENUM>` i18n keys (HOS-919 T-042).
 *
 * Category names are admin-managed catalog data (`nameI18n`), resolved with
 * `@/lib/trade-category-labels`. A key built from the retired enum would resolve
 * to the raw text in production for any category the enum never had, and the
 * client dictionary no longer ships the prefix, so reintroducing it fails
 * silently at runtime. This pins it at the source instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIENT_I18N_KEY_PREFIXES } from '../../src/lib/i18n-client-namespaces';

const SRC = path.resolve(__dirname, '../../src');
const SCANNED = new Set(['.ts', '.tsx', '.astro']);
const LEGACY = 'host-trades.categories';

/** Every scanned file under a directory. */
function collect({ dir }: { readonly dir: string }): readonly string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collect({ dir: full });
        return SCANNED.has(path.extname(entry.name)) ? [full] : [];
    });
}

describe('legacy host-trades.categories i18n keys (HOS-919)', () => {
    it('is named by no source file of apps/web', () => {
        const offenders = collect({ dir: SRC })
            .filter((file) => fs.readFileSync(file, 'utf8').includes(LEGACY))
            .map((file) => path.relative(SRC, file));

        expect(offenders).toEqual([]);
    });

    it('is not shipped to the browser dictionary', () => {
        expect(CLIENT_I18N_KEY_PREFIXES as readonly string[]).not.toContain(LEGACY);
    });
});
