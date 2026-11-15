/** TEST:V7:17 AC:V7:17 — action 6 configures a Partner owner's manual plan. */
import { randomUUID } from 'node:crypto';
import {
    and,
    billingOptions,
    domainEvent,
    emailOutbox,
    eq,
    getDb,
    inArray,
    manualPayments,
    partners,
    planCatalogModel,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { openDueManualInstallments } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../billing-subscription/manual-payment-route-fixtures';
import { seedPlan } from '../partner-presence/partner-presence.helpers';

const app = initApp();
const db = getDb;
const permission = PermissionEnum.PARTNER_CONFIGURE_BILLING;
const ownerIds: string[] = [];
const partnerIds: string[] = [];
let partnerOptions: {
    versionId: string;
    monthlyOptionId: string;
    quarterlyOptionId: string;
    planName: string;
    planSlug: string;
};
let otherVerticalOptionId: string;

async function seedCatalog() {
    const seeded = await seedPlan('SILVER');
    const [oldVersion] = await db()
        .select()
        .from(planVersions)
        .where(eq(planVersions.id, seeded.versionId));
    if (!oldVersion) throw new Error('Partner presence helper did not create its plan version');
    const [version] = await db()
        .insert(planVersions)
        .values({
            planId: oldVersion.planId,
            vertical: VerticalEnum.PARTNER,
            rank: Math.floor(Math.random() * 100000000) + 1000000000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Could not create sellable Partner version');
    const options = await db()
        .insert(billingOptions)
        .values([
            { planVersionId: version.id, cycle: 'monthly', amount: 25000, currency: 'ARS' },
            { planVersionId: version.id, cycle: 'quarterly', amount: 70000, currency: 'ARS' }
        ])
        .returning();
    const monthly = options.find((option) => option.cycle === 'monthly');
    const quarterly = options.find((option) => option.cycle === 'quarterly');
    if (!monthly || !quarterly) throw new Error('Could not create two Partner options');
    const [plan] = await db().select().from(plans).where(eq(plans.id, oldVersion.planId));
    if (!plan) throw new Error('Partner plan missing');
    const [otherPlan] = await db()
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `hos1489-other-${randomUUID()}`,
            name: 'Other vertical plan'
        })
        .returning();
    if (!otherPlan) throw new Error('Could not create other vertical plan');
    const [otherVersion] = await db()
        .insert(planVersions)
        .values({
            planId: otherPlan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1100000000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!otherVersion) throw new Error('Could not create other vertical version');
    const [otherOption] = await db()
        .insert(billingOptions)
        .values({
            planVersionId: otherVersion.id,
            cycle: 'monthly',
            amount: 25000,
            currency: 'ARS'
        })
        .returning();
    if (!otherOption) throw new Error('Could not create other vertical option');
    otherVerticalOptionId = otherOption.id;
    return {
        versionId: version.id,
        monthlyOptionId: monthly.id,
        quarterlyOptionId: quarterly.id,
        planName: plan.name,
        planSlug: plan.slug
    };
}

async function createOwner() {
    const [owner] = await db()
        .insert(users)
        .values({
            email: `hos1489-owner-${randomUUID()}@example.test`,
            displayName: 'Action 6 owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!owner) throw new Error('Could not create Partner owner');
    ownerIds.push(owner.id);
    return owner;
}

async function createPartner(ownerUserId: string | null, name = 'Action 6 Partner') {
    const [partner] = await db()
        .insert(partners)
        .values({
            slug: `hos1489-${randomUUID()}`,
            name,
            type: 'business',
            description: 'Action 6 route fixture',
            ownerUserId
        })
        .returning();
    if (!partner) throw new Error('Could not create Partner fixture');
    partnerIds.push(partner.id);
    return partner;
}

async function configure(
    partnerId: string,
    actorId: string,
    billingOptionId: string,
    permissions: readonly PermissionEnum[] = [permission],
    confirm = true
) {
    return app.request(`/api/v1/admin/partners/${partnerId}/billing-setup`, {
        method: 'POST',
        headers: actorHeaders(actorId, permissions),
        body: JSON.stringify({ billingOptionId, reason: 'Approved Partner billing setup', confirm })
    });
}

async function rowCounts(ownerId: string, partnerId: string) {
    const owned = await db()
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.userId, ownerId));
    const installments =
        owned.length === 0
            ? []
            : await db()
                  .select({ id: manualPayments.id })
                  .from(manualPayments)
                  .where(
                      inArray(
                          manualPayments.subscriptionId,
                          owned.map((row) => row.id)
                      )
                  );
    const events = await db()
        .select({ id: domainEvent.id })
        .from(domainEvent)
        .where(and(eq(domainEvent.entityType, 'partner'), eq(domainEvent.entityId, partnerId)));
    return {
        subscriptions: owned.length,
        installments: installments.length,
        events: events.length
    };
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    partnerOptions = await seedCatalog();
});

afterEach(async () => {
    const connection = db();
    if (ownerIds.length > 0) {
        const owned = await connection
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(inArray(subscriptions.userId, ownerIds));
        const ids = owned.map((row) => row.id);
        if (ids.length > 0) {
            await connection
                .delete(manualPayments)
                .where(inArray(manualPayments.subscriptionId, ids));
            await connection.delete(subscriptions).where(inArray(subscriptions.id, ids));
        }
        await connection.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, ownerIds));
    }
    if (partnerIds.length > 0)
        await connection.delete(partners).where(inArray(partners.id, partnerIds.splice(0)));
    if (ownerIds.length > 0)
        await connection.delete(users).where(inArray(users.id, ownerIds.splice(0)));
});

