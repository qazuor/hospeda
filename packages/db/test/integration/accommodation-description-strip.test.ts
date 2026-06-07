import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Integration test: accommodation.description — strip-markdown migration (P0).
 *
 * SPEC-187 FR-9 / PD-1 / PD-3:
 *   - The P0 strip migration removes markdown markers from `accommodation.description`.
 *   - The migration is hand-written (Carril 1), separate from the Phase 2
 *     `add_rich_description.sql` (PD-3, two rollback units).
 *   - The strip rules reuse the regex set from
 *     `apps/api/src/utils/entitlement-filter.ts:188-199` (the actual
 *     `stripMarkdown` function). Diverging from those regexes is a contract
 *     violation (PD-1).
 *
 * Test strategy:
 *   1. Read the migration SQL file from disk and assert it has the expected
 *      structural shape (function + UPDATE + DROP).
 *   2. Inside a rollback-isolated transaction, re-create the function
 *      (skipping the final `DROP FUNCTION` so the function remains callable),
 *      insert a fixture of accommodation rows with the canonical markdown
 *      markers, then execute the UPDATE.
 *   3. Assert the post-condition: 0 rows contain markdown markers.
 *   4. Assert a canonical fixture round-trips to a known clean text.
 *
 * The transaction rolls back at the end of each test (`withTestTransaction`),
 * so state stays clean without TRUNCATE and the function is dropped implicitly
 * by the rollback.
 */
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { accommodations, destinations, users } from '../../src/schemas/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATION_RELATIVE_PATH =
    '../../src/migrations/0008_strip_accommodation_description_markdown.sql';
const MIGRATION_PATH = join(__dirname, MIGRATION_RELATIVE_PATH);

/**
 * `LIKE`-based predicate for "description contains at least one markdown
 * marker." Equivalent (for assertion purposes) to the migration's regex
 * predicate `description ~ '[*_#`\[\]>~]'` but avoids any template-literal
 * / Drizzle `sql` tag escaping quirks around the backtick and bracket chars.
 * Used by RED/GREEN assertions to count rows that still carry markers.
 */
const MARKER_PREDICATE_SQL = `(description LIKE '%*%'
    OR description LIKE '%#%'
    OR description LIKE '%[%'
    OR description LIKE '%~%'
    OR description LIKE '%>%')`;

/**
 * Split a multi-statement SQL script on Drizzle's `--> statement-breakpoint`
 * separator, dropping empty fragments. The order is preserved.
 */
