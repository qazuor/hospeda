/**
 * AC:B4:5, AC:B4:6 and US:B4:3 (HOS-1534), composition half: action 24 through
 * its route with the PRODUCTION ports (no `vi.mock` of the simulator), so the
 * closure waits on billing's REAL `canCharge`: a live subscription, a
 * `CANCEL_SCHEDULED` whose cancellation no re-read confirmed, a
 * `CHARGE_DECLINED` inside PLAZO:16 counted from `provider_link.cancelled_seen_at`
 * and an open `CANCELACION_SIN_CONFIRMAR` mark all refuse with 409 and write
 * nothing; once Mercado Pago's cancellation is confirmed (and, for the declined
 * one, PLAZO:16 has elapsed), the closure goes through.
 *
 * Cleans only its own rows in `afterEach` (billing children first); never TRUNCATE.
 */
import {
    billingOptions,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    providerLinks,
    reconciliationMarks,
    sql,
    subscriptions
} from '@repo/db';
import { PermissionEnum, RoleEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, createOwner } from '../listing-publication/publication-routes.helpers';

const NOW = new Date('2026-10-12T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const REASON = 'Juan pidió por correo que demos de baja su cuenta';

const app = initApp({ clock: { now: () => NOW } });
const createdUsers: string[] = [];
const createdSubscriptions: string[] = [];
const createdBillingOptions: string[] = [];

function superAdminHeaders(id: string) {
    return actorHeaders({
        id,
        role: RoleEnum.SUPER_ADMIN,
        permissions: Object.values(PermissionEnum)
    });
}

/** An account with one credential, the shape action 24 pseudonymizes. */
async function account(): Promise<string> {
    const { id } = await createOwner();
    createdUsers.push(id);
    await getDb().execute(sql`INSERT INTO account (id, account_id, provider_id, user_id, password)
        VALUES (${crypto.randomUUID()}, ${id}, 'credential', ${id}, 'hash')`);
    return id;
}

/** A super admin acting on the route. */
async function superAdmin(): Promise<string> {
    const { id } = await createOwner();
    createdUsers.push(id);
    return id;
}

/**
 * One PRINCIPAL accommodation subscription of `userId` in `status`, over its own
 * plan version (neither current nor sellable, so no catalog lookup sees it), with
 * an optional `provider_link` carrying `cancelled_seen_at`.
 */
async function subscription(input: {
    readonly userId: string;
    readonly status: string;
    readonly providerLink?: { readonly cancelledSeenAt: Date | null };
}): Promise<string> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b43-close-${crypto.randomUUID()}`,
            name: 'B4.3 action 24'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    createdBillingOptions.push(option.id);
    const [row] = await db
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: input.status,
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected subscription');
    createdSubscriptions.push(row.id);
    if (input.providerLink) {
        await db.insert(providerLinks).values({
            subscriptionId: row.id,
            provider: 'mercadopago',
            providerId: `b43-close-${crypto.randomUUID()}`,
            cancelledSeenAt: input.providerLink.cancelledSeenAt
        });
    }
    return row.id;
}

/** Everything a refused closure must leave untouched. */
async function footprint(userId: string) {
    const user = await getDb().execute(sql`SELECT * FROM users WHERE id = ${userId}::uuid`);
    const accounts = await getDb().execute(
        sql`SELECT id FROM account WHERE user_id = ${userId}::uuid`
    );
    const events = await getDb().execute(
        sql`SELECT id FROM domain_event WHERE entity_id = ${userId}`
    );
    return { user: user.rows, accounts: accounts.rows.length, events: events.rows.length };
}

async function call(input: {
    readonly method: 'GET' | 'POST';
    readonly userId: string;
    readonly headers: Record<string, string>;
}) {
    const response = await app.request(`/api/v1/admin/users/${input.userId}/close-on-request`, {
        method: input.method,
        headers: input.headers,
        ...(input.method === 'POST' ? { body: JSON.stringify({ reason: REASON }) } : {})
    });
    const body = (await response.json()) as {
        readonly data?: Record<string, unknown>;
        readonly error?: { readonly code?: string; readonly reason?: string };
    };
    return { status: response.status, body };
}

/** Asserts the 409 refusal of action 24 for billing, with nothing written. */
async function expectRefusedForCharge(userId: string): Promise<void> {
    const adminId = await superAdmin();
    const before = await footprint(userId);

    const preview = await call({ method: 'GET', userId, headers: superAdminHeaders(adminId) });
    const response = await call({ method: 'POST', userId, headers: superAdminHeaders(adminId) });

    expect(preview.status).toBe(200);
    expect(preview.body.data).toEqual({
        userId,
        displayName: before.user[0]?.display_name,
        email: before.user[0]?.email,
        canCharge: true,
        listingsNotPurged: 0,
        partnerPresenceWithContent: false,
        ready: false
    });
    expect(response.status).toBe(409);
    expect(response.body.error?.code).toBe('ALREADY_EXISTS');
    expect(response.body.error?.reason).toBe('ACCOUNT_CAN_STILL_BE_CHARGED');
    expect(await footprint(userId)).toEqual(before);
    expect(before.accounts).toBe(1);
    expect(before.events).toBe(0);
}

/** Asserts action 24 closes the account: credentials gone, one audit event, user pseudonymized. */
async function expectClosed(userId: string): Promise<void> {
    const adminId = await superAdmin();
    const before = await footprint(userId);

    const response = await call({ method: 'POST', userId, headers: superAdminHeaders(adminId) });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ closed: true });
    const after = await footprint(userId);
    expect(after.accounts).toBe(0);
    expect(after.events).toBe(1);
    expect(after.user[0]?.email).not.toBe(before.user[0]?.email);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(async () => {
    const db = getDb();
    const subscriptionIds = createdSubscriptions.splice(0);
    if (subscriptionIds.length > 0) {
        await db
            .delete(reconciliationMarks)
            .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds));
        await db
            .delete(providerLinks)
            .where(inArray(providerLinks.subscriptionId, subscriptionIds));
        await db.delete(subscriptions).where(inArray(subscriptions.id, subscriptionIds));
    }
    for (const id of createdBillingOptions.splice(0)) {
        await db.delete(billingOptions).where(eq(billingOptions.id, id));
    }
    for (const id of createdUsers.splice(0)) {
        await db.execute(sql`DELETE FROM coverage_loss WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM account WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_role WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM user_permission WHERE user_id = ${id}::uuid`);
        await db.execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
    }
});
afterAll(async () => testDb.teardown());

describe('AC:B4:5 AC:B4:6 US:B4:3 action 24 waits on the real canCharge (HOS-1534)', () => {
    it('(a) refuses with 409 while an ACTIVE subscription remains, and writes nothing', async () => {
        // Arrange
        const juan = await account();
        await subscription({ userId: juan, status: 'ACTIVE' });

        // Act / Assert
        await expectRefusedForCharge(juan);
    });

    it('(b) refuses a CANCEL_SCHEDULED whose cancellation no re-read confirmed', async () => {
        // Arrange
        const juan = await account();
        await subscription({
            userId: juan,
            status: 'CANCEL_SCHEDULED',
            providerLink: { cancelledSeenAt: null }
        });

        // Act / Assert
        await expectRefusedForCharge(juan);
    });

    it('(b) closes once a re-read confirmed the CANCEL_SCHEDULED cancellation', async () => {
        // Arrange
        const juan = await account();
        await subscription({
            userId: juan,
            status: 'CANCEL_SCHEDULED',
            providerLink: { cancelledSeenAt: new Date(NOW.getTime() - DAY_MS) }
        });

        // Act / Assert
        await expectClosed(juan);
    });

    it('(c) refuses a CHARGE_DECLINED whose cancellation was seen 6 days ago (inside PLAZO:16)', async () => {
        // Arrange
        const juan = await account();
        await subscription({
            userId: juan,
            status: 'CHARGE_DECLINED',
            providerLink: { cancelledSeenAt: new Date(NOW.getTime() - 6 * DAY_MS) }
        });

        // Act / Assert
        await expectRefusedForCharge(juan);
    });

    it('(c) closes a CHARGE_DECLINED whose cancellation was seen 8 days ago (PLAZO:16 elapsed)', async () => {
        // Arrange
        const juan = await account();
        await subscription({
            userId: juan,
            status: 'CHARGE_DECLINED',
            providerLink: { cancelledSeenAt: new Date(NOW.getTime() - 8 * DAY_MS) }
        });

        // Act / Assert
        await expectClosed(juan);
    });

    it('(d) refuses while a CANCELACION_SIN_CONFIRMAR mark is open, even with the cancellation seen', async () => {
        // Arrange
        const juan = await account();
        const subscriptionId = await subscription({
            userId: juan,
            status: 'CANCELLED',
            providerLink: { cancelledSeenAt: new Date(NOW.getTime() - 30 * DAY_MS) }
        });
        await getDb()
            .insert(reconciliationMarks)
            .values({ subscriptionId, reason: 'CANCELACION_SIN_CONFIRMAR' });

        // Act / Assert
        await expectRefusedForCharge(juan);
    });

    it('closes an account with no subscription at all', async () => {
        // Arrange
        const juan = await account();

        // Act / Assert
        await expectClosed(juan);
    });

    it('still answers 403 SUBJECT_OUTRANKS_ACTOR when an ADMIN targets a SUPER_ADMIN', async () => {
        // Arrange
        const target = await account();
        await getDb().execute(
            sql`INSERT INTO user_role (user_id, role) VALUES (${target}::uuid, ${RoleEnum.SUPER_ADMIN})`
        );
        const { id: adminId } = await createOwner();
        createdUsers.push(adminId);
        const before = await footprint(target);

        // Act
        const response = await call({
            method: 'POST',
            userId: target,
            headers: actorHeaders({
                id: adminId,
                role: RoleEnum.ADMIN,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.USER_CLOSE_ON_REQUEST
                ]
            })
        });

        // Assert
        expect(response.status).toBe(403);
        expect(response.body.error?.reason).toBe('SUBJECT_OUTRANKS_ACTOR');
        expect(await footprint(target)).toEqual(before);
    });
});
