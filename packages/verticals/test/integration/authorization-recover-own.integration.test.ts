/** TEST:V5:2 — an archived listing remains recoverable from the floor without a title. */
import { randomUUID } from 'node:crypto';
import { coverageSourceClassOf } from '@repo/billing-verticals-contract';
import {
    type DrizzleClient,
    destinations,
    experiences,
    gastronomies,
    planCatalogModel,
    plans,
    planVersionEntitlements,
    planVersions,
    users
} from '@repo/db';
import {
    FLOOR_PLAN_ROLE,
    type PlanRole,
    PRE_TRIAL_PLAN_ROLE,
    PublicationStatusEnum,
    PublicationStatusEnumSchema,
    VerticalEnum
} from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import { createBootstrapCoverageReader } from './support/bootstrap-coverage-reader';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 3 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());

/** Keep this test's plans and listings out of later integration files. */
class Rollback extends Error {}

async function inRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new Rollback('rollback');
        });
    } catch (error) {
        if (!(error instanceof Rollback)) throw error;
    }
}

async function seedVersion(
    db: DrizzleClient,
    vertical: string,
    _role: typeof PRE_TRIAL_PLAN_ROLE | typeof FLOOR_PLAN_ROLE,
    recover: boolean
) {
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            role: null,
            slug: randomUUID(),
            name: 'Authorization fixture'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Plan insert failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: 1_000_000,
            sellable: false,
            current: true,
            trialDays: 14,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Version insert failed');
    if (recover)
        await db.insert(planVersionEntitlements).values({
            planVersionId: version.id,
            key: 'recover_own_listing'
        });
    return version.id;
}

