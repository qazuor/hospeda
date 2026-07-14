/**
 * @file generate-poi-allowlist.ts
 * @description Regenerates `src/routes/ai/protected/poi-allowlist.generated.json`
 * (HOS-142 §6.6 / G-7) from the seeded point-of-interest catalog.
 *
 * ## Why a generated file instead of ~659 hand-written entries
 *
 * HOS-142 extends the AI-search POI allowlist (`POI_ALLOWLIST`, HOS-113 §6.3)
 * beyond its original 12 hand-curated landmarks to cover the featured/
 * high-priority subset of the full 920-fixture catalog (~661 POIs, OQ-2). That
 * volume is unreviewable as hand-typed source and would blow the project's
 * 500-line-per-file limit — so this script derives the dictionary
 * mechanically and writes it to a separate, reviewable JSON file that
 * `poi-allowlist.ts` imports and merges under the hand-curated entries. The
 * hand-curated 12 (`CURATED_POI_ALLOWLIST`) are NEVER touched by this script
 * and always win on a key collision (see the merge in `poi-allowlist.ts`).
 *
 * ## Scope cut (OQ-2)
 *
 * A POI is in scope when `isFeatured === true` OR `displayWeight >= 100`
 * (the former `priority: HIGH` tier) — the "wide cut" the user approved,
 * ~661 of 920 fixtures.
 *
 * ## Candidate terms per in-scope POI
 *
 * - Every entry in the POI's `keywords` array (HOS-138 column), lowercased +
 *   trimmed.
 * - The POI's `nameI18n.es`, lowercased + trimmed.
 *
 * Only the `es` locale is generated. `nameI18n.en`/`nameI18n.pt` are `null`
 * for the overwhelming majority of the bulk-imported catalog (HOS-142 NG-6 —
 * translation is a separate follow-up), so there is no reliable source for
 * en/pt NL terms at this scale; the hand-curated 12 keep providing en/pt
 * coverage for the original landmarks.
 *
 * ## R-5 generic-term filter (the anti-noise guard)
 *
 * Two independent rules are applied before writing the output, because they
 * catch two DIFFERENT shapes of noise:
 *
 * **Rule 1 — bare single-word terms are always discarded**, regardless of
 * how many (or few) slugs they map to. This was added after an initial
 * count-only cut still let through `matchPoiTerms`-level false positives:
 * `"fe"` (2 chars, substring of "federación") matched `iglesia_santa_ana`
 * inside the unrelated query "termas de federación"; `"pileta"`/`"wifi"`
 * (amenity words, not landmarks) matched inside "una cabaña con pileta y
 * wifi"; `"faro"` matched `faro_stella_maris` inside "cerca del faro
 * imaginario" (an EXPLICITLY made-up lighthouse). A term's distinct-slug
 * COUNT says nothing about whether the term itself is a common word likely
 * to appear inside unrelated queries — a single bare noun can be "specific"
 * to one POI in the count sense while still being generic English/Spanish
 * vocabulary in the substring-match sense. Requiring at least one space (2+
 * tokens) eliminates this whole class: multi-word phrases ("faro stella
 * maris", "iglesia santa ana", "termas de federación") are what real users
 * type when they mean a SPECIFIC landmark; bare nouns are what they type
 * when they mean the general concept (which the allowlist must never resolve
 * to one arbitrary POI). Cost: 492 of 2282 candidate terms are single-word
 * and get dropped by this rule alone (verified: only 1 of the ~661 in-scope
 * POIs — "Playita" — had a single-word `nameI18n.es`, an acceptable loss).
 *
 * **Rule 2 — distinct-slug-count ceiling.** For the remaining (multi-word)
 * terms, any term mapping to MORE than `MAX_SLUGS_PER_TERM` distinct slugs is
 * still discarded — a multi-word phrase can also be generic ("centro
 * histórico", "zona rural"). Distribution across the ~1790 multi-word
 * candidate terms:
 *
 * ```text
 *   1 slug  -> 1572 terms   (POI-specific: proper names, distinctive phrases)
 *   2 slugs ->  125 terms   (shared alias across 2 closely related landmarks)
 *   3 slugs ->   48 terms   (shared alias across 3 closely related landmarks)
 *   4+ slugs ->  45 terms   (generic multi-word phrases: "rio uruguay" (32),
 *                            "lago salto grande" (20), "rio gualeguay" (19),
 *                            "plaza principal" (15), "terminal de omnibus"
 *                            (13), "centro civico" (13), ...)
 * ```
 *
 * At 3 or fewer distinct slugs, surviving multi-slug terms are still
 * reasonably specific shared concepts (e.g. "enoturismo"/"vino" mapping to
 * the catalog's 2-3 actual wineries) — the same "one NL concept, several
 * concrete rows" pattern the existing `ATTRACTION_ALLOWLIST` already uses for
 * "termas". Above that, the surviving terms trend toward generic multi-word
 * descriptors that would match several unrelated POIs. 3 sits inside the
 * user-approved 3-5 range and is the tightest (most conservative) choice in
 * that range.
 *
 * Terms already present in `CURATED_POI_ALLOWLIST` (same locale) are always
 * skipped regardless of either rule — the hand-curated entries are
 * HOS-113/HOS-111-verified and must never be silently overwritten by a
 * machine-derived guess.
 *
 * ## Regenerating
 *
 * ```bash
 * pnpm --filter @repo/api generate:poi-allowlist
 * ```
 *
 * Run this whenever the seeded POI catalog (`packages/seed/src/data/
 * pointOfInterest/*.json`) changes in a way that could affect scope
 * membership, keywords, or names. Never hand-edit
 * `poi-allowlist.generated.json` directly — it will be overwritten on the
 * next run.
 *
 * ## Prompt-embedded slug subset (HOS-142 Phase 4b)
 *
 * The full `POI_ALLOWLIST` (curated 12 + these ~1733 generated terms,
 * flattening to ~661 distinct slugs) is used for the SERVER-SIDE
 * `matchPoiTerms` lexical fallback (`search-chat.ts`), but embedding all ~661
 * slugs in the LLM prompt (`buildAllowlistLines`, `search-chat.prompt.ts`)
 * would bloat every conversational-search request. This script therefore also
 * writes a separate, MUCH smaller `promptFeaturedSlugs` list: the union of the
 * 12 curated slugs with the top `PROMPT_FEATURED_POI_LIMIT` in-scope POIs,
 * ranked by `displayWeight` descending (ties broken by `verified` — verified
 * landmarks first — then `slug` ascending for full determinism). `isFeatured`
 * alone (661) and `displayWeight >= 100` alone (653) are both far too large to
 * embed directly (hundreds, not the tens/dozens a prompt subset needs), hence
 * the additional top-N cut on top of the scope cut. Any landmark NOT in this
 * smaller list is still fully reachable — `matchPoiTerms` matches against the
 * complete `POI_ALLOWLIST`, independent of what got embedded in the prompt.
 *
 * @module apps/api/scripts/generate-poi-allowlist
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CURATED_POI_ALLOWLIST,
    extractAllSlugs
} from '../src/routes/ai/protected/poi-allowlist.js';

/** Maximum number of distinct POI slugs a single NL term may map to before it is treated as generic noise and discarded (R-5). See the module doc above for how this was chosen. */
const MAX_SLUGS_PER_TERM = 3;

