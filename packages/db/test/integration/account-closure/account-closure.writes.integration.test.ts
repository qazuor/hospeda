import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { accountClosureModel } from '../../../src/models/account-closure/account-closure.model.ts';
import {
    buildAccountEmailPseudonym,
    buildApplicationEmailPseudonym
} from '../../../src/models/account-closure/account-closure.pure.ts';
import { users } from '../../../src/schemas/user/user.dbschema.ts';
import { subscriptions } from '../../../src/schemas/vertical/subscription.dbschema.ts';
import type { DrizzleClient } from '../../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from '../helpers.ts';

afterAll(async () => closeTestPool());

async function rows(tx: DrizzleClient, query: ReturnType<typeof sql>) {
    const result = await tx.execute(query);
    return result.rows;
}

async function seedJuan(tx: DrizzleClient) {
    const suffix = crypto.randomUUID();
    const juan = testData.user({
        email: `juan.perez-${suffix}@example.com`,
        displayName: 'Juan Pérez',
        firstName: 'Juan',
        lastName: 'Pérez',
        slug: `juan-perez-${suffix.slice(0, 8)}`,
        contactInfo: {
            mobilePhone: '+5493442111111',
            whatsapp: '+5493442222222',
            personalEmail: `juan.personal-${suffix}@example.com`,
            website: 'https://juan.example.com'
        }
    });
    const admin = testData.user();
    const other = testData.user();
    await tx.insert(users).values([juan, admin, other]);

    await tx.execute(sql`INSERT INTO account (id, account_id, provider_id, user_id, password)
        VALUES (${crypto.randomUUID()}, ${juan.id}, 'credential', ${juan.id}, 'hash')`);
    await tx.execute(sql`INSERT INTO account (id, account_id, provider_id, user_id)
        VALUES (${crypto.randomUUID()}, ${`google-${suffix}`}, 'google', ${juan.id})`);
    for (let index = 0; index < 2; index += 1) {
        await tx.execute(sql`INSERT INTO session (id, expires_at, token, user_id)
            VALUES (${crypto.randomUUID()}, now() + interval '1 day', ${crypto.randomUUID()}, ${juan.id})`);
    }
    const verificationId = crypto.randomUUID();
    await tx.execute(sql`INSERT INTO verification (id, identifier, value, expires_at)
        VALUES (${verificationId}, ${`reset-password:${suffix}`}, ${juan.id}, now() + interval '1 hour')`);

    const upperEmail = juan.email.toUpperCase();
    const pending = await rows(
        tx,
        sql`INSERT INTO partner_application (email, status) VALUES (${upperEmail}, 'PENDING')
            RETURNING id, status, resolved_at`
    );
    const rejected = await rows(
        tx,
        sql`INSERT INTO partner_application (email, status, resolved_at)
            VALUES (${upperEmail}, 'REJECTED', now() - interval '400 days')
            RETURNING id, status, resolved_at`
    );

    const foreignBookmark = await rows(
        tx,
        sql`INSERT INTO user_bookmarks (user_id, entity_id, entity_type)
            VALUES (${other.id}, ${juan.id}, 'USER') RETURNING id`
    );
    const ownBookmark = await rows(
        tx,
        sql`INSERT INTO user_bookmarks (user_id, entity_id, entity_type)
            VALUES (${juan.id}, ${other.id}, 'USER') RETURNING id`
    );

    const pseudonym = crypto.randomUUID().replaceAll('-', '').padEnd(64, '0').slice(0, 64);
    await tx.execute(sql`INSERT INTO trial (user_id, vertical, status, email_pseudonym)
        VALUES (${juan.id}, 'accommodation', 'TRIAL_CONVERTED', ${pseudonym})`);

    const subscription = await rows(
        tx,
        sql`INSERT INTO subscription (status, class) VALUES ('CANCELLED', 'LAPIDA') RETURNING id`
    );
    const manual = await rows(
        tx,
        sql`INSERT INTO manual_payment (subscription_id, period_start, status)
            VALUES (${subscription[0]?.id}, now(), 'AWAITING') RETURNING id`
    );
    const receiptNumber = 1_000_000_000 + Math.floor(Math.random() * 1_000_000_000);
    const receipt = await rows(
        tx,
        sql`INSERT INTO receipt (manual_payment_id, receipt_number, payer_name, payer_email)
            VALUES (${manual[0]?.id}, ${receiptNumber}, 'Juan Pérez', ${juan.email}) RETURNING id`
    );

    return {
        juan,
        admin,
        other,
        verificationId,
        pendingId: String(pending[0]?.id),
        rejectedId: String(rejected[0]?.id),
        rejectedResolvedAt: rejected[0]?.resolved_at,
        foreignBookmarkId: String(foreignBookmark[0]?.id),
        ownBookmarkId: String(ownBookmark[0]?.id),
        receiptId: String(receipt[0]?.id)
    };
}

async function snapshot(tx: DrizzleClient, juanId: string, receiptId: string) {
    const trial = await rows(
        tx,
        sql`SELECT id, user_id, vertical, status, email_pseudonym, started_at, ends_at, updated_at
            FROM trial WHERE user_id = ${juanId}`
    );
    const receipt = await rows(
        tx,
        sql`SELECT id, manual_payment_id, receipt_number, payer_name, payer_email
            FROM receipt WHERE id = ${receiptId}`
    );
    return { trial, receipt };
}

