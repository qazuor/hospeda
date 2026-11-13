/**
 * @fileoverview
 * PostgreSQL integration coverage for 0169's frozen predecessor chain,
 * operator-edited row protection, and idempotency.
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
import * as migration from '../../src/data-migrations/0169-hos-2113-chat-rules-no-quoted-spanish.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(HERE, '../../../../apps/api/.env.local') });

type Feature = (typeof migration.CHAT_FEATURES)[number];
interface Snapshot {
    readonly before: { readonly rules: Readonly<Record<Feature, string>> };
    readonly after: { readonly rules: Readonly<Record<Feature, string>> };
}
const readSnapshot = (file: string): Snapshot =>
    JSON.parse(
        readFileSync(path.resolve(HERE, '../../src/data-migrations', file), 'utf-8')
    ) as Snapshot;
const noQuoted = readSnapshot('0169-hos-2113-chat-rules-no-quoted-spanish.data.json');
const previous = readSnapshot('0165-hos-2102-chat-residual-rules.data.json');
const predecessors: Readonly<Record<Feature, string>> = {
    chat: previous.after.rules.chat,
    chat_venue: previous.after.rules.chat_venue,
    chat_experience: previous.after.rules.chat_experience
};
const PREFIX = 'zzz-test-hos2113-no-quoted-';

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

describe('HOS-2113: 0169 chat quoted-language rules (integration)', () => {
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

    it('applies the 0162/0164 predecessor chain and preserves operator-edited rules', async () => {
        await withRollback(async (tx) => {
            const [owner] = await tx
                .insert(users)
                .values({ email: `${PREFIX}${crypto.randomUUID()}@example.test` })
                .returning({ id: users.id });
            if (!owner) throw new Error('Failed to insert owner');
            const edited = 'Operator-edited rules must remain byte-for-byte unchanged.';
            for (const feature of migration.CHAT_FEATURES) {
                await tx.insert(aiPromptVersions).values({
                    feature,
                    version: 1,
                    content: `content-${feature}`,
                    rules: predecessors[feature],
                    createdBy: owner.id
                });
            }
            await tx.insert(aiPromptVersions).values({
                feature: 'chat',
                version: 2,
                content: 'operator content',
                rules: edited,
                createdBy: owner.id
            });

            const result = await migration.up(buildCtx(tx, owner.id));
            const rows = await tx
                .select({ feature: aiPromptVersions.feature, rules: aiPromptVersions.rules })
                .from(aiPromptVersions)
                .where(eq(aiPromptVersions.createdBy, owner.id));
            for (const feature of migration.CHAT_FEATURES) {
                expect(
                    rows.some(
                        (row) =>
                            row.feature === feature && row.rules === noQuoted.after.rules[feature]
                    )
                ).toBe(true);
            }
            expect(rows.some((row) => row.feature === 'chat' && row.rules === edited)).toBe(true);
            expect(result.counts.chat).toBeGreaterThanOrEqual(1);
            expect(result.counts.chat_venue).toBeGreaterThanOrEqual(1);
            expect(result.counts.chat_experience).toBeGreaterThanOrEqual(1);
        });
    });

    it('changes nothing when run a second time', async () => {
        await withRollback(async (tx) => {
            const [owner] = await tx
                .insert(users)
                .values({ email: `${PREFIX}${crypto.randomUUID()}@example.test` })
                .returning({ id: users.id });
            if (!owner) throw new Error('Failed to insert owner');
            for (const feature of migration.CHAT_FEATURES) {
                await tx.insert(aiPromptVersions).values({
                    feature,
                    version: 1,
                    content: `content-${feature}`,
                    rules: predecessors[feature],
                    createdBy: owner.id
                });
            }
            await migration.up(buildCtx(tx, owner.id));
            const before = await tx
                .select({ feature: aiPromptVersions.feature, rules: aiPromptVersions.rules })
                .from(aiPromptVersions)
                .where(eq(aiPromptVersions.createdBy, owner.id));

            const second = await migration.up(buildCtx(tx, owner.id));
            const after = await tx
                .select({ feature: aiPromptVersions.feature, rules: aiPromptVersions.rules })
                .from(aiPromptVersions)
                .where(eq(aiPromptVersions.createdBy, owner.id));
            expect(after).toEqual(before);
            expect(second.counts).toMatchObject({ chat: 0, chat_venue: 0, chat_experience: 0 });
        });
    });
});
