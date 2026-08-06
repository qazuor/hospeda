#!/usr/bin/env tsx
/**
 * @file build-icon-manifest.ts
 * @description CLI for the icon-sprite-manifest analyzer (HOS-369
 * sprite-manifest). Derives every (glyph, weight) pair `apps/web` can reach
 * (see `scripts/icon-manifest/analyze.ts`) and either WRITES the committed
 * manifest (`src/lib/icon-sprite-manifest.json`, consumed by
 * `src/lib/icon-sprite.ts` to subset the sprite) or CHECKS it against the
 * current source without touching it — the drift-guard mode CI runs.
 *
 * Usage (from `apps/web/`):
 *   pnpm icons:build-manifest         # writes the manifest, prints a report
 *   pnpm icons:build-manifest --check # exits 1 if the committed file is stale
 *
 * The manifest must be a COMMITTED artifact: the SSR server runs from a built
 * `dist`, not from `src/`, and cannot re-run this analyzer at request time.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeIconManifest, pairsToCompactManifest } from './icon-manifest/analyze';

const currentDir = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = resolve(currentDir, '../src/lib/icon-sprite-manifest.json');

function serializeManifest(manifest: Record<string, string>): string {
    // Trailing newline: matches Biome's own file-formatting convention, so a
    // manifest this script just wrote never shows as dirty under `pnpm lint`.
    return `${JSON.stringify(manifest, null, 4)}\n`;
}

function printReport(
    report: ReturnType<typeof analyzeIconManifest>,
    manifest: Record<string, string>
): void {
    const pairCount = [...report.pairs.values()].reduce(
        (total, weights) => total + weights.size,
        0
    );
    const json = JSON.stringify(manifest);

    console.log('[icon-manifest] files scanned:', report.stats.filesScanned);
    console.log(
        '[icon-manifest] static call sites resolved:',
        report.stats.staticCallSitesResolved
    );
    console.log(
        '[icon-manifest] dynamic weight={} sites (resolved conservatively as fill+regular):',
        report.stats.dynamicWeightSites
    );
    console.log('[icon-manifest] data-driven groups:');
    for (const group of report.stats.dataDrivenGroups) {
        console.log(`  - ${group.id}: ${group.glyphCount} glyphs`);
    }
    if (report.stats.unresolvedImports.length > 0) {
        console.log(
            `[icon-manifest] ${report.stats.unresolvedImports.length} JSX-rendered import(s) with no known sprite glyph (correctly omitted — brand/hand-crafted icons are never sprite-eligible):`
        );
        for (const line of report.stats.unresolvedImports) console.log(`  - ${line}`);
    }
    if (report.stats.dataDrivenMissing.length > 0) {
        console.log(
            `[icon-manifest] ${report.stats.dataDrivenMissing.length} data-driven entries skipped:`
        );
        for (const line of report.stats.dataDrivenMissing) console.log(`  - ${line}`);
    }
    console.log(
        `[icon-manifest] manifest: ${report.pairs.size} glyphs, ${pairCount} pairs, ${Buffer.byteLength(json)} raw bytes`
    );
}

function main(): void {
    const checkOnly = process.argv.includes('--check');

    const report = analyzeIconManifest();
    const manifest = pairsToCompactManifest(report.pairs);
    const serialized = serializeManifest(manifest);

    printReport(report, manifest);

    if (checkOnly) {
        let committed: string | null = null;
        try {
            committed = readFileSync(MANIFEST_PATH, 'utf8');
        } catch {
            committed = null;
        }

        if (committed !== serialized) {
            console.error(
                '\n[icon-manifest] DRIFT: the committed manifest no longer matches what the analyzer ' +
                    'derives from current source.\n' +
                    `  Committed: ${MANIFEST_PATH}\n` +
                    '  Run `pnpm icons:build-manifest` (from apps/web) and commit the result.'
            );
            process.exitCode = 1;
            return;
        }

        console.log('[icon-manifest] manifest is up to date.');
        return;
    }

    writeFileSync(MANIFEST_PATH, serialized, 'utf8');
    console.log(`[icon-manifest] wrote ${MANIFEST_PATH}`);
}

main();