/**
 * How many additional (non-curated) in-scope POI slugs to embed in the LLM
 * prompt's `promptFeaturedSlugs` subset, on top of the 12 curated slugs — see
 * "Prompt-embedded slug subset" in the module doc. 40 keeps the combined
 * embedded total (12 curated + up to 40 featured, deduplicated) within the
 * ~30-60 slug target.
 */
const PROMPT_FEATURED_POI_LIMIT = 40;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SEED_POI_DIR = resolve(SCRIPT_DIR, '../../../packages/seed/src/data/pointOfInterest');
const OUTPUT_PATH = resolve(SCRIPT_DIR, '../src/routes/ai/protected/poi-allowlist.generated.json');

/** Minimal shape read off each POI fixture — only the fields this script needs. */
interface PoiFixture {
    readonly slug: string;
    readonly isFeatured?: boolean;
    readonly displayWeight?: number;
    readonly verified?: boolean;
    readonly keywords?: readonly string[];
    readonly nameI18n?: {
        readonly es?: string | null;
    };
}

/**
 * Reads and parses every POI fixture JSON file in the seed data directory.
 *
 * @returns Parsed fixtures, one per file (unfiltered).
 */
function loadPoiFixtures(): readonly PoiFixture[] {
    const files = readdirSync(SEED_POI_DIR).filter((file) => file.endsWith('.json'));
    return files.map((file) => {
        const raw = readFileSync(resolve(SEED_POI_DIR, file), 'utf-8');
        return JSON.parse(raw) as PoiFixture;
    });
}

