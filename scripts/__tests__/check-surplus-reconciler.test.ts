/** TEST:V6:6 — GUARD:G5 detects source writers without surplus reconciliation. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../check-surplus-reconciler';

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const baseFiles = {
    'apps/api/src/index.ts':
        "import { subscribeListingCoverageRecalculation } from './listener'; subscribeListingCoverageRecalculation();",
    'apps/api/src/utils/listing-publication/coverage-listener.ts': 'recalculateCoverage();',
    'packages/service-core/src/writer.ts':
        "import { trials } from '@repo/db'; export async function turnOff() { await db.update(trials).set({ status: 'TRIAL_EXPIRED' }); recalculateCoverage(); }"
};
function tree(files: Readonly<Record<string, string>> = baseFiles): string {
    const root = mkdtempSync(path.join(tmpdir(), 'g5-'));
    roots.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, source] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), source);
    }
    return root;
}
const writer = {
    file: 'packages/service-core/src/writer.ts',
    symbol: 'turnOff',
    table: 'trials',
    effect: 'turns-off',
    via: 'notice',
    reason: 'test'
} as const;
function check(files = baseFiles, inventory = [writer], minimum = 1) {
    return run({ root: tree(files), inventory, minScannedFiles: minimum });
}

describe('TEST:V6:6 GUARD:G5', () => {
    it('accepts the repository tree', () => {
        expect(run().exitCode).toBe(0);
    });
    it('accepts a notice-backed turn-off', () => {
        expect(check().exitCode).toBe(0);
    });
    it('rejects the mutation that removes its reconciler call', () => {
        const result = check({
            ...baseFiles,
            [writer.file]:
                "export async function turnOff() { await db.update(trials).set({ status: 'TRIAL_EXPIRED' }); }"
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('G5: packages/service-core/src/writer.ts:1');
    });
    it('rejects an unlisted writer', () => {
        expect(check(baseFiles, []).output).toContain('source write is not inventoried');
    });
    it('rejects a stale entry', () => {
        expect(check({ ...baseFiles, [writer.file]: 'export const x = 1;' }).output).toContain(
            'stale inventory'
        );
    });
    it('rejects pending without owner', () => {
        expect(
            check(baseFiles, [{ ...writer, via: 'pending', owner: undefined }]).output
        ).toContain('has no owner');
    });
    it('rejects pending over ceiling', () => {
        expect(
            check(
                baseFiles,
                Array.from({ length: 8 }, (_, i) => ({
                    ...writer,
                    file: `${writer.file}${i}`,
                    via: 'pending',
                    owner: 'owner'
                }))
            ).output
        ).toContain('exceed ceiling');
    });
    it('rejects missing cable wiring', () => {
        expect(
            check({
                ...baseFiles,
                'apps/api/src/index.ts': '',
                'apps/api/src/utils/listing-publication/coverage-listener.ts': ''
            }).output
        ).toContain('listener is not wired');
    });
    it('rejects an undersized scan', () => {
        expect(check(baseFiles, [writer], 20).output).toContain('expected at least 20');
    });
    it('allows a turn-on without via', () => {
        expect(check(baseFiles, [{ ...writer, effect: 'turns-on', via: null }]).exitCode).toBe(0);
    });
});

type InventoryEntry = NonNullable<NonNullable<Parameters<typeof run>[0]>['inventory']>[number];

describe('TEST:B4:10 GUARD:G5 a turn-off notified by its caller (via caller, notifiedBy)', () => {
    const vipWriter = 'packages/db/src/vip.ts';
    const notifier = 'packages/service-core/src/cancel-vip.ts';
    const callerFiles = {
        ...baseFiles,
        [vipWriter]:
            "export class Vip { async closeCancelledVip() { await db.update(subscriptions).set({ status: 'CANCELLED' }); } }",
        [notifier]:
            'export async function cancelVips() { await model.closeCancelledVip(); await notices.emitCoverageChanged({}); }'
    };
    const callerEntry: InventoryEntry = {
        file: vipWriter,
        symbol: 'closeCancelledVip',
        table: 'subscriptions',
        effect: 'turns-off',
        via: 'caller',
        notifiedBy: notifier,
        reason: 'test'
    };
    function checkCaller(
        files: Readonly<Record<string, string>>,
        entry: InventoryEntry = callerEntry
    ) {
        return run({ root: tree(files), inventory: [writer, entry], minScannedFiles: 1 });
    }

    it('accepts a caller that calls the writer symbol and emits', () => {
        const result = checkCaller(callerFiles);
        expect(result.output).toContain('G5: OK');
        expect(result.exitCode).toBe(0);
    });
    it('(a) rejects a caller entry without notifiedBy', () => {
        const result = checkCaller(callerFiles, { ...callerEntry, notifiedBy: undefined });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            'G5: packages/db/src/vip.ts:1 caller-notified writer has no notifiedBy'
        );
    });
    it('(b) rejects a notifier that does not emit', () => {
        const result = checkCaller({
            ...callerFiles,
            [notifier]: 'export async function cancelVips() { await model.closeCancelledVip(); }'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `G5: ${notifier}:1 notifiedBy emits no surplus reconciler notice after closeCancelledVip`
        );
    });
    it('(c) rejects a notifier that does not call the writer symbol', () => {
        const result = checkCaller({
            ...callerFiles,
            [notifier]:
                'export async function cancelVips() { await notices.emitCoverageChanged({}); }'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            `G5: ${notifier}:1 notifiedBy does not call closeCancelledVip`
        );
    });
    it('(d) rejects a notifier that is not a scanned production file', () => {
        const result = checkCaller(callerFiles, {
            ...callerEntry,
            notifiedBy: 'packages/service-core/test/cancel-vip.test.ts'
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(
            'G5: packages/service-core/test/cancel-vip.test.ts:1 notifiedBy is not a scanned production file'
        );
    });
    it('the repository inventory notifies closeCancelledVip through its caller', () => {
        const inventory = JSON.parse(
            readFileSync(
                path.join(
                    path.dirname(fileURLToPath(import.meta.url)),
                    '../guards/source-off-writers.json'
                ),
                'utf8'
            )
        ) as { symbol: string; via: string | null; notifiedBy?: string }[];
        const vip = inventory.find((entry) => entry.symbol === 'closeCancelledVip');
        expect(vip?.via).toBe('caller');
        expect(vip?.notifiedBy).toBe(
            'packages/service-core/src/services/billing/subscription/cancel-inherited-tourist-vip.service.ts'
        );
    });
});
