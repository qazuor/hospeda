/**
 * @file RelatedPostCard.test.ts
 * @description Source-reading tests for RelatedPostCard.astro after the Badge
 * migration (Phase 2). Asserts that the inline `.related-post-card__chip`
 * markup and CSS rules have been replaced by the shared Badge primitive with
 * the warm color scheme.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/cards/RelatedPostCard.astro'),
    'utf8'
);

describe('RelatedPostCard.astro — Badge migration', () => {
    describe('imports', () => {
        it('imports Badge from Badge.astro', () => {
            expect(src).toContain("from '@/components/shared/ui/Badge.astro'");
        });

        it('imports getWarmColorScheme from @/lib/colors', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getWarmColorScheme');
        });
    });

    describe('chip replacement', () => {
        it('uses the shared Badge primitive', () => {
            expect(src).toContain('<Badge');
        });

        it('does not contain the old `.related-post-card__chip` CSS rule', () => {
            // No selector (class block) using the chip name
            expect(src).not.toMatch(/\.related-post-card__chip\s*\{/);
        });

        it('does not render a `<span class="related-post-card__chip">`', () => {
            expect(src).not.toContain('related-post-card__chip');
        });

        it('does not hardcode --surface-warm / --accent in the chip context', () => {
            // After migration, those tokens live inside `getWarmColorScheme()`,
            // not in this file.
            expect(src).not.toContain('background-color: var(--surface-warm)');
        });
    });
});
