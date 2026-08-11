/**
 * @file data-driven-groups.ts
 * @description The manifest analyzer's SECOND category of reachable icon:
 * one resolved from a STRING at runtime (seed JSON, a database enum, a
 * category slug) rather than a statically-imported identifier a JSX tag
 * names directly (HOS-369 sprite-manifest).
 *
 * These are undecidable in general — "`resolveIcon({ iconName })` resolves
 * to whichever key the seed data or the API response happens to carry" is
 * not something a static scanner can narrow. The conservative, safe answer
 * (per the manifest's governing principle: a pair LEFT OUT falls back to
 * correct-but-heavier inline rendering, never a missing icon) is to include
 * the WHOLE resolver map's glyphs, at whatever weight(s) the call sites that
 * actually RENDER the resolved component use.
 *
 * ## Why the weight sets below are a maintained table, not re-derived
 *
 * The glyph SET per group below is NOT hand-typed — {@link resolveDataDrivenGroups}
 * reads each group's own map/constant directly out of its source file (see
 * {@link extractIconIdentifiersFromConst}), so a new amenity/category added to
 * any of these maps is picked up automatically the next time the analyzer
 * runs, with no edit needed here.
 *
 * The WEIGHT set per group is different: the icon a group resolves to is
 * rendered generically, often through a prop-forwarding component
 * (`FilterChips.astro` takes an already-resolved `icon` component and
 * renders `<Icon weight="regular" />` for whichever caller supplied it) —
 * tracing that from the resolver call site to its eventual render call site
 * is a data-flow question a regex scanner cannot answer across files. Each
 * entry below is instead the result of manually reading every call site that
 * renders that group's resolved icon (cited in `sourceHint`); re-verify the
 * cited files if this list needs updating, don't guess a new weight in.
 * Getting this table wrong in either direction is still safe: a weight
 * listed here that a call site stops using just ships a few unused sprite
 * symbols; a weight a call site starts using that this table has not been
 * updated for falls back to that one icon rendering inline — heavier, not
 * broken (the sprite wrapper's membership check, `hasIconSpriteSymbol`,
 * guarantees that fallback).
 *
 * @module scripts/icon-manifest/data-driven-groups
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../test/static-guards/cacheable-responses-declare-tags';

const currentDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(currentDir, '../../../..');

type SpriteWeight = 'regular' | 'bold' | 'fill' | 'duotone';

/** One data-driven resolver group: which const(s) hold its glyphs, and at what weight(s) they render. */
interface DataDrivenGroup {
    /** Human-readable name, used only in analyzer reports. */
    readonly id: string;
    /** File the const(s) are declared in, repo-root-relative. */
    readonly file: string;
    /** Exported const name(s) in that file whose icon-component values to collect. */
    readonly constNames: ReadonlyArray<string>;
    /** Weight(s) every glyph in this group's map(s) is rendered at somewhere in apps/web. */
    readonly weights: ReadonlyArray<SpriteWeight>;
    /** Where the `weights` above were verified — the render call site(s), not the resolver. */
    readonly sourceHint: string;
}

/**
 * Every data-driven icon resolver `apps/web` reaches, researched call site by
 * call site (HOS-369 sprite-manifest groundwork). See the module doc for what
 * "researched" means and does not mean.
 */
