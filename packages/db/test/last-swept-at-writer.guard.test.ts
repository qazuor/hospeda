import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_DIR = join(__dirname, '../src');
const AUTHORIZED_WRITER = 'models/reconciliation-sweep-run/reconciliation-sweep-run.model.ts';
const MIGRATION_DIR = 'migrations/';

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
            ? sourceFiles(path)
            : entry.isFile() && /\.(ts|sql)$/.test(entry.name)
              ? [path]
              : [];
    });
}

describe('last_swept_at has one writer', () => {
    it('allows writes only in stampSweptRow and the structural migration', () => {
        const violations: string[] = [];
        for (const path of sourceFiles(SOURCE_DIR)) {
            const name = relative(SOURCE_DIR, path).replaceAll('\\', '/');
            if (name === AUTHORIZED_WRITER || name.startsWith(MIGRATION_DIR)) continue;
            const content = readFileSync(path, 'utf8');
            const drizzleWrite = /\.(?:set|values)\s*\(\s*\{[^}]*\blastSweptAt\b/s.test(content);
            const rawWrite = name.endsWith('.sql')
                ? /\blast_swept_at\b/i.test(content)
                : /\bsql\s*`[^`]*\blast_swept_at\b/s.test(content);
            if (drizzleWrite || rawWrite) violations.push(name);
        }
        expect(violations).toEqual([]);
    });
});
