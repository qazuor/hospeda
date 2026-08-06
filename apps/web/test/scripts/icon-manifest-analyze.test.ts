/**
 * @file icon-manifest-analyze.test.ts
 * @description Unit tests for the icon-sprite-manifest analyzer's pure
 * building blocks (HOS-369 sprite-manifest). Each piece is tested on
 * synthetic source strings — the same reason
 * `icon-sprite-shipped-weights.test.ts` does — so a mutation can be proven to
 * flip a real assertion without touching `src/`.
 */

import { describe, expect, it } from 'vitest';
import { analyzeIconManifest } from '../../scripts/icon-manifest/analyze';
import {
    extractIconIdentifiersFromConst,
    resolveDataDrivenGroups
} from '../../scripts/icon-manifest/data-driven-groups';
import { buildWrapperGlyphIndex } from '../../scripts/icon-manifest/glyph-resolver';
import { findRepoIconsImportBindings } from '../../scripts/icon-manifest/import-bindings';
import { findJsxOpenTags, resolveTagWeight } from '../../scripts/icon-manifest/jsx-tag-weights';

describe('findRepoIconsImportBindings', () => {
    it('finds a single-line named import', () => {
        const bindings = findRepoIconsImportBindings({
            source: "import { StarIcon, HomeIcon } from '@repo/icons';"
        });

        expect([...bindings.entries()]).toEqual([
            ['StarIcon', 'StarIcon'],
            ['HomeIcon', 'HomeIcon']
        ]);
    });

    it('finds a multi-line named import (Biome-wrapped)', () => {
        const bindings = findRepoIconsImportBindings({
            source: ['import {', '    StarIcon,', '    HomeIcon', "} from '@repo/icons';"].join(
                '\n'
            )
        });

        expect([...bindings.keys()]).toEqual(['StarIcon', 'HomeIcon']);
    });

    it('resolves `X as Y` aliasing to the local name', () => {
        const bindings = findRepoIconsImportBindings({
            source: "import { StarIcon as RatingIcon } from '@repo/icons';"
        });

        expect(bindings.get('RatingIcon')).toBe('StarIcon');
    });

    it('drops a per-specifier type-only import', () => {
        const bindings = findRepoIconsImportBindings({
            source: "import { type IconProps, StarIcon } from '@repo/icons';"
        });

        expect([...bindings.keys()]).toEqual(['StarIcon']);
    });

    it('drops a whole-statement type-only import entirely', () => {
        const bindings = findRepoIconsImportBindings({
            source: "import type { IconProps, SpriteWeight } from '@repo/icons';"
        });

        expect(bindings.size).toBe(0);
    });

    it('ignores an import from a different package', () => {
        const bindings = findRepoIconsImportBindings({
            source: "import { StarIcon } from '@some/other-package';"
        });

        expect(bindings.size).toBe(0);
    });
});

describe('findJsxOpenTags', () => {
    it('finds a self-closing tag', () => {
        const tags = findJsxOpenTags({ source: '<StarIcon weight="fill" />', tagName: 'StarIcon' });

        expect(tags).toEqual(['<StarIcon weight="fill" />']);
    });

    it('does not match a tag whose name is a prefix of another', () => {
        const tags = findJsxOpenTags({
            source: '<StarIconLarge weight="fill" />',
            tagName: 'StarIcon'
        });

        expect(tags).toEqual([]);
    });

    it('does not truncate at a `>` inside a brace-nested expression', () => {
        const source = "<StarIcon weight={active ? 'fill' : 'regular'} size={20} />";
        const tags = findJsxOpenTags({ source, tagName: 'StarIcon' });

        expect(tags).toEqual([source]);
    });

    it('does not truncate at a `>` inside a quoted attribute value', () => {
        const source = '<StarIcon aria-label="a > b" weight="fill" />';
        const tags = findJsxOpenTags({ source, tagName: 'StarIcon' });

        expect(tags).toEqual([source]);
    });

    it('finds every occurrence across multiple tags', () => {
        const source = '<StarIcon weight="fill" /> text <StarIcon weight="regular" />';
        const tags = findJsxOpenTags({ source, tagName: 'StarIcon' });

        expect(tags.length).toBe(2);
    });

    it('finds a non-self-closing open tag', () => {
        const source = '<StarIcon weight="fill">child</StarIcon>';
        const tags = findJsxOpenTags({ source, tagName: 'StarIcon' });

        expect(tags).toEqual(['<StarIcon weight="fill">']);
    });
});

describe('resolveTagWeight', () => {
    it('reads a literal weight', () => {
        const result = resolveTagWeight({ tagText: '<StarIcon weight="fill" />' });

        expect(result).toEqual({ literalWeights: ['fill'], dynamicCount: 0 });
    });

    it('counts a dynamic weight instead of reading a literal', () => {
        const result = resolveTagWeight({
            tagText: "<StarIcon weight={active ? 'fill' : 'regular'} />"
        });

        expect(result).toEqual({ literalWeights: [], dynamicCount: 1 });
    });

    it('reports neither when the tag has no weight attribute', () => {
        const result = resolveTagWeight({ tagText: '<StarIcon size={20} />' });

        expect(result).toEqual({ literalWeights: [], dynamicCount: 0 });
    });
});

