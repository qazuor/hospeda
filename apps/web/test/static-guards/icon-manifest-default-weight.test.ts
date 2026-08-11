/**
 * @file icon-manifest-default-weight.test.ts
 * @description Guard for the invariant that closes the production gap found
 * in `PencilSimpleIcon` (aka `EditIcon`): every `@repo/icons` identifier
 * imported ANYWHERE in `apps/web/src` — whether or not it is ever a literal
 * JSX tag — must carry its resolved DEFAULT weight
 * (`weight ?? defaultWeight ?? 'duotone'`) in the committed manifest. An
 * identifier reachable only through an alias (`const Icon = a ? X : Y; <Icon
 * />`) or a local lookup table (`icon: X` in `comparison-row-icons.ts`,
 * `discovery-doors.ts`, …) renders at its DEFAULT weight whenever picked,
 * with no literal tag anywhere for a source scan to key off of.
 *
 * Deliberately does NOT call `analyzeIconManifest()`. That function is where
 * the bug lived (it only added a default-weight pair when a literal JSX tag
 * happened to exist), so re-deriving this check through it would just prove
 * the (possibly still-buggy, in some future edit) analyzer agrees with
 * itself — exactly the failure mode the coverage guard's own doc warns
 * about. This file reconstructs the invariant independently from the
 * lower-level, non-decisional primitives (`buildWrapperGlyphIndex`,
 * `findRepoIconsImportBindings`, `collectSourceFiles` — pure parsing, no
 * "when do we add a pair" control flow) and cross-checks the COMMITTED
 * manifest file directly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectSourceFiles } from '../../scripts/icon-manifest/fs-utils';
import { buildWrapperGlyphIndex } from '../../scripts/icon-manifest/glyph-resolver';
import { findRepoIconsImportBindings } from '../../scripts/icon-manifest/import-bindings';

const WEB_SRC_DIR = resolve(__dirname, '../../src');
const MANIFEST_PATH = resolve(__dirname, '../../src/lib/icon-sprite-manifest.json');

/** Maps a resolved weight name to the initial letter the compact manifest encodes it as. */
const WEIGHT_INITIAL: Readonly<Record<string, string>> = {
    regular: 'r',
    bold: 'b',
    fill: 'f',
    duotone: 'd'
};

/** One missing-default-weight finding. */
interface MissingDefault {
    readonly spriteName: string;
    readonly defaultWeight: string;
    readonly reachedVia: string;
    readonly manifestEntry: string;
}

/**
 * Finds every reachable `@repo/icons` identifier whose resolved default
 * weight is absent from the given manifest.
 */
function findMissingDefaultWeights({
    manifest,
    wrapperIndex,
    files
}: {
    readonly manifest: Readonly<Record<string, string>>;
    readonly wrapperIndex: ReadonlyMap<
        string,
        { readonly spriteName: string; readonly defaultWeight: string }
    >;
    readonly files: ReadonlyArray<string>;
}): MissingDefault[] {
    const seen = new Map<string, MissingDefault>();

    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        const bindings = findRepoIconsImportBindings({ source });

        for (const importedName of bindings.values()) {
            const wrapperInfo = wrapperIndex.get(importedName);
            if (!wrapperInfo) continue; // not a known sprite glyph (brand icon, etc.) — out of scope

            const initials = manifest[wrapperInfo.spriteName];
            const defaultInitial = WEIGHT_INITIAL[wrapperInfo.defaultWeight];
            const hasDefault = initials?.includes(defaultInitial ?? '\0') === true;
            if (hasDefault) continue;

            seen.set(wrapperInfo.spriteName, {
                spriteName: wrapperInfo.spriteName,
                defaultWeight: wrapperInfo.defaultWeight,
                reachedVia: importedName,
                manifestEntry: initials ?? '(absent from manifest)'
            });
        }
    }

    return [...seen.values()].sort((a, b) => (a.spriteName < b.spriteName ? -1 : 1));
}

describe('icon-sprite-manifest.json: every reachable glyph carries its default weight', () => {
    const wrapperIndex = buildWrapperGlyphIndex();
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, string>;
    const files = collectSourceFiles({ dir: WEB_SRC_DIR, extensions: ['.astro', '.ts', '.tsx'] });

    it('is non-vacuous: scans a non-trivial number of files and resolves a non-trivial number of wrappers', () => {
        expect(files.length).toBeGreaterThan(100);
        expect(wrapperIndex.size).toBeGreaterThan(300);
    });

    it('every @repo/icons identifier imported anywhere in apps/web/src has its resolved default weight in the manifest', () => {
        const missing = findMissingDefaultWeights({ manifest, wrapperIndex, files });

        expect(
            missing.map(
                (m) =>
                    `${m.spriteName}: default weight "${m.defaultWeight}" missing (reached via "${m.reachedVia}"; manifest entry is "${m.manifestEntry}")`
            )
        ).toEqual([]);
    });

    it('regression: PencilSimpleIcon (EditIcon) carries duotone — the exact production gap this guard exists for', () => {
        // EditIcon is only ever a literal JSX tag at weight="regular" (the
        // page/table icon-picker call sites); its duotone default was reached
        // ONLY through an alias (ContributionBanner.astro) and two local
        // lookup tables (discovery-doors.ts, comparison-row-icons.ts) — none
        // of which a tag-name scan can see. A manifest built by the old,
        // tag-gated logic shipped "PencilSimpleIcon": "r" — missing "d".
        expect(manifest.PencilSimpleIcon).toContain('d');
    });
});