/**
 * Determines whether a POI fixture is in scope for allowlist generation
 * (OQ-2's approved "wide cut").
 *
 * @param poi - The fixture to check.
 * @returns `true` when `isFeatured` is `true` or `displayWeight >= 100`.
 */
function isInScope(poi: PoiFixture): boolean {
    return poi.isFeatured === true || (poi.displayWeight ?? 0) >= 100;
}

/**
 * Collects every candidate NL term for a single in-scope POI (its keywords
 * plus its lowercased Spanish name), de-duplicated.
 *
 * @param poi - The in-scope POI fixture.
 * @returns De-duplicated, lowercased, trimmed candidate terms.
 */
function collectCandidateTerms(poi: PoiFixture): readonly string[] {
    const terms = new Set<string>();

    const esName = poi.nameI18n?.es;
    if (typeof esName === 'string' && esName.trim().length > 0) {
        terms.add(esName.toLowerCase().trim());
    }

    for (const keyword of poi.keywords ?? []) {
        if (typeof keyword === 'string' && keyword.trim().length > 0) {
            terms.add(keyword.toLowerCase().trim());
        }
    }

    return Array.from(terms);
}

/**
 * Builds the raw (pre-filter) term -> distinct-slugs map across every
 * in-scope POI.
 *
 * @param inScopePois - The POIs that passed {@link isInScope}.
 * @returns Map from candidate term to the set of slugs it was seen on.
 */
function buildTermToSlugsMap(inScopePois: readonly PoiFixture[]): Map<string, Set<string>> {
    const termToSlugs = new Map<string, Set<string>>();

    for (const poi of inScopePois) {
        for (const term of collectCandidateTerms(poi)) {
            const existing = termToSlugs.get(term);
            if (existing) {
                existing.add(poi.slug);
            } else {
                termToSlugs.set(term, new Set([poi.slug]));
            }
        }
    }

    return termToSlugs;
}

/** Result of applying the R-5 generic-term filter to the raw candidate map. */
interface FilterResult {
    readonly kept: Readonly<Record<string, readonly string[]>>;
    readonly discardedBareWord: number;
    readonly discardedGeneric: number;
    readonly skippedCurated: number;
}

/**
 * Whether a term is a single word (no space) — i.e. a bare noun rather than a
 * distinctive multi-word phrase. See "Rule 1" in the module doc for why bare
 * words are discarded outright regardless of their slug count.
 *
 * @param term - The candidate term to check.
 * @returns `true` when the term has no whitespace (a single token).
 */
function isBareSingleWordTerm(term: string): boolean {
    return !term.includes(' ');
}

/**
 * Applies the R-5 anti-noise filter (see module doc, "Rule 1"/"Rule 2"):
 * drops bare single-word terms, drops any remaining term mapping to more
 * than {@link MAX_SLUGS_PER_TERM} distinct slugs, and drops any term already
 * present in the curated dictionary (curated always wins).
 *
 * @param termToSlugs - Raw candidate map from {@link buildTermToSlugsMap}.
 * @param curatedTerms - Term keys already present in `CURATED_POI_ALLOWLIST.es`.
 * @returns The filtered, sorted dictionary plus filter counters for reporting.
 */
