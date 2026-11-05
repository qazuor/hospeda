import { randomUUID } from 'node:crypto';
import { BillingForVerticalsSimulator } from '@repo/billing-verticals-contract/testing';
import {
    eq,
    getDb,
    partnerPresenceHasContent,
    partners,
    payments,
    sql,
    subscriptions
} from '@repo/db';
import { InMemoryImageProvider } from '@repo/media/test-utils';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { invalidateEffectiveSetsForUser } from '../../../src/utils/effective-set-cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { createdPartnerIds, createdUserIds } from './partner-presence.helpers';
import {
    CONTENT_FIELD_NAMES,
    emptyingAdminHeaders,
    emptyingMocks,
    inMemoryProvider,
    seedEmptyablePartner
} from './v8b-empty-presence.helpers';

const closureSimulator = vi.hoisted(() => ({
    current: undefined as BillingForVerticalsSimulator | undefined
}));
vi.mock('../../../src/utils/listing-access/ports', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/listing-access/ports')>();
    return {
        ...actual,
        getListingAccessPorts: () => {
            const ports = actual.getListingAccessPorts();
            return {
                ...ports,
                billing: {
                    ...ports.billing,
                    canCharge: (args: { readonly userId: string }) => {
                        if (!closureSimulator.current)
                            throw new Error('No account closure simulator');
                        return closureSimulator.current.canCharge(args);
                    }
                }
            };
        }
    };
});

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => emptyingMocks.provider,
    initializeMediaProvider: () => undefined
}));
vi.mock('../../../src/utils/env', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/utils/env')>();
    return { ...original, env: { ...original.env, HOSPEDA_CLOUDINARY_CLOUD_NAME: 'fake-cloud' } };
});

let app: ReturnType<typeof initApp>;
const db = getDb;
const route = (id: string) => `/api/v1/admin/partners/${id}/empty-presence`;
const request = (id: string, actorId: string, permissions: PermissionEnum[], body: unknown) =>
    app.request(route(id), {
        method: 'POST',
        headers: emptyingAdminHeaders(actorId, permissions),
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp();
});
beforeEach(() => {
    closureSimulator.current = new BillingForVerticalsSimulator();
});
afterEach(async () => {
    for (const partnerId of createdPartnerIds)
        await db().execute(
            sql`DELETE FROM partner_application WHERE partner_id = ${partnerId}::uuid`
        );
    for (const partnerId of createdPartnerIds.splice(0))
        await db().delete(partners).where(eq(partners.id, partnerId));
    for (const userId of createdUserIds.splice(0)) {
        await db().execute(sql`DELETE FROM account WHERE user_id = ${userId}::uuid`);
        await db().execute(
            sql`DELETE FROM payment WHERE subscription_id IN (SELECT id FROM subscription WHERE user_id = ${userId}::uuid)`
        );
        await db().execute(sql`DELETE FROM subscription WHERE user_id = ${userId}::uuid`);
        await db().execute(sql`DELETE FROM users WHERE id = ${userId}::uuid`);
    }
    emptyingMocks.provider = new InMemoryImageProvider({ cloudName: 'fake-cloud' });
});
afterAll(async () => testDb.teardown());

