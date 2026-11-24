/**
 * @file retired-account-primitives.guard.test.ts
 * @description HOS-2416 AC-2 / HOS-2508: the legacy account primitives the kit
 * replaced are deleted, and nothing under `src` imports them again. A file that
 * comes back under the same name fails the first test; an import of it (or of
 * a copy re-added elsewhere under the same name) fails the second.
 *
 * @module test/static-guards/retired-account-primitives
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src');

/** Retired file (relative to `src`) → the module name an import would carry. */
const RETIRED: Readonly<Record<string, string>> = {
    'components/account/AccountPageHeader.astro': 'AccountPageHeader',
    'components/account/AccountSectionCard.astro': 'AccountSectionCard',
    'components/account/AccountEmptyState.astro': 'AccountEmptyState',
    'components/account/AccountEmptyState.tsx': 'AccountEmptyState',
    'components/account/AccountEmptyState.module.css': 'AccountEmptyState',
    'components/account/AccountPagination.astro': 'AccountPagination',
    'components/account/EditableContentCard.astro': 'EditableContentCard',
    'components/host/editor/ActionBar.client.tsx': 'ActionBar',
    'components/host/editor/SocialNetworksSection.client.tsx': 'SocialNetworksSection'
};

/** Every source file under `src` that can import a module. */
function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
        else if (/\.(ts|tsx|astro|css)$/.test(entry)) out.push(path);
    }
    return out;
}

describe('retired account primitives (HOS-2508)', () => {
    it.each(Object.keys(RETIRED))('%s stays deleted', (file) => {
        expect(existsSync(resolve(SRC, file))).toBe(false);
    });

    it('no source file imports or composes from a retired primitive', () => {
        const names = [...new Set(Object.values(RETIRED))];
        const importOf = new RegExp(
            `(?:from|import|composes:[^;]*from)\\s*['"][^'"]*/(?:${names.join('|')})(?:\\.[\\w.]+)?['"]`
        );
        const offenders = sourceFiles(SRC).filter((file) =>
            importOf.test(readFileSync(file, 'utf8'))
        );
        expect(offenders).toEqual([]);
    });
});
