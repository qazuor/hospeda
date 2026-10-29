/**
 * Unit tests for the step 3 journal check (HOS-1957 G5, AC:CORTE:7).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    buildJournalEntries,
    compareJournal
} from '../../../src/services/cutover-v6/verify-journal.js';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

const SQL: Readonly<Record<string, string>> = {
    '0000_a': 'CREATE TABLE a();',
    '0001_b': 'CREATE TABLE b();\n--> statement-breakpoint\nCREATE TABLE c();',
    '0002_hotfix': 'ALTER TABLE a ADD x int;'
};
const JOURNAL = JSON.stringify({
    version: '7',
    dialect: 'postgresql',
    entries: [
        { idx: 0, version: '7', when: 1000, tag: '0000_a', breakpoints: true },
        { idx: 1, version: '7', when: 3000, tag: '0001_b', breakpoints: true },
        // A freeze hotfix: lexically last, but dated BEFORE 0001_b.
        { idx: 2, version: '7', when: 2000, tag: '0002_hotfix', breakpoints: true }
    ]
});
const readSql = (tag: string): string => SQL[tag] ?? '';

describe('buildJournalEntries', () => {
    it('hashes each file content with sha256, as Drizzle records it', () => {
        // Arrange / Act
        const entries = buildJournalEntries({ journalJson: JOURNAL, readSql });

        // Assert
        expect(entries.map((e) => e.tag)).toEqual(['0000_a', '0001_b', '0002_hotfix']);
        expect(entries[1]?.hash).toBe(sha(SQL['0001_b'] as string));
        expect(entries[2]?.when).toBe(2000);
    });

    it('rejects a malformed journal', () => {
        expect(() =>
            buildJournalEntries({ journalJson: '{"entries":[{"tag":1}]}', readSql })
        ).toThrow();
    });
});

describe('compareJournal', () => {
    const entries = buildJournalEntries({ journalJson: JOURNAL, readSql });

    it('is ok when every journal hash is applied', () => {
        // Arrange
        const applied = entries.map((e) => ({ hash: e.hash, createdAt: String(e.when) }));

        // Act
        const result = compareJournal({ entries, applied });

        // Assert
        expect(result.ok).toBe(true);
        expect(result.missing).toEqual([]);
        expect(result.whenMismatch).toEqual([]);
    });

    it('RED: fails and names the migration Drizzle skipped for being older than the latest', () => {
        // Arrange: the table holds 0000 and 0001 (when 3000); 0002 (when 2000) was skipped
        // because the migrator only compares against the newest created_at.
        const applied = [entries[0], entries[1]].map((e) => ({
            hash: (e as { hash: string }).hash,
            createdAt: String((e as { when: number }).when)
        }));

        // Act
        const result = compareJournal({ entries, applied });

        // Assert
        expect(result.ok).toBe(false);
        expect(result.missing.map((m) => m.tag)).toEqual(['0002_hotfix']);
    });

    it('is not fooled by a matching row count', () => {
        // Arrange: three rows, but one is a foreign hash.
        const applied = [
            { hash: (entries[0] as { hash: string }).hash, createdAt: '1000' },
            { hash: (entries[1] as { hash: string }).hash, createdAt: '3000' },
            { hash: 'f'.repeat(64), createdAt: '2000' }
        ];

        // Act
        const result = compareJournal({ entries, applied });

        // Assert
        expect(result.appliedCount).toBe(result.journalCount);
        expect(result.ok).toBe(false);
        expect(result.unknownHashes).toEqual(['f'.repeat(64)]);
    });

    it('reports a created_at that differs from the journal as a warning, not a failure', () => {
        // Arrange
        const applied = entries.map((e) => ({ hash: e.hash, createdAt: 1 }));

        // Act
        const result = compareJournal({ entries, applied });

        // Assert
        expect(result.ok).toBe(true);
        expect(result.whenMismatch).toHaveLength(3);
    });
});
