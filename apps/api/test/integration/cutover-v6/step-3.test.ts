import {
    accommodations,
    and,
    emailOutbox,
    eq,
    experiences,
    getDb,
    inArray,
    plans,
    planVersions,
    trials,
    venues
} from '@repo/db';
import { PublicationStatusEnum, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { computeTrialEmailPseudonym } from '@repo/service-core';
import { marketMidnight } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runStep3, STEP3_EXIT_CODE } from '../../../src/services/cutover-v6/step-3.service.js';
import { injectClock } from '../../../src/utils/clock.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    createVerticalListing,
    ensurePublicationCatalog
} from '../listing-publication/publication-routes.helpers.js';

const CUTOVER = new Date('2026-10-10T12:00:00.000Z');
const fixedClock = (at: Date) => ({ now: () => at });
type Seeded = {
    userId: string;
    email: string;
    listingId: string;
    vertical:
        | typeof VerticalEnum.ACCOMMODATION
        | typeof VerticalEnum.VENUE
        | typeof VerticalEnum.EXPERIENCE;
};

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    for (const vertical of [
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ] as const)
        await ensurePublicationCatalog(vertical);
    injectClock({ clock: fixedClock(CUTOVER) });
});
afterEach(async () => testDb.clean());
afterAll(async () => testDb.teardown());

async function seedFive(): Promise<Seeded[]> {
    const seeded: Seeded[] = [];
    const kinds = [
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.ACCOMMODATION,
        VerticalEnum.VENUE,
        VerticalEnum.VENUE,
        VerticalEnum.EXPERIENCE
    ] as const;
    for (const kind of kinds) {
        const owner = await createOwner();
        const destinationId = await createVerticalDestination();
        const listingId =
            kind === VerticalEnum.ACCOMMODATION
                ? await createListing({
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED
                  })
                : await createVerticalListing({
                      vertical: kind,
                      ownerId: owner.id,
                      destinationId,
                      status: PublicationStatusEnum.PUBLISHED
                  });
        const table =
            kind === VerticalEnum.ACCOMMODATION
                ? accommodations
                : kind === VerticalEnum.VENUE
                  ? venues
                  : experiences;
        await getDb().update(table).set({ inactiveSince: CUTOVER }).where(eq(table.id, listingId));
        seeded.push({ userId: owner.id, email: owner.email, listingId, vertical: kind });
    }
    return seeded;
}

async function storedFor(seeded: readonly Seeded[]) {
    return getDb()
        .select()
        .from(trials)
        .where(
            inArray(
                trials.userId,
                seeded.map((row) => row.userId)
            )
        );
}
async function outboxFor(seeded: readonly Seeded[]) {
    return getDb()
        .select()
        .from(emailOutbox)
        .where(
            inArray(
                emailOutbox.recipientUserId,
                seeded.map((row) => row.userId)
            )
        );
}
async function expectedCatalog(vertical: Seeded['vertical']) {
    const rows = await getDb()
        .select({
            id: planVersions.id,
            planId: planVersions.planId,
            trialDays: planVersions.trialDays,
            rank: planVersions.rank,
            sellable: planVersions.sellable,
            role: plans.role
        })
        .from(planVersions)
        .innerJoin(plans, eq(planVersions.planId, plans.id))
        .where(and(eq(plans.vertical, vertical), eq(planVersions.current, true)));
    const trial = rows.find((row) => row.role === 'trial');
    const ordered = rows.filter((row) => row.sellable).sort((a, b) => a.rank - b.rank);
    const limits = ordered[0];
    const entitlements = ordered.at(-1);
    if (!trial || !limits || !entitlements) throw new Error('Missing seeded trial catalog');
    return { trial, limits, entitlements };
}
async function expectedPlan(seed: Seeded) {
    const catalog = await expectedCatalog(seed.vertical);
    return {
        userId: seed.userId,
        vertical: seed.vertical,
        listingId: seed.listingId,
        trialPlanId: catalog.trial.planId,
        floorEntitlementsVersionId: catalog.entitlements.id,
        floorLimitsVersionId: catalog.limits.id,
        floorTrialPlanVersionId: catalog.trial.id,
        startedAt: CUTOVER.toISOString(),
        endsAt: new Date(CUTOVER.getTime() + catalog.trial.trialDays * 86_400_000).toISOString(),
        deadlinesVersion: (
            await getDb()
                .select()
                .from((await import('@repo/db')).verticalDeadlineVersions)
        ).reduce((max, row) => Math.max(max, row.version), 0)
    };
}
async function expectedPlans(seeded: readonly Seeded[]) {
    return (await Promise.all(seeded.map(expectedPlan))).sort((a, b) =>
        a.listingId.localeCompare(b.listingId)
    );
}
function sortedPlans(planned: readonly { readonly listingId: string }[]) {
    return [...planned].sort((a, b) => a.listingId.localeCompare(b.listingId));
}

