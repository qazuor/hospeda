/**
 * Migration tests: HOS-919 provider trade categories (0229), EXPAND step.
 *
 * This release only ADDS the catalog (tables, join, `category_slugs`) and
 * relaxes `host_trades.category` to nullable. Everything that removes the
 * legacy single category (the columns, their indexes, the pg enum) ships one
 * release later, after this one is live (HOS-433 / docs/guides/migrations.md
 * "Deploy order"). Dropping early 500s the still-running old container.
 *
 * The file is Drizzle-generated, so these tests pin the two things a reviewer
 * is most likely to miss: nothing is dropped, and the restrict/cascade rules
 * of the join survived generation.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../src/migrations/0229_hos919_provider_trade_categories.sql'
);

/** Statements only: `--` comment lines are dropped so prose cannot trip a regex. */
const sql = readFileSync(MIGRATION_PATH, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

describe('0229 provider trade categories migration (expand only)', () => {
    it('drops no table, column, index, constraint or type', () => {
        const destructive = sql.match(
            /DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|TYPE)|ALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN/gi
        );
        expect(destructive).toBeNull();
    });

    it('only relaxes host_trades.category (DROP NOT NULL), never touches its type or indexes', () => {
        expect(sql).toContain('ALTER TABLE "host_trades" ALTER COLUMN "category" DROP NOT NULL');
        expect(sql).not.toMatch(/"hostTrades_(destinationId_)?category_idx"/);
        expect(sql).not.toMatch(/host_trade_category_enum/);
    });

    it('adds alliance_leads.category_slugs as a nullable text[]', () => {
        expect(sql).toContain('ALTER TABLE "alliance_leads" ADD COLUMN "category_slugs" text[];');
    });

    it('creates the three catalog tables', () => {
        for (const table of [
            'host_trade_category_groups',
            'host_trade_categories',
            'r_host_trade_category'
        ]) {
            expect(sql).toContain(`CREATE TABLE "${table}"`);
        }
    });

    it('keeps the delete rules: category RESTRICT, host trade CASCADE, group RESTRICT', () => {
        expect(sql).toMatch(
            /"r_host_trade_category_category_id_host_trade_categories_id_fk"[^;]*ON DELETE restrict/
        );
        expect(sql).toMatch(
            /"r_host_trade_category_host_trade_id_host_trades_id_fk"[^;]*ON DELETE cascade/
        );
        expect(sql).toMatch(
            /"host_trade_categories_group_id_host_trade_category_groups_id_fk"[^;]*ON DELETE restrict/
        );
    });

    it('adds the five hostTradeCategory permission labels to permission_enum', () => {
        for (const action of ['view', 'create', 'update', 'delete', 'restore']) {
            expect(sql).toContain(
                `ALTER TYPE "public"."permission_enum" ADD VALUE 'hostTradeCategory.${action}'`
            );
        }
    });
});
