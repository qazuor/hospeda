/**
 * Every `helpId` / `data-help` literal in `apps/web/src` must be a valid help
 * anchor per `parseHelpAnchor`, the authoritative grammar (HOS-2410). The kit's
 * own looser regex let invalid ids ship silently; this scan catches them.
 *
 * Templated ids (`section:${vertical}.dashboard`) are checked with the
 * placeholder replaced by `venue` and `experience`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseHelpAnchor } from '../../../../packages/help/src/anchors';

const SRC = resolve(__dirname, '../../src');

function sourceFiles(): string[] {
    // Scan the working tree so newly added files are checked and deleted files are not opened.
    return readdirSync(SRC, { recursive: true })
        .filter((file) => /\.(tsx?|astro)$/.test(file))
        .map((file) => resolve(SRC, file));
}

describe('help anchor literals in apps/web/src', () => {
    it('every section: literal parses with parseHelpAnchor', () => {
        // Arrange
        const bad: string[] = [];
        let seen = 0;

        // Act
        for (const file of sourceFiles()) {
            const text = readFileSync(file, 'utf8');
            for (const match of text.matchAll(/["'`{](section:[A-Za-z0-9.#_${}-]+)/g)) {
                const raw = match[1] ?? '';
                seen++;
                for (const vertical of ['venue', 'experience']) {
                    const anchor = raw.replace(/\$\{vertical\}/g, vertical);
                    if (anchor.includes('${')) continue; // other templates are built from validated parts
                    if (parseHelpAnchor({ anchor }) === undefined) {
                        bad.push(`${file.replace(SRC, 'src')}: ${anchor}`);
                    }
                }
            }
        }

        // Assert
        expect(seen).toBeGreaterThan(20);
        expect([...new Set(bad)]).toEqual([]);
    });
});