describe('TEST:V8a:13 the account closure writes (model)', () => {
    it('TEST:1730:7 clears declared payer emails only for the closed account', async () => {
        await withTestTransaction(async (tx) => {
            const seed = await seedJuan(tx);
            const [owned] = await tx
                .insert(subscriptions)
                .values({
                    userId: seed.juan.id,
                    status: 'CANCELLED',
                    class: 'LAPIDA',
                    declaredPayerEmail: 'juan-declared@example.test'
                })
                .returning();
            const [other] = await tx
                .insert(subscriptions)
                .values({
                    userId: seed.other.id,
                    status: 'CANCELLED',
                    class: 'LAPIDA',
                    declaredPayerEmail: 'other-declared@example.test'
                })
                .returning();
            if (!owned || !other) throw new Error('Expected subscription rows');
            await accountClosureModel.closeAccount({
                tx,
                userId: seed.juan.id,
                actorId: seed.admin.id,
                at: new Date('2026-10-12T12:00:00.000Z')
            });
            const result = await tx
                .select({ id: subscriptions.id, email: subscriptions.declaredPayerEmail })
                .from(subscriptions);
            expect(result.find((row) => row.id === owned.id)?.email).toBeNull();
            expect(result.find((row) => row.id === other.id)?.email).toBe(
                'other-declared@example.test'
            );
        });
    });

    it('pseudonymises the account, drops credentials and sessions, and leaves trial and receipt as they were', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seed = await seedJuan(tx);
            const before = await snapshot(tx, seed.juan.id, seed.receiptId);
            const at = new Date('2026-10-12T12:00:00.000Z');

            // Act
            const locked = await accountClosureModel.lockAccount({ tx, userId: seed.juan.id });
            const result = await accountClosureModel.closeAccount({
                tx,
                userId: seed.juan.id,
                actorId: seed.admin.id,
                at
            });

            // Assert
            expect(locked).toEqual({
                id: seed.juan.id,
                email: seed.juan.email,
                displayName: 'Juan Pérez',
                firstName: 'Juan',
                lastName: 'Pérez',
                deletedAt: null,
                isSystemAccount: false
            });
            expect({
                ...result,
                replacedApplicationIds: [...result.replacedApplicationIds].sort()
            }).toEqual({
                replacedApplicationIds: [seed.pendingId, seed.rejectedId].sort(),
                deletedAccounts: 2,
                deletedSessions: 2,
                deletedVerifications: 1
            });

            const [user] = await rows(
                tx,
                sql`SELECT email, display_name, first_name, last_name, slug, contact_info,
                    deleted_at, deleted_by_id, updated_by_id FROM users WHERE id = ${seed.juan.id}`
            );
            expect(user).toBeDefined();
            const slug = String(user?.slug);
            expect(slug).toMatch(/^user-[0-9a-f]{8}$/);
            expect(slug).not.toBe(seed.juan.slug);
            expect(slug).not.toContain('juan');
            expect({
                ...user,
                slug: 'checked',
                deleted_at: new Date(String(user?.deleted_at))
            }).toEqual({
                email: buildAccountEmailPseudonym({ userId: seed.juan.id }).email,
                display_name: 'deleted-user',
                first_name: null,
                last_name: null,
                slug: 'checked',
                contact_info: {
                    homePhone: null,
                    workPhone: null,
                    mobilePhone: null,
                    whatsapp: null,
                    personalEmail: null,
                    workEmail: null,
                    website: 'https://juan.example.com'
                },
                deleted_at: at,
                deleted_by_id: seed.admin.id,
                updated_by_id: seed.admin.id
            });

            const counts = await rows(
                tx,
                sql`SELECT
                    (SELECT count(*)::int FROM account WHERE user_id = ${seed.juan.id}) AS accounts,
                    (SELECT count(*)::int FROM session WHERE user_id = ${seed.juan.id}) AS sessions,
                    (SELECT count(*)::int FROM verification WHERE id = ${seed.verificationId}) AS verifications,
                    (SELECT count(*)::int FROM user_bookmarks WHERE id = ${seed.foreignBookmarkId}) AS foreign_bookmarks,
                    (SELECT count(*)::int FROM user_bookmarks WHERE id = ${seed.ownBookmarkId}) AS own_bookmarks`
            );
            expect(counts[0]).toEqual({
                accounts: 0,
                sessions: 0,
                verifications: 0,
                foreign_bookmarks: 0,
                own_bookmarks: 1
            });

            const applications = await rows(
                tx,
                sql`SELECT id, email, status, resolved_at FROM partner_application
                    WHERE id IN (${seed.pendingId}, ${seed.rejectedId}) ORDER BY status`
            );
            expect(applications).toEqual([
                {
                    id: seed.pendingId,
                    email: buildApplicationEmailPseudonym({ applicationId: seed.pendingId }).email,
                    status: 'PENDING',
                    resolved_at: null
                },
                {
                    id: seed.rejectedId,
                    email: buildApplicationEmailPseudonym({ applicationId: seed.rejectedId }).email,
                    status: 'REJECTED',
                    resolved_at: seed.rejectedResolvedAt
                }
            ]);

            const after = await snapshot(tx, seed.juan.id, seed.receiptId);
            expect(after).toEqual(before);
            expect(after.receipt).toHaveLength(1);
            expect(after.receipt[0]?.payer_name).toBe('Juan Pérez');
            expect(after.receipt[0]?.payer_email).toBe(seed.juan.email);
            expect(after.trial).toHaveLength(1);
        });
    });

    it('refuses to write over an account that is already closed', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const seed = await seedJuan(tx);
            const at = new Date('2026-10-12T12:00:00.000Z');
            await accountClosureModel.closeAccount({
                tx,
                userId: seed.juan.id,
                actorId: seed.admin.id,
                at
            });

            // Act / Assert
            await expect(
                accountClosureModel.closeAccount({
                    tx,
                    userId: seed.juan.id,
                    actorId: seed.admin.id,
                    at
                })
            ).rejects.toMatchObject({ name: 'AccountClosureWriteError', userId: seed.juan.id });
        });
    });
});