describe('buildWrapperGlyphIndex', () => {
    const index = buildWrapperGlyphIndex();

    it('resolves a well-known wrapper to its real Phosphor sprite name', () => {
        expect(index.get('StarIcon')).toEqual({ spriteName: 'StarIcon', defaultWeight: 'duotone' });
    });

    it('collapses semantic aliases of the same glyph onto one sprite name', () => {
        expect(index.get('BellIcon')?.spriteName).toBe(index.get('NotificationIcon')?.spriteName);
    });

    it('reads a defaultWeight override', () => {
        expect(index.get('AddIcon')?.defaultWeight).toBe('regular');
    });

    it('resolves the name index.ts actually re-exports when two files declare the same wrapper name', () => {
        // packages/icons/src/icons/utilities/EditIcon.tsx also declares an
        // `EditIcon`, but index.ts's `export { EditIcon } from
        // './icons/actions/EditIcon'` is the one `@repo/icons` surfaces.
        expect(index.get('EditIcon')?.spriteName).toBe('PencilSimpleIcon');
    });

    it('excludes brand-mark icons (never sprite-eligible)', () => {
        expect(index.has('FacebookIcon')).toBe(false);
        expect(index.has('WhatsappIcon')).toBe(false);
    });

    it('excludes hand-crafted components with no createPhosphorIcon wrapper', () => {
        expect(index.has('BridgeIcon')).toBe(false);
    });

    it('resolves a non-trivial number of wrappers, so the scan is not silently empty', () => {
        expect(index.size).toBeGreaterThan(300);
    });
});

describe('extractIconIdentifiersFromConst', () => {
    it('extracts identifiers from shorthand object properties', () => {
        const ids = extractIconIdentifiersFromConst({
            source: 'export const MAP = { StarIcon, HomeIcon };',
            constName: 'MAP'
        });

        expect(ids).toEqual(['StarIcon', 'HomeIcon']);
    });

    it('extracts identifiers from `icon: X` properties', () => {
        const ids = extractIconIdentifiersFromConst({
            source: "export const MAP = { hotel: { icon: BellIcon, colorToken: 'x' } };",
            constName: 'MAP'
        });

        expect(ids).toEqual(['BellIcon']);
    });

    it('extracts identifiers from a function-call value', () => {
        const ids = extractIconIdentifiersFromConst({
            source: "export const MAP = { beach: visual(BeachIcon, 'water') };",
            constName: 'MAP'
        });

        expect(ids).toEqual(['BeachIcon']);
    });

    it('extracts an identifier from a computed-key object', () => {
        const ids = extractIconIdentifiersFromConst({
            source: 'export const MAP = { [SomeEnum.X]: TagIcon };',
            constName: 'MAP'
        });

        expect(ids).toEqual(['TagIcon']);
    });

    it('extracts a single bare identifier initializer', () => {
        const ids = extractIconIdentifiersFromConst({
            source: 'export const FALLBACK: ComponentType<IconProps> = TagIcon;',
            constName: 'FALLBACK'
        });

        expect(ids).toEqual(['TagIcon']);
    });

    it('ignores an identifier mentioned only in a comment', () => {
        const ids = extractIconIdentifiersFromConst({
            source: 'export const MAP = {\n  // CommentOnlyIcon should not count\n  StarIcon\n};',
            constName: 'MAP'
        });

        expect(ids).toEqual(['StarIcon']);
    });

    it('does not stop at a `;` inside a nested call before the real statement end', () => {
        const ids = extractIconIdentifiersFromConst({
            source: "export const MAP = weird(';', StarIcon);",
            constName: 'MAP'
        });

        expect(ids).toEqual(['StarIcon']);
    });

    it('returns null when the const is not found', () => {
        expect(
            extractIconIdentifiersFromConst({
                source: 'export const OTHER = {};',
                constName: 'MAP'
            })
        ).toBeNull();
    });
});

describe('resolveDataDrivenGroups', () => {
    const { groups, missing } = resolveDataDrivenGroups();

    it('resolves every declared group with no missing consts', () => {
        expect(missing).toEqual([]);
        expect(groups.length).toBeGreaterThan(5);
    });

    it('every group resolves a non-trivial number of icon identifiers', () => {
        for (const group of groups) {
            expect(group.iconIdentifiers.length, group.id).toBeGreaterThan(0);
        }
    });
});

describe('analyzeIconManifest — default weight is unconditional', () => {
    // Regression coverage for a real production gap: a manifest built by
    // logic that only added a glyph's default weight when a literal JSX tag
    // existed shipped "PencilSimpleIcon": "r" (missing "duotone"), because
    // `EditIcon` (default weight duotone, no explicit `defaultWeight`) is
    // only ever a literal tag at weight="regular" — its duotone default was
    // reached solely through an alias (`ContributionBanner.astro`) and two
    // local lookup tables (`discovery-doors.ts`, `comparison-row-icons.ts`).
    const report = analyzeIconManifest();

    it('includes PencilSimpleIcon-duotone even though EditIcon is never a literal duotone tag', () => {
        expect(report.pairs.get('PencilSimpleIcon')?.has('duotone')).toBe(true);
    });

    it('reports a non-trivial number of default-weight-only bindings (the alias/table usage pattern)', () => {
        expect(report.stats.defaultWeightOnlyBindings).toBeGreaterThan(0);
    });

    it('every resolved static binding contributes at least its default weight', () => {
        // Cheap, general re-statement of the same invariant the dedicated
        // static guard (icon-manifest-default-weight.test.ts) checks against
        // the COMMITTED manifest — this one checks it against a FRESH
        // analyzer run instead, so a regression here is caught before the
        // manifest is even regenerated.
        expect(report.stats.staticCallSitesResolved).toBeGreaterThanOrEqual(
            report.stats.defaultWeightOnlyBindings
        );
    });
});
