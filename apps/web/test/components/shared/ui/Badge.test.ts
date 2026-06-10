/**
 * @file Badge.test.ts
 * @description Source-reading unit tests for Badge.astro.
 * Uses the project's conventional approach (Astro components are not runnable
 * in Vitest/jsdom — we assert on the source text).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/ui/Badge.astro'),
    'utf8'
);

describe('Badge.astro', () => {
    describe('imports', () => {
        it('imports types from badge.types.ts', () => {
            expect(src).toContain("from './badge.types'");
            expect(src).toContain('BadgeColorScheme');
            expect(src).toContain('BadgeSize');
            expect(src).toContain('BadgeVariant');
        });

        it('imports helpers from badge.utils.ts', () => {
            expect(src).toContain("from './badge.utils'");
            expect(src).toContain('buildBadgeInlineStyle');
            expect(src).toContain('buildBadgeClassName');
            expect(src).toContain('getBadgeIconSize');
        });

        it('imports resolveIcon from @repo/icons/resolver', () => {
            expect(src).toContain("from '@repo/icons/resolver'");
            expect(src).toContain('resolveIcon');
        });

        it('imports webLogger for dev-mode icon warning', () => {
            expect(src).toContain("from '@/lib/logger'");
            expect(src).toContain('webLogger');
        });
    });

    describe('type re-export', () => {
        it('re-exports BadgeColorScheme from badge.types.ts', () => {
            expect(src).toMatch(
                /export type \{[^}]*BadgeColorScheme[^}]*\} from '\.\/badge\.types'/
            );
        });
    });

    describe('props', () => {
        it('accepts label, href, colorScheme, size, variant', () => {
            expect(src).toContain('readonly label: string');
            expect(src).toContain('readonly href?: string');
            expect(src).toContain('readonly colorScheme: BadgeColorScheme');
            expect(src).toContain('readonly size?: BadgeSize');
            expect(src).toContain('readonly variant?: BadgeVariant');
        });

        it('accepts icon and ariaLabel', () => {
            expect(src).toContain('readonly icon?: string');
            expect(src).toContain('readonly ariaLabel?: string');
        });

        it('accepts an optional class prop for extra styling', () => {
            expect(src).toContain('readonly class?: string');
        });
    });

    describe('rendering branches', () => {
        it('renders <a> when href is provided', () => {
            expect(src).toContain('<a');
            expect(src).toContain('href={href}');
        });

        it('renders <span> when href is absent', () => {
            expect(src).toContain('<span');
        });

        it('forwards ariaLabel to the root element', () => {
            expect(src).toContain('aria-label={ariaLabel}');
        });
    });

    describe('icon handling', () => {
        it('calls resolveIcon with the icon name', () => {
            expect(src).toContain('resolveIcon({ iconName: icon })');
        });

        it('wraps dev-mode warning in import.meta.env.DEV check', () => {
            expect(src).toContain('import.meta.env.DEV');
            expect(src).toContain('webLogger.warn');
        });

        it('renders the resolved icon component', () => {
            expect(src).toContain('<IconComponent');
            expect(src).toContain('weight="regular"');
        });
    });

    describe('dot variant markup', () => {
        it('renders the leading dot element for variant="dot"', () => {
            expect(src).toContain('badge__dot');
            expect(src).toContain("variant === 'dot'");
        });
    });

    describe('styles', () => {
        it('uses the --radius-pill token for border-radius', () => {
            expect(src).toContain('var(--radius-pill)');
        });

        it('has the .badge--interactive rule for hover-lift affordance', () => {
            expect(src).toContain('.badge--interactive');
            expect(src).toMatch(/\.badge--interactive:hover[\s\S]*transform:\s*translateY/);
        });

        it('respects prefers-reduced-motion', () => {
            expect(src).toContain('prefers-reduced-motion: reduce');
        });

        it('defines .badge__dot rule for the dot indicator', () => {
            expect(src).toContain('.badge__dot');
            expect(src).toContain('border-radius: 50%');
        });

        it('no longer hardcodes min-height on .badge (computed per-instance)', () => {
            const badgeBlockMatch = src.match(/\.badge\s*\{[^}]*\}/);
            expect(badgeBlockMatch).not.toBeNull();
            // Within the base .badge block there should be no min-height declaration
            expect(badgeBlockMatch?.[0]).not.toContain('min-height');
        });
    });
});
