import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliHistory, CliHistoryEntry } from './types.js';

/**
 * The filename used for persisting command history in the monorepo root.
 */
export const HISTORY_FILE = '.cli-history.json';

/**
 * Maximum number of history entries to retain.
 * Oldest entries (by lastRun) are pruned when this limit is exceeded.
 */
export const MAX_ENTRIES = 20;

/**
 * Resolves the absolute path to the monorepo root directory.
 *
 * Walks up two levels from the directory containing this file
 * (`scripts/cli/` -> `scripts/` -> repo root).
 *
 * @returns Absolute path string of the monorepo root.
 *
 * @example
 * ```ts
 * const root = findMonorepoRoot();
 * // "/home/user/projects/hospeda"
 * ```
 */
export function findMonorepoRoot(): string {
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = dirname(thisFile);
    return join(thisDir, '..', '..');
}

/**
 * Reads the CLI history from `.cli-history.json` in the monorepo root.
 *
 * Returns an empty history object if the file does not exist or its
 * contents cannot be parsed as valid JSON.
 *
 * @returns Parsed `CliHistory` object, or `{ version: 1, entries: [] }` on any error.
 *
 * @example
 * ```ts
 * const history = await readHistory();
 * console.log(history.entries.length);
 * ```
 */
export async function readHistory(): Promise<CliHistory> {
    const historyPath = join(findMonorepoRoot(), HISTORY_FILE);
    try {
        const raw = await readFile(historyPath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'version' in parsed &&
            'entries' in parsed &&
            (parsed as { version: unknown }).version === 1 &&
            Array.isArray((parsed as { entries: unknown }).entries)
        ) {
            return parsed as CliHistory;
        }
        return { version: 1, entries: [] };
    } catch {
        return { version: 1, entries: [] };
    }
}

/**
 * Records a command execution in the persisted CLI history.
 *
 * If an entry for the given `id` already exists it is updated in place:
 * `lastRun` is set to the current ISO timestamp and `runCount` is
 * incremented. Otherwise a new entry with `runCount: 1` is created.
 *
 * After upserting, entries exceeding `MAX_ENTRIES` are pruned by removing
 * the oldest entry (smallest `lastRun`). The history file is written
 * atomically via a sibling `.tmp` file that is then renamed.
 *
 * @param params - Object containing the command `id` to record.
 *
 * @example
 * ```ts
 * await recordCommand({ id: 'db:start' });
 * ```
 */
export async function recordCommand({ id }: { id: string }): Promise<void> {
    const root = findMonorepoRoot();
    const historyPath = join(root, HISTORY_FILE);
    const tmpPath = join(root, `${HISTORY_FILE}.tmp`);

    const current = await readHistory();
    const now = new Date().toISOString();

    const existing = current.entries.find((e) => e.id === id);

    let updatedEntries: CliHistoryEntry[];
    if (existing !== undefined) {
        updatedEntries = current.entries.map((e) =>
            e.id === id ? { id: e.id, lastRun: now, runCount: e.runCount + 1 } : e
        );
    } else {
        updatedEntries = [...current.entries, { id, lastRun: now, runCount: 1 }];
    }

    if (updatedEntries.length > MAX_ENTRIES) {
        updatedEntries = updatedEntries
            .slice()
            .sort((a, b) => a.lastRun.localeCompare(b.lastRun))
            .slice(updatedEntries.length - MAX_ENTRIES);
    }

    const updated: CliHistory = { version: 1, entries: updatedEntries };
    await writeFile(tmpPath, JSON.stringify(updated, null, 2), 'utf-8');
    await rename(tmpPath, historyPath);
}

/**
 * Returns the most recently used commands from a history object.
 *
 * Entries are sorted by `lastRun` in descending order (most recent first)
 * and capped at `maxCount`.
 *
 * @param params - Object containing the `history` to query and an optional
 *   `maxCount` (defaults to `5`).
 * @returns A readonly array of `CliHistoryEntry` values.
 *
 * @example
 * ```ts
 * const history = await readHistory();
 * const recent = getRecentCommands({ history, maxCount: 3 });
 * recent.forEach(e => console.log(e.id, e.runCount));
 * ```
 */
export function getRecentCommands({
    history,
    maxCount = 5
}: {
    readonly history: CliHistory;
    readonly maxCount?: number;
}): readonly CliHistoryEntry[] {
    return history.entries
        .slice()
        .sort((a, b) => b.lastRun.localeCompare(a.lastRun))
        .slice(0, maxCount);
}
