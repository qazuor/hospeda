import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), '../..');
const allowedShare = new Set([
    'packages/payments/src/provider/provider-read-scope.ts',
    'packages/payments/src/index.ts',
    'packages/service-core/src/services/billing/reconciliation/period-charges/read-charge-for-act.ts'
]);

async function sourceFiles(directory: string): Promise<string[]> {
    const entries = await readdir(join(root, directory), { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const path = join(directory, entry.name);
            if (entry.isDirectory()) return await sourceFiles(path);
            return entry.isFile() && path.endsWith('.ts') ? [path] : [];
        })
    );
    return nested.flat();
}

describe('stamped provider read sharing guard', () => {
    it('limits stamped sharing to its act keyed API and raw memoization to payments', async () => {
        const groups = await Promise.all(
            ['packages', 'apps'].map(async (group) => {
                const entries = await readdir(join(root, group), { withFileTypes: true });
                return entries
                    .filter((entry) => entry.isDirectory())
                    .map((entry) => `${group}/${entry.name}/src`);
            })
        );
        const sourceRoots = groups.flat();
        const files = (
            await Promise.all(
                sourceRoots.map(async (directory) => {
                    try {
                        return await sourceFiles(directory);
                    } catch {
                        return [];
                    }
                })
            )
        ).flat();
        const violations: string[] = [];
        for (const file of files) {
            const path = relative(root, file).replaceAll('\\', '/');
            let source: string;
            try {
                source = await readFile(file, 'utf8');
            } catch {
                continue;
            }
            if (/\bshareProviderReadForAct\b/.test(source) && !allowedShare.has(path))
                violations.push(
                    `${path}: shareProviderReadForAct may only be used by readChargeForAct and exported by payments`
                );
            if (
                /\bmemoizeInProviderReadScope\b/.test(source) &&
                !path.startsWith('packages/payments/src/')
            )
                violations.push(
                    `${path}: memoizeInProviderReadScope is adapter-internal to packages/payments/src`
                );
        }
        expect(violations).toEqual([]);
    });
});
