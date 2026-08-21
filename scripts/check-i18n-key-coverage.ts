#!/usr/bin/env tsx
/**
 * check-i18n-key-coverage.ts — HOS-619
 *
 * A translation key written in source code must exist in the locale files.
 *
 * The production smoke of 2026-08-18/19 produced ten separate language
 * defects. Two of the four checks HOS-619 proposed turned out to already run
 * in CI — `pnpm --filter @repo/i18n check-locales` gates namespace parity,
 * es→en/pt key parity and bracketed development markers, and it is effective:
 * measured on 2026-08-21 there are 13.490 keys in `es` and ZERO absent from
 * `en` or `pt`. Parity was never the hole.
 *
 * The hole is the other direction: nothing checked that a key the CODE asks
 * for actually EXISTS. `packages/i18n` does generate a `TranslationKey` union
 * from the real locale files, but 530 literal keys in the repo reach `t()`
 * through an `as TranslationKey` cast, which switches that protection off. Six
 * of those 530 pointed at keys that exist in no locale — one of them is the
 * `[MISSING: admin-entities.columns.lifecycleState]` a person read in the
 * production partners listing (HOS-614).
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD ASSERTS — nothing more, nothing less
 * ---------------------------------------------------------------------------
 *
 * Check 1 — every literal translation key referenced in source resolves.
 *   Covers `t('ns.rest')` and `'ns.rest' as TranslationKey`. A key whose first
 *   segment is a real locale namespace must exist in the reference locale.
 *   There is NO allowlist for this check: a key that does not resolve renders
 *   as `[MISSING: key]` in the admin and as the raw dotted key on the public
 *   web (`apps/web/src/lib/i18n.ts` returns `fullKey` outside DEV), so there is
 *   no case where shipping one is acceptable.
 *
 * Check 2 — no NEW hardcoded fallback standing in for an absent key.
 *   `t('ns.rest', 'texto en español')` renders that literal in EVERY locale —
 *   `resolve()` uses the fallback directly, with no per-locale chain. So each
 *   such site serves Spanish under /en and /pt while looking translated in the
 *   source. Measured on 2026-08-21: 210 call sites over 66 files, all in
 *   apps/web. They are enumerated in FALLBACK_INVENTORY and this guard fails on
 *   any site that is not in it.
 *
 * This guard does NOT assert that a resolved key's TEXT is correct, nor that
 * `en`/`pt` values are really translated rather than the Spanish copied over.
 * Both are real and separate problems; neither is statically decidable here.
 *
 * ---------------------------------------------------------------------------
 * ON THE FALLBACK INVENTORY
 * ---------------------------------------------------------------------------
 * An allowlist is how a guard quietly becomes fail-open, so this one cannot be
 * used to wave through a new gap. It is an exhaustive enumeration of sites that
 * existed when the guard landed, not a pattern: every entry names one FILE and
 * one KEY. It can only shrink — an entry that no longer matches any site is a
 * FAILURE, not a shrug, so the file cannot drift into a permanent excuse. The
 * remaining count is printed on every run. Adding an entry by hand to silence a
 * new violation is the one thing this guard exists to prevent; add the key to
 * the three locale files instead.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCE_LOCALE = 'es';

/** Directories scanned for translation-key references. */
const SCAN_ROOTS = ['apps/web/src', 'apps/admin/src', 'packages'] as const;

/** Directory names never walked into. */
const SKIP_DIRS = new Set(['dist', 'build', 'coverage', '.git', ['node', 'modules'].join('_')]);

/** Source extensions that can contain a translation key. */
const SOURCE_EXT = /\.(ts|tsx|astro)$/;

/** Test and story files are excluded: a fixture key is not a rendered key. */
const NON_PRODUCT = /\.(test|spec|stories)\./;

// ---------------------------------------------------------------------------
// Locale side
// ---------------------------------------------------------------------------

/** Shape of one flattened locale: namespace set plus every fully-qualified key. */
export interface LocaleIndex {
    readonly namespaces: ReadonlySet<string>;
    readonly keys: ReadonlySet<string>;
}

