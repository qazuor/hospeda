/**
 * @fileoverview
 * HOS-2352: a writer that zeroes `promo_redemption.remaining_charges` goes through
 * `endPromoRedemptions()`. Green on the branch, and broken on purpose over
 * throwaway git trees: each case applies ONE mutation to a green tree.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { HELPER_FILE, run } from '../check-promo-redemption-end.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WRITER = 'packages/service-core/src/services/billing/subscription/queue.ts';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function makeTree({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const root = mkdtempSync(path.join(tmpdir(), 'hos-2352-'));
    tempDirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'pipe' });
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), content);
    }
    return root;
}

/** A green tree: the helper zeroes, the writer calls it, P1 decrements, a reader filters. */
const GREEN: Readonly<Record<string, string>> = {
    [HELPER_FILE]: 'export const endPromoRedemptions = () => ({ remainingCharges: 0, endedAt });\n',
    [WRITER]:
        "tx.update(promoRedemptions).set(endPromoRedemptions({ endedAt: now, reason: 'DOWNGRADE' }));\n",
    'packages/service-core/src/services/billing/payment/credit.ts':
        'tx.update(promoRedemptions).set({ remainingCharges: sql`${promoRedemptions.remainingCharges} - 1` });\n',
    'packages/service-core/src/services/billing/promo/s30.ts':
        'where(eq(promoRedemptions.remainingCharges, 0));\n',
    'packages/service-core/test/fixture.ts':
        'db.update(promoRedemptions).set({ remainingCharges: 0 });\n'
};

const guardOver = (overrides: Readonly<Record<string, string | null>> = {}) => {
    const files: Record<string, string> = { ...GREEN };
    for (const [file, content] of Object.entries(overrides)) {
        if (content === null) delete files[file];
        else files[file] = content;
    }
    return run({ root: makeTree({ files }) });
};

describe('HOS-2352 promo end guard on the branch', () => {
    it('is green over the repo', () => {
        const { exitCode, output } = run({ root: REPO_ROOT });
        expect(output).toContain('OK:');
        expect(exitCode).toBe(0);
    });

    it('is green over a tree where only the helper zeroes', () => {
        expect(guardOver().exitCode).toBe(0);
    });
});

describe('HOS-2352 promo end guard, broken on purpose', () => {
    it('is red when a writer zeroes the counter by hand', () => {
        const { exitCode, output } = guardOver({
            [WRITER]: 'tx.update(promoRedemptions).set({ remainingCharges: 0 });\n'
        });
        expect(exitCode).toBe(1);
        expect(output).toContain(`${WRITER}:1`);
    });

    it('is red when raw SQL zeroes the column', () => {
        const { exitCode } = guardOver({
            [WRITER]: 'sql`UPDATE promo_redemption SET remaining_charges = 0 WHERE id = ${id}`;\n'
        });
        expect(exitCode).toBe(1);
    });

    it('is red when the helper moved', () => {
        const { exitCode, output } = guardOver({ [HELPER_FILE]: null });
        expect(exitCode).toBe(1);
        expect(output).toContain('ERROR:');
    });

    it('ignores a zeroing inside a comment', () => {
        const { exitCode } = guardOver({
            [WRITER]: '// set({ remainingCharges: 0 }) was the old way\nexport {};\n'
        });
        expect(exitCode).toBe(0);
    });
});