const DATA_DRIVEN_GROUPS: ReadonlyArray<DataDrivenGroup> = [
    {
        id: 'ICON_MAP (resolveIcon)',
        file: 'packages/icons/src/icon-resolver.ts',
        constNames: ['ICON_MAP'],
        weights: ['regular', 'duotone'],
        sourceHint:
            'apps/web/src/components/shared/ui/Badge.astro (regular); ' +
            'apps/web/src/components/accommodation/FeaturesGrid.astro, AmenitiesGrid.astro (duotone)'
    },
    {
        id: 'WEB_ICON_MAP (resolveWebIcon)',
        file: 'apps/web/src/lib/icon-map.ts',
        constNames: ['WEB_ICON_MAP'],
        weights: ['regular', 'duotone'],
        sourceHint:
            'apps/web/src/components/shared/ui/Badge.tsx (regular); ' +
            'IconChipsFilter.tsx, FilterGroupContent.tsx, filters/components/SectionHeader.tsx (duotone)'
    },
    {
        id: 'STATS_ICON_MAP (resolveStatsIcon)',
        file: 'apps/web/src/lib/stats-icons.ts',
        constNames: ['STATS_ICON_MAP'],
        weights: ['duotone'],
        sourceHint: 'apps/web/src/components/sections/AnimatedCounter.client.tsx'
    },
    {
        id: 'ATTRACTION_ICONS (getAttractionIcon)',
        file: 'packages/icons/src/domain/attraction-icon.ts',
        constNames: ['ATTRACTION_ICONS'],
        weights: ['regular'],
        sourceHint: 'apps/web/src/pages/[lang]/destinos/index.astro'
    },
    {
        id: 'POI_CATEGORY_VISUALS (getPoiCategoryIcon)',
        file: 'packages/icons/src/domain/poi-category.ts',
        constNames: ['POI_CATEGORY_VISUALS', 'POI_CATEGORY_FALLBACK_VISUAL'],
        weights: ['fill'],
        sourceHint:
            'apps/web/src/components/accommodation/WhatsNearbySection.astro, ' +
            'destination/DestinationPOISection.astro, maps/MultiMarkerMapInner.client.tsx, ' +
            'destination/DestinationPOIFilter.client.tsx (all weight="fill")'
    },
    {
        id: 'POINT_OF_INTEREST_TYPE_ICONS (getPointOfInterestTypeIcon)',
        file: 'apps/web/src/lib/poi-type-icons.ts',
        constNames: ['POINT_OF_INTEREST_TYPE_ICONS', 'POINT_OF_INTEREST_TYPE_FALLBACK_ICON'],
        weights: ['fill'],
        sourceHint:
            'Same 3 consumers as POI_CATEGORY_VISUALS — this is their no-categorySlug fallback branch, rendered on the identical weight="fill" <Icon>'
    },
    {
        id: 'ACCOMMODATION_TYPE_VISUALS (getAccommodationTypeIcon)',
        file: 'packages/icons/src/domain/accommodation-type.ts',
        constNames: ['ACCOMMODATION_TYPE_VISUALS', 'ACCOMMODATION_TYPE_FALLBACK_VISUAL'],
        weights: ['regular', 'bold'],
        sourceHint:
            'apps/web/src/pages/[lang]/alojamientos/index.astro -> FilterChips (regular); ' +
            'sections/SearchBar.client.tsx (regular); host/CreatePropertyMiniForm.client.tsx -> ' +
            'form/SearchableSelect.client.tsx (regular); shared/ui/AccommodationTypeBadge.astro ' +
            '(regular href-variant, bold non-href-variant); maps/AccommodationsListingMap.client.tsx ' +
            '-> maps/MapCardsSidebar.client.tsx (bold)'
    },
    {
        id: 'POST_CATEGORY_VISUALS (getPostCategoryIcon)',
        file: 'packages/icons/src/domain/post-category.ts',
        constNames: ['POST_CATEGORY_VISUALS', 'POST_CATEGORY_FALLBACK_VISUAL'],
        weights: ['regular'],
        sourceHint: 'apps/web/src/pages/[lang]/publicaciones/index.astro -> FilterChips'
    },
    {
        id: 'EVENT_CATEGORY_ICON_COMPONENTS (getEventCategoryIconComponent)',
        file: 'apps/web/src/components/shared/cards/utils/eventCategoryIcon.ts',
        constNames: ['EVENT_CATEGORY_ICON_COMPONENTS'],
        weights: ['regular'],
        sourceHint: 'apps/web/src/pages/[lang]/eventos/index.astro -> FilterChips'
    },
    {
        id: 'POST_CATEGORY_ICON_COMPONENTS (getPostCategoryIconComponent)',
        file: 'apps/web/src/components/shared/cards/utils/postCategoryIcon.ts',
        constNames: ['POST_CATEGORY_ICON_COMPONENTS'],
        weights: ['duotone'],
        sourceHint:
            'apps/web/src/components/shared/cards/ArticleCard.astro, RelatedPostCard.astro, FeaturedArticleCard.astro'
    },
    {
        id: 'GASTRONOMY_TYPE_ICONS (getGastronomyTypeIcon)',
        file: 'apps/web/src/lib/gastronomy-type-icons.ts',
        constNames: ['GASTRONOMY_TYPE_ICONS', 'GASTRONOMY_TYPE_FALLBACK_ICON'],
        weights: ['regular'],
        sourceHint: 'apps/web/src/pages/[lang]/gastronomia/index.astro -> FilterChips'
    },
    {
        id: 'EXPERIENCE_TYPE_ICONS (getExperienceTypeIcon)',
        file: 'apps/web/src/lib/experience-type-icons.ts',
        constNames: ['EXPERIENCE_TYPE_ICONS', 'EXPERIENCE_TYPE_FALLBACK_ICON'],
        weights: ['regular'],
        sourceHint: 'apps/web/src/pages/[lang]/experiencias/index.astro -> FilterChips'
    },
    {
        id: 'COMPARISON_ROW_ICONS',
        file: 'apps/web/src/components/billing/comparison-row-icons.ts',
        constNames: ['COMPARISON_ROW_ICONS'],
        weights: ['regular'],
        sourceHint: 'apps/web/src/components/billing/PlanComparisonTable.astro'
    },
    {
        id: 'VARIANT_ICON (toast variant)',
        file: 'apps/web/src/components/ui/ToastViewport.client.tsx',
        constNames: ['VARIANT_ICON'],
        weights: ['regular', 'fill'],
        sourceHint:
            'Dynamic weight={isLoading ? "regular" : "fill"} — one of the 14 sites ' +
            'apps/web/test/static-guards/icon-sprite-shipped-weights.test.ts tracks as a known fill/regular ternary'
    }
];

