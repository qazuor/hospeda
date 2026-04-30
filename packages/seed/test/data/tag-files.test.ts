/**
 * T-038 file-system assertions for the reclassified tag seed JSONs.
 *
 * Validates that:
 *  - Exactly 25 internal-* files, 30 system-* files, and 34 postTag files exist.
 *  - Every JSON parses cleanly and has the correct shape.
 *  - No duplicate names within each group.
 *  - All PostTag slugs match the URL-safe slug pattern.
 *
 * References: SPEC-086 T-038, tag-seeds.md
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved paths — relative to the package root
const PKG_ROOT = resolve(import.meta.dirname, '../../');
const TAG_DIR = join(PKG_ROOT, 'src/data/tag');
const POST_TAG_DIR = join(PKG_ROOT, 'src/data/postTag');

// ---------------------------------------------------------------------------
// Shape validators
// ---------------------------------------------------------------------------

/** Valid TagColorPgEnum values (must match packages/schemas TagColorEnum). */
const VALID_COLORS = new Set([
    'RED',
    'BLUE',
    'GREEN',
    'YELLOW',
    'ORANGE',
    'PURPLE',
    'PINK',
    'BROWN',
    'GREY',
    'WHITE',
    'CYAN',
    'MAGENTA',
    'LIGHT_BLUE',
    'LIGHT_GREEN'
]);

/** Valid lifecycleState values for seed fixtures. */
const VALID_LIFECYCLE_STATES = new Set(['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']);

/** Slug must be lowercase alphanumerics separated by hyphens. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Read and parse a JSON file. Throws if the file cannot be parsed. */
function readJson(filePath: string): Record<string, unknown> {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
}

/** Collect files matching a prefix in a directory, sorted alphabetically. */
function collectFiles(dir: string, prefix: string): string[] {
    return readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
        .sort();
}

/** Collect all JSON files in a directory, sorted alphabetically. */
function collectAllFiles(dir: string): string[] {
    return readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .sort();
}

// ---------------------------------------------------------------------------
// Helpers for shared assertions
// ---------------------------------------------------------------------------

/**
 * Asserts the shape of an INTERNAL or SYSTEM tag JSON.
 * Must have: name, description, color, lifecycleState.
 * Must NOT have: slug.
 */
function assertInternalOrSystemShape(data: Record<string, unknown>, filePath: string): void {
    expect(typeof data.name, `${filePath}: name must be a string`).toBe('string');
    expect((data.name as string).length, `${filePath}: name must not be empty`).toBeGreaterThan(0);

    expect(typeof data.description, `${filePath}: description must be a string`).toBe('string');
    expect(
        (data.description as string).length,
        `${filePath}: description must not be empty`
    ).toBeGreaterThan(0);

    expect(typeof data.color, `${filePath}: color must be a string`).toBe('string');
    expect(
        VALID_COLORS.has(data.color as string),
        `${filePath}: color "${data.color as string}" is not a valid TagColorEnum value`
    ).toBe(true);

    expect(typeof data.lifecycleState, `${filePath}: lifecycleState must be a string`).toBe(
        'string'
    );
    expect(
        VALID_LIFECYCLE_STATES.has(data.lifecycleState as string),
        `${filePath}: lifecycleState "${data.lifecycleState as string}" is not valid`
    ).toBe(true);

    expect('slug' in data, `${filePath}: INTERNAL/SYSTEM tags must NOT have a slug field`).toBe(
        false
    );
}

/**
 * Asserts the shape of a PostTag JSON.
 * Must have: name, slug, description, color, lifecycleState.
 */
function assertPostTagShape(data: Record<string, unknown>, filePath: string): void {
    expect(typeof data.name, `${filePath}: name must be a string`).toBe('string');
    expect((data.name as string).length, `${filePath}: name must not be empty`).toBeGreaterThan(0);

    expect(typeof data.slug, `${filePath}: slug must be a string`).toBe('string');
    expect(
        SLUG_PATTERN.test(data.slug as string),
        `${filePath}: slug "${data.slug as string}" does not match URL-safe slug pattern`
    ).toBe(true);

    expect(typeof data.description, `${filePath}: description must be a string`).toBe('string');
    expect(
        (data.description as string).length,
        `${filePath}: description must not be empty`
    ).toBeGreaterThan(0);

    expect(typeof data.color, `${filePath}: color must be a string`).toBe('string');
    expect(
        VALID_COLORS.has(data.color as string),
        `${filePath}: color "${data.color as string}" is not a valid TagColorEnum value`
    ).toBe(true);

    expect(typeof data.lifecycleState, `${filePath}: lifecycleState must be a string`).toBe(
        'string'
    );
    expect(
        VALID_LIFECYCLE_STATES.has(data.lifecycleState as string),
        `${filePath}: lifecycleState "${data.lifecycleState as string}" is not valid`
    ).toBe(true);
}

// ---------------------------------------------------------------------------
// INTERNAL tag tests (25 files)
// ---------------------------------------------------------------------------

