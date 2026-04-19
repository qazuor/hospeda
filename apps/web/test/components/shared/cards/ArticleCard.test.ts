/**
 * @file ArticleCard.test.ts
 * @description Source-reading tests for ArticleCard.astro after the Badge
 * migration (Phase 2). Asserts the inline `mutedColorScheme` literal has
 * been replaced by a call to the shared `getMutedColorScheme()` helper.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/ArticleCard.astro'),
    'utf8'
);

describe('ArticleCard.astro — Badge migration', () => {
    describe('imports', () => {
        it('imports getMutedColorScheme from @/lib/colors', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getMutedColorScheme');
        });

        it('imports Badge from Badge.astro', () => {
            expect(src).toContain("from '@/components/shared/ui/Badge.astro'");
        });
    });

    describe('muted color scheme usage', () => {
        it('uses getMutedColorScheme() instead of inlining the literal', () => {
            expect(src).toContain('getMutedColorScheme()');
        });

        it('no longer contains the inline muted color scheme literal', () => {
            // The old inline literal had this very specific opacity value for the
            // background. After migration the helper owns it.
            expect(src).not.toContain(
                "bg: 'oklch(from var(--core-muted-foreground) l c h / 0.08)'"
            );
        });
    });
});