function applyGenericTermFilter(
    termToSlugs: ReadonlyMap<string, Set<string>>,
    curatedTerms: ReadonlySet<string>
): FilterResult {
    const kept: Record<string, readonly string[]> = {};
    let discardedBareWord = 0;
    let discardedGeneric = 0;
    let skippedCurated = 0;

    const sortedTerms = Array.from(termToSlugs.keys()).sort();

    for (const term of sortedTerms) {
        if (curatedTerms.has(term)) {
            skippedCurated++;
            continue;
        }

        if (isBareSingleWordTerm(term)) {
            discardedBareWord++;
            continue;
        }

        const slugs = termToSlugs.get(term) ?? new Set<string>();
        if (slugs.size > MAX_SLUGS_PER_TERM) {
            discardedGeneric++;
            continue;
        }

        kept[term] = Array.from(slugs).sort();
    }

    return { kept, discardedBareWord, discardedGeneric, skippedCurated };
}

/**
 * Selects the small "prompt-embedded" slug subset (HOS-142 Phase 4b): the
 * union of every curated slug with the top {@link PROMPT_FEATURED_POI_LIMIT}
 * in-scope POIs ranked by `displayWeight` descending, `verified` descending,
 * then `slug` ascending (full determinism when `displayWeight` ties, which is
 * the common case — most in-scope POIs share `displayWeight: 100`).
 *
 * @param inScopePois - The POIs that passed {@link isInScope}.
 * @param curatedSlugs - Slugs already covered by the curated dictionary.
 * @returns Sorted, de-duplicated array of slugs to embed in the LLM prompt.
 */
function selectPromptFeaturedSlugs(
    inScopePois: readonly PoiFixture[],
    curatedSlugs: ReadonlySet<string>
): readonly string[] {
    const ranked = [...inScopePois].sort((a, b) => {
        const weightDiff = (b.displayWeight ?? 0) - (a.displayWeight ?? 0);
        if (weightDiff !== 0) {
            return weightDiff;
        }
        const verifiedDiff = (b.verified === true ? 1 : 0) - (a.verified === true ? 1 : 0);
        if (verifiedDiff !== 0) {
            return verifiedDiff;
        }
        return a.slug.localeCompare(b.slug);
    });

    const topFeatured = ranked.slice(0, PROMPT_FEATURED_POI_LIMIT).map((poi) => poi.slug);
    const combined = new Set([...curatedSlugs, ...topFeatured]);

    return Array.from(combined).sort();
}

function main(): void {
    const fixtures = loadPoiFixtures();
    const inScopePois = fixtures.filter(isInScope);
    const termToSlugs = buildTermToSlugsMap(inScopePois);
    const curatedTerms = new Set(Object.keys(CURATED_POI_ALLOWLIST.es ?? {}));

    const { kept, discardedBareWord, discardedGeneric, skippedCurated } = applyGenericTermFilter(
        termToSlugs,
        curatedTerms
    );

    const curatedSlugs = extractAllSlugs(CURATED_POI_ALLOWLIST);
    const promptFeaturedSlugs = selectPromptFeaturedSlugs(inScopePois, curatedSlugs);

    const output = { es: kept, promptFeaturedSlugs };
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 4)}\n`, 'utf-8');

    console.log('========================================');
    console.log('  POI allowlist generation (HOS-142 G-7)');
    console.log('========================================');
    console.log(`Total fixtures scanned:        ${fixtures.length}`);
    console.log(`In-scope POIs (isFeatured OR displayWeight>=100): ${inScopePois.length}`);
    console.log(`Raw candidate terms:           ${termToSlugs.size}`);
    console.log(`Discarded (bare single-word):  ${discardedBareWord}`);
    console.log(`Discarded (generic, >${MAX_SLUGS_PER_TERM} slugs):    ${discardedGeneric}`);
    console.log(`Skipped (already curated):     ${skippedCurated}`);
    console.log(`Final generated terms:         ${Object.keys(kept).length}`);
    console.log(`Curated slugs:                 ${curatedSlugs.size}`);
    console.log(
        `Prompt-embedded slugs (curated + top ${PROMPT_FEATURED_POI_LIMIT} featured): ${promptFeaturedSlugs.length}`
    );
    console.log(`Written to: ${OUTPUT_PATH}`);
}

main();
