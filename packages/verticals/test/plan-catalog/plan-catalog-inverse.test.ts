/**
 * The plan catalog's inverse entries over an in-memory catalog (HOS-1435, V2):
 * the contract's shared case sets run against the verticals implementation,
 * plus the cases that pin what each answer must NOT carry.
 *
 * TEST:V2:4 (planPolicy), TEST:V2:7 (addonPolicy), and the unit half of the
 * changeDirection verdict (its DB-backed TEST:V2:5 lives under integration/).
 */
import {
    addonPolicyCaseSet,
    changeDirectionCaseSet,
    planPolicyCaseSet
} from '@repo/billing-verticals-contract/testing';
import { describe, expect, it } from 'vitest';
import { CatalogVersionNotFoundError } from '../../src/plan-catalog/errors';
import { createPlanCatalogInverse } from '../../src/plan-catalog/plan-catalog-inverse';
import { createInMemoryCatalog, planVersionRow } from './in-memory-catalog-reader';

describe('TEST:V2:4 — planPolicy answers its four fields and never a capability', () => {
    planPolicyCaseSet({
        describe,
        it,
        expect,
        makeHarness: async () => {
            const catalog = createInMemoryCatalog();
            return {
                subject: createPlanCatalogInverse({ reader: catalog.reader }),
                arrangePlanVersion: async ({ policy }) => ({
                    planVersionId: catalog.addPlanVersion(planVersionRow(policy))
                })
            };
        }
    });

    it('a version with trial days, a metered entitlement and a limit answers only the four policy fields', async () => {
        const catalog = createInMemoryCatalog();
        const planVersionId = catalog.addPlanVersion(
            planVersionRow({
                graceDays: 5,
                allowsPause: false,
                current: true,
                sellable: false,
                trialDays: 30,
                inheritsTouristVip: true,
                entitlements: [
                    { key: 'ai_chat', planQuota: 100, trialQuota: 10, aggregationStrategy: 'MAX' }
                ],
                limits: [{ key: 'max_accommodations', value: 3, aggregationStrategy: 'SUM' }]
            })
        );
        const subject = createPlanCatalogInverse({ reader: catalog.reader });

        const answer = await subject.planPolicy({ planVersionId });

        expect(answer).toStrictEqual({
            graceDays: 5,
            allowsPause: false,
            current: true,
            sellable: false
        });
    });

    it('an unknown version is refused, never answered with a default policy', async () => {
        const subject = createPlanCatalogInverse({ reader: createInMemoryCatalog().reader });

        await expect(
            subject.planPolicy({ planVersionId: '00000000-0000-0000-0000-000000000000' })
        ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
    });
});

describe('changeDirection over the inverse case set (unit half of AC:V2:4)', () => {
    changeDirectionCaseSet({
        describe,
        it,
        expect,
        makeHarness: async () => {
            const catalog = createInMemoryCatalog();
            return {
                subject: createPlanCatalogInverse({ reader: catalog.reader }),
                arrangeChange: async ({ lowersSomething }) => ({
                    // The destination always has the higher rank: only the delta decides.
                    fromPlanVersionId: catalog.addPlanVersion(
                        planVersionRow({
                            rank: 10,
                            limits: [
                                {
                                    key: 'max_photos_per_accommodation',
                                    value: 20,
                                    aggregationStrategy: 'SUM'
                                }
                            ]
                        })
                    ),
                    toPlanVersionId: catalog.addPlanVersion(
                        planVersionRow({
                            rank: 30,
                            limits: [
                                {
                                    key: 'max_photos_per_accommodation',
                                    value: lowersSomething ? 10 : 40,
                                    aggregationStrategy: 'SUM'
                                }
                            ]
                        })
                    )
                })
            };
        }
    });

    it('a version that does not exist is refused', async () => {
        const catalog = createInMemoryCatalog();
        const known = catalog.addPlanVersion(planVersionRow());
        const subject = createPlanCatalogInverse({ reader: catalog.reader });

        await expect(
            subject.changeDirection({
                fromPlanVersionId: known,
                toPlanVersionId: '00000000-0000-0000-0000-000000000000'
            })
        ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
    });
});

describe('TEST:V2:7 — addonPolicy answers its four fields and never what the addon grants', () => {
    addonPolicyCaseSet({
        describe,
        it,
        expect,
        makeHarness: async () => {
            const catalog = createInMemoryCatalog();
            return {
                subject: createPlanCatalogInverse({ reader: catalog.reader }),
                arrangeAddonVersion: async ({ policy }) => ({
                    addonVersionId: catalog.addAddonVersion({
                        ...policy,
                        entitlements: [],
                        limits: []
                    })
                })
            };
        }
    });

    it('an addon version that grants an entitlement and a limit answers only the policy', async () => {
        const catalog = createInMemoryCatalog();
        const addonVersionId = catalog.addAddonVersion({
            addonId: 'f5f0d7a4-3a49-4c63-9f0b-5f6e8d2d1c11',
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            entitlements: [{ key: 'featured_listing' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
        });
        const subject = createPlanCatalogInverse({ reader: catalog.reader });

        const answer = await subject.addonPolicy({ addonVersionId });

        expect(answer).toStrictEqual({
            addonId: 'f5f0d7a4-3a49-4c63-9f0b-5f6e8d2d1c11',
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: 'VERTICAL_SUBSCRIPTION'
        });
    });

    it('a fixed-days version answers its own number of days', async () => {
        const catalog = createInMemoryCatalog();
        const addonVersionId = catalog.addAddonVersion({
            addonId: '0d7b2a51-8f43-4e1a-9a7e-2c4b6d8e0f12',
            validity: 'FIXED_DAYS',
            validityDays: 7,
            scopeType: 'USER',
            entitlements: [],
            limits: []
        });
        const subject = createPlanCatalogInverse({ reader: catalog.reader });

        const answer = await subject.addonPolicy({ addonVersionId });

        expect(answer).toStrictEqual({
            addonId: '0d7b2a51-8f43-4e1a-9a7e-2c4b6d8e0f12',
            validity: 'FIXED_DAYS',
            validityDays: 7,
            scopeType: 'USER'
        });
    });

    it('an unknown addon version is refused', async () => {
        const subject = createPlanCatalogInverse({ reader: createInMemoryCatalog().reader });

        await expect(
            subject.addonPolicy({ addonVersionId: '00000000-0000-0000-0000-000000000000' })
        ).rejects.toBeInstanceOf(CatalogVersionNotFoundError);
    });
});
