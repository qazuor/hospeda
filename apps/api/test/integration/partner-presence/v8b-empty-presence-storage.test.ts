import { randomUUID } from 'node:crypto';
import { domainEventModel, eq, getDb, partners, sql } from '@repo/db';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { createdPartnerIds, createdUserIds } from './partner-presence.helpers';
import {
    emptyingAdminHeaders,
    emptyingMocks,
    inMemoryProvider,
    seedEmptyablePartner
} from './v8b-empty-presence.helpers';

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => emptyingMocks.provider,
    initializeMediaProvider: () => undefined
}));
vi.mock('../../../src/utils/env', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/utils/env')>();
    return { ...original, env: { ...original.env, HOSPEDA_CLOUDINARY_CLOUD_NAME: 'fake-cloud' } };
});

const app = initApp();
const db = getDb;
const post = (id: string) =>
    app.request(`/api/v1/admin/partners/${id}/empty-presence`, {
        method: 'POST',
        headers: emptyingAdminHeaders(randomUUID(), [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.PARTNER_EMPTY_PRESENCE
        ]),
        body: JSON.stringify({ reason: 'Storage retry', confirm: true })
    });

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    for (const partnerId of createdPartnerIds)
        await db().execute(
            sql`DELETE FROM partner_application WHERE partner_id = ${partnerId}::uuid`
        );
    for (const partnerId of createdPartnerIds.splice(0))
        await db().delete(partners).where(eq(partners.id, partnerId));
    for (const userId of createdUserIds.splice(0)) {
        await db().execute(
            sql`DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ${userId}::uuid)`
        );
        await db().execute(sql`DELETE FROM subscription WHERE user_id = ${userId}::uuid`);
        await db().execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
    }
    emptyingMocks.provider = new InMemoryImageProvider({ cloudName: 'fake-cloud' });
});
afterAll(async () => testDb.teardown());

/** TEST:V8b:6 storage failure and concurrent-state cases. */
describe('TEST:V8b:6 — Partner remote deletion retry safety', () => {
    it('keeps database content on partial storage failure and succeeds idempotently on retry', async () => {
        const fixture = await seedEmptyablePartner();
        const real = inMemoryProvider();
        const originalDelete = real.delete.bind(real);
        const deleteSpy = vi.spyOn(real, 'delete');
        deleteSpy.mockImplementationOnce(async ({ publicId }) => originalDelete({ publicId }));
        deleteSpy.mockImplementationOnce(async () => {
            throw new Error('remote down');
        });
        const failed = await post(fixture.partner.id);
        expect(failed.status).toBe(503);
        const body = await failed.json();
        expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
        expect(body.error.reason).toBe('REMOTE_DELETE_FAILED');
        expect(JSON.stringify(body)).not.toContain(fixture.logoPublicId);
        expect(JSON.stringify(body)).not.toContain(fixture.pendingPublicId);
        const row = (
            await db().select().from(partners).where(eq(partners.id, fixture.partner.id))
        )[0];
        expect(row?.logoUrl).toBe(fixture.partner.logoUrl);
        expect(row?.pendingLogoUrl).toBe(fixture.partner.pendingLogoUrl);
        expect(real.has(fixture.logoPublicId)).toBe(false);
        expect(real.has(fixture.pendingPublicId)).toBe(true);
        const events = await db().execute(
            sql`SELECT id FROM domain_event WHERE entity_id = ${fixture.partner.id} AND event_type = 'partner.presence_emptied'`
        );
        expect(events.rows).toEqual([]);
        deleteSpy.mockRestore();
        const retried = await post(fixture.partner.id);
        expect(retried.status).toBe(200);
        expect((await retried.json()).data.remoteAssetsDeleted).toBe(2);
        expect(real.has(fixture.logoPublicId)).toBe(false);
        expect(real.has(fixture.pendingPublicId)).toBe(false);
    });

    it('rejects a changed asset plan and allows retry against the current URL', async () => {
        const fixture = await seedEmptyablePartner();
        const provider = inMemoryProvider();
        const originalDelete = provider.delete.bind(provider);
        const deleteSpy = vi.spyOn(provider, 'delete');
        const changedUrl =
            'https://res.cloudinary.com/fake-cloud/image/upload/v1/hospeda/test/partners/replaced/logo.png';
        deleteSpy.mockImplementationOnce(async ({ publicId }) => {
            await db()
                .update(partners)
                .set({ logoUrl: changedUrl })
                .where(eq(partners.id, fixture.partner.id));
            return originalDelete({ publicId });
        });
        const changed = await post(fixture.partner.id);
        expect(changed.status).toBe(409);
        expect((await changed.json()).error.reason).toBe('PRESENCE_STATE_CHANGED');
        const retained = (
            await db().select().from(partners).where(eq(partners.id, fixture.partner.id))
        )[0];
        expect(retained?.logoUrl).toBe(changedUrl);
        expect(retained?.pendingLogoUrl).toBe(fixture.partner.pendingLogoUrl);
        expect(
            (
                await db().execute(
                    sql`SELECT id FROM domain_event WHERE entity_id = ${fixture.partner.id} AND event_type = 'partner.presence_emptied'`
                )
            ).rows
        ).toEqual([]);
        deleteSpy.mockRestore();
        const retried = await post(fixture.partner.id);
        expect(retried.status).toBe(200);
    });

    it('rolls back content clearing when the durable event insert fails, then retries successfully', async () => {
        const fixture = await seedEmptyablePartner();
        vi.spyOn(domainEventModel, 'insert').mockRejectedValueOnce(
            new Error('event insert failed')
        );
        const failed = await post(fixture.partner.id);
        expect(failed.status).toBe(500);
        const row = (
            await db().select().from(partners).where(eq(partners.id, fixture.partner.id))
        )[0];
        expect(row?.logoUrl).toBe(fixture.partner.logoUrl);
        expect(row?.pendingLogoUrl).toBe(fixture.partner.pendingLogoUrl);
        expect(row?.description).toBe('Presence description');
        expect(
            (
                await db().execute(
                    sql`SELECT id FROM domain_event WHERE entity_id = ${fixture.partner.id} AND event_type = 'partner.presence_emptied'`
                )
            ).rows
        ).toEqual([]);
        vi.restoreAllMocks();
        const retried = await post(fixture.partner.id);
        expect(retried.status).toBe(200);
    });
});
