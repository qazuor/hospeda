import { planCatalogModel } from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { listPlanMigrationOptions } from '../../../src/services/billing/plan-migration/plan-migration-options.service.js';
import { listRetiredPlanVersions } from '../../../src/services/billing/plan-migration/plan-migration-retired-versions.service.js';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanupPlanMigrationCases,
    createPlanMigrationCase,
    createPriceIncreaseCase
} from './support/plan-migration-fixtures.js';

const verticals = createPlanCatalogInverse({ reader: planCatalogModel });

afterEach(cleanupPlanMigrationCases);
afterAll(closeServiceTestPool);

/** Ask the retired listing and keep only the versions anchored to these plans. */
async function retiredItems(actor: Actor, ids: readonly string[]) {
    const list = await listRetiredPlanVersions({ actor, verticals });
    return list.items.filter((item) => ids.includes(item.id));
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1616 O-3 las opciones y el listado de retiradas distinguen las versiones de un mismo plan',
    () => {
        it('el origen y el destino de un aumento llevan números distintos', async () => {
            const seeded = await createPriceIncreaseCase();
            const options = await listPlanMigrationOptions({
                actor: seeded.actor,
                verticals
            });
            const pair = options.increases.filter(
                (entry) => entry.source.id === seeded.planVersionId
            );
            expect(pair).toHaveLength(1);
            // The source is the first version created for its plan.
            expect(pair[0]?.source).toEqual({
                id: seeded.planVersionId,
                planId: seeded.planId,
                name: 'Succession plan',
                vertical: 'accommodation',
                versionNumber: 1,
                customerCount: 1
            });
            // The increase target is the second version of the same plan.
            expect(pair[0]?.target).toEqual({
                id: seeded.increaseTarget.id,
                planId: seeded.planId,
                name: 'Succession plan',
                vertical: 'accommodation',
                versionNumber: 2
            });
            // Two versions of the SAME plan: only the derived ordinal differs.
            expect(pair[0]?.source.planId).toBe(pair[0]?.target.planId);
            expect(pair[0]?.source.versionNumber).not.toBe(pair[0]?.target.versionNumber);
        });

        it('el número es por plan', async () => {
            const first = await createPriceIncreaseCase();
            const second = await createPriceIncreaseCase();
            const options = await listPlanMigrationOptions({
                actor: first.actor,
                verticals
            });
            const sources = [first.planVersionId, second.planVersionId];
            const pairs = options.increases
                .filter((entry) => sources.includes(entry.source.id))
                .map((entry) => ({
                    planId: entry.source.planId,
                    source: entry.source.versionNumber,
                    target: entry.target.versionNumber
                }))
                .sort((left, right) => left.planId.localeCompare(right.planId));
            // Each plan restarts at 1: the second plan does not continue the first's count.
            expect(pairs).toEqual(
                [first.planId, second.planId]
                    .map((planId) => ({ planId, source: 1, target: 2 }))
                    .sort((left, right) => left.planId.localeCompare(right.planId))
            );
        });

        it('una versión retirada lleva su número en el listado', async () => {
            const seeded = await createPlanMigrationCase();
            // The retired source is the first version created for its plan.
            expect(await retiredItems(seeded.actor, [seeded.planVersionId])).toEqual([
                {
                    id: seeded.planVersionId,
                    planId: seeded.planId,
                    name: 'Succession plan',
                    vertical: 'accommodation',
                    versionNumber: 1,
                    liveSubscriptionCount: 1
                }
            ]);
        });
    }
);

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1616 O-1 el par de aumento exige un destino vigente y vendible',
    () => {
        it('no ofrece el par cuando la versión destino vigente no es vendible', async () => {
            const seeded = await createPriceIncreaseCase();
            const options = await listPlanMigrationOptions({
                actor: seeded.actor,
                verticals: {
                    planPolicy: async ({ planVersionId }) => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: true,
                        sellable: planVersionId !== seeded.increaseTarget.id
                    })
                }
            });
            expect(
                options.increases.filter((entry) => entry.source.id === seeded.planVersionId)
            ).toEqual([]);
            // The old version stays selectable as a retirement source.
            expect(options.sources.filter((row) => row.id === seeded.planVersionId)).toEqual([
                {
                    id: seeded.planVersionId,
                    planId: seeded.planId,
                    name: 'Succession plan',
                    vertical: 'accommodation',
                    versionNumber: 1,
                    customerCount: 1
                }
            ]);
        });

        it('no ofrece el par cuando la versión destino no es vigente', async () => {
            const seeded = await createPriceIncreaseCase();
            const options = await listPlanMigrationOptions({
                actor: seeded.actor,
                verticals: {
                    planPolicy: async ({ planVersionId }) => ({
                        graceDays: 10,
                        allowsPause: false,
                        current: planVersionId !== seeded.increaseTarget.id,
                        sellable: true
                    })
                }
            });
            expect(
                options.increases.filter((entry) => entry.source.id === seeded.planVersionId)
            ).toEqual([]);
        });
    }
);
