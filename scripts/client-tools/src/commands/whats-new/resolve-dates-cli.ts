#!/usr/bin/env bun
/**
 * CLI runner for the What's New date-resolution job (HOS-1214 §6.2, AC-14).
 *
 * Invoked ONLY by `.github/workflows/whats-new-resolve-dates.yml`, on `push`
 * to `main` — i.e. strictly after a promotion PR has actually merged. This is
 * deliberate I/O glue and nothing more: every decision about WHICH markers
 * get WHICH date lives in the pure, unit-tested {@link resolvePublishedAtMarkers}
 * (`resolve-dates.ts`). This file only reads env + the file, calls that
 * function, writes the result back when there is one, and reports outcomes
 * via `$GITHUB_OUTPUT` (falling back to plain stdout when run locally,
 * outside CI, for manual inspection).
 *
 * Required env:
 * - `MERGED_AT`     — ISO 8601 timestamp of the merge to `main`.
 * Optional env:
 * - `WHATS_NEW_FILE` — path to the catalog file (defaults to the real one,
 *   anchored to this CLI's own repo root — never the cwd. The workflow runs
 *   this file with `working-directory: scripts/client-tools`, and the original
 *   cwd-relative default resolved to `scripts/client-tools/apps/api/...` and
 *   ENOENTed on the first real promotion (2026-09-11, run 34647242767).).
 * - `REFERENCE_FILES` — newline-separated paths to OTHER versions of the
 *   catalog (the workflow passes `staging`'s and every open resolve-dates
 *   PR's). When set, a marker is resolved only if it is still pending in
 *   every one of them; see "Why `main` alone is not enough" in
 *   `resolve-dates.ts`. Set but empty, or naming a missing file, is an error:
 *   silently resolving everything is exactly the bug this exists to stop.
 *   Unset (a local manual run) resolves every marker, as before.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownRepoRoot } from '../../lib/repo.ts';
import { CATALOG_FILE_PATH } from './catalog.ts';
import { collectPendingMarkerIds, resolvePublishedAtMarkers } from './resolve-dates.ts';

/**
 * Resolves the catalog file path the CLI operates on.
 *
 * `WHATS_NEW_FILE` (or the `envFile` argument in tests) wins verbatim, so
 * tests and local overrides can point at a temp copy. Otherwise the default
 * is anchored to the monorepo root derived from this CLI's own location —
 * NOT the process cwd — because the only production invoker runs it from
 * `scripts/client-tools`.
 *
 * @param input.envFile - Value of `WHATS_NEW_FILE` when set.
 * @returns The catalog path to read and rewrite.
 */
export function resolveCatalogFilePath({ envFile }: { readonly envFile?: string }): string {
    return envFile ?? join(ownRepoRoot(), CATALOG_FILE_PATH);
}

/**
 * Intersects the still-pending marker ids of every reference catalog.
 *
 * An id survives only if it is pending in ALL of them: dated on `staging`
 * means already resolved, and dated on an open resolve-dates PR means
 * already being resolved.
 *
 * @param input.referenceContents - Sources of the reference catalogs; at
 *                                  least one.
 * @returns The ids that may be resolved.
 * @throws When `referenceContents` is empty — an empty intersection must
 *         never be mistaken for "no filter".
 */
export function intersectPendingIds({
    referenceContents
}: {
    readonly referenceContents: readonly string[];
}): ReadonlySet<string> {
    const [first, ...rest] = referenceContents;
    if (first === undefined) {
        throw new Error('intersectPendingIds: at least one reference catalog is required.');
    }
    const allowed = new Set(collectPendingMarkerIds({ content: first }));
    for (const content of rest) {
        const pending = collectPendingMarkerIds({ content });
        for (const id of allowed) {
            if (!pending.has(id)) {
                allowed.delete(id);
            }
        }
    }
    return allowed;
}

/**
 * Parses `REFERENCE_FILES` into a list of paths.
 *
 * @param input.envValue - Raw value of `REFERENCE_FILES`, or `undefined`.
 * @returns `undefined` when the variable is unset (no filtering); otherwise
 *          the non-blank paths.
 * @throws When the variable is set but names no path.
 */
export function parseReferenceFiles({
    envValue
}: {
    readonly envValue: string | undefined;
}): readonly string[] | undefined {
    if (envValue === undefined) {
        return undefined;
    }
    const paths = envValue
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    if (paths.length === 0) {
        throw new Error('REFERENCE_FILES is set but names no file.');
    }
    return paths;
}

/** Writes `key=value` to `$GITHUB_OUTPUT` when present, and always to stdout. */
function reportOutput({ key, value }: { readonly key: string; readonly value: string }): void {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
        appendFileSync(outputFile, `${key}=${value}\n`, 'utf8');
    }
    console.log(`${key}=${value}`);
}

function main(): void {
    const filePath = resolveCatalogFilePath({ envFile: process.env.WHATS_NEW_FILE });
    const mergedAt = process.env.MERGED_AT;

    if (!mergedAt) {
        console.error(
            'resolve-dates-cli: MERGED_AT env var is required (ISO 8601 merge timestamp).'
        );
        process.exit(1);
    }

    const referenceFiles = parseReferenceFiles({ envValue: process.env.REFERENCE_FILES });
    // readFileSync throws on a missing reference: fail loud, never fall open.
    const onlyIds =
        referenceFiles === undefined
            ? undefined
            : intersectPendingIds({
                  referenceContents: referenceFiles.map((path) => readFileSync(path, 'utf8'))
              });

    const content = readFileSync(filePath, 'utf8');
    const result = resolvePublishedAtMarkers({ content, mergedAt, onlyIds });

    if (result.skippedIds.length > 0) {
        console.log(
            `Skipped ${result.skippedIds.length} marker(s) already dated or being dated elsewhere: ${result.skippedIds.join(', ')}`
        );
    }

    if (result.resolvedCount === 0) {
        console.log(`No pending '${'on-promotion'}' markers in ${filePath}. Nothing to resolve.`);
        reportOutput({ key: 'resolved_count', value: '0' });
        reportOutput({ key: 'resolved_ids', value: '' });
        return;
    }

    writeFileSync(filePath, result.updatedContent, 'utf8');
    console.log(
        `Resolved ${result.resolvedCount} marker(s) in ${filePath}: ${result.resolvedIds.join(', ')}`
    );
    reportOutput({ key: 'resolved_count', value: String(result.resolvedCount) });
    reportOutput({ key: 'resolved_ids', value: result.resolvedIds.join(',') });
}

if (import.meta.main) {
    main();
}
