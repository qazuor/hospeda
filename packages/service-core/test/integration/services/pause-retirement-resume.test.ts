import { emailOutbox, eq, inArray, planMigrationSubscriptions, planMigrations } from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { launchPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-launch.service.js';
import { previewPlanMigration } from '../../../src/services/billing/plan-migration/plan-migration-preview.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { resumeSubscription } from '../../../src/services/billing/subscription/resume-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { pausePlanPolicy } from './support/pause-fixtures.js';
import { seedPlanChangePromo } from './support/plan-change-fixtures.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    migrationClock,
    setMigrationTargetCycle
} from './support/plan-migration-fixtures.js';
import { localDayInstant } from './support/plan-migration-increase-fixtures.js';
import { registerPlanMigrationNoticeSerial } from './support/plan-migration-notice-serial.js';

registerPlanMigrationNoticeSerial();

const db = getServiceTestDb();
/** Destination list price seeded through action 19 for the retirement. */
const TARGET_AMOUNT_MINOR = 300000;
const complements = {
    addonPolicy: async () => {
        throw new Error('Unexpected addon policy');
    },
    listing: async () => {
        throw new Error('Unexpected listing policy');
    }
};

type RetirementCase = Awaited<ReturnType<typeof createPlanMigrationCase>>;

const migrationIds: string[] = [];
const recipientIds: string[] = [];

/** Launches the real retirement of `createPlanMigrationCase` and returns its pending scope. */
async function launchRetirement(seeded: RetirementCase) {
    const input = {
        sourcePlanVersionId: seeded.planVersionId,
        targetPlanVersionId: seeded.targetPlanVersionId,
        reason: 'RETIREMENT' as const
    };
    const preview = await previewPlanMigration({
        actor: seeded.actor,
        input,
        verticals: seeded.verticals,
        clock: migrationClock
    });
    const launched = await launchPlanMigration({
        actor: seeded.actor,
        input: { ...input, cohortFingerprint: preview.cohortFingerprint },
        verticals: seeded.verticals,
        clock: migrationClock
    });
    migrationIds.push(launched.planMigrationId);
    recipientIds.push(seeded.user.id);
    const [scope] = await db
        .select()
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.planMigrationId, launched.planMigrationId));
    if (!scope) throw new Error('Retirement scope missing');
    return { launched, scope };
}

/** Pauses the principal and resumes it on the migration's own application day. */
async function pauseAndResumeOnApplicationDay(seeded: RetirementCase, applicationDay: string) {
    const paused = await pauseSubscription(
        { subscriptionId: seeded.predecessor.id, requestedMonths: 2 },
        {
            provider: seeded.provider,
            clock: migrationClock,
            planPolicy: pausePlanPolicy(),
            complements
        }
    );
    expect(paused.outcome).toBe('PAUSED');
    seeded.fake.moveNextCharge({
        authorizationId: seeded.started.authorizationId,
        at: localDayInstant(applicationDay)
    });
    const resumed = await resumeSubscription(
        { subscriptionId: seeded.predecessor.id, cause: 'EARLY' },
        { provider: seeded.provider, clock: migrationClock, complements }
    );
    expect(resumed.outcome).toBe('RESUMED');
    if (resumed.outcome !== 'RESUMED') throw new Error('S10 failed');
    return resumed;
}

async function createRetirementCase(): Promise<RetirementCase> {
    const seeded = await createPlanMigrationCase();
    await setMigrationTargetCycle({
        actor: seeded.actor,
        planVersionId: seeded.targetPlanVersionId,
        cycle: 'monthly',
        amount: TARGET_AMOUNT_MINOR
    });
    return seeded;
}

afterEach(async () => {
    const recipients = recipientIds.splice(0);
    if (recipients.length)
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, recipients));
    for (const id of migrationIds.splice(0)) {
        await db
            .delete(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.planMigrationId, id));
        await db.delete(planMigrations).where(eq(planMigrations.id, id));
    }
    await cleanupPlanMigrationCases();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8b:4 el «cuánto» al reanudar también vale para un retiro',
    () => {
        it('si el cobro reanudado es la fecha de aplicación, informa el monto del destino', async () => {
            const seeded = await createRetirementCase();
            const { scope } = await launchRetirement(seeded);
            const applicationDay = getLocalDateString({ instant: scope.applicationDate });

            const resumed = await pauseAndResumeOnApplicationDay(seeded, applicationDay);
            expect(resumed.nextCharge).toEqual({
                at: localDayInstant(applicationDay),
                amountMinor: TARGET_AMOUNT_MINOR,
                currency: 'ARS'
            });
        });

        it('en un retiro con una promo viva, el monto informado no descuenta la promo', async () => {
            const seeded = await createRetirementCase();
            await seedPlanChangePromo({
                subscriptionId: seeded.predecessor.id,
                userId: seeded.user.id
            });
            const { scope } = await launchRetirement(seeded);
            const applicationDay = getLocalDateString({ instant: scope.applicationDate });

            const resumed = await pauseAndResumeOnApplicationDay(seeded, applicationDay);
            // A retirement drops the live promo, so the destination list price is reported.
            expect(resumed.nextCharge).toEqual({
                at: localDayInstant(applicationDay),
                amountMinor: TARGET_AMOUNT_MINOR,
                currency: 'ARS'
            });
        });
    }
);
