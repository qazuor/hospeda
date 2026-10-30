import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { accountClosureModel } from '../../../src/models/account-closure/account-closure.model.ts';
import { buildApplicationEmailPseudonym } from '../../../src/models/account-closure/account-closure.pure.ts';
import { users } from '../../../src/schemas/user/user.dbschema.ts';
import { closeTestPool, testData, withTestTransaction } from '../helpers.ts';

afterAll(async () => closeTestPool());

describe('TEST:V8a:14 the application email replacement (model)', () => {
    it('replaces only the mailbox of the application, keeping status and resolution', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const email = `applicant-${crypto.randomUUID()}@example.com`;
            const inserted = await tx.execute(sql`
                INSERT INTO partner_application (email, status, resolved_at)
                VALUES (${email}, 'REJECTED', '2025-01-02T03:04:05.000Z')
                RETURNING id, created_at`);
            const applicationId = String(inserted.rows[0]?.id);
            const at = new Date('2026-10-12T12:00:00.000Z');

            // Act
            const locked = await accountClosureModel.lockApplication({ tx, applicationId });
            const result = await accountClosureModel.replaceApplicationEmail({
                tx,
                applicationId,
                at
            });

            // Assert
            expect(locked).toEqual({
                id: applicationId,
                email,
                status: 'REJECTED',
                createdAt: new Date(String(inserted.rows[0]?.created_at))
            });
            expect(result).toEqual({ replaced: true });
            const after = await tx.execute(sql`
                SELECT email, status, resolved_at, partner_id, wait_cancelled_at
                FROM partner_application WHERE id = ${applicationId}`);
            const row = after.rows[0];
            expect({ ...row, resolved_at: new Date(String(row?.resolved_at)) }).toEqual({
                email: buildApplicationEmailPseudonym({ applicationId }).email,
                status: 'REJECTED',
                resolved_at: new Date('2025-01-02T03:04:05.000Z'),
                partner_id: null,
                wait_cancelled_at: null
            });
        });
    });

    it('an unknown application is neither locked nor replaced', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const applicationId = crypto.randomUUID();

            // Act / Assert
            expect(await accountClosureModel.lockApplication({ tx, applicationId })).toBeNull();
            expect(
                await accountClosureModel.replaceApplicationEmail({
                    tx,
                    applicationId,
                    at: new Date()
                })
            ).toEqual({ replaced: false });
        });
    });

    it('finds a live account by mailbox in another case, and never a closed one', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const live = testData.user({ email: `live-${crypto.randomUUID()}@example.com` });
            const closed = testData.user({
                email: `closed-${crypto.randomUUID()}@example.com`,
                deletedAt: new Date('2026-10-01T00:00:00.000Z')
            });
            await tx.insert(users).values([live, closed]);

            // Act
            const found = await accountClosureModel.findLiveAccountIdByEmail({
                tx,
                email: live.email.toUpperCase()
            });
            const notFound = await accountClosureModel.findLiveAccountIdByEmail({
                tx,
                email: closed.email
            });

            // Assert
            expect(found).toBe(live.id);
            expect(notFound).toBeNull();
        });
    });
});
