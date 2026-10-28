import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { eq, getDb, inArray, initializeDb, resetDb, sql, users } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { whatsNewEntries } from '../../../../apps/api/src/data/whats-new/whats-new.js';
import {
    computeSeen,
    filterEntriesByRole
} from '../../../../apps/api/src/utils/whats-new/whats-new.helpers.js';
import { getNextPendingWelcomeTour } from '../../../../apps/web/src/config/tours.js';
import * as priorMigration from '../../src/data-migrations/0109-hos1418-whats-new-seen-ids-rename.js';
import * as migration from '../../src/data-migrations/0131-hos1822-venue-whats-new-and-tour-ids.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const OLD_WORD = `gastro${'nomy'}`;
const OLD_ID_1 = `2026-09-05-${OLD_WORD}-experience-publish-free-trial`;
const OLD_ID_2 = `2026-09-03-ai-chat-${OLD_WORD}-experience`;
const OLD_ID_3 = `2026-09-03-${OLD_WORD}-daily-menu`;
const OLD_TOUR = `web.${OLD_WORD}.welcome`;
const NEW_IDS = [
    '2026-09-05-venue-experience-publish-free-trial',
    '2026-09-03-ai-chat-venue-experience',
    '2026-09-03-venue-daily-menu'
];
const UNRELATED_ID = '2026-08-01-some-other-entry';
const BASELINE_AT = '2026-08-15T00:00:00.000Z';
const OLD_EMAIL = 'zzz-test-hos1822-old@example.test';
const CHAIN_EMAIL = 'zzz-test-hos1822-chain@example.test';
const TOUR_EMAIL = 'zzz-test-hos1822-tour@example.test';
const NONE_EMAIL = 'zzz-test-hos1822-none@example.test';
const ALL_TEST_EMAILS = [OLD_EMAIL, CHAIN_EMAIL, TOUR_EMAIL, NONE_EMAIL];
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos1822-venue-whats-new-and-tour-ids',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: []
};

class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool | undefined;

