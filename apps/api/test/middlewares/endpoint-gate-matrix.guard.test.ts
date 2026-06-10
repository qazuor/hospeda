/**
 * SPEC-145 T-022 — Route snapshot guard: gate-matrix completeness CI gate
 *
 * This test ensures the endpoint-gate-matrix.md stays in sync with the actual
 * route handler files on disk. It catches two classes of drift:
 *
 *   a) A new route file was added without a matrix row (developer forgot to
 *      add the gate decision).
 *   b) A matrix row points at a file that no longer exists (developer deleted
 *      or renamed a handler without updating the matrix).
 *
 * ## Approach: static filesystem scan (no app boot required)
 *
 * The guard reads the matrix markdown and the route handler files directly.
 * This is the same pattern used by the INV-1 transversal guard
 * (test/services/inv1-cache-invalidation.guard.test.ts, commit 6d6450258).
 *
 *   - Fast: no Hono app instantiation, no DB, no network.
 *   - Stable: does not depend on import resolution or module loading.
 *   - Self-documenting: failure messages tell the developer exactly what to do.
 *
 * ## What is scanned
 *
 * Matrix side: the "## Route Gate Matrix" section up to the next "##" heading.
 * Handler file column (index 1, 0-based after the leading "|") is extracted,
 * normalized (strip backticks and annotation suffixes like " (qzpay)", " (admin)"),
 * and deduplicated. Line-number suffixes like ":620" are stripped (those are
 * reserved-section references, not route files).
 *
 * Filesystem side: route handler files under `apps/api/src/routes/`, including:
 *   - Files inside `*\/protected\/*` or `*\/admin\/*` subdirectories
 *   - Specific top-level handler files covered by the matrix (auth/*, billing/*,
 *     app-logs/list.ts, cron-admin/runs.ts, event/comments/public/list.ts, etc.)
 *
 * Explicit exclusions (not route handlers):
 *   - index.ts barrel files (router assembly)
 *   - Files ending in `_singletons.ts` (shared DI helpers)
 *   - `comment/admin/comment-admin.helpers.ts` (shared read-route helpers)
 *   - `media/admin/permissions.ts` (entity-level permission helper)
 *   - `tag/user-tag/admin/entities.ts` (router barrel that assembles entity sub-routes)
 *   - `auth/handler.ts` (Better Auth passthrough, not an application route)
 *   - Matrix reserved sections (phantom gates, limit stubs) are not route files
 *
 * ## Failure messages
 *
 * Each assertion failure tells the developer exactly what file or matrix row is
 * missing and what to do to fix it.
 *
 * @module test/middlewares/endpoint-gate-matrix.guard
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Absolute path to the API source root. */
const API_ROOT = resolve(__dirname, '../../');

/** Absolute path to the route handler directory. */
const ROUTES_ROOT = resolve(API_ROOT, 'src/routes');

/** Absolute path to the endpoint gate matrix markdown. */
const MATRIX_PATH = resolve(API_ROOT, '../../docs/billing/endpoint-gate-matrix.md');

// ---------------------------------------------------------------------------
// Matrix parsing
// ---------------------------------------------------------------------------

/**
 * Parse the "## Route Gate Matrix" main table from the markdown file.
 *
 * Returns a Set of normalized handler file paths (relative to
 * `apps/api/src/routes/`). Annotation suffixes like " (qzpay)" and " (admin)"
 * are stripped so the result is a plain relative file path.
 *
 * Section boundary: starts at the "## Route Gate Matrix" heading, ends at the
 * next "##" heading (which begins the reserved/phantom sections).
 */
