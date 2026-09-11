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
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ownRepoRoot } from '../../lib/repo.ts';
import { CATALOG_FILE_PATH } from './catalog.ts';
import { resolvePublishedAtMarkers } from './resolve-dates.ts';

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

    const content = readFileSync(filePath, 'utf8');
    const result = resolvePublishedAtMarkers({ content, mergedAt });

    if (result.resolvedCount === 0) {
        console.log(`No '${'on-promotion'}' markers found in ${filePath}. Nothing to resolve.`);
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