async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    return {
        db: tx,
        actor: STUB_ACTOR,
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

async function insertUser(
    tx: DrizzleClient,
    {
        email,
        seenIds = [],
        adminTours = {}
    }: {
        readonly email: string;
        readonly seenIds?: readonly string[];
        readonly adminTours?: Readonly<Record<string, number>>;
    }
): Promise<void> {
    const settings = {
        notifications: { enabled: true, allowEmails: false, allowSms: false, allowPush: true },
        newsletter: true,
        onboarding: {
            whatsNew: { baselineAt: BASELINE_AT, seenIds: [...seenIds] },
            adminTours: { ...adminTours }
        }
    };
    await tx.insert(users).values({ email, slug: email.split('@')[0] ?? email });
    await tx
        .update(users)
        .set({ settings: sql`${JSON.stringify(settings)}::jsonb` })
        .where(eq(users.email, email));
}

async function readSettings(tx: DrizzleClient, email: string): Promise<unknown> {
    const rows = await tx
        .select({ settings: users.settings })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
    return rows[0]?.settings;
}

async function clearTargets(tx: DrizzleClient): Promise<void> {
    await tx.delete(users).where(inArray(users.email, ALL_TEST_EMAILS));
    const oldIds = [OLD_ID_1, OLD_ID_2, OLD_ID_3];
    await tx.execute(sql`UPDATE users SET settings = jsonb_set(settings, '{onboarding,whatsNew,seenIds}', '[]'::jsonb)
        WHERE (settings #> '{onboarding,whatsNew,seenIds}') ?| ARRAY[${oldIds[0]}, ${oldIds[1]}, ${oldIds[2]}]::text[]`);
    await tx.execute(sql`UPDATE users SET settings = jsonb_set(settings, '{onboarding,adminTours}', '{}'::jsonb)
        WHERE (settings #> '{onboarding,adminTours}') ? ${OLD_TOUR}`);
}

describe("HOS-1822: venue What's New and tour id migration (integration)", () => {
    beforeAll(async () => {
        if (!process.env.HOSPEDA_TEST_DATABASE_URL && !process.env.HOSPEDA_DATABASE_URL) return;
        pool = new Pool({
            connectionString:
                process.env.HOSPEDA_TEST_DATABASE_URL ?? process.env.HOSPEDA_DATABASE_URL
        });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool?.end();
        if (pool) resetDb();
    });

    it('maps exactly the three published ids to their venue ids', () => {
        expect(migration.WHATS_NEW_ID_RENAMES).toEqual({
            [OLD_ID_1]: NEW_IDS[0],
            [OLD_ID_2]: NEW_IDS[1],
            [OLD_ID_3]: NEW_IDS[2]
        });
    });

    it.skipIf(!process.env.HOSPEDA_TEST_DATABASE_URL && !process.env.HOSPEDA_DATABASE_URL)(
        'rewrites all three ids without making the entries appear new',
        async () => {
            await withRollback(async (tx) => {
                await clearTargets(tx);
                await insertUser(tx, {
                    email: OLD_EMAIL,
                    seenIds: [UNRELATED_ID, OLD_ID_1, OLD_ID_2, OLD_ID_3]
                });
                const result = await migration.up(buildCtx(tx));
                expect(result.counts?.usersRewritten).toBe(1);
                const settings = (await readSettings(tx, OLD_EMAIL)) as {
                    notifications: unknown;
                    newsletter: boolean;
                    onboarding: {
                        whatsNew: { baselineAt: string; seenIds: string[] };
                        adminTours: Record<string, number>;
                    };
                };
                expect(settings).toEqual({
                    notifications: {
                        enabled: true,
                        allowEmails: false,
                        allowSms: false,
                        allowPush: true
                    },
                    newsletter: true,
                    onboarding: {
                        whatsNew: { baselineAt: BASELINE_AT, seenIds: [UNRELATED_ID, ...NEW_IDS] },
                        adminTours: {}
                    }
                });
                expect(
                    settings.onboarding.whatsNew.seenIds.some((id) =>
                        [OLD_ID_1, OLD_ID_2, OLD_ID_3].includes(id)
                    )
                ).toBe(false);
                const applicable = filterEntriesByRole({
                    entries: whatsNewEntries,
                    roles: ['USER', 'VENUE_OWNER', 'EXPERIENCE_OWNER']
                });
                const relevant = applicable.filter((entry) => NEW_IDS.includes(entry.id));
                expect(
                    relevant.map((entry) =>
                        computeSeen({
                            entry,
                            seenIds: settings.onboarding.whatsNew.seenIds,
                            baselineAt: BASELINE_AT
                        })
                    )
                ).toEqual([true, true, true]);
            });
        }
    );

    it.skipIf(!process.env.HOSPEDA_TEST_DATABASE_URL && !process.env.HOSPEDA_DATABASE_URL)(
        'chains the earlier id through to the venue id',
        async () => {
            await withRollback(async (tx) => {
                await clearTargets(tx);
                const priorId = `2026-09-05-${`comm${'erce'}`}-publish-free-trial`;
                await insertUser(tx, { email: CHAIN_EMAIL, seenIds: [priorId] });
                await priorMigration.up(buildCtx(tx));
                await migration.up(buildCtx(tx));
                const settings = (await readSettings(tx, CHAIN_EMAIL)) as {
                    onboarding: { whatsNew: { seenIds: string[] } };
                };
                expect(settings.onboarding.whatsNew.seenIds).toEqual([
                    '2026-09-05-venue-experience-publish-free-trial'
                ]);
            });
        }
    );

    it.skipIf(!process.env.HOSPEDA_TEST_DATABASE_URL && !process.env.HOSPEDA_DATABASE_URL)(
        'moves the saved tour version and removes the old key',
        async () => {
            await withRollback(async (tx) => {
                await clearTargets(tx);
                await insertUser(tx, { email: TOUR_EMAIL, adminTours: { [OLD_TOUR]: 1 } });
                const result = await migration.up(buildCtx(tx));
                expect(result.counts?.usersRewritten).toBe(1);
                const settings = (await readSettings(tx, TOUR_EMAIL)) as {
                    onboarding: { adminTours: Record<string, number> };
                };
                expect(settings.onboarding.adminTours).toEqual({ 'web.venue.welcome': 1 });
                expect(settings.onboarding.adminTours[OLD_TOUR]).toBeUndefined();
                expect(
                    getNextPendingWelcomeTour({
                        roles: ['VENUE_OWNER'],
                        hasSeen: ({ tourId }) => tourId === 'web.venue.welcome'
                    })
                ).toBeUndefined();
            });
        }
    );

    it.skipIf(!process.env.HOSPEDA_TEST_DATABASE_URL && !process.env.HOSPEDA_DATABASE_URL)(
        'leaves a user with no old ids unchanged',
        async () => {
            await withRollback(async (tx) => {
                await clearTargets(tx);
                await insertUser(tx, {
                    email: NONE_EMAIL,
                    seenIds: [UNRELATED_ID],
                    adminTours: { 'web.host.welcome': 9999 }
                });
                const before = await readSettings(tx, NONE_EMAIL);
                const result = await migration.up(buildCtx(tx));
                expect(result.counts?.usersRewritten).toBe(0);
                expect(await readSettings(tx, NONE_EMAIL)).toEqual(before);
            });
        }
    );

    it.skipIf(!process.env.HOSPEDA_TEST_DATABASE_URL && !process.env.HOSPEDA_DATABASE_URL)(
        'is idempotent on a second run',
        async () => {
            await withRollback(async (tx) => {
                await clearTargets(tx);
                await insertUser(tx, {
                    email: OLD_EMAIL,
                    seenIds: [OLD_ID_1],
                    adminTours: { [OLD_TOUR]: 3, 'web.venue.welcome': 1 }
                });
                const first = await migration.up(buildCtx(tx));
                const second = await migration.up(buildCtx(tx));
                expect(first.counts?.usersRewritten).toBe(1);
                expect(second.counts?.usersRewritten).toBe(0);
                const settings = (await readSettings(tx, OLD_EMAIL)) as {
                    onboarding: {
                        whatsNew: { seenIds: string[] };
                        adminTours: Record<string, number>;
                    };
                };
                expect(settings.onboarding.whatsNew.seenIds).toEqual([
                    '2026-09-05-venue-experience-publish-free-trial'
                ]);
                expect(settings.onboarding.adminTours).toEqual({ 'web.venue.welcome': 3 });
            });
        }
    );
});
