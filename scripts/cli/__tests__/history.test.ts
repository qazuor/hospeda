import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    HISTORY_FILE,
    MAX_ENTRIES,
    getRecentCommands,
    readHistory,
    recordCommand
} from '../history.js';
import type { CliHistory } from '../types.js';

let tempDir = '';

beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'hospeda-cli-test-'));
});

afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = '';
});

describe('readHistory', () => {
    it('should return empty history when file does not exist', async () => {
        // Arrange - no file written

        // Act
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history).toEqual({ version: 1, entries: [] });
    });

    it('should return empty history when file contains corrupt JSON', async () => {
        // Arrange
        await writeFile(join(tempDir, HISTORY_FILE), 'not valid json!!!', 'utf-8');

        // Act
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history).toEqual({ version: 1, entries: [] });
    });

    it('should return empty history when file contains wrong schema version', async () => {
        // Arrange
        const badData = { version: 2, entries: [] };
        await writeFile(join(tempDir, HISTORY_FILE), JSON.stringify(badData), 'utf-8');

        // Act
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history).toEqual({ version: 1, entries: [] });
    });

    it('should return empty history when file is missing entries field', async () => {
        // Arrange
        const badData = { version: 1 };
        await writeFile(join(tempDir, HISTORY_FILE), JSON.stringify(badData), 'utf-8');

        // Act
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history).toEqual({ version: 1, entries: [] });
    });

    it('should correctly parse a valid history file', async () => {
        // Arrange
        const validHistory: CliHistory = {
            version: 1,
            entries: [{ id: 'test', lastRun: '2024-01-01T00:00:00.000Z', runCount: 3 }]
        };
        await writeFile(join(tempDir, HISTORY_FILE), JSON.stringify(validHistory), 'utf-8');

        // Act
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history.version).toBe(1);
        expect(history.entries).toHaveLength(1);
        expect(history.entries[0]?.id).toBe('test');
        expect(history.entries[0]?.runCount).toBe(3);
    });

    it('should filter out malformed entries via isValidEntry', async () => {
        // Arrange - entries with missing/wrong-typed fields
        const malformed = {
            version: 1,
            entries: [
                { id: 'good', lastRun: '2024-01-01T00:00:00.000Z', runCount: 1 },
                { id: 123, lastRun: '2024-01-01T00:00:00.000Z', runCount: 1 },
                { id: 'no-runCount', lastRun: '2024-01-01T00:00:00.000Z' },
                { id: 'bad-runCount', lastRun: '2024-01-01T00:00:00.000Z', runCount: 'two' },
                null,
                'string-entry'
            ]
        };
        await writeFile(join(tempDir, HISTORY_FILE), JSON.stringify(malformed), 'utf-8');

        // Act
        const history = await readHistory({ rootDir: tempDir });

        // Assert - only the valid entry survives
        expect(history.entries).toHaveLength(1);
        expect(history.entries[0]?.id).toBe('good');
    });
});