afterAll(async () => testDb.teardown());

describe('TEST:V7:17 AC:V7:17 — action 6 configures a Partner plan and manual payment', () => {
    it('writes one pending manual subscription, awaiting installment, and durable event; retry is idempotent', async () => {
        const owner = await createOwner();
        const partner = await createPartner(owner.id);
        const adminId = randomUUID();
        const response = await configure(partner.id, adminId, partnerOptions.monthlyOptionId);
        expect(response.status, await response.clone().text()).toBe(200);
        const { data } = (await response.json()) as {
            data: {
                subscriptionId: string;
                manualPaymentId: string;
                periodStart: string;
                authorizationWindowEndsAt: string;
                created: boolean;
            };
        };
        expect(data.created).toBe(true);
        const subRows = await db()
            .select({
                id: subscriptions.id,
                userId: subscriptions.userId,
                vertical: subscriptions.vertical,
                planVersionId: subscriptions.planVersionId,
                billingOptionId: subscriptions.billingOptionId,
                paymentMethod: subscriptions.paymentMethod,
                class: subscriptions.class,
                status: subscriptions.status,
                cancellationReason: subscriptions.cancellationReason,
                nextChargeAt: subscriptions.nextChargeAt,
                serviceEndsAt: subscriptions.serviceEndsAt,
                firstChargeAt: subscriptions.firstChargeAt,
                declaredPayerEmail: subscriptions.declaredPayerEmail,
                authorizationWindowDeadlineVersion:
                    subscriptions.authorizationWindowDeadlineVersion,
                authorizationWindowEndsAt: subscriptions.authorizationWindowEndsAt,
                graceStartedAt: subscriptions.graceStartedAt,
                graceEndsAt: subscriptions.graceEndsAt,
                renewalNoticeDeadlineVersion: subscriptions.renewalNoticeDeadlineVersion,
                renewalNoticeChargeAt: subscriptions.renewalNoticeChargeAt,
                succeedsId: subscriptions.succeedsId,
                succeededById: subscriptions.succeededById
            })
            .from(subscriptions)
            .where(eq(subscriptions.id, data.subscriptionId));
        expect(subRows).toEqual([
            {
                id: data.subscriptionId,
                userId: owner.id,
                vertical: 'partner',
                planVersionId: partnerOptions.versionId,
                billingOptionId: partnerOptions.monthlyOptionId,
                paymentMethod: 'MANUAL',
                class: 'PRINCIPAL',
                status: 'PENDING_AUTHORIZATION',
                cancellationReason: null,
                nextChargeAt: null,
                serviceEndsAt: null,
                firstChargeAt: null,
                declaredPayerEmail: null,
                authorizationWindowDeadlineVersion: expect.any(Number),
                authorizationWindowEndsAt: new Date(data.authorizationWindowEndsAt),
                graceStartedAt: null,
                graceEndsAt: null,
                renewalNoticeDeadlineVersion: null,
                renewalNoticeChargeAt: null,
                succeedsId: null,
                succeededById: null
            }
        ]);
        const paymentRows = await db()
            .select({
                id: manualPayments.id,
                subscriptionId: manualPayments.subscriptionId,
                periodStart: manualPayments.periodStart,
                status: manualPayments.status,
                entry: manualPayments.entry,
                registeredBy: manualPayments.registeredBy,
                registeredAt: manualPayments.registeredAt,
                proofRef: manualPayments.proofRef
            })
            .from(manualPayments)
            .where(eq(manualPayments.id, data.manualPaymentId));
        expect(paymentRows).toEqual([
            {
                id: data.manualPaymentId,
                subscriptionId: data.subscriptionId,
                periodStart: new Date(data.periodStart),
                status: 'AWAITING',
                entry: 'INSTALLMENT',
                registeredBy: null,
                registeredAt: null,
                proofRef: null
            }
        ]);
        const eventRows = await db()
            .select({
                eventType: domainEvent.eventType,
                entityType: domainEvent.entityType,
                entityId: domainEvent.entityId,
                actorType: domainEvent.actorType,
                actorId: domainEvent.actorId,
                reason: domainEvent.reason,
                changes: domainEvent.changes,
                correlationId: domainEvent.correlationId
            })
            .from(domainEvent)
            .where(
                and(eq(domainEvent.entityType, 'partner'), eq(domainEvent.entityId, partner.id))
            );
        expect(eventRows).toEqual([
            {
                eventType: 'partner.billing_configured',
                entityType: 'partner',
                entityId: partner.id,
                actorType: 'admin',
                actorId: adminId,
                reason: 'Approved Partner billing setup',
                changes: [
                    { field: 'payment_method', old: null, new: 'MANUAL' },
                    { field: 'plan_version_id', old: null, new: partnerOptions.versionId },
                    { field: 'billing_option_id', old: null, new: partnerOptions.monthlyOptionId },
                    { field: 'subscription_id', old: null, new: data.subscriptionId },
                    { field: 'owner_user_id', old: null, new: owner.id }
                ],
                correlationId: expect.any(String)
            }
        ]);
        const retry = await configure(partner.id, randomUUID(), partnerOptions.monthlyOptionId);
        expect(retry.status).toBe(200);
        expect(((await retry.json()) as { data: { created: boolean } }).data.created).toBe(false);
        const taken = await configure(partner.id, randomUUID(), partnerOptions.quarterlyOptionId);
        expect(taken.status).toBe(409);
        expect(await taken.json()).toMatchObject({ error: { reason: 'COMMITMENT_TAKEN' } });
        expect(await rowCounts(owner.id, partner.id)).toEqual({
            subscriptions: 1,
            installments: 1,
            events: 1
        });
    });

    it('denies missing permission, rejects unconfirmed acts, and keeps preview read-only', async () => {
        const owner = await createOwner();
        const partner = await createPartner(owner.id);
        const before = await rowCounts(owner.id, partner.id);
        const denied = await configure(
            partner.id,
            randomUUID(),
            partnerOptions.monthlyOptionId,
            []
        );
        expect(denied.status).toBe(403);
        expect(await denied.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
        const unconfirmed = await configure(
            partner.id,
            randomUUID(),
            partnerOptions.monthlyOptionId,
            [permission],
            false
        );
        expect(unconfirmed.status).toBe(400);
        expect(await rowCounts(owner.id, partner.id)).toEqual(before);
        const preview = await app.request(`/api/v1/admin/partners/${partner.id}/billing-setup`, {
            headers: actorHeaders(randomUUID(), [permission])
        });
        expect(preview.status).toBe(200);
        const previewData = (
            (await preview.json()) as { data: { options: unknown[]; method: string } }
        ).data;
        expect(previewData.method).toBe('MANUAL');
        expect(
            (previewData.options as Array<Record<string, unknown>>).filter((option) =>
                [partnerOptions.monthlyOptionId, partnerOptions.quarterlyOptionId].includes(
                    option.billingOptionId as string
                )
            )
        ).toEqual([
            {
                billingOptionId: partnerOptions.monthlyOptionId,
                planVersionId: partnerOptions.versionId,
                planName: partnerOptions.planName,
                planSlug: partnerOptions.planSlug,
                cycle: 'monthly',
                amountMinor: 25000,
                currency: 'ARS'
            },
            {
                billingOptionId: partnerOptions.quarterlyOptionId,
                planVersionId: partnerOptions.versionId,
                planName: partnerOptions.planName,
                planSlug: partnerOptions.planSlug,
                cycle: 'quarterly',
                amountMinor: 70000,
                currency: 'ARS'
            }
        ]);
        expect(await rowCounts(owner.id, partner.id)).toEqual(before);
        const deniedPreview = await app.request(
            `/api/v1/admin/partners/${partner.id}/billing-setup`,
            { headers: actorHeaders(randomUUID(), []) }
        );
        expect(deniedPreview.status).toBe(403);
    });

    it('rejects missing owners, self-configuration, and billing options from another vertical', async () => {
        const owner = await createOwner();
        const unowned = await createPartner(null, 'Action 6 unowned Partner');
        const missingOwner = await configure(
            unowned.id,
            randomUUID(),
            partnerOptions.monthlyOptionId
        );
        expect(missingOwner.status).toBe(409);
        expect(await missingOwner.json()).toMatchObject({
            error: { reason: 'PARTNER_WITHOUT_OWNER' }
        });
        const selfPartner = await createPartner(owner.id, 'Action 6 self-owned Partner');
        const self = await configure(selfPartner.id, owner.id, partnerOptions.monthlyOptionId);
        expect(self.status).toBe(403);
        expect(await self.json()).toMatchObject({
            error: { reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' }
        });
        const otherVertical = await configure(selfPartner.id, randomUUID(), otherVerticalOptionId);
        expect(otherVertical.status).toBe(422);
        expect(await otherVertical.json()).toMatchObject({
            error: { reason: 'MANUAL_PAYMENT_NOT_AVAILABLE' }
        });
    });

    it('keeps S1 pending with one awaiting installment after the manual S4 sweep', async () => {
        const owner = await createOwner();
        const partner = await createPartner(owner.id);
        const response = await configure(partner.id, randomUUID(), partnerOptions.monthlyOptionId);
        expect(response.status).toBe(200);
        const { data } = (await response.json()) as { data: { subscriptionId: string } };
        const beforeRows = await db()
            .select({ id: manualPayments.id, status: manualPayments.status })
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, data.subscriptionId));
        expect(beforeRows).toEqual([{ id: expect.any(String), status: 'AWAITING' }]);
        const ports = {
            clock: { now: () => new Date('2100-01-01T00:00:00.000Z') },
            planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy
        };
        await openDueManualInstallments({ pageSize: 1000 }, ports);
        const [after] = await db()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, data.subscriptionId));
        expect(after).toEqual({ status: 'PENDING_AUTHORIZATION' });
        const afterRows = await db()
            .select({ id: manualPayments.id, status: manualPayments.status })
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, data.subscriptionId));
        expect(afterRows).toEqual(beforeRows);
    });
});
