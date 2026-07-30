/**
 * Migration tests: HOS-296 `user_role` backfill shape (0069).
 *
 * The backfill in `0069_mushy_captain_america.sql` is hand-added SQL inside a
 * Drizzle-generated file, so nothing else in the pipeline type-checks it. These
 * tests read the file and pin the ONE invariant that a live database cannot be
 * asked about after the fact: which accounts receive the baseline `USER` hat.
 *
 * The SYSTEM exclusion is the point. `systemUser.seed.ts` grants the reserved
 * account exactly `{SYSTEM}`; a backfill that also gave it `USER` would leave a
 * migrated database at `{SYSTEM, USER}` and a fresh one at `{SYSTEM}`. That
 * divergence is not inert — `revokeRole` only refuses an account's LAST hat, so
 * `DELETE /admin/users/{SYSTEM_USER_ID}/roles/SYSTEM` would succeed on the
 * migrated environment and be refused on the fresh one.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../src/migrations/0069_mushy_captain_america.sql'
);

const rawSql = readFileSync(MIGRATION_PATH, 'utf8');

/**
 * Drops `--` comment lines.
 *
 * Mandatory here, not cosmetic: the backfill carries a long comment block that
 * quotes both `grant_reason` literals in prose, so matching against the raw
 * file finds the COMMENT rather than the statement.
 *
 * The `--> statement-breakpoint` markers are preserved — Drizzle uses them as
 * separators, and they are what the split below relies on.
 *
 * @param params.sql - Raw migration text.
 * @returns The same text with comment-only lines removed.
 */
const stripSqlComments = (params: { sql: string }): string =>
    params.sql
        .split('\n')
        .filter((line) => {
            const trimmed = line.trimStart();
            return !trimmed.startsWith('--') || trimmed.startsWith('--> statement-breakpoint');
        })
        .join('\n');

const migrationSql = stripSqlComments({ sql: rawSql });

/** Splits the migration into its individual statements. */
const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

/** The statement that grants the baseline `USER` hat. */
const baselineStatement = statements.find((statement) =>
    statement.includes("'migrated_baseline_user'")
);

/** The statement that copies the declared `users.role` scalar verbatim. */
const scalarCopyStatement = statements.find((statement) =>
    statement.includes("'migrated_from_users_role'")
);

describe('HOS-296 backfill (0069) — baseline USER grant', () => {
    it('exists as its own statement', () => {
        expect(baselineStatement).toBeDefined();
    });

    it('EXCLUDES the reserved SYSTEM account, so it converges with the seed at {SYSTEM}', () => {
        expect(baselineStatement).toContain('WHERE "role" <> \'SYSTEM\'::"role_enum"');
    });

    it('scopes the exclusion declaratively, without hard-coding the system user id', () => {
        expect(baselineStatement).not.toContain('a0000000-0000-4000-8000-000000000001');
    });

    it('stays idempotent on the (user_id, role) primary key', () => {
        expect(baselineStatement).toContain('ON CONFLICT ("user_id", "role") DO NOTHING');
    });
});

describe('HOS-296 backfill (0069) — declared scalar copy', () => {
    it('exists as its own statement', () => {
        expect(scalarCopyStatement).toBeDefined();
    });

    it('copies EVERY account, SYSTEM included — the reserved account keeps its own hat', () => {
        expect(scalarCopyStatement).not.toContain('WHERE');
    });

    it('stays idempotent on the (user_id, role) primary key', () => {
        expect(scalarCopyStatement).toContain('ON CONFLICT ("user_id", "role") DO NOTHING');
    });
});

describe('HOS-296 backfill (0069) — ordering', () => {
    it('runs both backfill statements BEFORE the users.role column is dropped', () => {
        const dropIndex = migrationSql.indexOf('ALTER TABLE "users" DROP COLUMN "role"');
        const baselineIndex = migrationSql.indexOf("'migrated_baseline_user'");
        const scalarIndex = migrationSql.indexOf("'migrated_from_users_role'");

        expect(dropIndex).toBeGreaterThan(-1);
        expect(scalarIndex).toBeGreaterThan(-1);
        expect(baselineIndex).toBeGreaterThan(-1);
        expect(dropIndex).toBeGreaterThan(scalarIndex);
        expect(dropIndex).toBeGreaterThan(baselineIndex);
    });
});
