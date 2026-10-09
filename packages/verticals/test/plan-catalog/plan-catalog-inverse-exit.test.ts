/**
 * TEST:V2:14 (HOS-1438, V2.5, AC:V2:10): the contract's inverse case set —
 * `planPolicy`, `changeDirection` and `addonPolicy` — runs against the
 * verticals implementation of the three queries, and the public entry pins
 * clauses 2, 3 and 4 of LISTA:V2: the rank never decides the direction, an
 * only-MIN key becoming more favorable is UP, and no answer carries an
 * entitlement, a limit or the trial days.
 */
import {
    addonPolicyCaseSet,
    changeDirectionCaseSet,
    planPolicyCaseSet
} from '@repo/billing-verticals-contract/testing';
import { describe, expect, it } from 'vitest';
import { createPlanCatalogInverse } from '../../src/plan-catalog/plan-catalog-inverse';
import { createInMemoryCatalog, planVersionRow } from './in-memory-catalog-reader';

describe('TEST:V2:14 — the verticals implementation passes the plan catalog part of the inverse case set (AC:V2:10)', () => {
    planPolicyCaseSet({
        describe,
        it,
        expect,
        makeHarness: async () => {
            const catalog = createInMemoryCatalog();
            return {
                subject: createPlanCatalogInverse({ reader: catalog.reader }),
                arrangePlanVersion: async ({ policy }) => ({
                    planVersionId: catalog.addPlanVersion(
                        planVersionRow({
                            ...policy,
                            trialDays: 30,
                            entitlements: [
                                {
                                    key: 'ai_chat',
                                    planQuota: 100,
                                    trialQuota: 10,
                                    aggregationStrategy: 'MAX'
                                }
                            ],
                            limits: [
                                {
                                    key: 'max_accommodations',
                                    value: 3,
                                    aggregationStrategy: 'SUM'
                                }
                            ]
                        })
                    )
                })
            };
        }
    });

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
                        entitlements: [{ key: 'featured_listing' }],
                        limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
                    })
                })
            };
        }
    });

    it('exposes exactly the three queries of the plan catalog and nothing else', () => {
        const queries = Object.keys(
            createPlanCatalogInverse({ reader: createInMemoryCatalog().reader })
        ).sort();

        expect(queries).toEqual(['addonPolicy', 'changeDirection', 'planPolicy']);
    });

    it('LISTA:V2 clause 2: a higher rank with ONE SUM limit lower answers DOWN, never UP', async () => {
        const catalog = createInMemoryCatalog();
        const fromPlanVersionId = catalog.addPlanVersion(
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
        );
        const toPlanVersionId = catalog.addPlanVersion(
            planVersionRow({
                rank: 30,
                entitlements: [
                    {
                        key: 'respond_reviews',
                        planQuota: null,
                        trialQuota: null,
                        aggregationStrategy: 'MAX'
                    }
                ],
                limits: [
                    {
                        key: 'max_photos_per_accommodation',
                        value: 10,
                        aggregationStrategy: 'SUM'
                    }
                ]
            })
        );
        const subject = createPlanCatalogInverse({ reader: catalog.reader });

        const verdict = await subject.changeDirection({ fromPlanVersionId, toPlanVersionId });

        expect(verdict).toStrictEqual({ direction: 'DOWN' });
    });

    it('LISTA:V2 clause 4: only a MIN key falling from 24 to 4 answers UP', async () => {
        const catalog = createInMemoryCatalog();
        const fromPlanVersionId = catalog.addPlanVersion(
            planVersionRow({
                limits: [
                    {
                        key: 'max_photos_per_accommodation',
                        value: 20,
                        aggregationStrategy: 'SUM'
                    },
                    { key: 'response_time_hours', value: 24, aggregationStrategy: 'MIN' }
                ]
            })
        );
        const toPlanVersionId = catalog.addPlanVersion(
            planVersionRow({
                limits: [
                    {
                        key: 'max_photos_per_accommodation',
                        value: 20,
                        aggregationStrategy: 'SUM'
                    },
                    { key: 'response_time_hours', value: 4, aggregationStrategy: 'MIN' }
                ]
            })
        );
        const subject = createPlanCatalogInverse({ reader: catalog.reader });

        const verdict = await subject.changeDirection({ fromPlanVersionId, toPlanVersionId });

        expect(verdict).toStrictEqual({ direction: 'UP' });
    });

    it('LISTA:V2 clause 3: neither planPolicy nor addonPolicy leaks a capability', async () => {
        const catalog = createInMemoryCatalog();
        const planVersionId = catalog.addPlanVersion(
            planVersionRow({
                entitlements: [
                    {
                        key: 'ai_chat',
                        planQuota: 100,
                        trialQuota: 10,
                        aggregationStrategy: 'MAX'
                    }
                ],
                limits: [{ key: 'max_accommodations', value: 3, aggregationStrategy: 'SUM' }]
            })
        );
        const addonVersionId = catalog.addAddonVersion({
            addonId: 'f5f0d7a4-3a49-4c63-9f0b-5f6e8d2d1c11',
            validity: 'WHILE_SUBSCRIPTION_ALIVE',
            validityDays: null,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            entitlements: [{ key: 'featured_listing' }],
            limits: [{ key: 'max_photos_per_accommodation', value: 30 }]
        });
        const subject = createPlanCatalogInverse({ reader: catalog.reader });

        const planAnswer = JSON.stringify(await subject.planPolicy({ planVersionId }));
        const addonAnswer = JSON.stringify(await subject.addonPolicy({ addonVersionId }));

        for (const forbidden of [
            'ai_chat',
            'max_accommodations',
            'featured_listing',
            'max_photos_per_accommodation',
            'trialDays'
        ]) {
            expect(planAnswer).not.toContain(forbidden);
            expect(addonAnswer).not.toContain(forbidden);
        }
    });
});
