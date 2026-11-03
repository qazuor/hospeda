import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HOS-1999 (spec §6.2, decision 2026-11-03): a stamped `ProviderRead` may be
 * shared only through `shareProviderReadForAct`, keyed by act identity, and its
 * only consumer is `readChargeForAct`. Raw-input memoization
 * (`memoizeInProviderReadScope`) stays inside `packages/payments/src`.
 */
const root = resolve(__dirname, '../../../..');
const SHARE_ALLOWED = new Set([
    'packages/payments/src/provider/provider-read-scope.ts',
    'packages/payments/src/index.ts',
    'packages/service-core/src/services/billing/reconciliation/period-charges/read-charge-for-act.ts'
]);
const SOURCE_FILE = /\.(ts|tsx|mts|cts)$/;

async function sourceFiles(absoluteDirectory: string): Promise<string[]> {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const path = join(absoluteDirectory, entry.name);
            if (entry.isDirectory()) return await sourceFiles(path);
            return entry.isFile() && SOURCE_FILE.test(entry.name) ? [path] : [];
        })
    );
    return nested.flat();
}

async function productionSources(): Promise<readonly string[]> {
    const roots: string[] = [];
    for (const group of ['packages', 'apps']) {
        const entries = await readdir(join(root, group), { withFileTypes: true });
        for (const entry of entries) {
            const src = join(root, group, entry.name, 'src');
            if (entry.isDirectory() && existsSync(src)) roots.push(src);
        }
    }
    return (await Promise.all(roots.map(sourceFiles))).flat();
}

describe('stamped provider read sharing guard (HOS-1999)', () => {
    it('limits stamped sharing to readChargeForAct and raw memoization to payments', async () => {
        const files = await productionSources();
        const scanned = new Set(files.map((file) => relative(root, file).replaceAll('\\', '/')));
        // The scan must reach the files the rule is about, or it proves nothing.
        for (const allowed of SHARE_ALLOWED) expect(scanned.has(allowed), allowed).toBe(true);

        const violations: string[] = [];
        for (const file of files) {
            const path = relative(root, file).replaceAll('\\', '/');
            const source = await readFile(file, 'utf8');
            if (/\bshareProviderReadForAct\b/.test(source) && !SHARE_ALLOWED.has(path))
                violations.push(
                    `${path}: shareProviderReadForAct may only be used by readChargeForAct (spec §6.2)`
                );
            if (
                /\bmemoizeInProviderReadScope\b/.test(source) &&
                !path.startsWith('packages/payments/src/')
            )
                violations.push(
                    `${path}: memoizeInProviderReadScope is internal to packages/payments/src`
                );
        }
        expect(violations).toEqual([]);
    });
});
