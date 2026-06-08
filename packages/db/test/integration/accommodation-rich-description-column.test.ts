import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Integration test: accommodation.rich_description — add-column migration (P2-T2).
 *
 * SPEC-187 P2-T2 / PD-3:
 *   - Phase 2 introduces a NEW nullable column `accommodations.rich_description`
 *     to store the optional markdown source (presence = owner is entitled,
 *     absence = owner is not entitled — see FR-3b).
 *   - This column is INTENTIONALLY separate from the P0 strip migration. Per
 *     PD-3 ("two rollback units"), the column add must be a fresh migration
 *     file that ONLY does `ALTER TABLE ... ADD COLUMN rich_description text`
 *     and does NOT contain any data transformation (UPDATE / DELETE / strip).
 *   - The drift guard (`scripts/check-schema-drift.sh`) blocks CI if a
 *     committed schema change has no matching migration; conversely, this
 *     test fails RED if a hand-edited migration smuggles a strip into the
 *     add-column file.
 *
 * Test strategy:
 *   1. Static (file-inspection) PD-3 contract test — reads the latest
 *      migration SQL file and asserts it ONLY contains the column ADD and
 *      NO data-strip UPDATE/DELETE statements.
 *   2. Drizzle schema test — imports the `accommodations` table schema and
 *      asserts `richDescription` is a nullable text column. Catches accidental
 *      removal of the field.
 *   3. Live column round-trip — inside a rollback-isolated transaction,
 *      inserts a row with `rich_description`, reads it back via the Drizzle
 *      schema, and asserts byte equality. Catches generated-SQL drift (e.g.
 *      wrong column type, nullability flipped).
 *
 * File-inspection tests run as part of `pnpm test:integration`; they do not
 * require a DB connection. The live round-trip test requires the integration
 * Docker PostgreSQL (matches the rest of `test/integration/`).
 */
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { accommodations, destinations, users } from '../../src/schemas/index.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, '../../src/migrations');

/**
 * Find the highest-numbered migration file in `src/migrations/`. Phase 2
 * introduces a new file (e.g. `0009_add_rich_description.sql`); this helper
 * returns its filename so the PD-3 contract test can read it directly.
 */
async function findLatestMigrationFilename(): Promise<string> {
    const entries = await readdir(MIGRATIONS_DIR);
    const sqlFiles = entries.filter((f) => f.endsWith('.sql'));
    if (sqlFiles.length === 0) {
        throw new Error(`No .sql migration files found in ${MIGRATIONS_DIR}`);
    }
    // Sort by leading 4-digit index, descending; pick the largest.
    sqlFiles.sort((a, b) => {
        const aIdx = Number.parseInt(a.slice(0, 4), 10);
        const bIdx = Number.parseInt(b.slice(0, 4), 10);
        return bIdx - aIdx;
    });
    const latest = sqlFiles[0];
    if (typeof latest !== 'string') {
        throw new Error('Could not resolve latest migration filename');
    }
    return latest;
}

/**
 * Tokenize a migration file's SQL on Drizzle's `--> statement-breakpoint`
 * separator and return the non-empty statements, uppercased for assertion.
 * Comments are stripped at the per-line level (`--` to end of line).
 */
function splitStatementsUpper(script: string): string[] {
    return script
        .split('--> statement-breakpoint')
        .map((s) =>
            s
                .split('\n')
                .filter((line) => !line.trim().startsWith('--'))
                .join('\n')
                .trim()
        )
        .filter((s) => s.length > 0)
        .map((s) => s.toUpperCase());
}

afterAll(async () => {
    await closeTestPool();
});

describe('accommodation.rich_description migration (SPEC-187 P2-T2 / PD-3)', () => {
    it('latest migration file contains ONLY the ADD COLUMN and NO data-strip statements', async () => {
        const filename = await findLatestMigrationFilename();
        const path = join(MIGRATIONS_DIR, filename);
        const script = await readFile(path, 'utf-8');
        const statements = splitStatementsUpper(script);

        // PD-3 — the add-column migration must not mutate existing rows.
        // Any of the following would be a data-strip or row mutation:
        //   UPDATE  : data transformation
        //   DELETE  : row removal
        //   TRUNCATE: table reset
        const dataMutationStatements = statements.filter(
            (s) => s.startsWith('UPDATE') || s.startsWith('DELETE') || s.startsWith('TRUNCATE')
        );

        expect(dataMutationStatements).toEqual([]);

        // The migration MUST add the column. The exact text is the
        // generated Drizzle output for `text('rich_description')`.
        const addColumnStatements = statements.filter(
            (s) => s.includes('ADD COLUMN') && s.includes('RICH_DESCRIPTION')
        );
        expect(addColumnStatements.length).toBeGreaterThanOrEqual(1);
    });

    it('drizzle schema declares richDescription as a nullable text column', () => {
        // The field must exist on the accommodations table schema object.
        const column = (accommodations as unknown as Record<string, unknown>).richDescription;
        expect(column).toBeDefined();

        // Drizzle text columns expose `notNull` (default false) and a
        // dataType / columnType. We assert the column is nullable text.
        const col = column as { notNull: boolean; dataType: string };
        expect(col.notNull).toBe(false);
        expect(col.dataType).toBe('string');
    });

    it('round-trips a markdown payload through the rich_description column', async () => {
        getTestDb();
        const fixture = '## Premium Suite\n\n**Luxury** awaits with a [link](https://example.com).';

        await withTestTransaction(async (tx) => {
            // Insert a fresh owner + destination so the FK constraints are
            // satisfied for the accommodation row. testData.user() is a
            // payload factory — it does not insert on its own; we have to
            // tx.insert(users) explicitly.
            const ownerPayload = testData.user({ role: 'HOST' });
            const [owner] = await tx.insert(users).values(ownerPayload).returning();
            if (!owner) throw new Error('Failed to insert owner in round-trip test');
            const destinationPayload = testData.destination({ ownerId: owner.id });
            const [destination] = await tx
                .insert(destinations)
                .values(destinationPayload)
                .returning();
            if (!destination) throw new Error('Failed to insert destination in round-trip test');

            const [inserted] = await tx
                .insert(accommodations)
                .values({
                    ownerId: owner.id,
                    destinationId: destination.id,
                    slug: `spec187-rich-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    name: 'SPEC-187 Round-Trip Test',
                    summary: 'Short summary for SPEC-187 round-trip integration test.',
                    type: 'HOTEL',
                    description:
                        'Plain description (no markdown markers here for P0 strip purposes).',
                    richDescription: fixture
                })
                .returning();

            expect(inserted).toBeDefined();
            expect(inserted?.richDescription).toBe(fixture);

            // Re-fetch via a plain SELECT to catch any client-side coercion
            // that might mask a column-type mismatch.
            const [reFetched] = await tx
                .select({ richDescription: accommodations.richDescription })
                .from(accommodations)
                .where(eq(accommodations.id, inserted!.id));

            expect(reFetched.richDescription).toBe(fixture);

            // Smoke: count rows where rich_description is not null. Confirms
            // the column exists in the SQL table (not just the schema object)
            // and accepts non-null values without a CHECK constraint blocking
            // the insert.
            const result = await tx.execute(sql`
                SELECT COUNT(*)::int AS n
                FROM accommodations
                WHERE rich_description IS NOT NULL
            `);
            const count = Number((result.rows[0] as { n: number } | undefined)?.n ?? 0);
            expect(count).toBeGreaterThanOrEqual(1);
        });
    });
});