/**
 * Flattens a locale JSON object into fully-qualified dotted keys.
 *
 * @param source - The parsed JSON object for one namespace.
 * @param prefix - Dotted prefix accumulated so far (the namespace at the root).
 * @param out - Set collecting every leaf key.
 */
export function flattenKeys(
    source: Record<string, unknown>,
    prefix: string,
    out: Set<string>
): void {
    for (const [key, value] of Object.entries(source)) {
        const full = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            flattenKeys(value as Record<string, unknown>, full, out);
        } else {
            out.add(full);
        }
    }
}

/**
 * Reads the reference locale and indexes its namespaces and keys.
 *
 * @param localesDir - Absolute path to `packages/i18n/src/locales`.
 * @returns The namespace set and the fully-qualified key set.
 */
export function readReferenceLocale({ localesDir }: { localesDir: string }): LocaleIndex {
    const namespaces = new Set<string>();
    const keys = new Set<string>();
    const dir = join(localesDir, REFERENCE_LOCALE);
    for (const entry of readdirSync(dir)) {
        if (!entry.endsWith('.json')) continue;
        const namespace = entry.replace(/\.json$/, '');
        namespaces.add(namespace);
        const parsed = JSON.parse(readFileSync(join(dir, entry), 'utf8')) as Record<
            string,
            unknown
        >;
        flattenKeys(parsed, namespace, keys);
    }
    return { namespaces, keys };
}

/**
 * Decides whether a key the code asks for is actually resolvable.
 *
 * `tPlural()` never looks the base key up directly: `pluralize()` appends the
 * CLDR `_one` / `_other` suffix and resolves that instead, so a base key with
 * both variants present is correctly translated even though it is absent from
 * the JSON itself. Treating those as unresolved is how this guard would have
 * reported five false alarms on the admin social routes.
 *
 * @param key - The fully-qualified dotted key written in source.
 * @param known - Every leaf key present in the reference locale.
 * @returns True when the key resolves directly or through its plural variants.
 */
export function resolvesToATranslation({
    key,
    known
}: {
    key: string;
    known: ReadonlySet<string>;
}): boolean {
    if (known.has(key)) return true;
    return known.has(`${key}_one`) && known.has(`${key}_other`);
}

// ---------------------------------------------------------------------------
// Source side
// ---------------------------------------------------------------------------

/** One literal translation-key reference found in source. */
export interface Reference {
    readonly file: string;
    readonly line: number;
    readonly key: string;
    /** True when the call passes a second argument (the hardcoded fallback). */
    readonly hasFallback: boolean;
}

/**
 * Collects every scannable source file under a directory.
 *
 * @param dir - Absolute directory to walk.
 * @param acc - Accumulator of absolute file paths.
 * @returns The accumulator.
 */
export function collectSourceFiles(dir: string, acc: string[]): string[] {
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, acc);
        } else if (SOURCE_EXT.test(full) && !NON_PRODUCT.test(full)) {
            acc.push(full);
        }
    }
    return acc;
}

/**
 * Blanks out comment bodies while preserving offsets, so a JSDoc example such
 * as `t('nav.iniciarSesion')` is not mistaken for a real call site.
 *
 * @param source - Raw file contents.
 * @returns The same string with comment interiors replaced by spaces.
 */
export function blankComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(
            /(^|[^:])\/\/[^\n]*/g,
            (m, lead: string) => lead + ' '.repeat(m.length - lead.length)
        );
}

