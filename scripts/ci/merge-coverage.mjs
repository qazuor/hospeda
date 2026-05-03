#!/usr/bin/env node
/**
 * Merge per-shard vitest v8 coverage outputs into a single coverage-final
 * and coverage-summary per package. Designed for CI sharded runs where
 * every shard executes a slice of test files but instruments the same
 * source files; merging means summing per-file hit counts.
 *
 * Usage: node scripts/ci/merge-coverage.mjs <shards-dir> <out-dir>
 *
 * Input layout (downloaded artifacts):
 *   <shards-dir>/coverage-shard-1/<pkg-path>/coverage/coverage-final.json
 *   <shards-dir>/coverage-shard-2/<pkg-path>/coverage/coverage-final.json
 *   ...
 *
 * Output layout:
 *   <out-dir>/<pkg-path>/coverage/coverage-final.json
 *   <out-dir>/<pkg-path>/coverage/coverage-summary.json
 */

import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const [, , shardsDir, outDir] = process.argv;

if (!shardsDir || !outDir) {
    console.error('Usage: merge-coverage.mjs <shards-dir> <out-dir>');
    process.exit(2);
}

/**
 * Recursively walk a directory, yielding absolute file paths whose
 * basename matches the predicate.
 */
function* walk(root, matchBasename) {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(root, entry.name);
        if (entry.isDirectory()) {
            yield* walk(full, matchBasename);
        } else if (entry.isFile() && matchBasename(entry.name)) {
            yield full;
        }
    }
}

let shardRoots;
try {
    shardRoots = readdirSync(shardsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith('coverage-shard-'))
        .map((e) => join(shardsDir, e.name));
} catch (err) {
    console.error(`Cannot read shards dir "${shardsDir}":`, err.message);
    process.exit(1);
}

if (shardRoots.length === 0) {
    console.error(`No coverage-shard-* directories found under ${shardsDir}`);
    process.exit(1);
}

console.log(`Found ${shardRoots.length} shard(s):`);
for (const root of shardRoots) console.log(`  - ${root}`);

// Group coverage-final.json files by their workspace-relative package path.
// The artifact preserves the workspace tree, so the package path is the
// part of the file path between the shard root and `coverage/coverage-final.json`.
const groups = new Map(); // pkgPath -> string[] (absolute file paths)

for (const shardRoot of shardRoots) {
    for (const file of walk(shardRoot, (n) => n === 'coverage-final.json')) {
        // Drop the shard root prefix and the trailing `/coverage/coverage-final.json`.
        const rel = relative(shardRoot, file);
        const pkgPath = dirname(dirname(rel));
        if (!groups.has(pkgPath)) groups.set(pkgPath, []);
        groups.get(pkgPath).push(file);
    }
}

if (groups.size === 0) {
    console.error('No coverage-final.json files found across shards');
    process.exit(1);
}

console.log(`\nMerging coverage for ${groups.size} package(s)...`);

/**
 * Merge a list of istanbul coverage-final.json contents into a single
 * coverage map. Hit counts (s, f, b) are summed; structural maps
 * (statementMap, fnMap, branchMap) are taken from the first occurrence
 * since they are deterministic for a given source file.
 */
function mergeCoverage(coverages) {
    const merged = {};
    for (const cov of coverages) {
        for (const [filePath, data] of Object.entries(cov)) {
            if (!merged[filePath]) {
                // Deep clone the structural data plus zeroed counters.
                merged[filePath] = {
                    path: data.path ?? filePath,
                    statementMap: data.statementMap ?? {},
                    fnMap: data.fnMap ?? {},
                    branchMap: data.branchMap ?? {},
                    s: {},
                    f: {},
                    b: {}
                };
                for (const k of Object.keys(data.s ?? {})) merged[filePath].s[k] = 0;
                for (const k of Object.keys(data.f ?? {})) merged[filePath].f[k] = 0;
                for (const k of Object.keys(data.b ?? {})) {
                    merged[filePath].b[k] = (data.b[k] ?? []).map(() => 0);
                }
            }
            const target = merged[filePath];
            for (const [k, v] of Object.entries(data.s ?? {})) {
                target.s[k] = (target.s[k] ?? 0) + (v ?? 0);
            }
            for (const [k, v] of Object.entries(data.f ?? {})) {
                target.f[k] = (target.f[k] ?? 0) + (v ?? 0);
            }
            for (const [k, arr] of Object.entries(data.b ?? {})) {
                if (!target.b[k]) target.b[k] = arr.map(() => 0);
                for (let i = 0; i < arr.length; i++) {
                    target.b[k][i] = (target.b[k][i] ?? 0) + (arr[i] ?? 0);
                }
            }
        }
    }
    return merged;
}