describe('TEST:1695:2 AC:1695:1 the step 3 CLI writes the five cutover trials with the real campaign adapter', () => {
    it('writes catalog-backed trials and campaigns, exposes secret-free plans, and reruns idempotently', async () => {
        const seeded = await seedFive();
        const result = await runStep3({
            dryRun: false,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock(CUTOVER)
        });
        expect(result.status).toBe('completed');
        expect(new Set(result.written.map((row) => row.listingId))).toEqual(
            new Set(seeded.map((row) => row.listingId))
        );
        expect(result.skipped).toEqual([]);
        const stored = await storedFor(seeded);
        expect(stored).toHaveLength(5);
        const outbox = await outboxFor(seeded);
        expect(outbox).toHaveLength(20);
        for (const seed of seeded) {
            const row = stored.find((trial) => trial.userId === seed.userId);
            const pseudo = computeTrialEmailPseudonym({ email: seed.email });
            if (!row || !pseudo.ok) throw new Error('Missing seeded trial or pseudonym');
            const plan = await expectedPlan(seed);
            expect(row).toMatchObject({
                vertical: seed.vertical,
                status: TrialStatusEnum.TRIAL_ACTIVE,
                startedAt: CUTOVER,
                endsAt: new Date(plan.endsAt),
                trialPlanId: plan.trialPlanId,
                floorEntitlementsVersionId: plan.floorEntitlementsVersionId,
                floorLimitsVersionId: plan.floorLimitsVersionId,
                floorTrialPlanVersionId: plan.floorTrialPlanVersionId,
                emailPseudonym: pseudo.pseudonym
            });
            const campaignRows = outbox.filter((email) => email.recipientUserId === seed.userId);
            expect(campaignRows).toHaveLength(4);
            expect(new Set(campaignRows.map((email) => email.template))).toEqual(
                new Set([
                    'trial_ending_10d',
                    'trial_ending_5d',
                    'trial_ending_2d',
                    'trial_ending_today'
                ])
            );
            for (const email of campaignRows) {
                expect(email.status).toBe('pending');
                expect(email.payload.verticals).toEqual([seed.vertical]);
                const date = email.payload.targetDate;
                if (typeof date !== 'string') throw new Error('Missing campaign target date');
                const [year, month, day] = date.split('-').map(Number);
                expect(email.sendAfter).toEqual(
                    marketMidnight({ year: year!, month: month!, day: day! })
                );
            }
        }
        expect(sortedPlans(result.planned)).toEqual(await expectedPlans(seeded));
        const rerun = await runStep3({
            dryRun: false,
            ownerIds: seeded.map((row) => row.userId),
            clock: fixedClock(CUTOVER)
        });
        expect(rerun.status).toBe('already_done');
        expect(rerun.written).toEqual([]);
        expect(rerun.skipped).toHaveLength(5);
        expect(await storedFor(seeded)).toHaveLength(5);
        expect(await outboxFor(seeded)).toHaveLength(20);
    });
});

describe('TEST:1695:3 AC:1695:2 --dry-run writes nothing and an empty plan is not a success', () => {
    it('previews all five rows without writes, then confirms the same seed', async () => {
        const seeded = await seedFive();
        const args = { ownerIds: seeded.map((row) => row.userId), clock: fixedClock(CUTOVER) };
        const preview = await runStep3({ ...args, dryRun: true });
        expect(preview.status).toBe('dry_run');
        expect(sortedPlans(preview.planned)).toEqual(await expectedPlans(seeded));
        expect(preview.written).toEqual([]);
        expect(preview.skipped).toEqual([]);
        expect(await storedFor(seeded)).toHaveLength(0);
        expect(await outboxFor(seeded)).toHaveLength(0);
        const confirmed = await runStep3({ ...args, dryRun: false });
        expect(confirmed.written).toHaveLength(5);
    });
    it('returns a failing status for owners without published listings in either mode', async () => {
        const owners = await Promise.all([createOwner(), createOwner()]);
        for (const dryRun of [true, false]) {
            const result = await runStep3({
                dryRun,
                ownerIds: owners.map((owner) => owner.id),
                clock: fixedClock(CUTOVER)
            });
            expect(result.status).toBe('nothing_planned');
            expect(STEP3_EXIT_CODE[result.status]).toBe(1);
        }
    });
});
