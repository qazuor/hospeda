#!/usr/bin/env node
/**
 * E2E suite budget + slowest-test report (SPEC-143 T-143-56).
 *
 * Reads the JSON report vitest emits when `VITEST_E2E_JSON_OUTPUT` is set,
 * verifies the suite finished within budget, and prints the top-N slowest
 * test files so drift is visible in CI logs over time.
 *
 * Usage (called from `pnpm test:e2e:ci`):
 *
 *   VITEST_E2E_JSON_OUTPUT=./test-results/e2e-results.json pnpm test:e2e
 *   node scripts/check-e2e-budget.mjs ./test-results/e2e-results.json
 *
 * Env knobs:
 *
 *   E2E_BUDGET_SECONDS         total suite wallclock cap. Default 1800 (30 min).
 *   E2E_FILE_BUDGET_SECONDS    per-file wallclock cap.    Default 300  (5 min).
 *   E2E_REPORT_TOP_N           how many slow files to print. Default 10.
 *
 * Exits non-zero (and prints the offending files) when the budget is exceeded
 * so CI surfaces the regression instead of silently accepting an ever-slower
 * suite. The thresholds are deliberately generous — they catch step-changes,
 * not gradual drift; tune them as the suite grows.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_SUITE_BUDGET_S = 1800;
const DEFAULT_FILE_BUDGET_S = 300;
const DEFAULT_TOP_N = 10;

const reportPathArg = process.argv[2];
if (!reportPathArg) {
    console.error('check-e2e-budget: missing report path argument');
    console.error('usage: node scripts/check-e2e-budget.mjs <path-to-vitest-json>');
    process.exit(2);
}

const reportPath = resolve(process.cwd(), reportPathArg);

let raw;
try {
    raw = readFileSync(reportPath, 'utf-8');
} catch (err) {
    console.error(`check-e2e-budget: cannot read ${reportPath}: ${err.message}`);
    process.exit(2);
}

let report;
try {
    report = JSON.parse(raw);
} catch (err) {
    console.error(`check-e2e-budget: invalid JSON in ${reportPath}: ${err.message}`);
    process.exit(2);
}

// Vitest JSON report shape: { startTime, success, testResults: [{ name, perfStats: { runtime }, ... }] }
// The vitest reporter modeled on Jest writes per-file entries under `testResults`.
const fileResults = Array.isArray(report.testResults) ? report.testResults : [];

if (fileResults.length === 0) {
    console.error('check-e2e-budget: testResults empty — suite did not run any files?');
    process.exit(2);
}

const suiteBudgetMs = Number(process.env.E2E_BUDGET_SECONDS ?? DEFAULT_SUITE_BUDGET_S) * 1000;
const fileBudgetMs = Number(process.env.E2E_FILE_BUDGET_SECONDS ?? DEFAULT_FILE_BUDGET_S) * 1000;
const topN = Number(process.env.E2E_REPORT_TOP_N ?? DEFAULT_TOP_N);

// Build per-file summary. Vitest 1.x emits `startTime`/`endTime` per file
// (milliseconds since epoch); older versions used `perfStats.runtime`.
// Per-file runtime captures only the test execution, NOT the beforeAll
// setup chain — for total wallclock we use the top-level report.startTime.
const entries = fileResults.map((file) => {
    const runtime =
        file?.perfStats?.runtime ??
        (typeof file?.endTime === 'number' && typeof file?.startTime === 'number'
            ? file.endTime - file.startTime
            : 0);

    return {
        name: file?.name ?? '<unknown>',
        runtimeMs: Number(runtime) || 0,
        endTime: Number(file?.endTime) || 0,
        numFailingTests: Number(file?.numFailingTests) || 0,
        numPassingTests: Number(file?.numPassingTests) || 0
    };
});

// Total wallclock = max file endTime - report startTime. Captures setup +
// every file's run + teardown, matching what CI sees. Sum of per-file
// runtimes would undercount because vitest's per-file startTime/endTime
// excludes the setupFiles cost.
const reportStartTime = Number(report.startTime) || 0;
const lastFileEndTime = entries.reduce((max, e) => Math.max(max, e.endTime), 0);
const totalMs =
    reportStartTime > 0 && lastFileEndTime > reportStartTime
        ? lastFileEndTime - reportStartTime
        : entries.reduce((sum, e) => sum + e.runtimeMs, 0);
const totalSec = Math.round(totalMs / 1000);

console.log('');
console.log('=== E2E suite budget report ===');
console.log(`Files run:        ${entries.length}`);
console.log(`Total wallclock:  ${totalSec}s (budget ${suiteBudgetMs / 1000}s)`);

const sorted = [...entries].sort((a, b) => b.runtimeMs - a.runtimeMs);
const slowest = sorted.slice(0, topN);

console.log('');
console.log(`Top ${slowest.length} slowest files:`);
for (const file of slowest) {
    const fileSec = Math.round(file.runtimeMs / 1000);
    const marker = file.runtimeMs > fileBudgetMs ? ' ⚠  OVER FILE BUDGET' : '';
    console.log(`  ${fileSec.toString().padStart(4)}s  ${file.name}${marker}`);
}

const overFileBudget = entries.filter((e) => e.runtimeMs > fileBudgetMs);
const overSuiteBudget = totalMs > suiteBudgetMs;

console.log('');
if (overSuiteBudget) {
    console.error(
        `❌ suite over budget: ${totalSec}s > ${suiteBudgetMs / 1000}s. Investigate the slowest files above or raise E2E_BUDGET_SECONDS if the new floor is intentional.`
    );
}
if (overFileBudget.length > 0) {
    console.error(`❌ ${overFileBudget.length} file(s) over per-file budget:`);
    for (const file of overFileBudget) {
        console.error(`     ${file.name}  (${Math.round(file.runtimeMs / 1000)}s)`);
    }
}

if (overSuiteBudget || overFileBudget.length > 0) {
    process.exit(1);
}

console.log('✅ within budget');
process.exit(0);
