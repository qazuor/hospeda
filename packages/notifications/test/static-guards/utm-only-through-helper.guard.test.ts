/**
 * @file utm-only-through-helper.guard.test.ts
 * @description UTMs are built only through `withUtm()` from `@repo/analytics` (HOS-2359, OD-4, AC-20).
 *
 * The closed UTM vocabulary is enforced by `withUtm()`. A hand-written `utm_` literal
 * would bypass it (an invented source/medium, or UTMs on an internal link), so no
 * source file under packages/notifications/src may contain one. Comment lines are ignored: prose that
 * explains a past bug with an example URL is not a UTM being built. Test files under
 * `src` are ignored too: they may use a UTM URL as input.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(__dirname, '../../src');

/** Lists every source file under a directory, test files excluded. */
function listSourceFiles({ dir }: { readonly dir: string }): readonly string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return entry === '__tests__' ? [] : listSourceFiles({ dir: full });
        }
        if (/\.(test|spec)\.tsx?$/.test(entry)) return [];
        return /\.tsx?$/.test(entry) ? [full] : [];
    });
}

/** True for a line that is only a comment (`//`, `/*`, ` *`). */
function isCommentLine({ line }: { readonly line: string }): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

describe('UTMs only through withUtm() (HOS-2359)', () => {
    it('no source file under packages/notifications/src writes a utm_ literal', () => {
        // Arrange
        const files = listSourceFiles({ dir: SRC_DIR });

        // Act
        const offenders = files.flatMap((file) =>
            readFileSync(file, 'utf-8')
                .split('\n')
                .flatMap((line, index) =>
                    line.includes('utm_') && !isCommentLine({ line })
                        ? [`${relative(SRC_DIR, file)}:${index + 1}`]
                        : []
                )
        );

        // Assert
        expect(files.length).toBeGreaterThan(10);
        expect(offenders).toEqual([]);
    });
});