/** `t('ns.rest'` followed by `,` (fallback) or `)` (no fallback). */
export const CALL_PATTERN = /\bt\(\s*(['"])([A-Za-z0-9_@-]+(?:\.[A-Za-z0-9_@-]+)+)\1\s*([,)])/g;

/** `tPlural('ns.rest', count, …)` — the second argument is a count, not a fallback. */
export const PLURAL_CALL_PATTERN = /\btPlural\(\s*(['"])([A-Za-z0-9_@-]+(?:\.[A-Za-z0-9_@-]+)+)\1/g;

/** `'ns.rest' as TranslationKey` — the cast that switches typing off. */
export const CAST_PATTERN =
    /(['"])([A-Za-z0-9_@-]+(?:\.[A-Za-z0-9_@-]+)+)\1\s+as\s+TranslationKey/g;

/**
 * Extracts every literal translation-key reference from one file.
 *
 * @param file - Absolute path of the file.
 * @param namespaces - Known locale namespaces; other first segments are ignored.
 * @returns Every reference found, with 1-indexed line numbers.
 */
export function extractReferences({
    file,
    namespaces
}: {
    file: string;
    namespaces: ReadonlySet<string>;
}): Reference[] {
    const source = blankComments(readFileSync(file, 'utf8'));
    const lineStarts: number[] = [0];
    for (let i = 0; i < source.length; i++) {
        if (source[i] === '\n') lineStarts.push(i + 1);
    }
    const lineOf = (index: number): number => {
        let lo = 0;
        let hi = lineStarts.length - 1;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if ((lineStarts[mid] as number) <= index) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };

    const found: Reference[] = [];
    // A `tPlural('k' as TranslationKey, …)` site matches both the plural and
    // the cast pattern; without this the same site is reported twice.
    const seen = new Set<string>();
    const push = (key: string, index: number, hasFallback: boolean): void => {
        if (!namespaces.has(key.split('.')[0] as string)) return;
        const line = lineOf(index);
        const id = `${line}::${key}`;
        if (seen.has(id)) return;
        seen.add(id);
        found.push({ file, line, key, hasFallback });
    };

    for (const m of source.matchAll(CALL_PATTERN)) {
        push(m[2] as string, m.index, (m[3] as string) === ',');
    }
    for (const m of source.matchAll(PLURAL_CALL_PATTERN)) {
        push(m[2] as string, m.index, false);
    }
    for (const m of source.matchAll(CAST_PATTERN)) {
        push(m[2] as string, m.index, false);
    }
    return found;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

/** One frozen fallback site: a repo-relative file plus the key it stands in for. */
export interface InventoryEntry {
    readonly file: string;
    readonly key: string;
}

/**
 * Reads the frozen fallback inventory.
 *
 * @param path - Absolute path to the inventory JSON.
 * @returns The entries, or an empty list when the file does not exist yet.
 */
export function readInventory({ path }: { path: string }): InventoryEntry[] {
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as { entries?: InventoryEntry[] };
        return parsed.entries ?? [];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/**
 * Runs both checks over the repository.
 *
 * @param repoRoot - Absolute path to the repository root.
 * @returns Process exit code: 0 when both checks pass, 1 otherwise.
 */
export function run(repoRoot: string): number {
    const locale = readReferenceLocale({ localesDir: join(repoRoot, 'packages/i18n/src/locales') });

    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
        collectSourceFiles(join(repoRoot, root), files);
    }

    const references: Reference[] = [];
    for (const file of files) {
        references.push(...extractReferences({ file, namespaces: locale.namespaces }));
    }

    const rel = (file: string): string => relative(repoRoot, file);
    const unresolved = references.filter(
        (r) => !resolvesToATranslation({ key: r.key, known: locale.keys })
    );

    console.log('i18n key coverage (HOS-619)');
    console.log(
        `  reference locale '${REFERENCE_LOCALE}': ${locale.keys.size} keys in ${locale.namespaces.size} namespaces`
    );
    console.log(
        `  scanned ${files.length} source files, ${references.length} literal key references`
    );
    console.log('');

    let failed = false;

    // --- Check 1 -----------------------------------------------------------
    const missing = unresolved.filter((r) => !r.hasFallback);
    if (missing.length > 0) {
        console.log('ERROR: translation keys referenced in code that exist in no locale.');
        console.log('       These render as "[MISSING: key]" in the admin and as the raw');
        console.log('       dotted key on the public web.');
        for (const r of missing) {
            console.log(`  ${rel(r.file)}:${r.line}`);
            console.log(`    ${r.key}`);
        }
        console.log(`\n  Add the key to packages/i18n/src/locales/{es,en,pt}/<namespace>.json.`);
        failed = true;
    } else {
        console.log(
            `  OK — every referenced key resolves (${references.length} references checked).`
        );
    }

    // --- Check 2 -----------------------------------------------------------
    const inventory = readInventory({
        path: join(repoRoot, 'scripts/i18n-fallback-inventory.json')
    });
    const inventoryIndex = new Set(inventory.map((e) => `${e.file}::${e.key}`));
    const fallbackSites = unresolved.filter((r) => r.hasFallback);
    const liveIndex = new Set(fallbackSites.map((r) => `${rel(r.file)}::${r.key}`));

    const unlisted = fallbackSites.filter((r) => !inventoryIndex.has(`${rel(r.file)}::${r.key}`));
    const stale = inventory.filter((e) => !liveIndex.has(`${e.file}::${e.key}`));

    if (unlisted.length > 0) {
        console.log('\nERROR: new hardcoded fallback standing in for a key that does not exist.');
        console.log('       The fallback string is served under /en and /pt too — resolve()');
        console.log('       uses it directly, with no per-locale chain.');
        for (const r of unlisted) {
            console.log(`  ${rel(r.file)}:${r.line}`);
            console.log(`    ${r.key}`);
        }
        console.log('\n  Add the key to the three locale files and drop the second argument.');
        console.log('  Do NOT add an entry to scripts/i18n-fallback-inventory.json — that list');
        console.log('  is frozen and may only shrink.');
        failed = true;
    }

    if (stale.length > 0) {
        console.log('\nERROR: stale entries in scripts/i18n-fallback-inventory.json.');
        console.log('       These sites no longer exist, so the entry is dead weight and the');
        console.log('       list must be trimmed — that is how it stays a shrinking debt.');
        for (const e of stale) console.log(`  ${e.file} :: ${e.key}`);
        failed = true;
    }

    if (unlisted.length === 0 && stale.length === 0) {
        console.log(
            `  OK — ${fallbackSites.length} hardcoded fallbacks remain, all of them listed ` +
                `in the frozen inventory (HOS-616 is what drains it).`
        );
    }

    console.log('');
    if (failed) {
        console.log('FAILED — fix the issues above before merging.');
        return 1;
    }
    console.log('All checks passed.');
    return 0;
}

/**
 * Removes inventory entries whose call site no longer exists.
 *
 * This is the ONLY supported way to edit the inventory, and it can only take
 * entries away: it never writes an entry that is not already in the file, so it
 * cannot be used to silence a new violation. Run it after draining fallbacks.
 *
 * @param repoRoot - Absolute path to the repository root.
 * @returns Process exit code, always 0.
 */
export function prune(repoRoot: string): number {
    const locale = readReferenceLocale({ localesDir: join(repoRoot, 'packages/i18n/src/locales') });
    const files: string[] = [];
    for (const root of SCAN_ROOTS) collectSourceFiles(join(repoRoot, root), files);

    const live = new Set<string>();
    for (const file of files) {
        for (const ref of extractReferences({ file, namespaces: locale.namespaces })) {
            if (ref.hasFallback && !resolvesToATranslation({ key: ref.key, known: locale.keys })) {
                live.add(`${relative(repoRoot, file)}::${ref.key}`);
            }
        }
    }

    const path = join(repoRoot, 'scripts/i18n-fallback-inventory.json');
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
        entries: InventoryEntry[];
        [key: string]: unknown;
    };
    const before = parsed.entries.length;
    parsed.entries = parsed.entries.filter((e) => live.has(`${e.file}::${e.key}`));
    writeFileSync(path, `${JSON.stringify(parsed, null, 4)}\n`, 'utf8');

    console.log(
        `pruned ${before - parsed.entries.length} entries; ${parsed.entries.length} remain.`
    );
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    process.exit(process.argv.includes('--prune') ? prune(REPO_ROOT) : run(REPO_ROOT));
}
