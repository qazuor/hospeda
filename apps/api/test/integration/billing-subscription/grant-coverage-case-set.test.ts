import type { CaseRunner } from '@repo/billing-verticals-contract/testing';
import { createBootstrapBillingForVerticals } from '@repo/verticals';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { createApiBillingCoverage } from '../../../src/utils/listing-access/billing-coverage';
import { createBootstrapCoverageReader } from '../../../src/utils/listing-access/bootstrap-coverage-reader';
import { testDb } from '../../e2e/setup/test-database';
import { ensureAccommodationCatalog } from '../listing-publication/publication-routes.helpers';
import { grantCoverageCaseSet } from './grant-coverage-case-set';
import { cleanGrantCoverageFixtures, makeGrantCoverageHarness } from './grant-coverage-fixtures';

const FIXTURE_NOW = new Date('2026-10-12T12:00:00.000Z');

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => FIXTURE_NOW } });
    await ensureAccommodationCatalog();
});

afterEach(cleanGrantCoverageFixtures);
afterAll(() => testDb.teardown());

async function realHarness() {
    const { coverage } = createApiBillingCoverage({ reader: createBootstrapCoverageReader() });
    return makeGrantCoverageHarness({ subject: { coverage } });
}

async function bootstrapHarness() {
    const bootstrap = createBootstrapBillingForVerticals({
        reader: createBootstrapCoverageReader()
    });
    return makeGrantCoverageHarness({ subject: bootstrap });
}

describe('TEST:B9a:12 production API coverage composition', () => {
    grantCoverageCaseSet({ describe, it, expect, makeHarness: realHarness });

    it('proves bootstrap fails the GRANT and seeded COURTESY cases', async () => {
        const cases: { name: string; body: () => Promise<void> }[] = [];
        const runner: CaseRunner = {
            describe: (_name, body) => body(),
            it: (name, body) => cases.push({ name, body }),
            expect
        };
        grantCoverageCaseSet({ ...runner, makeHarness: bootstrapHarness });
        const failed: string[] = [];
        for (const testCase of cases) {
            try {
                await testCase.body();
            } catch {
                failed.push(testCase.name);
            }
        }
        expect(failed).toContain(
            'a live permanent grant covers its anchored vertical with a GRANT source that carries its floor (AC:B9a:12)'
        );
        expect(failed).toContain(
            'the real COURTESY source emits nothing from empty tables and one source from a seeded row (AC:B9a:12)'
        );
    });
});
