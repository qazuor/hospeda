import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-analytics-catalog-emitters.js';

const trees: string[] = [];
function tree(options: { emitter?: boolean; allowlist?: string }): string {
    const root = mkdtempSync(join(tmpdir(), 'analytics-emitter-'));
    trees.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, 'packages/analytics/src'), { recursive: true });
    mkdirSync(join(root, 'apps/api/src'), { recursive: true });
    mkdirSync(join(root, 'docs/analytics'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(
        join(root, 'packages/analytics/src/catalog.ts'),
        "export const AnalyticsEvents = {\n    billingGraceEntered: 'billing_grace_entered'\n};\n"
    );
    writeFileSync(
        join(root, 'apps/api/src/emitter.ts'),
        options.emitter === false
            ? 'export const value = 1;'
            : "import { AnalyticsEvents } from '@repo/analytics';\nvoid AnalyticsEvents.billingGraceEntered;\n"
    );
    const tick = String.fromCharCode(96);
    writeFileSync(
        join(root, 'docs/analytics/event-catalog.md'),
        `| ${tick}billing_grace_entered${tick} | row |\n`
    );
    writeFileSync(
        join(root, 'scripts/analytics-emitter-allowlist.json'),
        options.allowlist ?? '[]'
    );
    return root;
}
afterEach(() => {
    for (const root of trees.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('analytics catalog emitter guard (TEST:1878:17)', () => {
    it('passes the positive control', () => {
        expect(run({ root: tree({}), minScannedFiles: 1, minCatalogKeys: 1 }).exitCode).toBe(0);
    });
    it('fails when a catalog event has no production mention', () => {
        const result = run({
            root: tree({ emitter: false }),
            minScannedFiles: 1,
            minCatalogKeys: 1
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('billing_grace_entered');
    });
    it('fails when an allowlist entry is stale', () => {
        const result = run({
            root: tree({
                allowlist: '[{"event":"billing_grace_entered","reason":"obsolete","issue":"HOS-1"}]'
            }),
            minScannedFiles: 1,
            minCatalogKeys: 1
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('stale allowlist entry');
    });
    it('rejects retired event names outside the migration log (TEST:1878:18)', () => {
        const root = tree({});
        const tick = String.fromCharCode(96);
        writeFileSync(
            join(root, 'docs/analytics/event-catalog.md'),
            `| ${tick}subscription_created${tick} | retired |${String.fromCharCode(10)}`
        );
        const result = run({ root, minScannedFiles: 1, minCatalogKeys: 1 });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('subscription_created');
    });
    it('passes against the real repository tree', () => {
        expect(run().exitCode).toBe(0);
    });
});
