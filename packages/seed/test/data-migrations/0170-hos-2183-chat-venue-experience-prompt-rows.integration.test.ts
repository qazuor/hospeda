/**
 * @fileoverview
 * PostgreSQL integration coverage for 0170: empty table, only `chat` present, both already
 * present (operator-edited rows untouched) and idempotency. Each case rolls back.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { aiPromptVersions, getDb, inArray, initializeDb, resetDb, users } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0170-hos-2183-chat-venue-experience-prompt-rows.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(HERE, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos2183-';
const EXPECTED_RULES_MD5 = {
    chat_venue: 'd08776600cc009698869a31982d60b4b',
    chat_experience: '5f41dcc1ee6ba7d6fda5e9c602b61e4b'
} as const;
const md5 = (text: string | null) =>
    createHash('md5')
        .update(text ?? '')
        .digest('hex');

class RollbackSignal extends Error {}
let pool: Pool;

/** Runs a callback in a transaction that always rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

function buildCtx(tx: DrizzleClient, actorId: string): SeedMigrationCtx {
    const actor: Actor = { id: actorId, roles: [RoleEnum.SUPER_ADMIN], permissions: [] };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

async function createOwner(tx: DrizzleClient): Promise<string> {
    const [owner] = await tx
        .insert(users)
        .values({ email: `${PREFIX}${crypto.randomUUID()}@example.test` })
        .returning({ id: users.id });
    if (!owner) throw new Error('Failed to insert owner');
    return owner.id;
}

/** Rows of the two target features. */
async function targetRows(tx: DrizzleClient) {
    return tx
        .select({
            feature: aiPromptVersions.feature,
            version: aiPromptVersions.version,
            rules: aiPromptVersions.rules,
            isActive: aiPromptVersions.isActive,
            createdBy: aiPromptVersions.createdBy
        })
        .from(aiPromptVersions)
        .where(inArray(aiPromptVersions.feature, [...migration.MISSING_FEATURES]));
}

/** The shared test database may hold seeded rows, so each case starts by clearing the targets. */
async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx
        .delete(aiPromptVersions)
        .where(inArray(aiPromptVersions.feature, [...migration.MISSING_FEATURES]));
}

describe('HOS-2183: 0170 chat_venue/chat_experience prompt rows (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL)
            throw new Error('HOSPEDA_DATABASE_URL is not set in this worktree');
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('on an empty table inserts both active v1 rows with the staging rules hash', async () => {
        await withRollback(async (tx) => {
            const ownerId = await createOwner(tx);
            await clearTargets(tx);

            const result = await migration.up(buildCtx(tx, ownerId));

            const rows = await targetRows(tx);
            expect(rows).toHaveLength(2);
            for (const feature of migration.MISSING_FEATURES) {
                const row = rows.find((r) => r.feature === feature);
                expect(row).toMatchObject({ version: 1, isActive: true, createdBy: ownerId });
                expect(md5(row?.rules ?? null)).toBe(EXPECTED_RULES_MD5[feature]);
            }
            expect(result.counts).toEqual({ chat_venue: 1, chat_experience: 1 });
        });
    });

    it('with only `chat` present inserts the other two and leaves `chat` alone', async () => {
        await withRollback(async (tx) => {
            const ownerId = await createOwner(tx);
            await clearTargets(tx);
            const [chat] = await tx
                .insert(aiPromptVersions)
                .values({
                    feature: 'chat',
                    version: 99,
                    content: 'chat content',
                    rules: 'chat rules',
                    isActive: false,
                    createdBy: ownerId
                })
                .returning();
            if (!chat) throw new Error('Failed to insert chat row');

            await migration.up(buildCtx(tx, ownerId));

            expect(await targetRows(tx)).toHaveLength(2);
            const [chatAfter] = await tx
                .select()
                .from(aiPromptVersions)
                .where(inArray(aiPromptVersions.id, [chat.id]));
            expect(chatAfter).toEqual(chat);
        });
    });

    it('with both rows already present changes nothing, even if operator-edited', async () => {
        await withRollback(async (tx) => {
            const ownerId = await createOwner(tx);
            await clearTargets(tx);
            for (const feature of migration.MISSING_FEATURES) {
                await tx.insert(aiPromptVersions).values({
                    feature,
                    version: 1,
                    content: `operator content ${feature}`,
                    rules: `operator rules ${feature}`,
                    isActive: true,
                    createdBy: ownerId
                });
            }
            const before = await targetRows(tx);

            const result = await migration.up(buildCtx(tx, ownerId));

            expect(await targetRows(tx)).toEqual(before);
            expect(result.counts).toEqual({ chat_venue: 0, chat_experience: 0 });
        });
    });

    it('is idempotent: a second run inserts nothing', async () => {
        await withRollback(async (tx) => {
            const ownerId = await createOwner(tx);
            await clearTargets(tx);
            await migration.up(buildCtx(tx, ownerId));
            const before = await targetRows(tx);

            const second = await migration.up(buildCtx(tx, ownerId));

            expect(await targetRows(tx)).toEqual(before);
            expect(second.counts).toEqual({ chat_venue: 0, chat_experience: 0 });
        });
    });
});