describe('recordCommand', () => {
    it('should create a new entry when command has not been run before', async () => {
        // Arrange & Act
        await recordCommand({ id: 'db:start', rootDir: tempDir });
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history.entries).toHaveLength(1);
        const entry = history.entries[0];
        expect(entry?.id).toBe('db:start');
        expect(entry?.runCount).toBe(1);
        expect(typeof entry?.lastRun).toBe('string');
    });

    it('should increment runCount when command already exists', async () => {
        // Arrange
        await recordCommand({ id: 'test', rootDir: tempDir });
        await recordCommand({ id: 'test', rootDir: tempDir });

        // Act
        await recordCommand({ id: 'test', rootDir: tempDir });
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        const entry = history.entries.find((e) => e.id === 'test');
        expect(entry).toBeDefined();
        expect(entry?.runCount).toBe(3);
    });

    it('should update lastRun timestamp on subsequent calls', async () => {
        // Arrange - write initial history with an old known timestamp
        const firstTime = '2020-01-01T10:00:00.000Z';
        const initial: CliHistory = {
            version: 1,
            entries: [{ id: 'lint', lastRun: firstTime, runCount: 1 }]
        };
        await writeFile(join(tempDir, HISTORY_FILE), JSON.stringify(initial), 'utf-8');

        // Act - record again; the new timestamp will be current time (after 2020)
        await recordCommand({ id: 'lint', rootDir: tempDir });
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        const entry = history.entries.find((e) => e.id === 'lint');
        expect(entry).toBeDefined();
        expect((entry?.lastRun ?? '') > firstTime).toBe(true);
        expect(entry?.runCount).toBe(2);
    });

    it('should enforce MAX_ENTRIES=20 limit by removing oldest entry', async () => {
        // Arrange - seed MAX_ENTRIES entries with old timestamps
        const seeded: CliHistory = {
            version: 1,
            entries: Array.from({ length: MAX_ENTRIES }, (_, i) => ({
                id: `old-cmd-${i}`,
                lastRun: `2020-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
                runCount: 1
            }))
        };
        await writeFile(join(tempDir, HISTORY_FILE), JSON.stringify(seeded), 'utf-8');

        // Act - add one more to trigger pruning
        await recordCommand({ id: 'overflow-cmd', rootDir: tempDir });
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history.entries).toHaveLength(MAX_ENTRIES);
        expect(history.entries.some((e) => e.id === 'overflow-cmd')).toBe(true);
    });

    it('should keep exactly MAX_ENTRIES after adding many commands', async () => {
        // Arrange & Act - add MAX_ENTRIES + 5 distinct commands sequentially
        for (let i = 0; i < MAX_ENTRIES + 5; i++) {
            await recordCommand({ id: `cmd-${i}`, rootDir: tempDir });
        }
        const history = await readHistory({ rootDir: tempDir });

        // Assert
        expect(history.entries).toHaveLength(MAX_ENTRIES);
    });

    it('should write history atomically (no tmp file left behind)', async () => {
        // Arrange & Act
        await recordCommand({ id: 'build', rootDir: tempDir });

        // Assert - tmp file should not exist, history file should
        const files = await readdir(tempDir);
        expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
        expect(files).toContain(HISTORY_FILE);
    });
});

describe('getRecentCommands', () => {
    it('should sort entries by lastRun descending (most recent first)', () => {
        // Arrange
        const history: CliHistory = {
            version: 1,
            entries: [
                { id: 'old', lastRun: '2024-01-01T00:00:00.000Z', runCount: 1 },
                { id: 'newest', lastRun: '2024-03-01T00:00:00.000Z', runCount: 1 },
                { id: 'middle', lastRun: '2024-02-01T00:00:00.000Z', runCount: 1 }
            ]
        };

        // Act
        const recent = getRecentCommands({ history });

        // Assert
        expect(recent[0]?.id).toBe('newest');
        expect(recent[1]?.id).toBe('middle');
        expect(recent[2]?.id).toBe('old');
    });

    it('should limit to maxCount entries', () => {
        // Arrange
        const history: CliHistory = {
            version: 1,
            entries: [
                { id: 'cmd-1', lastRun: '2024-01-05T00:00:00.000Z', runCount: 1 },
                { id: 'cmd-2', lastRun: '2024-01-04T00:00:00.000Z', runCount: 1 },
                { id: 'cmd-3', lastRun: '2024-01-03T00:00:00.000Z', runCount: 1 },
                { id: 'cmd-4', lastRun: '2024-01-02T00:00:00.000Z', runCount: 1 },
                { id: 'cmd-5', lastRun: '2024-01-01T00:00:00.000Z', runCount: 1 }
            ]
        };

        // Act
        const recent = getRecentCommands({ history, maxCount: 3 });

        // Assert
        expect(recent).toHaveLength(3);
        expect(recent[0]?.id).toBe('cmd-1');
    });

    it('should default maxCount to 5', () => {
        // Arrange
        const entries = Array.from({ length: 10 }, (_, i) => ({
            id: `cmd-${i}`,
            lastRun: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
            runCount: 1
        }));
        const history: CliHistory = { version: 1, entries };

        // Act
        const recent = getRecentCommands({ history });

        // Assert
        expect(recent).toHaveLength(5);
    });

    it('should return empty array for empty history', () => {
        // Arrange
        const history: CliHistory = { version: 1, entries: [] };

        // Act
        const recent = getRecentCommands({ history });

        // Assert
        expect(recent).toEqual([]);
    });

    it('should not mutate the original history entries array', () => {
        // Arrange
        const history: CliHistory = {
            version: 1,
            entries: [
                { id: 'b', lastRun: '2024-01-02T00:00:00.000Z', runCount: 1 },
                { id: 'a', lastRun: '2024-01-01T00:00:00.000Z', runCount: 1 }
            ]
        };
        const originalFirstId = history.entries[0]?.id;

        // Act
        getRecentCommands({ history });

        // Assert - original order unchanged
        expect(history.entries[0]?.id).toBe(originalFirstId);
    });

    it('should return empty array for negative maxCount', () => {
        // Arrange
        const history: CliHistory = {
            version: 1,
            entries: [{ id: 'a', lastRun: '2024-01-01T00:00:00.000Z', runCount: 1 }]
        };

        // Act
        const recent = getRecentCommands({ history, maxCount: -1 });

        // Assert
        expect(recent).toEqual([]);
    });

    it('should return empty array for maxCount of 0', () => {
        // Arrange
        const history: CliHistory = {
            version: 1,
            entries: [{ id: 'a', lastRun: '2024-01-01T00:00:00.000Z', runCount: 1 }]
        };

        // Act
        const recent = getRecentCommands({ history, maxCount: 0 });

        // Assert
        expect(recent).toEqual([]);
    });
});
