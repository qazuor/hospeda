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
 * - `STAGING_CATALOG` — path to `staging`'s version of the catalog. When set,
 *   only markers still pending there are resolved.
 * - `IN_FLIGHT_CATALOGS` — newline-separated paths to the catalog of every
 *   open resolve-dates PR; may be empty. Ids those PRs already DATE are
 *   excluded. Requires `STAGING_CATALOG`.
 *
 *   See "Why `main` alone is not enough" in `resolve-dates.ts`. A blank
 *   `STAGING_CATALOG`, `IN_FLIGHT_CATALOGS` without it, or a path that does
 *   not exist is an error: silently resolving everything is exactly the bug
 *   this exists to stop. So is neither being set under GitHub Actions
 *   (`GITHUB_ACTIONS=true`). Neither set in a local manual run resolves
 *   every marker, as before.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownRepoRoot } from '../../lib/repo.ts';
import { CATALOG_FILE_PATH } from './catalog.ts';
import {
    collectDatedIds,
    collectPendingMarkerIds,
    resolvePublishedAtMarkers
} from './resolve-dates.ts';

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
 * Computes which marker ids may be resolved: those still pending on
 * `staging`, minus those any open resolve-dates PR already dates.
 *
 * Staging is the authority on what is pending (an entry it does not have, or
 * has dated, is skipped). The in-flight PRs only SUBTRACT what they date —
 * an entry absent from a PR is newer than its branch, not "being resolved".
 *
 * @param input.stagingContent   - `staging`'s catalog source.
 * @param input.inFlightContents - Catalog source of each open resolve-dates PR.
 * @returns The ids that may be resolved.
 */
export function computeResolvableIds({
    stagingContent,
    inFlightContents
}: {
    readonly stagingContent: string;
    readonly inFlightContents: readonly string[];
}): ReadonlySet<string> {
    const allowed = new Set(collectPendingMarkerIds({ content: stagingContent }));
    for (const content of inFlightContents) {
        for (const id of collectDatedIds({ content })) {
            allowed.delete(id);
        }
    }
    return allowed;
}

/** Paths of the reference catalogs, as passed by the workflow. */
export interface ReferenceCatalogPaths {
    readonly stagingPath: string;
    readonly inFlightPaths: readonly string[];
}

/**
 * Parses `STAGING_CATALOG` and `IN_FLIGHT_CATALOGS`.
 *
 * @param input.stagingEnv  - Raw `STAGING_CATALOG`, or `undefined`.
 * @param input.inFlightEnv - Raw `IN_FLIGHT_CATALOGS`, or `undefined`.
 * @param input.inCi        - Whether this runs in GitHub Actions
 *                            (`GITHUB_ACTIONS === 'true'`).
 * @returns `undefined` when neither is set outside CI (a local manual run, no
 *          filtering); otherwise the paths.
 * @throws When `STAGING_CATALOG` is blank, missing in CI, or absent while
 *         `IN_FLIGHT_CATALOGS` is set — each means a broken workflow step,
 *         which must fail closed rather than resolve every marker.
 */
export function parseReferenceCatalogs({
    stagingEnv,
    inFlightEnv,
    inCi
}: {
    readonly stagingEnv: string | undefined;
    readonly inFlightEnv: string | undefined;
    readonly inCi: boolean;
}): ReferenceCatalogPaths | undefined {
    if (stagingEnv === undefined) {
        if (inCi) {
            throw new Error('STAGING_CATALOG is required in CI; refusing to resolve unfiltered.');
        }
        if (inFlightEnv !== undefined) {
            throw new Error('IN_FLIGHT_CATALOGS is set but STAGING_CATALOG is not.');
        }
        return undefined;
    }
    const stagingPath = stagingEnv.trim();
    if (stagingPath.length === 0) {
        throw new Error('STAGING_CATALOG is set but empty.');
    }
    const inFlightPaths = (inFlightEnv ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    return { stagingPath, inFlightPaths };
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

    const references = parseReferenceCatalogs({
        stagingEnv: process.env.STAGING_CATALOG,
        inFlightEnv: process.env.IN_FLIGHT_CATALOGS,
        inCi: process.env.GITHUB_ACTIONS === 'true'
    });
    // readFileSync throws on a missing reference: fail loud, never fall open.
    const onlyIds =
        references === undefined
            ? undefined
            : computeResolvableIds({
                  stagingContent: readFileSync(references.stagingPath, 'utf8'),
                  inFlightContents: references.inFlightPaths.map((path) =>
                      readFileSync(path, 'utf8')
                  )
              });

    const content = readFileSync(filePath, 'utf8');
    const result = resolvePublishedAtMarkers({ content, mergedAt, onlyIds });

    if (result.skippedIds.length > 0) {
        console.log(
            `Skipped ${result.skippedIds.length} marker(s) not pending on staging or already dated by an open resolve PR: ${result.skippedIds.join(', ')}`
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
