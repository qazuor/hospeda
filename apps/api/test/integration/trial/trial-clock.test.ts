import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, trials } from '@repo/db';
import { createAdjustableClock } from '@repo/test-clock';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expireDueTrials } from '../../../../../packages/verticals/src/trial/trial-expiry';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getTrialMachinePorts } from '../../../src/utils/trial/trial-machine-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createOwner,
    createTrial,
    ensureAccommodationCatalog
} from '../listing-publication/publication-routes.helpers';

const start = new Date('2026-10-10T12:00:00.000Z');

function systemTimeMatches(source: string): boolean {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '');
    return /Date\.now\s*\(/.test(withoutComments) || /new Date\(\s*\)/.test(withoutComments);
}

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
});
beforeEach(async () => {
    await testDb.clean();
    await ensureAccommodationCatalog();
});
afterAll(async () => testDb.teardown());

describe('TEST:V4:19 - the trial expires when the shared adjustable clock advances; the machine never reads the system time', () => {
    it('expires a real trial after advancing the injected shared clock', async () => {
        const clock = createAdjustableClock({ start });
        injectClock({ clock });
        const owner = await createOwner();
        await createTrial({ userId: owner.id, status: 'TRIAL_ACTIVE' });
        const [trial] = await getDb().select().from(trials).where(eq(trials.userId, owner.id));
        if (!trial) throw new Error('Fixture trial was not created');
        await getDb()
            .update(trials)
            .set({ endsAt: new Date(start.getTime() + 3_600_000) })
            .where(eq(trials.id, trial.id));
        const ports = getTrialMachinePorts();
        const args = { ...ports, clock, batchSize: 100 };
        await expireDueTrials(args);
        const [before] = await getDb().select().from(trials).where(eq(trials.id, trial.id));
        expect(before?.status).toBe('TRIAL_ACTIVE');
        clock.advance({ ms: 2 * 3_600_000 });
        await expireDueTrials(args);
        const [after] = await getDb().select().from(trials).where(eq(trials.id, trial.id));
        expect(after?.status).toBe('TRIAL_EXPIRED');
    });

    it('has no system clock reads in trial sources and proves its detector on a positive control', () => {
        const directory = resolve(
            import.meta.dirname,
            '../../../../../packages/verticals/src/trial'
        );
        const files = readdirSync(directory).filter((file) => file.endsWith('.ts'));
        const sources = files.map((file) => readFileSync(resolve(directory, file), 'utf8'));
        expect(files.length).toBeGreaterThan(5);
        expect(sources.some(systemTimeMatches)).toBe(false);
        expect(systemTimeMatches('const now = new Date();')).toBe(true);
    });
});
