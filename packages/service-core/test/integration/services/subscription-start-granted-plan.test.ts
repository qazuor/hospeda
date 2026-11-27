import { permanentGrants, permanentGrantVerticals, users } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { readLivePermanentGrantPlan } from '../../../src/services/billing/grant/permanent-grant-live-plan';
import {
    type StartSubscriptionPorts,
    startSubscription
} from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { nextPlanVersionRank } from './support/plan-version-rank.js';
import { noTouristVip } from './support/tourist-vip.ts';

afterAll(closeServiceTestPool);

const clock = { now: () => new Date('2026-11-27T12:00:00.000Z') };
const returnUrl = 'https://hospeda.example/account';

async function seedUser(): Promise<string> {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `hos2665-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-2665 test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('No user');
    return user.id;
}

async function seedPlan(name: string) {
    const pool = getServiceTestPool();
    const planId = (
        await pool.query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `hos2665-${crypto.randomUUID()}`, name]
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('No plan');
    const planVersionId = (
        await pool.query<{ id: string }>(
            `INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
         VALUES ($1, 'accommodation', $2, true, true, 0, false) RETURNING id`,
            [planId, nextPlanVersionRank()]
        )
    ).rows[0]?.id;
    if (!planVersionId) throw new Error('No version');
    const billingOptionId = (
        await pool.query<{ id: string }>(
            `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
         VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id`,
            [planVersionId]
        )
    ).rows[0]?.id;
    if (!billingOptionId) throw new Error('No option');
    return { planId, planVersionId, billingOptionId };
}

async function grant(input: {
    readonly userId: string;
    readonly plan: { readonly planId: string; readonly planVersionId: string };
    readonly revoked?: boolean;
}) {
    const signer = await seedUser();
    const db = getServiceTestDb();
    const [row] = await db
        .insert(permanentGrants)
        .values({
            beneficiaryUserId: input.userId,
            grantedBy: signer,
            includesAddons: false,
            reason: 'HOS-2665 test grant',
            affectedSubscriptionIds: [],
            ...(input.revoked
                ? { revokedAt: clock.now(), revokedBy: signer, revocationReason: 'test revoke' }
                : {})
        })
        .returning({ id: permanentGrants.id });
    if (!row) throw new Error('No grant');
    const [anchor] = await db
        .insert(permanentGrantVerticals)
        .values({
            permanentGrantId: row.id,
            vertical: 'accommodation',
            planId: input.plan.planId,
            floorPlanVersionId: input.plan.planVersionId
        })
        .returning({ createdAt: permanentGrantVerticals.createdAt });
    if (!anchor) throw new Error('No anchor');
    return anchor;
}

function ports(fake: FakePaymentProvider): StartSubscriptionPorts {
    return {
        provider: namespaceFake(fake),
        clock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' },
        touristVipInheritance: noTouristVip
    };
}

describe('HOS-2665 live permanent grant plan reader', () => {
    it('returns the anchored plan with its catalog name, and nothing once revoked', async () => {
        const live = await seedUser();
        const plan = await seedPlan('Pro');
        const anchor = await grant({ userId: live, plan });
        expect(
            await readLivePermanentGrantPlan({ userId: live, vertical: 'accommodation' })
        ).toEqual({
            plan: {
                planId: plan.planId,
                planVersionId: plan.planVersionId,
                planName: 'Pro',
                since: anchor.createdAt
            }
        });
        expect(await readLivePermanentGrantPlan({ userId: live, vertical: 'venue' })).toEqual({
            plan: null
        });

        const revoked = await seedUser();
        await grant({ userId: revoked, plan, revoked: true });
        expect(
            await readLivePermanentGrantPlan({ userId: revoked, vertical: 'accommodation' })
        ).toEqual({ plan: null });
    });
});

describe('HOS-2665 S1 refuses the plan already held through a permanent grant', () => {
    it('rejects the granted plan before any provider call and allows a different plan', async () => {
        const userId = await seedUser();
        const granted = await seedPlan('Básico');
        const upgrade = await seedPlan('Pro');
        await grant({ userId, plan: granted });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');

        await expect(
            startSubscription(
                { userId, billingOptionId: granted.billingOptionId, returnUrl },
                ports(fake)
            )
        ).rejects.toMatchObject({ code: 'ALREADY_EXISTS', reason: 'PLAN_ALREADY_GRANTED' });
        expect(authorize).not.toHaveBeenCalled();

        const started = await startSubscription(
            { userId, billingOptionId: upgrade.billingOptionId, returnUrl },
            ports(fake)
        );
        expect(started.subscriptionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(authorize).toHaveBeenCalledOnce();
    });
});