/**
 * Extracts one exported const's initializer text — from its `=` to the
 * matching top-level `;` — by balancing `{`/`(`/`[` against their closers and
 * skipping over string/template literals, so a `;` inside a string cannot
 * end the scan early.
 *
 * @param params.source - File contents to scan.
 * @param params.constName - Exported const name to find.
 * @returns The initializer text, or `null` if the const was not found.
 */
function extractConstInitializer({
    source,
    constName
}: {
    readonly source: string;
    readonly constName: string;
}): string | null {
    const declPattern = new RegExp(`\\bconst\\s+${constName}\\b`);
    const declMatch = declPattern.exec(source);
    if (!declMatch || declMatch.index === undefined) return null;

    const eqIndex = source.indexOf('=', declMatch.index + declMatch[0].length);
    if (eqIndex === -1) return null;

    const start = eqIndex + 1;
    let i = start;
    let depth = 0;
    let quote: string | null = null;

    while (i < source.length) {
        const ch = source[i];
        if (quote !== null) {
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
        } else if (ch === '{' || ch === '(' || ch === '[') {
            depth++;
        } else if (ch === '}' || ch === ')' || ch === ']') {
            depth--;
        } else if (ch === ';' && depth <= 0) {
            break;
        }
        i++;
    }

    return source.slice(start, i);
}

/** Every icon identifier bare-referenced in a value position — a PascalCase name ending in "Icon". */
const ICON_IDENTIFIER_PATTERN = /\b[A-Z][A-Za-z0-9]*Icon\b/g;

/**
 * Extracts every icon-component identifier a const's initializer references,
 * regardless of the object-literal shape (shorthand `{ X }`, `{ icon: X }`,
 * `visual(X, 'bucket')`, a computed-key `[Enum.X]: Y`, or a single bare
 * identifier) — all of them contain the referenced identifiers as plain text,
 * so one generic scan covers every group in {@link DATA_DRIVEN_GROUPS}
 * without a bespoke parser per file shape.
 *
 * @param params.source - File contents to scan.
 * @param params.constName - Exported const name whose initializer to scan.
 * @returns The identifiers found, or `null` if the const was not found.
 */
export function extractIconIdentifiersFromConst({
    source,
    constName
}: {
    readonly source: string;
    readonly constName: string;
}): string[] | null {
    const initializer = extractConstInitializer({ source, constName });
    if (initializer === null) return null;

    const withoutComments = stripComments({ source: initializer });
    return [...new Set(withoutComments.match(ICON_IDENTIFIER_PATTERN) ?? [])];
}

/** One data-driven group's resolved icon identifiers and the weight(s) to pair them with. */
export interface ResolvedDataDrivenGroup {
    readonly id: string;
    readonly iconIdentifiers: ReadonlyArray<string>;
    readonly weights: ReadonlyArray<SpriteWeight>;
}

/**
 * Reads every group in {@link DATA_DRIVEN_GROUPS} off disk and resolves its
 * icon identifiers.
 *
 * @returns One {@link ResolvedDataDrivenGroup} per entry, plus any file/const
 *   this run could not read or find (reported, never thrown — a missing
 *   group should not crash the whole manifest build, just under-cover that
 *   one group, which is the safe direction per the module's governing
 *   principle).
 */
export function resolveDataDrivenGroups(): {
    readonly groups: ReadonlyArray<ResolvedDataDrivenGroup>;
    readonly missing: ReadonlyArray<string>;
} {
    const groups: ResolvedDataDrivenGroup[] = [];
    const missing: string[] = [];

    for (const group of DATA_DRIVEN_GROUPS) {
        const filePath = resolve(REPO_ROOT, group.file);
        let source: string;
        try {
            source = readFileSync(filePath, 'utf8');
        } catch {
            missing.push(`${group.id}: cannot read ${group.file}`);
            continue;
        }

        const identifiers = new Set<string>();
        for (const constName of group.constNames) {
            const found = extractIconIdentifiersFromConst({ source, constName });
            if (found === null) {
                missing.push(`${group.id}: const "${constName}" not found in ${group.file}`);
                continue;
            }
            for (const identifier of found) identifiers.add(identifier);
        }

        groups.push({ id: group.id, iconIdentifiers: [...identifiers], weights: group.weights });
    }

    return { groups, missing };
}
