/**
 * @file CompareModeControls.test.ts
 * @description Source-assertion tests for `CompareModeControls.astro` (HOS-85
 * T-005, entitlement-gate post-review fix). Astro components cannot be
 * rendered in Vitest, so this asserts on the component source — the
 * project's documented approach for `.astro` coverage (see
 * apps/web/CLAUDE.md > Testing).
 *
 * Coverage:
 * - Imports and mounts `CompareModeToggle` with `client:idle`.
 * - Receives and forwards the `locale` and `isAuthenticated` props.
 * - Does NOT mount `CompareModeBanner` (removed post-review — HOS-85 fix: the
 *   toggle itself now communicates the active state instead of a banner).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/compare/CompareModeControls.astro'),
    'utf8'
);

describe('CompareModeControls.astro (HOS-85 T-005)', () => {
    it('imports CompareModeToggle', () => {
        expect(src).toContain("import { CompareModeToggle } from './CompareModeToggle.client'");
    });

    it('mounts CompareModeToggle with client:idle, the locale prop, and the isAuthenticated prop', () => {
        expect(src).toMatch(
            /<CompareModeToggle\s+client:idle\s+locale=\{locale\}\s+isAuthenticated=\{isAuthenticated\}\s*\/>/
        );
    });

    it('does not import or mount CompareModeBanner (removed post-review)', () => {
        // A doc comment in the component explains the removal and legitimately
        // mentions the old component's name, so assert on the import/JSX usage
        // specifically rather than the bare string.
        expect(src).not.toContain("from './CompareModeBanner.client'");
        expect(src).not.toContain('<CompareModeBanner');
    });

    it('declares a readonly locale prop', () => {
        expect(src).toContain('readonly locale: SupportedLocale');
    });

    it('declares a readonly isAuthenticated prop', () => {
        expect(src).toContain('readonly isAuthenticated: boolean');
    });

    it('destructures isAuthenticated from Astro.props', () => {
        expect(src).toContain('const { locale, isAuthenticated } = Astro.props;');
    });
});
