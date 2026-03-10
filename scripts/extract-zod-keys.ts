/**
 * extract-zod-keys.ts
 *
 * Scans the codebase for all zodError translation key usages and produces
 * a structured JSON inventory file at scripts/zod-keys-inventory.json.
 *
 * Scan scope:
 *   - packages/schemas/src/**\/*.ts
 *   - apps/api/src/types/validation-messages.ts
 *   - apps/api/src/schemas/base-schemas.ts
 *   - apps/api/src/routes/exchange-rates/admin/index.ts
 *
 * Usage:
 *   npx tsx scripts/extract-zod-keys.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the output JSON file. */
interface ZodKeysInventory {
    /** All unique resolved keys, sorted alphabetically. */
    keys: string[];
    /** Total number of unique keys. */
    total: number;
    /** Count of keys per second-level namespace (e.g. "accommodation", "common"). */
    byNamespace: Record<string, number>;
    /** Keys that were resolved from template literals in the factory file. */
    dynamicKeys: string[];
    /** Non-fatal warnings generated during extraction. */
    warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

/** Factory file path — handled with hardcoded resolutions instead of regex. */
const FACTORY_FILE = path.join(REPO_ROOT, 'packages/schemas/src/utils/http-field.factory.ts');

/** Files to scan with a simple static regex (excludes the factory file). */
const STATIC_SCAN_PATTERNS = [
    'packages/schemas/src/**/*.ts',
    'apps/api/src/types/validation-messages.ts',
    'apps/api/src/schemas/base-schemas.ts',
    'apps/api/src/routes/exchange-rates/admin/index.ts'
];

const OUTPUT_FILE = path.join(REPO_ROOT, 'scripts/zod-keys-inventory.json');

/**
 * Regex that matches any quoted string literal (single, double, or backtick
 * with no interpolation) whose value starts with "zodError.".
 *
 * Capturing group 1 holds the key text.
 */
const _STATIC_KEY_RE = /(?:'|"|`)( zodError\.[a-zA-Z0-9_.]+)(?:'|"|`)/g;

/**
 * Same pattern but without the leading space artifact — the actual match
 * group we care about is a zodError key with no whitespace prefix.
 */
const KEY_RE = /['"`](zodError\.[a-zA-Z0-9_.]+)['"`]/g;

// ---------------------------------------------------------------------------
// Hardcoded dynamic key resolutions for http-field.factory.ts
// ---------------------------------------------------------------------------

/**
 * Returns all keys that the http-field factory generates dynamically.
 *
 * Each entry maps the template pattern to the concrete field names that are
 * passed at call-site (derived from CommonHttpFields and the factory
 * implementation).
 */
function buildFactoryKeys(): string[] {
    const resolved: string[] = [];

    // priceField: field = 'min' | 'max'
    //   zodError.common.${options.field}Price.tooLow
    //   zodError.common.${options.field}Price.tooHigh
    for (const field of ['min', 'max'] as const) {
        resolved.push(`zodError.common.${field}Price.tooLow`);
        resolved.push(`zodError.common.${field}Price.tooHigh`);
    }

    // guestField: field = 'min' | 'max'
    //   zodError.common.${options.field}Guests.tooLow
    //   zodError.common.${options.field}Guests.tooHigh
    for (const field of ['min', 'max'] as const) {
        resolved.push(`zodError.common.${field}Guests.tooLow`);
        resolved.push(`zodError.common.${field}Guests.tooHigh`);
    }

    // roomField: field = minBedrooms | maxBedrooms | minBathrooms | maxBathrooms
    //   zodError.common.${options.field}.tooLow
    //   zodError.common.${options.field}.tooHigh
    for (const field of ['minBedrooms', 'maxBedrooms', 'minBathrooms', 'maxBathrooms']) {
        resolved.push(`zodError.common.${field}.tooLow`);
        resolved.push(`zodError.common.${field}.tooHigh`);
    }

    // ratingField: field = 'min' | 'max'
    //   zodError.common.${options.field}Rating.tooLow
    //   zodError.common.${options.field}Rating.tooHigh
    for (const field of ['min', 'max'] as const) {
        resolved.push(`zodError.common.${field}Rating.tooLow`);
        resolved.push(`zodError.common.${field}Rating.tooHigh`);
    }

    // coordinateField: type = 'latitude' | 'longitude'
    //   zodError.common.${type}.tooLow
    //   zodError.common.${type}.tooHigh
    for (const type of ['latitude', 'longitude']) {
        resolved.push(`zodError.common.${type}.tooLow`);
        resolved.push(`zodError.common.${type}.tooHigh`);
    }

    // ageField: field = 'min' | 'max'
    //   zodError.common.${options.field}Age.tooLow
    //   zodError.common.${options.field}Age.tooHigh
    for (const field of ['min', 'max'] as const) {
        resolved.push(`zodError.common.${field}Age.tooLow`);
        resolved.push(`zodError.common.${field}Age.tooHigh`);
    }

    // dateField: fieldName = checkIn | checkOut | createdAfter | createdBefore | lastLoginAfter | lastLoginBefore
    //   zodError.common.${fieldName}.invalidDate
    for (const fieldName of [
        'checkIn',
        'checkOut',
        'createdAfter',
        'createdBefore',
        'lastLoginAfter',
        'lastLoginBefore'
    ]) {
        resolved.push(`zodError.common.${fieldName}.invalidDate`);
    }

    // booleanField: fieldName = isActive | isFeatured | isAvailable | isEmailVerified | hasActiveSubscription | hasAccommodations
    //   zodError.common.${fieldName}.invalidBoolean
    for (const fieldName of [
        'isActive',
        'isFeatured',
        'isAvailable',
        'isEmailVerified',
        'hasActiveSubscription',
        'hasAccommodations'
    ]) {
        resolved.push(`zodError.common.${fieldName}.invalidBoolean`);
    }

    // distanceField: static keys (no interpolation in the actual factory)
    //   zodError.common.distance.mustBePositive
    //   zodError.common.distance.tooHigh
    // NOTE: these are technically static in the factory source but relate to
    // the distance/radius concept, so we surface them here too for completeness.
    resolved.push('zodError.common.distance.mustBePositive');
    resolved.push('zodError.common.distance.tooHigh');

    return resolved;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

/**
 * Resolves all `.ts` file paths matching the static scan patterns,
 * excluding the factory file (which is handled separately).
 *
 * @returns Absolute paths to files that should be statically scanned.
 */
async function resolveStaticFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of STATIC_SCAN_PATTERNS) {
        const matches = await glob(pattern, {
            cwd: REPO_ROOT,
            absolute: true,
            ignore: ['**/node_modules/**', '**/*.d.ts']
        });
        allFiles.push(...matches);
    }

    // Remove duplicates and exclude the factory file
    const unique = [...new Set(allFiles)].filter(
        (f) => path.resolve(f) !== path.resolve(FACTORY_FILE)
    );

    return unique;
}

// ---------------------------------------------------------------------------
// Static key extraction
// ---------------------------------------------------------------------------

/**
 * Extracts all static zodError keys from a single file's source text.
 *
 * @param source - Raw file contents as a string.
 * @param filePath - Absolute file path (used in warning messages).
 * @param warnings - Mutable array to push non-fatal warnings into.
 * @returns Array of raw zodError key strings found in the file.
 */
function extractStaticKeysFromSource(
    source: string,
    filePath: string,
    warnings: string[]
): string[] {
    const keys: string[] = [];
    let match: RegExpExecArray | null;

    KEY_RE.lastIndex = 0;

    match = KEY_RE.exec(source);
    while (match !== null) {
        const key = match[1];

        if (!key) {
            match = KEY_RE.exec(source);
            continue;
        }

        // Sanity check: key should have at least three segments
        const segments = key.split('.');
        if (segments.length < 3) {
            warnings.push(
                `Suspicious key with fewer than 3 segments in ${path.relative(REPO_ROOT, filePath)}: "${key}"`
            );
        }

        keys.push(key);
        match = KEY_RE.exec(source);
    }

    return keys;
}

/**
 * Reads each file in the provided list and extracts static zodError keys.
 *
 * @param files - Absolute paths to scan.
 * @param warnings - Mutable array to push non-fatal warnings into.
 * @returns All static keys found across all files (may contain duplicates).
 */
function extractStaticKeys(files: readonly string[], warnings: string[]): string[] {
    const allKeys: string[] = [];

    for (const filePath of files) {
        let source: string;

        try {
            source = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            warnings.push(
                `Could not read file ${path.relative(REPO_ROOT, filePath)}: ${String(err)}`
            );
            continue;
        }

        const keys = extractStaticKeysFromSource(source, filePath, warnings);
        allKeys.push(...keys);
    }

    return allKeys;
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

/**
 * Deduplicates and sorts an array of strings alphabetically.
 *
 * @param keys - Raw (possibly duplicate) array of strings.
 * @returns Sorted, deduplicated array.
 */
function deduplicateAndSort(keys: readonly string[]): string[] {
    return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
}

/**
 * Counts keys per second-level namespace.
 *
 * Given `zodError.accommodation.name.min`, the namespace is `accommodation`.
 * Given `zodError.common.id.invalid_uuid`, the namespace is `common`.
 *
 * @param keys - Deduplicated array of zodError keys.
 * @returns Object mapping namespace name to key count.
 */
function countByNamespace(keys: readonly string[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const key of keys) {
        const segments = key.split('.');
        // segments[0] = "zodError", segments[1] = namespace
        const namespace = segments[1] ?? 'unknown';
        counts[namespace] = (counts[namespace] ?? 0) + 1;
    }

    // Sort namespace keys alphabetically for deterministic output
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Entry point. Runs the full extraction pipeline and writes the output JSON.
 */
async function main(): Promise<void> {
    const warnings: string[] = [];
    const staticFiles = await resolveStaticFiles();
    const rawStaticKeys = extractStaticKeys(staticFiles, warnings);
    const rawDynamicKeys = buildFactoryKeys();

    const allRawKeys = [...rawStaticKeys, ...rawDynamicKeys];
    const allKeys = deduplicateAndSort(allRawKeys);
    const dynamicKeys = deduplicateAndSort(rawDynamicKeys);
    const byNamespace = countByNamespace(allKeys);

    if (warnings.length > 0) {
        console.warn(`\nWarnings (${warnings.length}):`);
        for (const w of warnings) {
            console.warn(`  [WARN] ${w}`);
        }
    }

    const inventory: ZodKeysInventory = {
        keys: allKeys,
        total: allKeys.length,
        byNamespace,
        dynamicKeys,
        warnings
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(inventory, null, 4), 'utf8');
}

main().catch((err: unknown) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