/** TEST:V8b:6 — ACC:25 empties a Partner presence with auditable, private changes. */
describe('TEST:V8b:6 AC:V8b:6 — Partner presence emptying', () => {
    it('empties the ten content columns, deletes its assets, and records only field names', async () => {
        const fixture = await seedEmptyablePartner();
        const before = await db()
            .select()
            .from(partners)
            .where(eq(partners.id, fixture.partner.id));
        expect(before[0]).toBeDefined();
        expect(partnerPresenceHasContent(before[0]!)).toBe(true);
        expect(inMemoryProvider().has(fixture.logoPublicId)).toBe(true);
        expect(inMemoryProvider().has(fixture.pendingPublicId)).toBe(true);
        const subscriptionsBefore = await db()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.subscriptionId));
        const paymentsBefore = await db()
            .select()
            .from(payments)
            .where(eq(payments.subscriptionId, fixture.subscriptionId));
        const applicationsBefore = await db().execute(
            sql`SELECT * FROM partner_application WHERE id = ${fixture.applicationId}::uuid`
        );
        const reason = 'Owner requested permanent deletion';
        const actorId = randomUUID();
        const response = await request(
            fixture.partner.id,
            actorId,
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: ` ${reason} `, confirm: true }
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({
            success: true,
            data: {
                id: fixture.partner.id,
                clearedFields: [...CONTENT_FIELD_NAMES],
                remoteAssetsDeleted: 2,
                remoteAssetsSkipped: 0
            },
            metadata: { timestamp: expect.any(String), requestId: expect.any(String) }
        });
        const after = await db().select().from(partners).where(eq(partners.id, fixture.partner.id));
        expect(after[0]).toBeDefined();
        expect(partnerPresenceHasContent(after[0]!)).toBe(false);
        expect([
            after[0]!.logoUrl,
            after[0]!.websiteUrl,
            after[0]!.description,
            after[0]!.contactInfo,
            after[0]!.socialNetworks,
            after[0]!.pendingLogoUrl,
            after[0]!.pendingDescription,
            after[0]!.pendingWebsiteUrl,
            after[0]!.contentReviewState,
            after[0]!.contentReviewNote
        ]).toEqual(Array(10).fill(null));
        expect({
            name: after[0]!.name,
            slug: after[0]!.slug,
            type: after[0]!.type,
            lifecycleState: after[0]!.lifecycleState,
            ownerUserId: after[0]!.ownerUserId,
            presenceModerated: after[0]!.presenceModerated,
            claimSecretHash: after[0]!.claimSecretHash,
            contentApprovedAt: after[0]!.contentApprovedAt,
            contentApprovedById: after[0]!.contentApprovedById,
            analytics: after[0]!.analytics
        }).toEqual({
            name: before[0]!.name,
            slug: before[0]!.slug,
            type: before[0]!.type,
            lifecycleState: before[0]!.lifecycleState,
            ownerUserId: before[0]!.ownerUserId,
            presenceModerated: before[0]!.presenceModerated,
            claimSecretHash: before[0]!.claimSecretHash,
            contentApprovedAt: before[0]!.contentApprovedAt,
            contentApprovedById: before[0]!.contentApprovedById,
            analytics: before[0]!.analytics
        });
        expect(
            (
                await db()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, fixture.subscriptionId))
            )[0]
        ).toEqual(subscriptionsBefore[0]);
        expect(
            (
                await db()
                    .select()
                    .from(payments)
                    .where(eq(payments.subscriptionId, fixture.subscriptionId))
            )[0]
        ).toEqual(paymentsBefore[0]);
        expect(
            (
                await db().execute(
                    sql`SELECT * FROM partner_application WHERE id = ${fixture.applicationId}::uuid`
                )
            ).rows
        ).toEqual(applicationsBefore.rows);
        expect(inMemoryProvider().has(fixture.logoPublicId)).toBe(false);
        expect(inMemoryProvider().has(fixture.pendingPublicId)).toBe(false);
        const events = await db().execute(
            sql`SELECT event_type, entity_type, entity_id, actor_id, actor_type, reason, changes FROM domain_event WHERE entity_id = ${fixture.partner.id} AND event_type = 'partner.presence_emptied'`
        );
        expect(events.rows).toHaveLength(1);
        const event = events.rows[0] as {
            event_type: string;
            entity_type: string;
            entity_id: string;
            actor_id: string;
            actor_type: string;
            reason: string;
            changes: unknown;
        };
        expect(event).toEqual({
            event_type: 'partner.presence_emptied',
            entity_type: 'partner',
            entity_id: fixture.partner.id,
            actor_id: actorId,
            actor_type: 'admin',
            reason,
            changes: [
                ...CONTENT_FIELD_NAMES.map((field) => ({ field })),
                { field: 'remote_assets', new: 2 }
            ]
        });
        expect(JSON.stringify(event.changes)).not.toContain('Presence description');
        expect(JSON.stringify(event.changes)).not.toContain(fixture.partner.logoUrl);
    });
    it('rejects missing dedicated permission and invalid confirmation input', async () => {
        const fixture = await seedEmptyablePartner();
        expect(inMemoryProvider().has(fixture.logoPublicId)).toBe(true);
        const denied = await request(
            fixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_MANAGE],
            { reason: 'Reason', confirm: true }
        );
        expect(denied.status).toBe(403);
        const ownerDenied = await request(
            fixture.partner.id,
            fixture.owner!.id,
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Own Partner', confirm: true }
        );
        expect(ownerDenied.status).toBe(403);
        const unauthenticated = await app.request(route(fixture.partner.id), {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify({ reason: 'Reason', confirm: true })
        });
        expect(unauthenticated.status).toBe(401);
        const inputs = [
            {},
            { reason: '  ', confirm: true },
            { reason: 'x'.repeat(501), confirm: true },
            { reason: 'reason' },
            { reason: 'reason', confirm: false }
        ];
        for (const body of inputs) {
            const invalid = await request(
                fixture.partner.id,
                randomUUID(),
                [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
                body
            );
            expect(invalid.status).toBe(400);
        }
        expect(inMemoryProvider().has(fixture.logoPublicId)).toBe(true);
        const events = await db().execute(
            sql`SELECT id FROM domain_event WHERE entity_id = ${fixture.partner.id} AND event_type = 'partner.presence_emptied'`
        );
        expect(events.rows).toEqual([]);
    });
    it('returns typed conflicts for an empty Partner and 404 for a deleted or missing Partner', async () => {
        const fixture = await seedEmptyablePartner();
        const eventCount = await db().execute(
            sql`SELECT id FROM domain_event WHERE entity_id = ${fixture.partner.id} AND event_type = 'partner.presence_emptied'`
        );
        await db()
            .update(partners)
            .set({
                logoUrl: null,
                websiteUrl: null,
                description: null,
                contactInfo: null,
                socialNetworks: null,
                pendingLogoUrl: null,
                pendingDescription: null,
                pendingWebsiteUrl: null,
                contentReviewState: null,
                contentReviewNote: null
            })
            .where(eq(partners.id, fixture.partner.id));
        const empty = await request(
            fixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Empty', confirm: true }
        );
        expect(empty.status).toBe(409);
        expect((await empty.json()).error.reason).toBe('PRESENCE_ALREADY_EMPTY');
        expect(
            (
                await db().execute(
                    sql`SELECT id FROM domain_event WHERE entity_id = ${fixture.partner.id} AND event_type = 'partner.presence_emptied'`
                )
            ).rows
        ).toEqual(eventCount.rows);
        await db()
            .update(partners)
            .set({ description: 'Restore content', deletedAt: new Date() })
            .where(eq(partners.id, fixture.partner.id));
        const deleted = await request(
            fixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Deleted', confirm: true }
        );
        expect(deleted.status).toBe(404);
        const missing = await request(
            '11111111-1111-4111-8111-111111111111',
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Missing', confirm: true }
        );
        expect(missing.status).toBe(404);
    });
    it('skips foreign cloud and non-Hospeda assets, and works without a provider when no owned asset remains', async () => {
        const fixture = await seedEmptyablePartner();
        const provider = inMemoryProvider();
        const deleteSpy = vi.spyOn(provider, 'delete');
        await db()
            .update(partners)
            .set({
                logoUrl:
                    'https://res.cloudinary.com/other-cloud/image/upload/v1/hospeda/partner/logo.png',
                pendingLogoUrl:
                    'https://res.cloudinary.com/fake-cloud/image/upload/v1/foreign/logo.png'
            })
            .where(eq(partners.id, fixture.partner.id));
        const response = await request(
            fixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Clear links', confirm: true }
        );
        expect(response.status).toBe(200);
        expect((await response.json()).data.remoteAssetsSkipped).toBe(2);
        expect(deleteSpy).not.toHaveBeenCalled();

        const noProviderFixture = await seedEmptyablePartner();
        emptyingMocks.provider = null;
        const unavailable = await request(
            noProviderFixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Clear owned remote asset', confirm: true }
        );
        expect(unavailable.status).toBe(503);
        expect((await unavailable.json()).error.reason).toBe('MEDIA_PROVIDER_UNAVAILABLE');
        const unchanged = (
            await db().select().from(partners).where(eq(partners.id, noProviderFixture.partner.id))
        )[0];
        expect(unchanged?.logoUrl).toBe(noProviderFixture.partner.logoUrl);
        await db()
            .update(partners)
            .set({ logoUrl: 'https://images.pexels.com/foreign.png', pendingLogoUrl: null })
            .where(eq(partners.id, noProviderFixture.partner.id));
        const skipped = await request(
            noProviderFixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Clear foreign URL', confirm: true }
        );
        expect(skipped.status).toBe(200);
        expect((await skipped.json()).data).toEqual({
            id: noProviderFixture.partner.id,
            clearedFields: CONTENT_FIELD_NAMES.filter((field) => field !== 'pending_logo_url'),
            remoteAssetsDeleted: 0,
            remoteAssetsSkipped: 1
        });
    });
    it('uses the closed entitlement key for the 404 and leaves that subscription state untouched', async () => {
        const fixture = await seedEmptyablePartner();
        const publicPath = `/api/v1/public/partners/${fixture.partner.slug}`;
        expect(
            (
                await app.request(publicPath, {
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ).status
        ).toBe(200);
        await db()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, fixture.subscriptionId));
        await invalidateEffectiveSetsForUser(fixture.owner!.id);
        expect(
            (
                await app.request(publicPath, {
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ).status
        ).toBe(404);
        const afterStepOne = (
            await db()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.subscriptionId))
        )[0];
        const emptied = await request(
            fixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Complete owner request', confirm: true }
        );
        expect(emptied.status).toBe(200);
        expect(
            (
                await app.request(publicPath, {
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ).status
        ).toBe(404);
        expect(
            (
                await db()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, fixture.subscriptionId))
            )[0]
        ).toEqual(afterStepOne);
    });
    it('documents that emptying alone leaves a still-entitled page available', async () => {
        // If the owner selects option 2 of Q-2, this expectation changes to 404.
        const fixture = await seedEmptyablePartner();
        const publicPath = `/api/v1/public/partners/${fixture.partner.slug}`;
        expect(
            (
                await app.request(publicPath, {
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ).status
        ).toBe(200);
        const response = await request(
            fixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Clear presence', confirm: true }
        );
        expect(response.status).toBe(200);
        expect(
            (
                await app.request(publicPath, {
                    headers: { 'user-agent': 'vitest', accept: 'application/json' }
                })
            ).status
        ).toBe(200);
    });
    it('unblocks the action 24 preview after presence content is emptied', async () => {
        const fixture = await seedEmptyablePartner();
        const ownerId = fixture.owner!.id;
        await db().execute(
            sql`INSERT INTO account (id, account_id, provider_id, user_id, password) VALUES (${randomUUID()}, ${ownerId}, 'credential', ${ownerId}, 'hash')`
        );
        await db()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, fixture.subscriptionId));
        closureSimulator.current?.setCanCharge({ userId: ownerId, response: { canCharge: false } });
        const previewPath = `/api/v1/admin/users/${ownerId}/close-on-request`;
        const preview = async () =>
            app.request(previewPath, {
                headers: emptyingAdminHeaders(randomUUID(), [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.USER_CLOSE_ON_REQUEST
                ])
            });
        const before = await preview();
        expect(before.status).toBe(200);
        expect((await before.json()).data).toMatchObject({
            partnerPresenceWithContent: true,
            ready: false
        });
        const emptied = await request(
            fixture.partner.id,
            randomUUID(),
            [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.PARTNER_EMPTY_PRESENCE],
            { reason: 'Finish account closure', confirm: true }
        );
        expect(emptied.status).toBe(200);
        const after = await preview();
        expect(after.status).toBe(200);
        expect((await after.json()).data).toMatchObject({ partnerPresenceWithContent: false });
    });
});
