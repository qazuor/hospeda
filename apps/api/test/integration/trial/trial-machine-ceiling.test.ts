import { randomUUID } from 'node:crypto';
import { eq, getDb, verticalDeadlineVersions } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import {
    getTrialMachinePorts,
    TrialCeilingConfigurationError
} from '../../../src/utils/trial/trial-machine-ports';
import { testDb } from '../../../test/e2e/setup/test-database';

initApp({ clock: { now: () => new Date('2026-10-15T12:00:00.000Z') } });

describe('TEST:HOS-1588-3B trial machine ceiling port', () => {
    beforeAll(async () => testDb.setup());
    afterAll(async () => testDb.teardown());

    it('reads PLAZO:7 from the seeded vertical deadlines version 1', async () => {
        const { unitOfWork } = getTrialMachinePorts();
        const days = await unitOfWork.runLocked(
            { userId: randomUUID(), vertical: VerticalEnum.ACCOMMODATION },
            (tx) =>
                tx.findTrialCeilingDays({
                    vertical: VerticalEnum.ACCOMMODATION,
                    deadlinesVersion: 1
                })
        );
        expect(days).toBe(90);
    });

    it('reads the requested version value instead of a fixed trial ceiling', async () => {
        const db = getDb();
        const [versionOne] = await db
            .select({ values: verticalDeadlineVersions.values })
            .from(verticalDeadlineVersions)
            .where(eq(verticalDeadlineVersions.version, 1));
        if (!versionOne) throw new Error('Seeded vertical deadlines version 1 is missing');
        const probeVersion = 999_998;
        // Deadline snapshots are immutable; the integration database is dropped by testDb teardown.
        await db.insert(verticalDeadlineVersions).values({
            version: probeVersion,
            values: { ...versionOne.values, '7': { days: 91 } }
        });
        const { unitOfWork } = getTrialMachinePorts();
        const days = await unitOfWork.runLocked(
            { userId: randomUUID(), vertical: VerticalEnum.ACCOMMODATION },
            (tx) =>
                tx.findTrialCeilingDays({
                    vertical: VerticalEnum.ACCOMMODATION,
                    deadlinesVersion: probeVersion
                })
        );
        expect(days).toBe(91);
    });

    it('fails closed with a typed error when the deadline version does not exist', async () => {
        const { unitOfWork } = getTrialMachinePorts();
        await expect(
            unitOfWork.runLocked(
                { userId: randomUUID(), vertical: VerticalEnum.ACCOMMODATION },
                (tx) =>
                    tx.findTrialCeilingDays({
                        vertical: VerticalEnum.ACCOMMODATION,
                        deadlinesVersion: 999_999
                    })
            )
        ).rejects.toMatchObject({
            name: TrialCeilingConfigurationError.name,
            reason: 'DEADLINE_VERSION_NOT_FOUND'
        });
        await expect(
            unitOfWork.runLocked(
                { userId: randomUUID(), vertical: VerticalEnum.ACCOMMODATION },
                (tx) =>
                    Reflect.apply(tx.findTrialCeilingDays, tx, [
                        { vertical: 'missing-vertical', deadlinesVersion: 1 }
                    ])
            )
        ).rejects.toMatchObject({
            reason: 'VERTICAL_NOT_FOUND',
            vertical: 'missing-vertical'
        });
    });
});
