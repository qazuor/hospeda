import {
    and,
    billingOptions,
    courtesyGrants,
    eq,
    isNull,
    planVersions,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveCourtesySources } from '../../../src/services/billing/coverage/courtesy-sources.js';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { readPauseQuota } from '../../../src/services/billing/subscription/pause-quota.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    courtesyNow,
    createPermanentAnchor,
    retireCourtesyFixtures,
    seedCourtesyPrincipal
} from './support/courtesy-fixtures.js';

const db = getServiceTestDb();
const grant = async (s: Awaited<ReturnType<typeof seedCourtesyPrincipal>>, months = 2) =>
    grantTemporaryCourtesy(
        {
            subscriptionId: s.subscriptionId,
            months,
            grantedBy: s.userId,
            reason: 'temporary courtesy test'
        },
        s.ports
    );
afterEach(retireCourtesyFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9b:7 temporary courtesy S9', () => {
    it('grants calendar months, opens a courtesy pause, emits coverage, and preserves customer quota', async () => {
        const s = await seedCourtesyPrincipal();
        const before = await readPauseQuota({
            tx: db,
            userId: s.userId,
            vertical: 'accommodation',
            now: courtesyNow
        });
        const result = await grant(s);
        expect(result).toMatchObject({
            outcome: 'GRANTED',
            endsAt: new Date('2026-12-14T12:00:00.000Z')
        });
        const [row] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        const [pause] = await db
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        const [courtesy] = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        expect(row?.status).toBe('PAUSED');
        expect(pause).toMatchObject({
            reason: 'COURTESY',
            requestedMonths: 2,
            startsAt: courtesyNow,
            expectedEndAt: new Date('2026-12-14T12:00:00.000Z')
        });
        expect(courtesy).toMatchObject({
            months: 2,
            startsAt: courtesyNow,
            endsAt: pause?.expectedEndAt,
            balanceMonths: null,
            beneficiaryUserId: s.userId
        });
        expect(
            (
                await resolveCourtesySources({
                    userId: s.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: s.ports
                })
            ).sources
        ).toMatchObject([{ type: 'COURTESY', until: courtesy?.endsAt }]);
        expect(s.harness.calls).toEqual([
            `pause:${s.authorizationId}`,
            `read:${s.authorizationId}`
        ]);
        expect(
            await readPauseQuota({
                tx: db,
                userId: s.userId,
                vertical: VerticalEnum.ACCOMMODATION,
                now: courtesyNow
            })
        ).toEqual(before);
    });
    it.each([
        'annual',
        'quarterly',
        'semiannual'
    ] as const)('refuses %s billing without writing', async (cycle) => {
        const s = await seedCourtesyPrincipal({ annual: true });
        const [row] = await db
            .select({ id: subscriptions.billingOptionId })
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        if (cycle !== 'annual' && row?.id)
            await db.update(billingOptions).set({ cycle }).where(eq(billingOptions.id, row.id));
        expect(await grant(s)).toEqual({ outcome: 'REFUSED', reason: 'NOT_MONTHLY' });
        expect(
            (
                await db
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, s.subscriptionId))
            )[0]?.status
        ).toBe('ACTIVE');
        expect(
            await db
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.subscriptionId, s.subscriptionId))
        ).toEqual([]);
        expect(
            await db
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId))
        ).toEqual([]);
    });
    it('grants to a manual payer without a provider call', async () => {
        const s = await seedCourtesyPrincipal({ manual: true });
        expect(await grant(s)).toMatchObject({ outcome: 'GRANTED' });
        expect(s.harness.calls).toEqual([]);
    });
    it('keeps ACTIVE and opens mark 22 when the provider did not apply the pause', async () => {
        const s = await seedCourtesyPrincipal({ pauseAcknowledgesOnly: true });
        expect(await grant(s)).toEqual({ outcome: 'NOT_APPLIED' });
        expect(
            (
                await db
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, s.subscriptionId))
            )[0]?.status
        ).toBe('ACTIVE');
        expect(
            await db
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId))
        ).toEqual([]);
        expect(
            await db
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.subscriptionId, s.subscriptionId))
        ).toEqual([]);
        expect(
            await db
                .select({ reason: reconciliationMarks.reason })
                .from(reconciliationMarks)
                .where(
                    and(
                        eq(reconciliationMarks.subscriptionId, s.subscriptionId),
                        isNull(reconciliationMarks.liftedAt)
                    )
                )
        ).toEqual([{ reason: 'PAUSA_NO_APLICADA' }]);
    });
    it('refuses a live permanent anchor on the same vertical', async () => {
        const a = await createPermanentAnchor();
        const s = await seedCourtesyPrincipal({ userId: a.userId });
        expect(await grant(s)).toEqual({ outcome: 'REFUSED', reason: 'LIVE_GRANT_ANCHOR' });
    });
    it('grants after the permanent anchor was revoked', async () => {
        const a = await createPermanentAnchor({ revoked: true });
        const s = await seedCourtesyPrincipal({ userId: a.userId });
        expect(await grant(s)).toMatchObject({ outcome: 'GRANTED' });
    });
    it('grants when the live anchor belongs to another vertical', async () => {
        const a = await createPermanentAnchor({ vertical: 'venue' });
        const s = await seedCourtesyPrincipal({ userId: a.userId });
        expect(await grant(s)).toMatchObject({ outcome: 'GRANTED' });
    });
    it('grants even when the plan disallows customer pauses', async () => {
        const s = await seedCourtesyPrincipal();
        await db
            .update(planVersions)
            .set({ allowsPause: false })
            .where(eq(planVersions.id, s.planVersionId));
        expect(await grant(s)).toMatchObject({ outcome: 'GRANTED' });
    });
    it('refuses fractional and zero months', async () => {
        const s = await seedCourtesyPrincipal();
        expect(await grant(s, 1.5)).toEqual({ outcome: 'REFUSED', reason: 'MONTHS_INVALID' });
        expect(await grant(s, 0)).toEqual({ outcome: 'REFUSED', reason: 'MONTHS_INVALID' });
    });
});
