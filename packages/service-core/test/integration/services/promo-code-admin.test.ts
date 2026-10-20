import { eq, getDb, promoCodes, promoRedemptions, users } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { closePromoCode, createPromoCode, listPromoCodes } from '../../../src/services';
import type { Actor } from '../../../src/types/index.js';
import { createSystemActor } from '../../../src/utils/system-actor.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';

const now = new Date('2026-10-18T12:00:00.000Z');
const clock = { now: () => new Date(now) };
const codes: string[] = [];
const ids: string[] = [];
let userId = '';
let actor: Actor;
const createInput = (
    code: string,
    override: Partial<Parameters<typeof createPromoCode>[0]['input']> = {}
) => ({
    code,
    effect: {
        kind: 'DISCOUNT' as const,
        discountKind: 'PERCENTAGE' as const,
        value: 20,
        durationKind: 'N_CHARGES' as const,
        durationCharges: 3
    },
    allVerticals: true,
    verticals: null,
    totalQuota: null,
    validUntil: null,
    stackable: false,
    usableWithAnotherActive: false,
    ...override
});

beforeAll(async () => {
    getServiceTestDb();
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `promo-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Promo admin',
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Could not create promo admin fixture');
    userId = user.id;
    actor = { id: user.id, roles: [], permissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES] };
});
afterAll(async () => {
    if (userId) await getDb().delete(users).where(eq(users.id, userId));
    await closeServiceTestPool();
});
afterEach(async () => {
    for (const id of ids.splice(0)) {
        await getDb().delete(promoRedemptions).where(eq(promoRedemptions.promoCodeId, id));
        await getDb().delete(promoCodes).where(eq(promoCodes.id, id));
    }
    codes.splice(0);
});

async function create(input: Parameters<typeof createPromoCode>[0]['input']) {
    const view = await createPromoCode({ actor, input }, { clock });
    ids.push(view.id);
    codes.push(view.code);
    return view;
}

describe('TEST:B9b:9 (support) AC:B9b:9 HOS-1591 admin action 21 creates and closes promo codes', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(a) persists each effect shape and defaults the start from the injected clock',
        async () => {
            const discount = await create(createInput(`ADM-${crypto.randomUUID()}`));
            const trial = await create(
                createInput(`TRI-${crypto.randomUUID()}`, {
                    effect: { kind: 'TRIAL_EXTENSION', extensionDays: 14 }
                })
            );
            const rows = await getDb()
                .select()
                .from(promoCodes)
                .where(eq(promoCodes.id, discount.id));
            expect(rows[0]).toMatchObject({
                effectKind: 'DISCOUNT',
                discountKind: 'PERCENTAGE',
                value: 20,
                durationKind: 'N_CHARGES',
                durationCharges: 3,
                extensionDays: null,
                validFrom: now,
                validUntil: null,
                totalQuota: null,
                verticals: null
            });
            const trialRows = await getDb()
                .select()
                .from(promoCodes)
                .where(eq(promoCodes.id, trial.id));
            expect(trialRows[0]).toMatchObject({
                effectKind: 'TRIAL_EXTENSION',
                extensionDays: 14,
                discountKind: null,
                value: null,
                durationKind: null,
                durationCharges: null
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(b) maps only the unique promo code constraint and keeps one row',
        async () => {
            const input = createInput(`DUP-${crypto.randomUUID()}`);
            const first = await create(input);
            await expect(createPromoCode({ actor, input }, { clock })).rejects.toMatchObject({
                reason: 'PROMO_CODE_ALREADY_EXISTS'
            });
            expect(
                await getDb().select().from(promoCodes).where(eq(promoCodes.code, first.code))
            ).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c) maps a violated promo CHECK and writes no code row',
        async () => {
            const code = `BAD-${crypto.randomUUID()}`;
            await expect(
                createPromoCode(
                    { actor, input: createInput(code, { validFrom: now, validUntil: now }) },
                    { clock }
                )
            ).rejects.toMatchObject({ reason: 'INVALID_PROMO_CODE_INPUT' });
            expect(
                await getDb().select().from(promoCodes).where(eq(promoCodes.code, code))
            ).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(d) denies adjacent permissions and system actors before any write',
        async () => {
            const neighbors: Actor = {
                ...actor,
                permissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY]
            };
            const system = {
                ...createSystemActor({ jobId: 'hos-1591-test', permissions: [] }),
                permissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES]
            } as Actor;
            const deniedCreateCode = `DENY-${crypto.randomUUID()}`;
            const systemCreateCode = `SYS-${crypto.randomUUID()}`;
            const neighborCreateResult = await createPromoCode(
                { actor: neighbors, input: createInput(deniedCreateCode) },
                { clock }
            ).then(
                (value) => ({ value }),
                (error: unknown) => ({ error })
            );
            expect(
                await getDb().select().from(promoCodes).where(eq(promoCodes.code, deniedCreateCode))
            ).toHaveLength(0);
            expect(neighborCreateResult).toMatchObject({
                error: { reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' }
            });
            const systemCreateResult = await createPromoCode(
                { actor: system, input: createInput(systemCreateCode) },
                { clock }
            ).then(
                (value) => ({ value }),
                (error: unknown) => ({ error })
            );
            expect(
                await getDb().select().from(promoCodes).where(eq(promoCodes.code, systemCreateCode))
            ).toHaveLength(0);
            expect(systemCreateResult).toMatchObject({
                error: { reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' }
            });
            const closable = await create(createInput(`CLOSE-${crypto.randomUUID()}`));
            await expect(
                closePromoCode({ actor: neighbors, promoCodeId: closable.id }, { clock })
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            await expect(
                closePromoCode({ actor: system, promoCodeId: closable.id }, { clock })
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            await expect(
                listPromoCodes({ actor: neighbors, page: 1, pageSize: 10 }, { clock })
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            await expect(
                listPromoCodes({ actor: system, page: 1, pageSize: 10 }, { clock })
            ).rejects.toMatchObject({ reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' });
            expect(
                await getDb().select().from(promoCodes).where(eq(promoCodes.code, deniedCreateCode))
            ).toHaveLength(0);
            expect(
                await getDb().select().from(promoCodes).where(eq(promoCodes.code, systemCreateCode))
            ).toHaveLength(0);
            const [stillOpen] = await getDb()
                .select()
                .from(promoCodes)
                .where(eq(promoCodes.id, closable.id));
            expect(stillOpen?.closedAt).toBeNull();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(e) closes once, records actor and time, and rejects missing or repeated close',
        async () => {
            const view = await create(createInput(`CLS-${crypto.randomUUID()}`));
            const closed = await closePromoCode({ actor, promoCodeId: view.id }, { clock });
            expect(closed).toMatchObject({
                promoCodeId: view.id,
                closedAt: now,
                closedBy: userId,
                redemptionCount: 0
            });
            await expect(
                closePromoCode({ actor, promoCodeId: view.id }, { clock })
            ).rejects.toMatchObject({ reason: 'PROMO_CODE_ALREADY_CLOSED' });
            expect(
                (await getDb().select().from(promoCodes).where(eq(promoCodes.id, view.id)))[0]
                    ?.closedAt
            ).toEqual(now);
            await expect(
                closePromoCode({ actor, promoCodeId: crypto.randomUUID() }, { clock })
            ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_FOUND' });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(f) lists owned codes with per-code counts and every availability state',
        async () => {
            const open = await create(createInput(`OPEN-${crypto.randomUUID()}`));
            const closed = await create(createInput(`CLOSED-${crypto.randomUUID()}`));
            const expired = await create(
                createInput(`EXPIRE-${crypto.randomUUID()}`, {
                    validFrom: new Date(now.getTime() - 60_000),
                    validUntil: new Date(now.getTime())
                })
            );
            const exhausted = await create(
                createInput(`EXHAUST-${crypto.randomUUID()}`, { totalQuota: 1 })
            );
            const upcoming = await create(
                createInput(`SOON-${crypto.randomUUID()}`, {
                    validFrom: new Date(now.getTime() + 1000)
                })
            );
            await closePromoCode({ actor, promoCodeId: closed.id }, { clock });
            await getDb().insert(promoRedemptions).values({
                promoCodeId: exhausted.id,
                userId,
                redeemedAt: now,
                subscriptionId: null,
                remainingCharges: null
            });
            const result = await listPromoCodes({ actor, page: 1, pageSize: 100 }, { clock });
            const byId = new Map(result.items.map((item) => [item.id, item]));
            expect(byId.get(open.id)).toMatchObject({ availability: 'OPEN', redemptionCount: 0 });
            expect(byId.get(closed.id)).toMatchObject({
                availability: 'CLOSED',
                redemptionCount: 0
            });
            expect(byId.get(expired.id)).toMatchObject({
                availability: 'EXPIRED',
                redemptionCount: 0
            });
            expect(byId.get(exhausted.id)).toMatchObject({
                availability: 'EXHAUSTED',
                redemptionCount: 1
            });
            expect(byId.get(upcoming.id)).toMatchObject({
                availability: 'NOT_YET_VALID',
                redemptionCount: 0
            });
        }
    );
});
