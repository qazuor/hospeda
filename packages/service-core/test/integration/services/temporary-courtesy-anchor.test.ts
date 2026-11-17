import { courtesyGrants, eq, subscriptionPauses, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import type { ComplementPolicyPorts } from '../../../src/services/billing/subscription/complement-ports.js';
import { computeCourtesyBalanceMonths } from '../../../src/services/billing/subscription/courtesy-balance.js';
import { endDuePauses } from '../../../src/services/billing/subscription/end-due-pauses.service.js';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { previewTemporaryCourtesyGrant } from '../../../src/services/billing/subscription/temporary-courtesy-preview.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    courtesyNow,
    retireCourtesyFixtures,
    seedCourtesyPrincipal
} from './support/courtesy-fixtures.js';
import { adjustablePauseHarness, seedPausePrincipal } from './support/pause-fixtures.js';

const db = getServiceTestDb();
const anchor = new Date('2026-11-10T12:00:00.000Z');
const expectedEnd = new Date('2027-01-09T12:00:00.000Z');
const emptyComplements: ComplementPolicyPorts = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};

afterEach(retireCourtesyFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('HOS-2300 temporary courtesy anchor', () => {
    it('anchors S9 preview and grant to the next charge and preserves two months of balance', async () => {
        const s = await seedCourtesyPrincipal();
        await db
            .update(subscriptions)
            .set({ nextChargeAt: anchor })
            .where(eq(subscriptions.id, s.subscriptionId));

        const preview = await previewTemporaryCourtesyGrant(
            { subscriptionId: s.subscriptionId, months: 2 },
            s.ports
        );
        expect(preview.endsAt).toEqual(expectedEnd);

        const grant = await grantTemporaryCourtesy(
            {
                subscriptionId: s.subscriptionId,
                months: 2,
                grantedBy: s.userId,
                reason: 'HOS-2300 regression'
            },
            s.ports
        );
        expect(grant).toMatchObject({ outcome: 'GRANTED', endsAt: expectedEnd });
        const [courtesy] = await db
            .select()
            .from(courtesyGrants)
            .where(eq(courtesyGrants.subscriptionId, s.subscriptionId));
        const [pause] = await db
            .select()
            .from(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, s.subscriptionId));
        expect(courtesy).toMatchObject({ startsAt: anchor, endsAt: expectedEnd, months: 2 });
        if (!courtesy) throw new Error('Courtesy grant row was not created');
        expect(
            computeCourtesyBalanceMonths({
                startsAt: courtesy.startsAt,
                endsAt: courtesy.endsAt,
                now: courtesyNow
            })
        ).toEqual({ months: 2 });
        expect(pause).toMatchObject({ startsAt: courtesyNow, expectedEndAt: expectedEnd });
    });

    it('rolls a missed next charge beyond now and falls back to now when absent', async () => {
        const s = await seedCourtesyPrincipal({ manual: true });
        await db
            .update(subscriptions)
            .set({ nextChargeAt: new Date('2026-09-10T12:00:00.000Z') })
            .where(eq(subscriptions.id, s.subscriptionId));
        expect(
            (
                await previewTemporaryCourtesyGrant(
                    { subscriptionId: s.subscriptionId, months: 2 },
                    s.ports
                )
            ).endsAt
        ).toEqual(expectedEnd);
        await db
            .update(subscriptions)
            .set({ nextChargeAt: null })
            .where(eq(subscriptions.id, s.subscriptionId));
        expect(
            (
                await previewTemporaryCourtesyGrant(
                    { subscriptionId: s.subscriptionId, months: 2 },
                    s.ports
                )
            ).endsAt
        ).toEqual(new Date('2026-12-13T12:00:00.000Z'));
    });

    it.each([
        { manual: false },
        { manual: true }
    ])('resumes before the unsuppressed charge for card/manual payer %#', async ({ manual }) => {
        const harness = adjustablePauseHarness();
        const s = await seedPausePrincipal({ harness, paymentMethod: manual ? 'MANUAL' : 'CARD' });
        const clock = harness.clock;
        const ports = {
            provider: harness.provider,
            clock,
            coverageNotices: { emitCoverageChanged: async () => undefined }
        };
        const chargeAnchor = new Date('2026-11-10T12:00:00.000Z');
        harness.fake.moveNextCharge({ authorizationId: s.authorizationId, at: chargeAnchor });
        await db
            .update(subscriptions)
            .set({ nextChargeAt: chargeAnchor })
            .where(eq(subscriptions.id, s.subscriptionId));
        const grant = await grantTemporaryCourtesy(
            {
                subscriptionId: s.subscriptionId,
                months: 2,
                grantedBy: s.userId,
                reason: 'RP10 regression'
            },
            ports
        );
        expect(grant.outcome).toBe('GRANTED');
        if (grant.outcome !== 'GRANTED') throw new Error('Courtesy grant was not created');
        clock.set({ at: new Date(grant.endsAt.getTime() + 60 * 60 * 1000) });
        expect(
            await endDuePauses({ limit: 10 }, { ...ports, complements: emptyComplements })
        ).toMatchObject({ resumed: 1 });
        const [row] = await db
            .select({ nextChargeAt: subscriptions.nextChargeAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, s.subscriptionId));
        expect(row?.nextChargeAt).toEqual(new Date('2027-01-10T12:00:00.000Z'));
    });
});