function parseMatrixHandlerFiles(): Set<string> {
    const raw = readFileSync(MATRIX_PATH, 'utf-8');

    // Extract only the main table section
    const mainTableMatch = raw.match(/^## Route Gate Matrix\s*\n([\s\S]*?)(?=^## )/m);
    if (!mainTableMatch) {
        throw new Error(
            `Could not find "## Route Gate Matrix" section in ${MATRIX_PATH}. The matrix file must contain this exact heading followed by the pipe table.`
        );
    }
    // mainTableMatch[1] is always defined here — the match captured group 1
    const mainTableText: string = mainTableMatch[1] ?? '';

    const handlerFiles = new Set<string>();

    for (const line of mainTableText.split('\n')) {
        // Skip separator rows and empty lines
        if (!line.startsWith('|') || line.includes('|---|')) {
            continue;
        }

        // Skip section header rows (bold text like | **ACCOMMODATION — PROTECTED** | ... |)
        if (/^\|\s*\*\*/.test(line)) {
            continue;
        }

        // Skip the column header row
        if (/^\|\s*Route \(METHOD/.test(line)) {
            continue;
        }

        // Split by pipe, extract handler file column (index 1, 0-based after leading "|")
        const cols = line.split('|');
        if (cols.length < 3) {
            continue;
        }

        // Column layout: | route | handler file | decision | keys | status | reason |
        // After split by "|": [empty, route, handler, decision, keys, status, reason, empty]
        //   index 0 = "" (before first |)
        //   index 1 = route
        //   index 2 = handler file  <-- we want this
        const rawHandler = (cols[2] ?? '').trim();

        if (!rawHandler) {
            continue;
        }

        // Strip backtick delimiters
        const stripped = rawHandler.replace(/`/g, '');

        // Strip annotation suffixes: " (qzpay)", " (admin)", or similar
        const withoutAnnotation = stripped.replace(/\s*\([^)]*\)\s*$/, '').trim();

        // Strip line-number suffixes like ":620" (reserved section references)
        const withoutLineNum = withoutAnnotation.replace(/:\d+$/, '').trim();

        // Skip empty, wildcard, or non-file entries
        if (!withoutLineNum || withoutLineNum === '-' || withoutLineNum.startsWith('*')) {
            continue;
        }

        // Only include entries that look like TypeScript source files
        if (!withoutLineNum.endsWith('.ts')) {
            continue;
        }

        handlerFiles.add(withoutLineNum);
    }

    return handlerFiles;
}

// ---------------------------------------------------------------------------
// Filesystem enumeration
// ---------------------------------------------------------------------------

/**
 * Files that exist on disk but are NOT route handlers and must be excluded
 * from the filesystem-side enumeration. These are router barrels, shared
 * helpers, framework passthrough files, or QZPay factory hooks modules.
 */
const FS_EXCLUSIONS: ReadonlySet<string> = new Set([
    // Router barrel — assembles entity sub-routes; the individual handlers
    // (entities/add.ts, entities/list-own.ts, entities/remove.ts) are in the matrix
    'tag/user-tag/admin/entities.ts',
    // Shared read-route helpers (not registered as standalone routes)
    'comment/admin/comment-admin.helpers.ts',
    // Entity-level permission helper (used by media upload/delete handlers)
    'media/admin/permissions.ts',
    // Better Auth framework passthrough — not an application route handler
    'auth/handler.ts',
    // QZPay lifecycle hooks module — not a standalone route; routes registered by
    // the qzpay-hono factory and covered by the billing/admin/index.ts (qzpay) row
    'billing/admin/qzpay-admin-hooks.ts',
    // Shared SYSTEM_ACTOR constant for owner conversation routes (not a route handler)
    'conversations/protected/owner/system-actor.ts',
    // Pure amenity/feature allowlist data + matching helpers consumed by search-intent.ts (not a Hono route)
    'ai/protected/amenity-allowlist.ts',
    // Pure intent→search-params mapper consumed by search-intent.ts (not a Hono route)
    'ai/protected/search-intent.mapper.ts'
]);

/**
 * Recursively walk a directory and return all `.ts` file paths relative to
 * `ROUTES_ROOT`, filtered by the provided predicate.
 */
function walkRoutes(dir: string, filter: (relPath: string) => boolean): readonly string[] {
    const results: string[] = [];

    function walk(current: string): void {
        for (const entry of readdirSync(current)) {
            const full = join(current, entry);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (entry.endsWith('.ts')) {
                const rel = relative(ROUTES_ROOT, full);
                if (filter(rel)) {
                    results.push(rel);
                }
            }
        }
    }

    walk(dir);
    return results;
}

/**
 * Multi-route "index.ts" files that the matrix explicitly references.
 *
 * These are real route handler files that implement multiple routes each
 * (QZPay factory-generated or multi-route routers). They are excluded from
 * the standard index.ts-barrel filter but must be present in the FS
 * enumeration so the bidirectional check stays in sync with the matrix.
 */
const MULTI_ROUTE_INDEX_FILES: ReadonlySet<string> = new Set([
    'billing/index.ts', // QZPay protected tier (customers, subscriptions, plans, etc.)
    'billing/admin/index.ts', // QZPay admin tier
    'geocoding/admin/index.ts', // Geocoding admin proxy
    'geocoding/protected/index.ts', // Geocoding protected proxy (autocomplete + reverse, SPEC-208)
    'platform-settings/admin/index.ts', // Platform settings admin CRUD
    'revalidation/index.ts', // Revalidation admin routes
    'exchange-rates/admin/index.ts', // Exchange-rate admin routes
    'metrics/index.ts', // Ops metrics admin
    'auth/index.ts' // Admin auth monitoring (Better Auth passthrough)
]);

/**
 * Determine whether a route-relative path should be included in the
 * filesystem-side enumeration.
 *
 * Included:
 *   - Any .ts file inside a /protected/ or /admin/ path segment
 *   - Specific multi-route index.ts files listed in MULTI_ROUTE_INDEX_FILES
 *   - Top-level handler files that appear in the matrix (auth/, billing/
 *     non-public, app-logs/, cron-admin/, event/comments/public/)
 *
 * Excluded:
 *   - index.ts barrel files (unless explicitly listed in MULTI_ROUTE_INDEX_FILES)
 *   - Files ending in _singletons.ts
 *   - Files in FS_EXCLUSIONS
 *   - Public-only route dirs not covered by the matrix:
 *     billing/public/, exchange-rates/public/
 *   - Internal webhook implementation modules (only webhooks/admin/ is in scope):
 *     webhooks/mercadopago/*, webhooks/brevo.ts, webhooks/health.ts
 */
function shouldIncludeRouteFile(relPath: string): boolean {
    // Always include explicitly listed multi-route index.ts files
    if (MULTI_ROUTE_INDEX_FILES.has(relPath)) {
        return true;
    }

    // Never include other index.ts barrels
    if (relPath.endsWith('/index.ts') || relPath === 'index.ts') {
        return false;
    }

    // Never include DI singleton helpers
    if (relPath.endsWith('_singletons.ts')) {
        return false;
    }

    // Never include explicitly excluded helper files
    if (FS_EXCLUSIONS.has(relPath)) {
        return false;
    }

    // Exclude public-only billing routes (not billing-gated, out of matrix scope)
    if (relPath.startsWith('billing/public/')) {
        return false;
    }

    // Exclude public exchange-rate routes (not in matrix scope)
    if (relPath.startsWith('exchange-rates/public/')) {
        return false;
    }

    // Exclude internal MercadoPago webhook implementation modules.
    // The MP webhook entry point is the QZPay factory in billing/index.ts;
    // the individual handler/logic/utils files are an internal split-module
    // pattern and are not standalone Hono routes.
    if (relPath.startsWith('webhooks/mercadopago/')) {
        return false;
    }

    // Exclude other top-level public webhook routes (not in matrix scope)
    if (relPath === 'webhooks/brevo.ts' || relPath === 'webhooks/health.ts') {
        return false;
    }

    // Include all files inside a /protected/ or /admin/ path segment
    if (/\/(protected|admin)\//.test(relPath)) {
        return true;
    }

    // Include top-level handler files from specific directories that the matrix covers
    const TOP_LEVEL_PREFIXES: readonly string[] = [
        'auth/',
        'billing/',
        'app-logs/',
        'cron-admin/',
        'event/comments/public/'
    ];

    for (const prefix of TOP_LEVEL_PREFIXES) {
        if (relPath.startsWith(prefix)) {
            return true;
        }
    }

    return false;
}

/**
 * Enumerate all route handler files from the filesystem.
 * Returns paths relative to `ROUTES_ROOT`.
 */
function enumerateFsRouteFiles(): readonly string[] {
    return walkRoutes(ROUTES_ROOT, shouldIncludeRouteFile);
}

// ---------------------------------------------------------------------------
// Parser unit helper (for internal sanity cases)
// ---------------------------------------------------------------------------

/**
 * Parse a synthetic matrix snippet for testing the parser itself.
 * Accepts a subset of table rows (no heading required).
 */
function parseHandlerFilesFromLines(lines: string[]): string[] {
    const results: string[] = [];
    for (const line of lines) {
        if (!line.startsWith('|') || line.includes('|---|')) continue;
        if (/^\|\s*\*\*/.test(line)) continue;
        if (/^\|\s*Route \(METHOD/.test(line)) continue;
        const cols = line.split('|');
        if (cols.length < 3) continue;
        const rawHandler = (cols[2] ?? '').trim();
        if (!rawHandler) continue;
        const stripped = rawHandler.replace(/`/g, '');
        const withoutAnnotation = stripped.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const withoutLineNum = withoutAnnotation.replace(/:\d+$/, '').trim();
        if (!withoutLineNum || withoutLineNum === '-' || withoutLineNum.startsWith('*')) continue;
        if (!withoutLineNum.endsWith('.ts')) continue;
        results.push(withoutLineNum);
    }
    return results;
}

// ---------------------------------------------------------------------------
// Guard suite
// ---------------------------------------------------------------------------

describe('endpoint-gate-matrix snapshot guard (SPEC-145 T-022)', () => {
    // -------------------------------------------------------------------------
    // Parser unit cases — prove the parser handles edge cases before the main
    // cross-check assertions. These act as the "deliberate drift" self-test
    // required by the task spec.
    // -------------------------------------------------------------------------

    describe('matrix parser — unit cases', () => {
        it('extracts a plain handler file from a normal row', () => {
            const lines = [
                '| `POST /api/v1/protected/accommodations` | `accommodation/protected/create.ts` | gate+limit | `publish_accommodations` | wired | reason |'
            ];
            expect(parseHandlerFilesFromLines(lines)).toEqual([
                'accommodation/protected/create.ts'
            ]);
        });

        it('strips (qzpay) annotation from billing factory rows', () => {
            const lines = [
                '| `GET /api/v1/protected/billing/customers` | `billing/index.ts (qzpay)` | none | - | n/a | reason |'
            ];
            expect(parseHandlerFilesFromLines(lines)).toEqual(['billing/index.ts']);
        });

        it('strips (admin) annotation from auth wildcard row', () => {
            const lines = [
                '| `* /api/v1/admin/auth/*` | `auth/index.ts (admin)` | none | - | n/a | reason |'
            ];
            expect(parseHandlerFilesFromLines(lines)).toEqual(['auth/index.ts']);
        });

        it('strips line-number suffix from reserved-section references', () => {
            const lines = [
                '| `max_properties` | `middlewares/limit-enforcement.ts:620` | - | - | - | stub |'
            ];
            // Note: middlewares/ files do not end in .ts after stripping — actually they do.
            // They ARE stripped of the line-number but kept as a .ts path.
            // The filter "must end in .ts" keeps them. That is intentional: the reserved section
            // references middlewares files that ARE on disk, and the guard skips them because
            // the reserved section is outside the main table parse window.
            // This parser is only called on main-table lines, so this case shouldn't arise.
            // Here we confirm the line-number stripping works regardless.
            expect(parseHandlerFilesFromLines(lines)).toEqual(['middlewares/limit-enforcement.ts']);
        });

        it('skips section header rows (bold)', () => {
            const lines = ['| **ACCOMMODATION — PROTECTED** | | | | | |'];
            expect(parseHandlerFilesFromLines(lines)).toHaveLength(0);
        });

        it('skips separator rows', () => {
            const lines = ['|---|---|---|---|---|---|'];
            expect(parseHandlerFilesFromLines(lines)).toHaveLength(0);
        });

        it('skips rows where handler column is "-" (wildcard/placeholder)', () => {
            const lines = [
                '| `GET /api/v1/protected/accommodations` | `-` | none | - | n/a | reason |'
            ];
            expect(parseHandlerFilesFromLines(lines)).toHaveLength(0);
        });

        it('handles multi-route index.ts files (geocoding, revalidation, etc.)', () => {
            const lines = [
                '| `GET /api/v1/admin/geocoding/autocomplete` | `geocoding/admin/index.ts` | none | - | n/a | reason |',
                '| `POST /api/v1/admin/revalidation/revalidate/manual` | `revalidation/index.ts` | none | - | n/a | reason |'
            ];
            expect(parseHandlerFilesFromLines(lines)).toEqual([
                'geocoding/admin/index.ts',
                'revalidation/index.ts'
            ]);
        });

        it('deduplicated: same file appearing multiple times counts once in Set', () => {
            const matrixFiles = parseMatrixHandlerFiles();
            // billing/index.ts appears many times in the matrix (all QZPay routes)
            // but the Set should contain it exactly once
            expect(matrixFiles.has('billing/index.ts')).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Core guard: matrix → filesystem (matrix rows must point to existing files)
    // -------------------------------------------------------------------------

    describe('matrix rows → filesystem: every matrix handler file must exist on disk', () => {
        const matrixFiles = parseMatrixHandlerFiles();

        it('matrix is non-empty (guard against accidental wipe)', () => {
            expect(matrixFiles.size).toBeGreaterThan(50);
        });

        it.each([...matrixFiles].map((f) => [f] as const))(
            'matrix handler file exists: %s',
            (handlerFile: string) => {
                const absPath = join(ROUTES_ROOT, handlerFile);
                expect(
                    existsSync(absPath),
                    `Matrix references a handler file that does NOT exist on disk:\n  File: ${handlerFile}\n  Full path: ${absPath}\n\nFix: either restore the file, rename the matrix row to the new path,\nor remove the matrix row if the route was intentionally deleted.\nMatrix location: docs/billing/endpoint-gate-matrix.md`
                ).toBe(true);
            }
        );
    });

    // -------------------------------------------------------------------------
    // Core guard: filesystem → matrix (every route file must have a matrix row)
    // -------------------------------------------------------------------------

    describe('filesystem → matrix: every route handler file must have a matrix row', () => {
        const matrixFiles = parseMatrixHandlerFiles();
        const fsFiles = enumerateFsRouteFiles();

        it('filesystem enumeration is non-empty (guard against misconfigured walk)', () => {
            expect(fsFiles.length).toBeGreaterThan(50);
        });

        it.each(fsFiles.map((f) => [f] as const))(
            'route file has a matrix row: %s',
            (fsFile: string) => {
                expect(
                    matrixFiles.has(fsFile),
                    `Route handler file on disk has NO entry in the endpoint-gate-matrix:\n  File: ${fsFile}\n\nFix: add a row to docs/billing/endpoint-gate-matrix.md with the correct\n"Decision" value for this route:\n  - "none"       if the route needs auth only (no entitlement gate)\n  - "gate"       if requireEntitlement() should be applied\n  - "limit"      if enforceXxxLimit() should be applied\n  - "gate+limit" if both should be applied\n\nSee docs/billing/adding-an-entitlement.md for the full wiring procedure.\nMatrix location: docs/billing/endpoint-gate-matrix.md`
                ).toBe(true);
            }
        );
    });

    // -------------------------------------------------------------------------
    // Count reconciliation meta-test (informational — does not gate CI by itself
    // but makes drift immediately visible in the test report)
    // -------------------------------------------------------------------------

    it('matrix and filesystem file-set sizes are reconciled (drift report)', () => {
        const matrixFiles = parseMatrixHandlerFiles();
        const fsFiles = enumerateFsRouteFiles();
        const fsSet = new Set(fsFiles);

        const inMatrixNotFs = [...matrixFiles].filter((f) => !fsSet.has(f));
        const inFsNotMatrix = fsFiles.filter((f) => !matrixFiles.has(f));

        // Both directions are expected to be empty sets.
        // This assertion consolidates what the individual it.each tests above check,
        // providing a summary count in the output.
        expect(
            inMatrixNotFs,
            `Matrix has ${inMatrixNotFs.length} handler reference(s) that do not exist on disk:\n${inMatrixNotFs.map((f) => `  - ${f}`).join('\n')}`
        ).toHaveLength(0);

        expect(
            inFsNotMatrix,
            `Filesystem has ${inFsNotMatrix.length} route file(s) with no matrix row:\n${inFsNotMatrix.map((f) => `  - ${f}`).join('\n')}`
        ).toHaveLength(0);
    });
});
