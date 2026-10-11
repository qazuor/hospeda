// TEST:V4:21 (HOS-1448): trial condition reads exist on an empty migrated schema.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

interface CorpusRow {
    readonly machine: string;
    readonly reads: readonly string[];
    readonly writes: readonly string[];
}

afterAll(async () => {
    await closeTestPool();
});

describe('TEST:V4:21 - every column a trial-machine condition reads exists and some declared transition writes it', () => {
    it('checks trial reads against the empty migrated database and corpus writers', async () => {
        const corpus = JSON.parse(
            readFileSync(
                path.resolve(
                    import.meta.dirname,
                    '../../../../scripts/guards/transition-tables.json'
                ),
                'utf8'
            )
        ) as { readonly transitions: readonly CorpusRow[] };
        const rows = corpus.transitions.filter((row) => row.machine === 'trial');
        const reads = [...new Set(rows.flatMap((row) => row.reads))];
        expect(reads.length).toBeGreaterThanOrEqual(3);
        expect(reads).toEqual(
            expect.arrayContaining([
                'trial.email_pseudonym',
                'trial.ends_at',
                'domain_event.changes'
            ])
        );
        for (const column of reads) {
            const [tableName, columnName] = column.split('.');
            expect(tableName).toBeTruthy();
            expect(columnName).toBeTruthy();
            const { rows: found } = await getTestPool().query<{ column_name: string }>(
                `SELECT column_name FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
                [tableName, columnName]
            );
            expect(found, column).toHaveLength(1);
            expect(
                corpus.transitions.some((row) => row.writes.includes(column)),
                `${column} has a declared writer`
            ).toBe(true);
        }
    });
});
