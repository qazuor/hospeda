/**
 * @fileoverview
 * PostgreSQL integration coverage for 0178: a row holding the exact old
 * default is rewritten, an operator-edited row is left byte-for-byte, and a
 * second run changes nothing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { aiPromptVersions, eq, getDb, initializeDb, resetDb, users } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0178-hos-2250-accommodation-import-prompt-keys.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(HERE, '../../../../apps/api/.env.local') });

const frozen = JSON.parse(
    readFileSync(
        path.resolve(
            HERE,
            '../../src/data-migrations/0178-hos-2250-accommodation-import-prompt-keys.data.json'
        ),
        'utf-8'
    )
) as { before: { content: string }; after: { content: string } };
const PREFIX = 'zzz-test-hos2250-import-prompt-';
const EDITED = 'Operator-edited import prompt: must remain byte-for-byte unchanged.';

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

/** Builds the migration context for the transaction. */
function buildCtx(tx: DrizzleClient, actorId: string): SeedMigrationCtx {
    const actor: Actor = { id: actorId, roles: [RoleEnum.SUPER_ADMIN], permissions: [] };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

/** Inserts an owner plus one old-default row (v1) and one operator-edited row (v2). */
async function seedRows(tx: DrizzleClient): Promise<string> {
    const [owner] = await tx
        .insert(users)
        .values({ email: `${PREFIX}${crypto.randomUUID()}@example.test` })
        .returning({ id: users.id });
    if (!owner) throw new Error('Failed to insert owner');
    await tx.insert(aiPromptVersions).values([
        {
            feature: migration.FEATURE,
            version: 1,
            content: frozen.before.content,
            rules: 'rules',
            createdBy: owner.id
        },
        {
            feature: migration.FEATURE,
            version: 2,
            content: EDITED,
            rules: 'rules',
            createdBy: owner.id
        }
    ]);
    return owner.id;
}

const ownRows = (tx: DrizzleClient, ownerId: string) =>
    tx
        .select({ version: aiPromptVersions.version, content: aiPromptVersions.content })
        .from(aiPromptVersions)
        .where(eq(aiPromptVersions.createdBy, ownerId));

describe('HOS-2250: 0178 accommodation_import prompt keys (integration)', () => {
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

    it('rewrites the old-default row and keeps the operator-edited one', async () => {
        await withRollback(async (tx) => {
            const ownerId = await seedRows(tx);

            const result = await migration.up(buildCtx(tx, ownerId));
            const rows = await ownRows(tx, ownerId);

            expect(rows.find((r) => r.version === 1)?.content).toBe(frozen.after.content);
            expect(rows.find((r) => r.version === 2)?.content).toBe(EDITED);
            expect(result.counts.updated).toBeGreaterThanOrEqual(1);
            expect(result.counts.operatorEdited).toBeGreaterThanOrEqual(1);
        });
    });

    it('changes nothing when run a second time', async () => {
        await withRollback(async (tx) => {
            const ownerId = await seedRows(tx);
            await migration.up(buildCtx(tx, ownerId));
            const first = await ownRows(tx, ownerId);

            const second = await migration.up(buildCtx(tx, ownerId));
            const after = await ownRows(tx, ownerId);

            expect(after).toEqual(first);
            expect(second.counts.updated).toBe(0);
        });
    });
});