/**
 * Compute istanbul-style file/total summary from a merged coverage entry.
 */
function summarizeFile(entry) {
    const sValues = Object.values(entry.s ?? {});
    const fValues = Object.values(entry.f ?? {});
    const bValues = Object.values(entry.b ?? {}); // array of arrays

    const stmtsTotal = sValues.length;
    const stmtsCovered = sValues.filter((c) => c > 0).length;

    const fnTotal = fValues.length;
    const fnCovered = fValues.filter((c) => c > 0).length;

    let brTotal = 0;
    let brCovered = 0;
    for (const arr of bValues) {
        brTotal += arr.length;
        brCovered += arr.filter((c) => c > 0).length;
    }

    // Lines: a line is covered if any statement starting on it has count > 0.
    const lineHit = new Map(); // lineNumber -> bool covered
    for (const [stmtId, loc] of Object.entries(entry.statementMap ?? {})) {
        const line = loc?.start?.line;
        if (typeof line !== 'number') continue;
        const hit = (entry.s?.[stmtId] ?? 0) > 0;
        lineHit.set(line, (lineHit.get(line) ?? false) || hit);
    }
    const linesTotal = lineHit.size;
    const linesCovered = [...lineHit.values()].filter(Boolean).length;

    const pct = (covered, total) => (total === 0 ? 100 : (covered / total) * 100);

    return {
        lines: {
            total: linesTotal,
            covered: linesCovered,
            skipped: 0,
            pct: pct(linesCovered, linesTotal)
        },
        statements: {
            total: stmtsTotal,
            covered: stmtsCovered,
            skipped: 0,
            pct: pct(stmtsCovered, stmtsTotal)
        },
        functions: {
            total: fnTotal,
            covered: fnCovered,
            skipped: 0,
            pct: pct(fnCovered, fnTotal)
        },
        branches: {
            total: brTotal,
            covered: brCovered,
            skipped: 0,
            pct: pct(brCovered, brTotal)
        }
    };
}

function aggregateTotals(fileSummaries) {
    const totals = {
        lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
        statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
        functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
        branches: { total: 0, covered: 0, skipped: 0, pct: 0 }
    };
    for (const s of fileSummaries) {
        for (const metric of ['lines', 'statements', 'functions', 'branches']) {
            totals[metric].total += s[metric].total;
            totals[metric].covered += s[metric].covered;
            totals[metric].skipped += s[metric].skipped;
        }
    }
    for (const metric of ['lines', 'statements', 'functions', 'branches']) {
        const t = totals[metric];
        t.pct = t.total === 0 ? 100 : (t.covered / t.total) * 100;
    }
    return totals;
}

let mergedCount = 0;
for (const [pkgPath, files] of groups) {
    const coverages = files.map((f) => {
        try {
            return JSON.parse(readFileSync(f, 'utf-8'));
        } catch (err) {
            console.warn(`  ! Failed to parse ${f}: ${err.message}`);
            return {};
        }
    });

    const merged = mergeCoverage(coverages);
    const fileSummaries = Object.values(merged).map(summarizeFile);
    const total = aggregateTotals(fileSummaries);

    const summary = { total };
    for (const [filePath, entry] of Object.entries(merged)) {
        summary[filePath] = summarizeFile(entry);
    }

    const outPkgDir = join(outDir, pkgPath, 'coverage');
    mkdirSync(outPkgDir, { recursive: true });
    writeFileSync(
        join(outPkgDir, 'coverage-final.json'),
        JSON.stringify(merged, null, 2)
    );
    writeFileSync(
        join(outPkgDir, 'coverage-summary.json'),
        JSON.stringify(summary, null, 2)
    );

    console.log(
        `  ✓ ${pkgPath}: ${files.length} shard(s) merged, lines ${total.lines.pct.toFixed(2)}%`
    );
    mergedCount++;
}

console.log(`\nDone: merged ${mergedCount} package(s) into ${outDir}/`);
