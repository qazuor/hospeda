import { eq, providerLinks, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantTemporaryCourtesy } from '../../../src/services/billing/subscription/grant-temporary-courtesy.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import {
    previewTemporaryCourtesyGrant,
    previewTemporaryCourtesyRevoke
} from '../../../src/services/billing/subscription/temporary-courtesy-preview.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    createPermanentAnchor,
    retireCourtesyFixtures,
    seedCourtesyPrincipal
} from './support/courtesy-fixtures.js';
import { addonPolicyFromTx } from './support/coverage-fixtures.js';
import { pausePlanPolicy } from './support/pause-fixtures.js';

const db = getServiceTestDb();
const grant = (s: Awaited<ReturnType<typeof seedCourtesyPrincipal>>, months = 2) =>
    grantTemporaryCourtesy(
        { subscriptionId: s.subscriptionId, months, grantedBy: s.userId, reason: 'Preview parity' },
        s.ports
    );
const preview = (s: Awaited<ReturnType<typeof seedCourtesyPrincipal>>, months = 2) =>
    previewTemporaryCourtesyGrant({ subscriptionId: s.subscriptionId, months }, s.ports);

afterEach(retireCourtesyFixtures);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('AC:B9b:10 temporary courtesy previews', () => {
    it('projects S9 and S34 ends using the same calendar rule as the service', async () => {
        const s = await seedCourtesyPrincipal({ manual: true });
        const firstPreview = await preview(s);
        expect(firstPreview).toMatchObject({
            offered: true,
            endsAt: new Date('2026-12-14T12:00:00.000Z'),
            liveCourtesy: null
        });
        const first = await grant(s);
        expect(first).toMatchObject({ outcome: 'GRANTED', endsAt: firstPreview.endsAt });
        const secondPreview = await preview(s, 3);
        expect(secondPreview).toMatchObject({
            offered: true,
            endsAt: new Date('2027-03-14T12:00:00.000Z')
        });
        expect(secondPreview.liveCourtesy).toMatchObject({
            courtesyGrantId: first.outcome === 'GRANTED' ? first.courtesyGrantId : '',
            remainingMonths: 2
        });
        const second = await grant(s, 3);
        expect(second).toMatchObject({ outcome: 'EXTENDED', endsAt: secondPreview.endsAt });
    });

    it('agrees with the service on reachable annual, invalid-month and customer-pause refusals', async () => {
        const annual = await seedCourtesyPrincipal({ annual: true });
        const annualPreview = await preview(annual);
        const annualResult = await grant(annual);
        expect(annualPreview).toMatchObject({
            offered: false,
            reason: 'NOT_MONTHLY',
            alternatives: ['PERMANENT_GRANT', 'RENEWAL_PROMO']
        });
        expect(annualResult).toEqual({ outcome: 'REFUSED', reason: annualPreview.reason });

        const invalid = await seedCourtesyPrincipal();
        const invalidPreview = await preview(invalid, 0);
        expect(invalidPreview.reason).toBe('MONTHS_INVALID');
        expect(await grant(invalid, 0)).toEqual({
            outcome: 'REFUSED',
            reason: invalidPreview.reason
        });

        const paused = await seedCourtesyPrincipal();
        const applied = await pauseSubscription(
            { subscriptionId: paused.subscriptionId, requestedMonths: 1 },
            {
                ...paused.ports,
                planPolicy: pausePlanPolicy(),
                complements: {
                    addonPolicy: addonPolicyFromTx(db),
                    listing: async () => {
                        throw new Error('No listing addon seeded');
                    }
                }
            }
        );
        expect(applied.outcome).toBe('PAUSED');
        const pausedPreview = await preview(paused);
        expect(pausedPreview.reason).toBe('SUBSCRIPTION_PAUSED');
        expect(await grant(paused)).toEqual({ outcome: 'REFUSED', reason: pausedPreview.reason });
    });

    it('agrees on a live anchor and a missing card provider link', async () => {
        const anchor = await createPermanentAnchor();
        const anchored = await seedCourtesyPrincipal({ userId: anchor.userId });
        const anchorPreview = await preview(anchored);
        expect(anchorPreview.reason).toBe('LIVE_GRANT_ANCHOR');
        expect(await grant(anchored)).toEqual({ outcome: 'REFUSED', reason: anchorPreview.reason });

        const unlinked = await seedCourtesyPrincipal();
        await db
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, unlinked.subscriptionId));
        const linkPreview = await preview(unlinked);
        expect(linkPreview.reason).toBe('NO_PROVIDER_LINK');
        expect(await grant(unlinked)).toEqual({ outcome: 'REFUSED', reason: linkPreview.reason });
    });

    it('agrees on non-principal and inconsistent paused fixture rows', async () => {
        const complement = await seedCourtesyPrincipal();
        // Seeded class shape: no S9 transition changes a principal into a complement.
        await db
            .update(subscriptions)
            .set({ class: 'COMPLEMENTO' })
            .where(eq(subscriptions.id, complement.subscriptionId));
        const complementPreview = await preview(complement);
        expect(complementPreview.reason).toBe('NOT_PRINCIPAL');
        expect(await grant(complement)).toEqual({
            outcome: 'REFUSED',
            reason: complementPreview.reason
        });

        const pausedWithoutPause = await seedCourtesyPrincipal();
        // Seeded inconsistent row: no service produces PAUSED without an open pause.
        await db
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, pausedWithoutPause.subscriptionId));
        const ineligiblePreview = await preview(pausedWithoutPause);
        expect(ineligiblePreview.reason).toBe('NOT_ELIGIBLE');
        expect(await grant(pausedWithoutPause)).toEqual({
            outcome: 'REFUSED',
            reason: ineligiblePreview.reason
        });
    });

    it('predicts a charge from the live courtesy end when pause clears nextChargeAt', async () => {
        const s = await seedCourtesyPrincipal({ manual: true });
        const result = await grant(s);
        expect(result.outcome).toBe('GRANTED');
        await db
            .update(subscriptions)
            .set({ nextChargeAt: null })
            .where(eq(subscriptions.id, s.subscriptionId));
        const revoke = await previewTemporaryCourtesyRevoke(
            { subscriptionId: s.subscriptionId },
            s.ports
        );
        expect(revoke.inForce).toBe(true);
        expect(revoke.predictedNextChargeAt).toEqual(
            result.outcome === 'GRANTED' ? result.endsAt : undefined
        );
    });

    it('rolls a past next-charge date by billing cycle until it passes the clock', async () => {
        const s = await seedCourtesyPrincipal({ manual: true });
        const result = await grant(s);
        expect(result.outcome).toBe('GRANTED');
        await db
            .update(subscriptions)
            .set({ nextChargeAt: new Date('2026-08-14T12:00:00.000Z') })
            .where(eq(subscriptions.id, s.subscriptionId));
        const revoke = await previewTemporaryCourtesyRevoke(
            { subscriptionId: s.subscriptionId },
            s.ports
        );
        expect(revoke).toMatchObject({
            inForce: true,
            predictedNextChargeAt: new Date('2026-11-14T12:00:00.000Z')
        });
        expect(revoke.courtesy?.endsAt).toEqual(
            result.outcome === 'GRANTED' ? result.endsAt : undefined
        );
    });
});