describe('INTERNAL tag seed files (T-038)', () => {
    const files = collectFiles(TAG_DIR, 'internal-');

    it('should contain exactly 25 internal-* files', () => {
        expect(files).toHaveLength(25);
    });

    it('should parse every INTERNAL JSON cleanly', () => {
        for (const file of files) {
            const filePath = join(TAG_DIR, file);
            expect(() => readJson(filePath), `${file} must parse as valid JSON`).not.toThrow();
        }
    });

    it('should have correct shape for every INTERNAL tag', () => {
        for (const file of files) {
            const filePath = join(TAG_DIR, file);
            const data = readJson(filePath);
            assertInternalOrSystemShape(data, file);
        }
    });

    it('should have no duplicate names within INTERNAL group', () => {
        const names = files.map((file) => {
            const data = readJson(join(TAG_DIR, file));
            return data.name as string;
        });
        const uniqueNames = new Set(names);
        expect(uniqueNames.size, 'Duplicate names found in INTERNAL tags').toBe(names.length);
    });
});

// ---------------------------------------------------------------------------
// SYSTEM tag tests (30 files)
// ---------------------------------------------------------------------------

describe('SYSTEM tag seed files (T-038)', () => {
    const files = collectFiles(TAG_DIR, 'system-');

    it('should contain exactly 30 system-* files', () => {
        expect(files).toHaveLength(30);
    });

    it('should parse every SYSTEM JSON cleanly', () => {
        for (const file of files) {
            const filePath = join(TAG_DIR, file);
            expect(() => readJson(filePath), `${file} must parse as valid JSON`).not.toThrow();
        }
    });

    it('should have correct shape for every SYSTEM tag', () => {
        for (const file of files) {
            const filePath = join(TAG_DIR, file);
            const data = readJson(filePath);
            assertInternalOrSystemShape(data, file);
        }
    });

    it('should have no duplicate names within SYSTEM group', () => {
        const names = files.map((file) => {
            const data = readJson(join(TAG_DIR, file));
            return data.name as string;
        });
        const uniqueNames = new Set(names);
        expect(uniqueNames.size, 'Duplicate names found in SYSTEM tags').toBe(names.length);
    });
});

// ---------------------------------------------------------------------------
// PostTag tests (34 files)
// ---------------------------------------------------------------------------

describe('PostTag seed files (T-038)', () => {
    const files = collectAllFiles(POST_TAG_DIR);

    it('should contain exactly 34 postTag files', () => {
        expect(files).toHaveLength(34);
    });

    it('should parse every PostTag JSON cleanly', () => {
        for (const file of files) {
            const filePath = join(POST_TAG_DIR, file);
            expect(() => readJson(filePath), `${file} must parse as valid JSON`).not.toThrow();
        }
    });

    it('should have correct shape (including slug) for every PostTag', () => {
        for (const file of files) {
            const filePath = join(POST_TAG_DIR, file);
            const data = readJson(filePath);
            assertPostTagShape(data, file);
        }
    });

    it('should have no duplicate names within PostTag group', () => {
        const names = files.map((file) => {
            const data = readJson(join(POST_TAG_DIR, file));
            return data.name as string;
        });
        const uniqueNames = new Set(names);
        expect(uniqueNames.size, 'Duplicate names found in PostTag').toBe(names.length);
    });

    it('should have no duplicate slugs within PostTag group', () => {
        const slugs = files.map((file) => {
            const data = readJson(join(POST_TAG_DIR, file));
            return data.slug as string;
        });
        const uniqueSlugs = new Set(slugs);
        expect(uniqueSlugs.size, 'Duplicate slugs found in PostTag').toBe(slugs.length);
    });

    it('should have all PostTag slugs match the URL-safe slug pattern', () => {
        for (const file of files) {
            const data = readJson(join(POST_TAG_DIR, file));
            const slug = data.slug as string;
            expect(
                SLUG_PATTERN.test(slug),
                `${file}: slug "${slug}" does not match /^[a-z0-9]+(?:-[a-z0-9]+)*$/`
            ).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// Cross-group sanity checks
// ---------------------------------------------------------------------------

describe('Tag directory sanity (T-038)', () => {
    it('should have only internal-* and system-* files in the tag directory', () => {
        const allTagFiles = readdirSync(TAG_DIR).filter((f) => f.endsWith('.json'));
        const unexpectedFiles = allTagFiles.filter(
            (f) => !f.startsWith('internal-') && !f.startsWith('system-')
        );
        expect(
            unexpectedFiles,
            `Unexpected files in tag/: ${unexpectedFiles.join(', ')}`
        ).toHaveLength(0);
    });

    it('should have exactly 55 total files in tag/ (25 internal + 30 system)', () => {
        const allTagFiles = readdirSync(TAG_DIR).filter((f) => f.endsWith('.json'));
        expect(allTagFiles).toHaveLength(55);
    });
});
