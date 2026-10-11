import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { isBaselineHistory, run } from '../check-catalog-sql.ts';
import { buildLoads, renderInsert } from '../generate-catalog-sql.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function migrations({ files }: { readonly files: Readonly<Record<string, string>> }): string {
    const base = path.join(ROOT, '.hoja/tmp');
    mkdirSync(base, { recursive: true });
    const dir = mkdtempSync(path.join(base, 'g18-baseline-'));
    dirs.push(dir);
    for (const [name, sql] of Object.entries(files)) writeFileSync(path.join(dir, name), sql);
    return dir;
}

const baselineSql = `${renderInsert({ load: buildLoads().catalog_key })}\n--> statement-breakpoint\n${renderInsert({ load: buildLoads().vertical })}\n`;

describe('G18 baseline history mode', () => {
    it('compares only catalog_key and vertical and identifies the mode', () => {
        const result = run({
            migrationsDir: migrations({ files: { '0000_baseline.sql': baselineSql } })
        });
        expect(result.exitCode).toBe(0);
        expect(result.output).toContain('baseline history: catalog_key and vertical only');
    });
    it('still catches a missing catalog key and changed attributes', () => {
        const changed = baselineSql.replace("'ai_chat'", "'ai_chatt'");
        const result = run({
            migrationsDir: migrations({ files: { '0000_baseline.sql': changed } })
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('catalog_key');
        expect(result.output).toContain('ai_chat');
    });
    it('does not enable the mode for multiple versioned files', () => {
        const result = run({
            migrationsDir: migrations({
                files: { '0000_baseline.sql': baselineSql, '0001_more.sql': '' }
            })
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('full migration history');
    });
    it('does not enable the mode for a different single filename', () => {
        const result = run({
            migrationsDir: migrations({ files: { '0001_other.sql': baselineSql } })
        });
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('full migration history');
    });
    it('recognizes only the one-file baseline name', () => {
        expect(isBaselineHistory({ files: [{ name: '0000_baseline.sql', sql: '' }] })).toBe(true);
        expect(
            isBaselineHistory({
                files: [
                    { name: '0000_baseline.sql', sql: '' },
                    { name: '0001_x.sql', sql: '' }
                ]
            })
        ).toBe(false);
        expect(isBaselineHistory({ files: [{ name: '0001_other.sql', sql: '' }] })).toBe(false);
    });
});
