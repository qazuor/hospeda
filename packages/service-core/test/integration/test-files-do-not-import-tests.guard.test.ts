import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testImportSpecifier =
    /\bimport\s*(?:\(\s*)?(?:type\s*)?(?:[^;'"()]*?\s+from\s*)?['"]([^'"]+\.test(?:\.ts)?)['"]/g;

async function findTestFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return findTestFiles(entryPath);
            return entry.isFile() && entry.name.endsWith('.test.ts') ? [entryPath] : [];
        })
    );
    return nested.flat();
}

describe('test file import guard', () => {
    it('rejects imports whose specifier points to another test file', async () => {
        const files = await findTestFiles(testRoot);
        const violations: string[] = [];

        for (const file of files) {
            const source = await readFile(file, 'utf8');
            for (const match of source.matchAll(testImportSpecifier)) {
                violations.push(`${path.relative(testRoot, file)}: ${match[1]}`);
            }
        }

        expect(violations).toEqual([]);
    });
});
