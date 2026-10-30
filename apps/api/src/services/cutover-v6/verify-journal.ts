/**
 * Journal check for cutover step 3 (HOS-1957 G5, AC:CORTE:7).
 *
 * After `db-migrate`, every migration in the image's Drizzle journal must be
 * recorded in `drizzle.__drizzle_migrations` of the target database, otherwise
 * the cutover does not continue (abort branch).
 *
 * How Drizzle records a migration (read from `drizzle-orm/migrator.js` and
 * `pg-core/dialect.js`, drizzle-orm 0.45): for every journal entry it stores
 * `hash = sha256(<tag>.sql file content, as read)` and `created_at = entry.when`.
 * The migrator only applies an entry when `created_at` of the LAST row (ordered
 * by `created_at desc`) is lower than the entry's `when`, so an entry whose
 * `when` is older than the newest applied one is silently skipped. That is the
 * hotfix-during-freeze hole this check closes: the comparison is by `hash`, one
 * lookup per journal entry, not by count and not by "latest".
 *
 * Pure module: the file reads are injected.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

const JournalSchema = z.object({
    entries: z.array(
        z.object({
            idx: z.number().int(),
            tag: z.string().min(1),
            when: z.number()
        })
    )
});

/** One migration the image's journal declares. */
export interface JournalEntry {
    readonly idx: number;
    readonly tag: string;
    /** Journal `when`; Drizzle stores it as `created_at`. */
    readonly when: number;
    /** sha256 of the `.sql` file content, exactly as Drizzle computes it. */
    readonly hash: string;
}

/** One row of `drizzle.__drizzle_migrations`. */
export interface AppliedMigrationRow {
    readonly hash: string;
    /** `bigint` column: `pg` returns it as a string. */
    readonly createdAt: string | number | null;
}

/**
 * Parses the journal and hashes each migration file the way Drizzle does.
 *
 * @param input - Raw `_journal.json` text and a reader for `<tag>.sql`.
 * @returns The entries in journal order.
 * @throws When the journal is malformed or a file is unreadable.
 */
export function buildJournalEntries(input: {
    readonly journalJson: string;
    readonly readSql: (tag: string) => string;
}): readonly JournalEntry[] {
    const journal = JournalSchema.parse(JSON.parse(input.journalJson));
    return journal.entries.map((entry) => ({
        idx: entry.idx,
        tag: entry.tag,
        when: entry.when,
        hash: createHash('sha256').update(input.readSql(entry.tag)).digest('hex')
    }));
}

/** Result of {@link compareJournal}. */
export interface JournalComparison {
    /** `true` only when no journal entry is missing from the database. */
    readonly ok: boolean;
    readonly journalCount: number;
    readonly appliedCount: number;
    /** Journal entries with no row of the same hash: the cut must not continue. */
    readonly missing: readonly JournalEntry[];
    /** Hash present but `created_at` differs from `when`: applied, worth a look. */
    readonly whenMismatch: readonly JournalEntry[];
    /** Rows whose hash matches no journal entry: informational only. */
    readonly unknownHashes: readonly string[];
}

/**
 * Compares the image's journal with the applied-migrations table.
 *
 * @param input - Journal entries and the rows of `drizzle.__drizzle_migrations`.
 * @returns The comparison; `ok` is false iff something is missing.
 */
export function compareJournal(input: {
    readonly entries: readonly JournalEntry[];
    readonly applied: readonly AppliedMigrationRow[];
}): JournalComparison {
    const byHash = new Map<string, AppliedMigrationRow>();
    for (const row of input.applied) byHash.set(row.hash, row);
    const journalHashes = new Set(input.entries.map((entry) => entry.hash));
    const missing = input.entries.filter((entry) => !byHash.has(entry.hash));
    const whenMismatch = input.entries.filter((entry) => {
        const row = byHash.get(entry.hash);
        return row !== undefined && Number(row.createdAt) !== entry.when;
    });
    const unknownHashes = input.applied
        .map((row) => row.hash)
        .filter((hash) => !journalHashes.has(hash));
    return {
        ok: missing.length === 0,
        journalCount: input.entries.length,
        appliedCount: input.applied.length,
        missing,
        whenMismatch,
        unknownHashes
    };
}
