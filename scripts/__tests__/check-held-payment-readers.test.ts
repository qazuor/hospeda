/**
 * @fileoverview
 * GUARD:HELD-ROWS (HOS-2179 D1) is green over the repo and red on purpose. Mutation: add a
 * reader of `payments.addonInstanceId` without the held-row predicate, and the guard reddens.
 * The allowlist cannot rot: an entry that matches no reader, or carries no reason, also fails.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    ALLOWLIST_PATH,
    findHeldReaderProblems,
    readersIn,
    run
} from '../check-held-payment-readers.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const UNFILTERED = `
export async function latestPaymentOf(instanceId: string) {
    return getDb().select().from(payments).where(eq(payments.addonInstanceId, instanceId));
}
`;

const FILTERED = `
export async function activationPaymentOf(instanceId: string) {
    return getDb()
        .select()
        .from(payments)
        .where(and(eq(payments.addonInstanceId, instanceId), notHeldByPageChargeMark()));
}
`;

describe('GUARD:HELD-ROWS over the repo', () => {
    it('is green on the current tree', () => {
        const { ok, findings } = run({ root: REPO_ROOT });

        expect(findings.readers.length).toBeGreaterThan(0);
        expect(findings.unfiltered).toEqual([]);
        expect(findings.stale).toEqual([]);
        expect(findings.reasonless).toEqual([]);
        expect(ok).toBe(true);
    });

    it('reddens when a production reader without the predicate is added', () => {
        // Arrange: a tree with the real allowlist and one new unfiltered reader.
        const root = mkdtempSync(path.join(tmpdir(), 'held-rows-'));
        tempDirs.push(root);
        mkdirSync(path.join(root, 'scripts/guards'), { recursive: true });
        cpSync(path.join(REPO_ROOT, ALLOWLIST_PATH), path.join(root, ALLOWLIST_PATH));
        cpSync(path.join(REPO_ROOT, 'packages'), path.join(root, 'packages'), {
            recursive: true,
            filter: (src) => !/node_modules|[\\/]dist[\\/]?|[\\/]test[\\/]?|\.turbo/.test(src)
        });
        const rogue = path.join(
            root,
            'packages/service-core/src/services/billing/addon/latest-payment.ts'
        );
        writeFileSync(rogue, UNFILTERED);

        // Act
        const { ok, findings } = run({ root });

        // Assert
        expect(ok).toBe(false);
        expect(findings.unfiltered).toEqual([
            expect.objectContaining({
                file: 'packages/service-core/src/services/billing/addon/latest-payment.ts',
                function: 'latestPaymentOf'
            })
        ]);
    });
});

describe('GUARD:HELD-ROWS predicate', () => {
    it('counts a reader with notHeldByPageChargeMark as filtered', () => {
        expect(readersIn({ file: 'a.ts', source: FILTERED })).toEqual([
            { file: 'a.ts', function: 'activationPaymentOf', line: 6, filtered: true }
        ]);
    });

    it('charges a reader inside an anonymous callback to its named owner', () => {
        const source = `
export async function owner(id: string) {
    return getDb().transaction(async (tx) => {
        await tx.select().from(payments).where(eq(payments.addonInstanceId, id));
    });
}
`;
        expect(readersIn({ file: 'b.ts', source })).toEqual([
            { file: 'b.ts', function: 'owner', line: 4, filtered: false }
        ]);
    });

    it('accepts an allowlisted reader and fails a stale or reasonless entry', () => {
        const readers = readersIn({ file: 'c.ts', source: UNFILTERED });

        const allowed = findHeldReaderProblems({
            readers,
            allowlist: [{ file: 'c.ts', function: 'latestPaymentOf', reason: 'why' }]
        });
        const stale = findHeldReaderProblems({
            readers,
            allowlist: [
                { file: 'c.ts', function: 'latestPaymentOf', reason: 'why' },
                { file: 'gone.ts', function: 'gone', reason: 'why' }
            ]
        });
        const reasonless = findHeldReaderProblems({
            readers,
            allowlist: [{ file: 'c.ts', function: 'latestPaymentOf', reason: ' ' }]
        });

        expect(allowed.unfiltered).toEqual([]);
        expect(stale.stale).toEqual([{ file: 'gone.ts', function: 'gone', reason: 'why' }]);
        expect(reasonless.reasonless).toHaveLength(1);
    });
});
