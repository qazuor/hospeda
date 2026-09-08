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
 * - `WHATS_NEW_FILE` — path to the catalog file (defaults to the real one).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolvePublishedAtMarkers } from './resolve-dates.ts';

const DEFAULT_FILE = 'apps/api/src/data/whats-new/whats-new.ts';

/** Writes `key=value` to `$GITHUB_OUTPUT` when present, and always to stdout. */
function reportOutput({ key, value }: { readonly key: string; readonly value: string }): void {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
        appendFileSync(outputFile, `${key}=${value}\n`, 'utf8');
    }
    console.log(`${key}=${value}`);
}

function main(): void {
    const filePath = process.env.WHATS_NEW_FILE ?? DEFAULT_FILE;
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

main();