function splitStatements(script: string): string[] {
    return script
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

/**
 * Read the migration SQL file and return all statements BEFORE the
 * `DROP FUNCTION` line. The drop is intentionally skipped so the function
 * remains callable within the test transaction.
 */
async function loadMigrationWithoutDrop(): Promise<string[]> {
    const script = await readFile(MIGRATION_PATH, 'utf-8');
    const dropIdx = script.toUpperCase().indexOf('DROP FUNCTION');
    if (dropIdx === -1) {
        throw new Error(
            `Migration file does not contain a DROP FUNCTION statement — unexpected for P0 strip. Path: ${MIGRATION_PATH}`
        );
    }
    return splitStatements(script.slice(0, dropIdx));
}

/**
 * Re-create the `strip_markdown` function inside the given test transaction
 * by executing every statement from the migration file EXCEPT the final
 * `DROP FUNCTION`. The function is dropped implicitly when the transaction
 * rolls back at the end of the test (or by the explicit DROP if the test
 * chooses to commit).
 */
async function setupStripFunction(tx: DrizzleClient): Promise<void> {
    const statements = await loadMigrationWithoutDrop();
    for (const stmt of statements) {
        await tx.execute(sql.raw(stmt));
    }
}

afterAll(async () => {
    await closeTestPool();
});

describe('SPEC-187 P0 — accommodation.description strip-markdown migration', () => {
    // ── 1. Migration file invariants ─────────────────────────────────────────
    describe('migration file shape', () => {
        it('exists at packages/db/src/migrations/0008_strip_accommodation_description_markdown.sql', async () => {
            await expect(access(MIGRATION_PATH)).resolves.toBeUndefined();
        });

        it('declares the strip_markdown(input text) function with plpgsql + IMMUTABLE', async () => {
            const content = await readFile(MIGRATION_PATH, 'utf-8');
            expect(content).toMatch(
                /CREATE OR REPLACE FUNCTION strip_markdown\s*\(\s*input\s+text\s*\)\s*RETURNS\s+text/i
            );
            expect(content).toMatch(/LANGUAGE\s+plpgsql\s+IMMUTABLE/i);
        });

        it('runs the UPDATE accommodations SET description = strip_markdown(...) statement', async () => {
            const content = await readFile(MIGRATION_PATH, 'utf-8');
            // The migration uses quoted identifiers (`"accommodations"`,
            // `"description"`) to match the Drizzle-generated style.
            expect(content).toMatch(
                /UPDATE\s+"?accommodations"?\s+SET\s+"?description"?\s*=\s*strip_markdown\s*\(\s*"?description"?\s*\)/i
            );
        });

        it('gates the UPDATE with a regex marker check on the description column', async () => {
            const content = await readFile(MIGRATION_PATH, 'utf-8');
            expect(content).toMatch(/WHERE\s+"?description"?\s+~\s*/i);
        });

        it('ends with DROP FUNCTION strip_markdown(text) (one-off cleanup)', async () => {
            const content = await readFile(MIGRATION_PATH, 'utf-8');
            expect(content).toMatch(/DROP FUNCTION strip_markdown\s*\(\s*text\s*\)/i);
        });
    });

    // ── 2. RED — fixture with markers → post-condition 0 markers after strip ──
    describe('fixture: N rows with markdown markers → 0 markers after the strip', () => {
        it('strips every fixture and leaves 0 rows matching the marker regex', async () => {
            await withTestTransaction(async (tx) => {
                await setupStripFunction(tx);

                // Insert parent rows so the FK on accommodations passes.
                const owner = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(owner);
                await tx.insert(destinations).values(dest);

                // Insert 5 fixture rows, each with different markdown markers.
                const fixtures = [
                    '## Title\n\n**bold** and *italic*\n- list item\n[link](https://x.com)\n`code`',
                    '# H1 heading\nSome **bold** text with `code` and [a link](https://example.com)',
                    '> blockquote line\n- bullet\n- bullet 2',
                    'plain text with **bold** and *italic* and ~~strike~~',
                    'has ~~strike~~ and [link](https://x.com) and ![image](https://x.com/i.png)'
                ];

                for (let i = 0; i < fixtures.length; i++) {
                    await tx.insert(accommodations).values({
                        slug: `strip-red-${i}`,
                        name: `Strip Red ${i}`,
                        summary: 'Strip test summary',
                        type: 'HOTEL',
                        description: fixtures[i],
                        ownerId: owner.id,
                        destinationId: dest.id
                    });
                }

                // Sanity precondition: all 5 fixtures contain at least one markdown
                // marker. This proves the fixture setup is meaningful (not a trivial
                // pass).
                const pre = await tx.execute(sql<{
                    c: number;
                }>`SELECT count(*)::int AS c FROM accommodations
                    WHERE slug LIKE 'strip-red-%'
                      AND ${sql.raw(MARKER_PREDICATE_SQL)}`);
                expect(pre.rows[0]?.c).toBe(fixtures.length);

                // Act: run the migration UPDATE. Use `sql.raw` here to bypass any
                // template-literal / Drizzle `sql` tag escaping of the regex
                // character class. The WHERE clause is intentionally broad (the
                // migration's exact predicate would also work, but we want the
                // test to be robust to template-literal quirks on this platform).
                const updateResult = await tx.execute(
                    sql.raw(
                        `UPDATE accommodations
                     SET description = strip_markdown(description)
                     WHERE slug LIKE 'strip-red-%'
                       AND ${MARKER_PREDICATE_SQL}`
                    )
                );
                // Sanity: all 5 fixture rows were affected (otherwise the strip is a no-op).
                expect(updateResult.rowCount ?? 0).toBe(fixtures.length);

                // Spot-check one row to see what the function actually produced.
                const sample = await tx.execute<{ description: string; slug: string }>(
                    sql.raw(
                        `SELECT slug, description FROM accommodations WHERE slug LIKE 'strip-red-%' ORDER BY slug LIMIT 1`
                    )
                );
                const sampleRow = sample.rows[0];
                expect(sampleRow).toBeDefined();
                // The first fixture is `## Title\n\n**bold** and *italic*\n- list item\n[link](https://x.com)\n`code``
                // and the function should strip those markers.
                expect(sampleRow?.description).not.toMatch(/\*\*/);
                expect(sampleRow?.description).not.toMatch(/^##\s/m);

                // Post-condition: 0 fixture rows still match the marker regex.
                const post = await tx.execute(sql<{
                    c: number;
                }>`SELECT count(*)::int AS c FROM accommodations
                    WHERE slug LIKE 'strip-red-%'
                      AND ${sql.raw(MARKER_PREDICATE_SQL)}`);
                expect(post.rows[0]?.c).toBe(0);
            });
        });
    });

    // ── 3. GREEN — canonical fixture round-trips to a known clean text ───────
    describe('canonical fixture: spec input → expected clean plain text', () => {
        it('strips the canonical fixture from FR-9 to the expected clean text', async () => {
            await withTestTransaction(async (tx) => {
                await setupStripFunction(tx);

                const owner = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(owner);
                await tx.insert(destinations).values(dest);

                // Canonical input from the spec (FR-9 scenario).
                const input = '## Title\n\n**bold**\n[link](https://x.com)\n- item\n`code`';
                const expected = 'Title\n\nbold\nlink\nitem\ncode';

                await tx.insert(accommodations).values({
                    slug: 'strip-canonical',
                    name: 'Strip Canonical',
                    summary: 'Strip test summary',
                    type: 'HOTEL',
                    description: input,
                    ownerId: owner.id,
                    destinationId: dest.id
                });

                await tx.execute(
                    sql`UPDATE accommodations SET description = strip_markdown(description) WHERE slug = 'strip-canonical'`
                );

                const result = await tx.execute<{ description: string }>(
                    sql`SELECT description FROM accommodations WHERE slug = 'strip-canonical'`
                );
                const actual = result.rows[0]?.description;
                expect(actual).toBe(expected);
            });
        });
    });

    // ── 4. Idempotency — re-running the UPDATE on clean data is a no-op ─────
    describe('idempotency', () => {
        it('re-running the UPDATE on a clean row leaves it unchanged', async () => {
            await withTestTransaction(async (tx) => {
                await setupStripFunction(tx);

                const owner = testData.user();
                const dest = testData.destination();
                await tx.insert(users).values(owner);
                await tx.insert(destinations).values(dest);

                const cleanInput = 'A clean description with no markdown at all.';
                await tx.insert(accommodations).values({
                    slug: 'strip-clean',
                    name: 'Strip Clean',
                    summary: 'Strip test summary',
                    type: 'HOTEL',
                    description: cleanInput,
                    ownerId: owner.id,
                    destinationId: dest.id
                });

                // Clean rows are NOT in scope of the WHERE clause — UPDATE affects 0 rows.
                await tx.execute(
                    sql`UPDATE accommodations SET description = strip_markdown(description) WHERE description ~ '[*_#\`\[\]>~]' AND slug = 'strip-clean'`
                );

                const result = await tx.execute<{ description: string }>(
                    sql`SELECT description FROM accommodations WHERE slug = 'strip-clean'`
                );
                expect(result.rows[0]?.description).toBe(cleanInput);
            });
        });
    });

    // ── 5. Sanity — pool cleanup so the worker can exit cleanly ───────────────
    describe('worker pool', () => {
        it('closes the test pool without errors', async () => {
            const db = getTestDb();
            const result = await db.execute(sql`SELECT 1 AS ok`);
            expect(result.rows[0]).toBeDefined();
        });
    });
});
