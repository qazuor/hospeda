import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tests');

async function walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) => {
            const entryPath = path.join(directory, entry.name);
            return entry.isDirectory() ? walk(entryPath) : [entryPath];
        })
    );
    return nested.flat();
}

describe('mail capture lifecycle guard', () => {
    it('requires every spec that starts mail capture to close it', async () => {
        const files = (await walk(testsRoot)).filter((file) => file.endsWith('.spec.ts'));
        const sources = await Promise.all(
            files.map(async (file) => [file, await readFile(file, 'utf8')] as const)
        );
        const starters = /\bstartE2eMailCapture\s*\(/;
        const closer = /\b(?:world\??\.mailCapture|capture|mailCapture)\??\.close\s*\(/;
        const missing = sources
            .filter(([, source]) => starters.test(source) && !closer.test(source))
            .map(([file]) => path.relative(testsRoot, file));
        expect(
            missing,
            `Mail capture started without a matching close(): ${missing.join(', ')}`
        ).toEqual([]);
    });
});
