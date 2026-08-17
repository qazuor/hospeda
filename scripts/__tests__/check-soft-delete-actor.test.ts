/**
 * Unit tests for the soft-delete authorship guard (HOS-556 / HOS-559).
 *
 * These pin the guard's PREDICATE, not the repository's current state: each
 * one feeds a synthetic source string to the matcher and asserts the verdict.
 * The repo-wide run is the CI step; this is what stops the predicate from
 * silently becoming unable to fail.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    assignsDeletedById,
    assignsNonNullDeletedAt,
    checkCanonicalWriter,
    collectSourceFiles,
    EXEMPT_TABLES,
    REPO_ROOT,
    readArgList,
    resolveTableIdentifier,
    SYSTEM_DELETE_SITES,
    scanNullActors,
    scanSources,
    splitTopLevelArgs,
    validateExemptions
} from '../check-soft-delete-actor.js';

// ---------------------------------------------------------------------------
// Throwaway trees, so the fixtures cannot be confused with the real repo
// ---------------------------------------------------------------------------

const dirs: string[] = [];

afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Writes `files` into a temp repo shaped like `packages/<pkg>/src/...`. */
function makeTree(files: Record<string, string>): { root: string; paths: string[] } {
    const root = mkdtempSync(join(tmpdir(), 'sda-'));
    dirs.push(root);
    const paths: string[] = [];
    for (const [rel, content] of Object.entries(files)) {
        const full = join(root, rel);
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, content, 'utf8');
        paths.push(full);
    }
    return { root, paths };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

describe('argument parsing', () => {
    it('reads a balanced argument list', () => {
        expect(readArgList('f({ a: 1, b: [2, 3] }, tx)', 1)).toBe('{ a: 1, b: [2, 3] }, tx');
    });

    it('splits only on top-level commas', () => {
        expect(splitTopLevelArgs('{ a: 1, b: 2 }, tx')).toEqual(['{ a: 1, b: 2 }', 'tx']);
    });

    it('resolves the table from the nearest single-argument .update()', () => {
        const src = 'await db.update(accommodations).set({ deletedAt: now })';
        expect(resolveTableIdentifier(src, src.indexOf('.set('))).toBe('accommodations');
    });

    it('refuses to resolve a table from a two-argument .update()', () => {
        const src = 'await model.update({ id }, { deletedAt: now })';
        expect(resolveTableIdentifier(src, src.length)).toBeNull();
    });
});

describe('deletedAt / deletedById detection', () => {
    it('treats a non-null deletedAt as a soft-delete write', () => {
        expect(assignsNonNullDeletedAt('{ deletedAt: now }')).toBe(true);
        expect(assignsNonNullDeletedAt('{ deletedAt: new Date() }')).toBe(true);
        expect(assignsNonNullDeletedAt('{ deletedAt: sql`now()` }')).toBe(true);
    });

    it('ignores a restore, which clears deletedAt', () => {
        expect(assignsNonNullDeletedAt('{ deletedAt: null, deletedById: null }')).toBe(false);
        expect(assignsNonNullDeletedAt('{ updatedAt: now }')).toBe(false);
    });

    it('accepts both explicit and shorthand deletedById', () => {
        expect(assignsDeletedById('{ deletedAt: now, deletedById: actor.id }')).toBe(true);
        expect(assignsDeletedById('{ deletedAt: now, deletedById, updatedAt: now }')).toBe(true);
        expect(assignsDeletedById('{ deletedAt: now, updatedAt: now }')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Check 4 — the call-site scan
// ---------------------------------------------------------------------------

describe('scanSources', () => {
    it('flags a .set() that stamps deletedAt without an author', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts': 'await db.update(posts).set({ deletedAt: now, updatedAt: now });'
        });

        const { violations } = scanSources(root, paths);

        expect(violations).toHaveLength(1);
        expect(violations[0]?.table).toBe('posts');
        expect(violations[0]?.file).toBe('packages/x/src/a.ts');
    });

    it('accepts the same write once it carries the author', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts':
                'await db.update(posts).set({ deletedAt: now, deletedById: actor.id });'
        });

        expect(scanSources(root, paths).violations).toEqual([]);
    });

    it('flags the model form update(where, data) too', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts': 'await this.model.update({ id }, { deletedAt: new Date() });'
        });

        const { violations } = scanSources(root, paths);

        expect(violations).toHaveLength(1);
        // No table identifier to exempt: this shape is fail-closed on purpose.
        expect(violations[0]?.table).toBeNull();
    });

    it('does not flag a restore', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts':
                'await db.update(posts).set({ deletedAt: null, deletedById: null });'
        });

        expect(scanSources(root, paths).violations).toEqual([]);
    });

    it('does not flag a plain object that merely reports a deletion', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts': 'return { relation: { ...existing, deletedAt: new Date() } };'
        });

        expect(scanSources(root, paths).violations).toEqual([]);
    });

    it('excuses a table on the exemption list and counts the excuse', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts': 'await db.update(featureFlags).set({ deletedAt: sql`now()` });'
        });

        const { violations, exemptionsUsed } = scanSources(root, paths);

        expect(violations).toEqual([]);
        expect(exemptionsUsed).toEqual(['featureFlags']);
    });

    it('skips test files', () => {
        const tree = makeTree({
            'packages/x/src/a.test.ts':
                'await db.update(posts).set({ deletedAt: now, updatedAt: now });'
        });

        expect(collectSourceFiles(tree.root)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Check 2 — null actors
// ---------------------------------------------------------------------------

describe('scanNullActors', () => {
    it('flags a softDelete() that hard-codes a null actor', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts': 'await model.softDelete({ id }, null, tx);'
        });

        const found = scanNullActors(root, paths);

        expect(found).toHaveLength(1);
        expect(found[0]?.file).toBe('packages/x/src/a.ts');
    });

    it('accepts a real actor id', () => {
        const { root, paths } = makeTree({
            'packages/x/src/a.ts': 'await model.softDelete({ id }, actor.id, tx);'
        });

        expect(scanNullActors(root, paths)).toEqual([]);
    });

    it('has no allowed system sites today', () => {
        // If this ever grows, each entry is a row that will never be auditable.
        expect(SYSTEM_DELETE_SITES).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Checks 1 and 3, against the real repository
// ---------------------------------------------------------------------------

describe('the repository itself', () => {
    it('keeps the canonical writer stamping the actor', () => {
        expect(checkCanonicalWriter(REPO_ROOT)).toEqual([]);
    });

    it('has no exemption that hides a table which does have the column', () => {
        expect(validateExemptions(REPO_ROOT)).toEqual([]);
    });

    it('exempts only tables, never files — an exemption cannot target a call site', () => {
        for (const entry of EXEMPT_TABLES) {
            expect(entry.table).not.toMatch(/[/.]/);
            expect(entry.reason.length).toBeGreaterThan(10);
        }
    });
});