describe('TEST:V5:2 archived owner without TITLE', () => {
    it('recovers an archived gastronomy from the floor and denies it when the other vertical lacks the key', async () => {
        await inRollback(async (db) => {
            const [user] = await db
                .insert(users)
                .values({
                    email: `authorization-${randomUUID()}@example.com`,
                    displayName: 'Authorization Owner'
                })
                .returning({ id: users.id });
            if (!user) throw new Error('User insert failed');
            const [destination] = await db
                .insert(destinations)
                .values({
                    destinationType: 'CITY',
                    path: `/authorization-${randomUUID()}`,
                    slug: randomUUID(),
                    name: 'Authorization city',
                    summary: 'Test city',
                    description: 'A city for authorization fixtures',
                    location: { coordinates: { lat: '-32.49', long: '-58.23' } }
                })
                .returning({ id: destinations.id });
            if (!destination) throw new Error('Destination insert failed');

            const fixtureVersions = new Map<string, string>();
            for (const vertical of [VerticalEnum.GASTRONOMY, VerticalEnum.EXPERIENCE]) {
                fixtureVersions.set(
                    `${vertical}:${PRE_TRIAL_PLAN_ROLE}`,
                    await seedVersion(db, vertical, PRE_TRIAL_PLAN_ROLE, false)
                );
                fixtureVersions.set(
                    `${vertical}:${FLOOR_PLAN_ROLE}`,
                    await seedVersion(
                        db,
                        vertical,
                        FLOOR_PLAN_ROLE,
                        vertical === VerticalEnum.GASTRONOMY
                    )
                );
            }

            const [gastronomy] = await db
                .insert(gastronomies)
                .values({
                    slug: randomUUID(),
                    name: 'Archived venue',
                    summary: 'Archived venue',
                    description: 'Archived venue for recovery',
                    type: 'RESTAURANT',
                    ownerId: user.id,
                    destinationId: destination.id,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                })
                .returning({ id: gastronomies.id });
            const [experience] = await db
                .insert(experiences)
                .values({
                    slug: randomUUID(),
                    name: 'Archived tour',
                    summary: 'Archived tour',
                    description: 'Archived tour for recovery',
                    type: 'EXCURSION',
                    ownerId: user.id,
                    destinationId: destination.id,
                    publicationStatus: PublicationStatusEnum.ARCHIVED
                })
                .returning({ id: experiences.id });
            if (!gastronomy || !experience) throw new Error('Listing insert failed');

            const reader = {
                ...createBootstrapCoverageReader(db),
                async findCurrentVersionByRole(args: {
                    readonly vertical: string;
                    readonly role: PlanRole;
                }) {
                    const id = fixtureVersions.get(`${args.vertical}:${args.role}`);
                    if (!id) return null;
                    const [row] = await db
                        .select({
                            id: planVersions.id,
                            planId: planVersions.planId,
                            vertical: planVersions.vertical,
                            rank: planVersions.rank,
                            sellable: planVersions.sellable,
                            current: planVersions.current
                        })
                        .from(planVersions)
                        .where(eq(planVersions.id, id))
                        .limit(1);
                    return row ?? null;
                }
            };
            const billing = createBootstrapBillingForVerticals({ reader });
            const coverageSpy = vi.spyOn(billing, 'coverage');
            const catalog = {
                findPlanVersionEffects: ({ id }: { readonly id: string }) =>
                    planCatalogModel.findPlanVersionEffects({ id, tx: db })
            };
            const gastroCoverage = await billing.coverage({
                userId: user.id,
                vertical: VerticalEnum.GASTRONOMY
            });
            expect(gastroCoverage.covered).toBe(false);
            expect(
                gastroCoverage.sources.every(
                    (source) => coverageSourceClassOf({ source }).sourceClass !== 'TITLE'
                )
            ).toBe(true);

            const [archived] = await db
                .select({
                    ownerId: gastronomies.ownerId,
                    publicationStatus: gastronomies.publicationStatus
                })
                .from(gastronomies)
                .where(eq(gastronomies.id, gastronomy.id))
                .limit(1);
            const [otherArchived] = await db
                .select({
                    ownerId: experiences.ownerId,
                    publicationStatus: experiences.publicationStatus
                })
                .from(experiences)
                .where(eq(experiences.id, experience.id))
                .limit(1);
            if (!archived || !otherArchived) throw new Error('Seeded listing missing');

            const common = {
                actorId: user.id,
                vertical: VerticalEnum.GASTRONOMY,
                facts: {
                    ownerId: archived.ownerId,
                    publicationStatus: PublicationStatusEnumSchema.nullable().parse(
                        archived.publicationStatus
                    )
                },
                billing,
                catalog
            };
            expect(await resolveListingAccess({ ...common, operation: 'READ_OWN' })).toEqual({
                allowed: true,
                evaluatedSteps: [4]
            });
            for (const operation of ['EXPORT', 'REACTIVATE', 'DELETE'] as const) {
                expect(await resolveListingAccess({ ...common, operation })).toEqual({
                    allowed: true,
                    evaluatedSteps: [4, 6]
                });
            }
            for (const operation of ['EDIT', 'PUBLISH'] as const) {
                expect(await resolveListingAccess({ ...common, operation })).toEqual({
                    allowed: false,
                    reason: 'NOT_FOUND'
                });
            }

            const beforePending = coverageSpy.mock.calls.length;
            const draft = { ownerId: user.id, publicationStatus: PublicationStatusEnum.DRAFT };
            for (const operation of ['EDIT', 'PUBLISH'] as const) {
                expect(await resolveListingAccess({ ...common, facts: draft, operation })).toEqual({
                    allowed: false,
                    reason: 'NO_CAPABILITY'
                });
            }
            expect(coverageSpy).toHaveBeenCalledTimes(beforePending);

            const mirror = {
                ...common,
                vertical: VerticalEnum.EXPERIENCE,
                facts: {
                    ownerId: otherArchived.ownerId,
                    publicationStatus: PublicationStatusEnumSchema.nullable().parse(
                        otherArchived.publicationStatus
                    )
                }
            };
            const otherCoverage = await billing.coverage({
                userId: user.id,
                vertical: VerticalEnum.EXPERIENCE
            });
            expect(otherCoverage.covered).toBe(false);
            expect(await resolveListingAccess({ ...mirror, operation: 'READ_OWN' })).toEqual({
                allowed: true,
                evaluatedSteps: [4]
            });
            for (const operation of ['EXPORT', 'REACTIVATE', 'DELETE'] as const) {
                expect(await resolveListingAccess({ ...mirror, operation })).toEqual({
                    allowed: false,
                    reason: 'NO_CAPABILITY'
                });
            }
        });
    });
});
