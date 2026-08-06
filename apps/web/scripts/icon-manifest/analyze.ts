/**
 * @file analyze.ts
 * @description Orchestrates the icon-sprite-manifest analyzer: derives every
 * (glyph, weight) pair `apps/web` can reach, from TWO categories of usage
 * (HOS-369 sprite-manifest).
 *
 * **(a) Statically imported identifiers**. {@link findRepoIconsImportBindings}
 * finds every `@repo/icons` import in a file; {@link buildWrapperGlyphIndex}
 * maps each one to its real sprite glyph name and resolved DEFAULT weight
 * (`weight ?? defaultWeight ?? 'duotone'`, mirroring `createPhosphorIcon`
 * exactly). Every resolved binding contributes its default-weight pair
 * UNCONDITIONALLY — not only when a literal `<StarIcon .../>` JSX tag is
 * found for it in that file. An identifier can be reachable without ever
 * appearing as a literal tag: `const Icon = variant === 'x' ? EditIcon :
 * ImageIcon; <Icon />` (an alias), or `icon: EditIcon` in a local lookup
 * table rendered generically elsewhere (`ContributionBanner.astro`,
 * `discovery-doors.ts`) — the identifier is still imported, still reachable,
 * and still renders at ITS resolved default weight whenever the alias picks
 * it. {@link findJsxOpenTags}/{@link resolveTagWeight} additionally scan for
 * literal tags of the SAME name in the SAME file and add any explicit
 * weights found on top — call-site weights are additive, never a
 * replacement for the unconditional default-weight contribution.
 *
 * This was a real gap, caught in production verification (not a
 * hypothetical): a manifest that added the default weight only when a
 * literal tag was found shipped `PencilSimpleIcon` (aka `EditIcon`) at
 * `"r"` only — its `regular` call sites were literal tags, but its
 * `duotone` default (declared nowhere, since `EditIcon` sets no
 * `defaultWeight`) was reached ONLY through the three alias/table usages
 * above, none of which are a literal `<EditIcon` tag. 30 of 196 glyphs
 * (15%) were missing their default weight this way before the fix; only one
 * of them happened to be on a page that got measured.
 *
 * **(b) Data-driven resolvers** — `resolveIcon({ iconName })`, and the dozen
 * siblings cataloged in {@link resolveDataDrivenGroups}. These resolve a
 * STRING at runtime (seed data, an enum, an API field), which a static
 * scanner cannot narrow — so the whole resolver map's glyphs are included, at
 * a manually-researched, cited weight set (see that module's doc for why the
 * weight set is a maintained table and the glyph set is not).
 *
 * A dynamic `weight={expression}` call site on a category-(a) identifier is
 * resolved CONSERVATIVELY rather than omitted: both `fill` and `regular` are
 * added, because `apps/web/test/static-guards/icon-sprite-shipped-weights.test.ts`
 * already established every such site in this app is a fill/regular ternary.
 * These sites are reported separately (`dynamicWeightSites`) so that
 * assumption stays visible and auditable rather than silently baked in.
 *
 * The one thing genuinely OMITTED — never guessed — is an import binding
 * this analyzer can see is rendered as JSX but cannot map to a known sprite
 * glyph (`unresolvedImports`). Per the manifest's governing principle, an
 * omitted pair just falls back to correct-but-heavier inline rendering, so
 * this count is a real, safe result, not a failure to fix before shipping.
 *
 * @module scripts/icon-manifest/analyze
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataDrivenGroups } from './data-driven-groups';
import { collectSourceFiles } from './fs-utils';
import { buildWrapperGlyphIndex } from './glyph-resolver';
import { findRepoIconsImportBindings } from './import-bindings';
import { findJsxOpenTags, resolveTagWeight } from './jsx-tag-weights';

const currentDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(currentDir, '../../../..');
const WEB_SRC_DIR = resolve(currentDir, '../../src');

const SPRITE_WEIGHTS = ['regular', 'bold', 'fill', 'duotone'] as const;
type SpriteWeight = (typeof SPRITE_WEIGHTS)[number];

function isSpriteWeight(value: string): value is SpriteWeight {
    return (SPRITE_WEIGHTS as ReadonlyArray<string>).includes(value);
}

/** Mutable pair accumulator: glyph sprite name → the weights it needs. */
type PairAccumulator = Map<string, Set<SpriteWeight>>;

function addPair(pairs: PairAccumulator, name: string, weight: SpriteWeight): void {
    const weights = pairs.get(name) ?? new Set<SpriteWeight>();
    weights.add(weight);
    pairs.set(name, weights);
}

/** Diagnostics the analyzer reports alongside the derived manifest. */
export interface AnalyzerStats {
    /** How many `apps/web/src` files were scanned. */
    readonly filesScanned: number;
    /** Distinct (import binding, file) pairs resolved to a known sprite glyph — with or without a literal JSX tag. */
    readonly staticCallSitesResolved: number;
    /**
     * Resolved bindings that contributed ONLY their default weight because no
     * literal JSX tag of that name was found in the same file — the alias /
     * local-table usage pattern (`const Icon = a ? X : Y; <Icon />`,
     * `icon: X` in a lookup table). Reported so this category stays visible,
     * not folded silently into `staticCallSitesResolved`.
     */
    readonly defaultWeightOnlyBindings: number;
    /** `weight={expression}` call sites resolved conservatively as fill+regular. */
    readonly dynamicWeightSites: number;
    /** JSX-rendered `@repo/icons` bindings this analyzer could not map to a sprite glyph. Genuinely omitted. */
    readonly unresolvedImports: ReadonlyArray<string>;
    /** Data-driven groups (or specific consts within one) this run could not read. */
    readonly dataDrivenMissing: ReadonlyArray<string>;
    /** Per-group glyph counts, for the report table. */
    readonly dataDrivenGroups: ReadonlyArray<{ readonly id: string; readonly glyphCount: number }>;
}

/** The analyzer's full output: the derived pair set plus its diagnostics. */
export interface AnalyzerReport {
    readonly pairs: PairAccumulator;
    readonly stats: AnalyzerStats;
}

/**
 * Runs the full two-category analysis described in the module doc.
 *
 * @returns The derived (glyph, weight) pairs and diagnostics about how they
 *   were derived.
 */
export function analyzeIconManifest(): AnalyzerReport {
    const pairs: PairAccumulator = new Map();
    const wrapperIndex = buildWrapperGlyphIndex();
    const files = collectSourceFiles({ dir: WEB_SRC_DIR, extensions: ['.astro', '.ts', '.tsx'] });

    let staticCallSitesResolved = 0;
    let defaultWeightOnlyBindings = 0;
    let dynamicWeightSites = 0;
    const unresolvedImports: string[] = [];

    for (const file of files) {
        const source = readFileSync(file, 'utf8');
        const bindings = findRepoIconsImportBindings({ source });
        if (bindings.size === 0) continue;

        for (const [localName, importedName] of bindings) {
            const wrapperInfo = wrapperIndex.get(importedName);
            const tags = findJsxOpenTags({ source, tagName: localName });

            if (!wrapperInfo) {
                // Only worth reporting when this binding was clearly meant to
                // render an icon (a literal tag with its exact name exists).
                // Most `@repo/icons` value imports are NOT icons at all
                // (functions, constants, types already filtered out) and
                // never match a JSX tag of their own name — reporting those
                // would flood this list with non-findings.
                if (tags.length > 0) {
                    unresolvedImports.push(
                        `${relative(REPO_ROOT, file)}: <${localName}> (imported as "${importedName}") has no known sprite glyph`
                    );
                }
                continue;
            }

            // UNCONDITIONAL: an imported binding is reachable whether or not
            // this file happens to render it via a literal `<Name .../>` tag
            // — it may be stored in a variable and rendered through an alias,
            // or as a value in a local lookup table rendered generically
            // elsewhere. Its resolved default weight must always be in the
            // manifest, or that render path silently falls back to inline.
            // See this module's doc for the production bug this fixes.
            addPair(pairs, wrapperInfo.spriteName, wrapperInfo.defaultWeight);
            staticCallSitesResolved++;
            if (tags.length === 0) defaultWeightOnlyBindings++;

            for (const tagText of tags) {
                const { literalWeights, dynamicCount } = resolveTagWeight({ tagText });

                if (literalWeights.length > 0) {
                    for (const weight of literalWeights) {
                        if (isSpriteWeight(weight)) addPair(pairs, wrapperInfo.spriteName, weight);
                        // thin/light: never shipped by the sprite regardless — correctly excluded.
                    }
                } else if (dynamicCount > 0) {
                    dynamicWeightSites += dynamicCount;
                    addPair(pairs, wrapperInfo.spriteName, 'fill');
                    addPair(pairs, wrapperInfo.spriteName, 'regular');
                }
                // A tag with no weight attribute at all needs nothing further
                // here — its weight IS the default, already added above.
            }
        }
    }

    const { groups, missing: dataDrivenMissing } = resolveDataDrivenGroups();
    const dataDrivenGroups: Array<{ id: string; glyphCount: number }> = [];

    for (const group of groups) {
        let resolvedInGroup = 0;
        for (const identifier of group.iconIdentifiers) {
            const wrapperInfo = wrapperIndex.get(identifier);
            if (!wrapperInfo) {
                dataDrivenMissing.push(
                    `${group.id}: "${identifier}" has no known sprite glyph (skipped)`
                );
                continue;
            }
            resolvedInGroup++;
            for (const weight of group.weights) addPair(pairs, wrapperInfo.spriteName, weight);
        }
        dataDrivenGroups.push({ id: group.id, glyphCount: resolvedInGroup });
    }

    return {
        pairs,
        stats: {
            filesScanned: files.length,
            staticCallSitesResolved,
            defaultWeightOnlyBindings,
            dynamicWeightSites,
            unresolvedImports,
            dataDrivenMissing,
            dataDrivenGroups
        }
    };
}

/**
 * Converts the derived pair map into the manifest's committed COMPACT shape:
 * `{ glyphName: "initials" }`, one character per weight (its first letter —
 * `r`/`b`/`f`/`d`, all four distinct so no ambiguity), sorted by glyph name
 * for a stable, reviewable diff. {@link SPRITE_WEIGHTS} order decides each
 * entry's own character order, so re-running the analyzer never reorders an
 * unchanged entry's initials.
 *
 * @param params.pairs - The analyzer's derived pair map.
 * @returns The compact manifest object, ready for `JSON.stringify`.
 */
export function pairsToCompactManifest(pairs: PairAccumulator): Record<string, string> {
    const manifest: Record<string, string> = {};
    for (const name of [...pairs.keys()].sort()) {
        const weights = pairs.get(name);
        if (!weights) continue;
        const initials = SPRITE_WEIGHTS.filter((weight) => weights.has(weight))
            .map((weight) => weight[0])
            .join('');
        if (initials.length > 0) manifest[name] = initials;
    }
    return manifest;
}
