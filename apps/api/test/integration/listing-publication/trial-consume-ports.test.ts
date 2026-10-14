import { randomUUID } from 'node:crypto';
import type { CoverageResponse } from '@repo/billing-verticals-contract';
import { AccommodationModel, accommodations, destinations, getDb, trials, users } from '@repo/db';
import {
    type Accommodation,
    PublicationStatusEnum,
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    type VerticalActivationEvent,
    VerticalEnum
} from '@repo/schemas';
import { computeTrialEmailPseudonym } from '@repo/service-core';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicationTransaction } from '../../../../../packages/verticals/src/publication/publication-types';
import { publishListing } from '../../../../../packages/verticals/src/publication/publish-listing';
import { consumeTrialOnFirstPayment } from '../../../../../packages/verticals/src/trial/trial-first-payment';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { getTrialMachinePorts } from '../../../src/utils/trial/trial-machine-ports';
import { testDb } from '../../e2e/setup/test-database';
import { ensureAccommodationCatalog } from './publication-routes.helpers';

const vertical = VerticalEnum.ACCOMMODATION;
function activationEventFor(): VerticalActivationEvent {
    const event = VERTICAL_ACTIVATION_EVENT_BY_VERTICAL[vertical];
    if (!event) throw new Error('Accommodation activation event is missing');
    return event;
}
const now = new Date('2026-10-10T12:00:00.000Z');
const clock = { now: () => now };

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});
beforeEach(async () => {
    await testDb.clean();
    await ensureAccommodationCatalog();
});
afterAll(async () => testDb.teardown());

async function fixture(args: { readonly name: string }) {
    const db = getDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `${args.name.toLowerCase().replaceAll(' ', '-')}-${randomUUID()}@example.test`,
            displayName: args.name
        })
        .returning({ id: users.id, email: users.email });
    const [destination] = await db
        .insert(destinations)
        .values({
            name: `Trial consume ${randomUUID()}`,
            slug: `trial-consume-${randomUUID()}`,
            destinationType: 'CITY',
            level: 5,
            path: `/trial-consume-${randomUUID()}`,
            pathIds: randomUUID(),
            summary: 'Trial consume fixture',
            description: 'Trial consume integration fixture',
            location: { coordinates: { lat: '-32.49', long: '-58.23' } }
        })
        .returning({ id: destinations.id });
    if (!user || !destination) throw new Error('Fixture insert failed');
    const listing = await new AccommodationModel().create(
        {
            name: 'Trial consume listing',
            slug: `trial-consume-${randomUUID()}`,
            summary: 'Trial consume fixture',
            description: 'Trial consume fixture description',
            ownerId: user.id,
            destinationId: destination.id,
            type: 'CABIN',
            publicationStatus: PublicationStatusEnum.DRAFT
        } as Partial<Accommodation>,
        db
    );
    const pseudonymResult = computeTrialEmailPseudonym({ email: user.email });
    if (!pseudonymResult.ok) throw new Error('Fixture email was rejected');
    return { db, user, listing, emailPseudonym: pseudonymResult.pseudonym };
}

function paidCoverage(): CoverageResponse {
    return {
        covered: true,
        sources: [
            {
                type: 'SUBSCRIPTION' as const,
                reference: { kind: 'PLAN_VERSION' as const, planVersionId: randomUUID() },
                scope: 'VERTICAL' as const,
                target: null,
                since: now,
                until: 'NO_KNOWN_DATE' as const,
                charged: true,
                floor: null
            }
        ]
    };
}

function unpaidCoverage(): CoverageResponse {
    const paid = paidCoverage();
    return {
        covered: true,
        sources: [
            {
                type: 'SUBSCRIPTION',
                reference: paid.sources[0]!.reference,
                scope: 'VERTICAL',
                target: null,
                since: now,
                until: 'NO_KNOWN_DATE',
                charged: false,
                floor: null
            }
        ]
    };
}

function productionPublicationPortsWithCapacity() {
    const ports = getListingPublicationPorts();
    return {
        ...ports,
        unitOfWork: {
            runLocked<T>(
                args: { readonly userId: string; readonly vertical: typeof vertical },
                work: (tx: PublicationTransaction) => Promise<T>
            ) {
                return ports.unitOfWork.runLocked(args, (tx) =>
                    work({
                        ...tx,
                        async readPublishLimit() {
                            return 1;
                        }
                    })
                );
            }
        }
    };
}

describe('TEST:V4:12 production trial consume ports', () => {
    it('runs T6 and T8 through production adapters and handles unexercised and TOURIST events', async () => {
        const paid = await fixture({ name: 'T6 production owner' });
        const t6 = await publishListing({
            ...productionPublicationPortsWithCapacity(),
            billing: { coverage: async () => paidCoverage() },
            clock,
            afterCommit: {
                emitCoverageChanged: vi.fn(async () => {}),
                invalidateUser: vi.fn(async () => {}),
                revalidate: vi.fn(async () => {})
            },
            userId: paid.user.id,
            vertical,
            listingId: paid.listing.id,
            event: activationEventFor(),
            emailPseudonym: paid.emailPseudonym,
            correlationId: randomUUID()
        });
        expect(t6).toMatchObject({ published: true, trialStarted: false, trialConsumed: true });
        const [paidTrial] = await paid.db
            .select()
            .from(trials)
            .where(eq(trials.userId, paid.user.id));
        expect(paidTrial).toMatchObject({
            status: 'TRIAL_CONVERTED',
            startedAt: null,
            endsAt: null,
            trialPlanId: null,
            floorEntitlementsVersionId: null,
            floorLimitsVersionId: null,
            floorTrialPlanVersionId: null,
            deadlinesVersion: null,
            emailPseudonym: paid.emailPseudonym
        });
        const [published] = await paid.db
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, paid.listing.id));
        expect(published?.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
        expect(
            await (
                await import(
                    '../../../../../packages/db/src/models/listing/listing-publication.model'
                )
            ).listingPublicationModel.hasOwnerPublished({
                tx: paid.db,
                vertical,
                userId: paid.user.id
            })
        ).toBe(true);

        const t8Owner = await fixture({ name: 'T8 production owner' });
        const notices = vi.fn(async () => {});
        const invalidations = vi.fn(async () => {});
        const machinePorts = getTrialMachinePorts();
        const t8 = await publishListing({
            ...productionPublicationPortsWithCapacity(),
            billing: { coverage: async () => unpaidCoverage() },
            clock,
            afterCommit: {
                emitCoverageChanged: vi.fn(async () => {}),
                invalidateUser: vi.fn(async () => {}),
                revalidate: vi.fn(async () => {})
            },
            userId: t8Owner.user.id,
            vertical,
            listingId: t8Owner.listing.id,
            event: activationEventFor(),
            emailPseudonym: t8Owner.emailPseudonym,
            correlationId: randomUUID()
        });
        expect(t8).toMatchObject({ published: true, trialStarted: false, trialConsumed: false });
        const result = await consumeTrialOnFirstPayment({
            ...machinePorts,
            billing: { coverage: async () => paidCoverage() },
            afterCommit: {
                async emitCoverageChanged(event) {
                    notices();
                    expect(event).toMatchObject({
                        userId: t8Owner.user.id,
                        sourceType: 'TRIAL',
                        change: 'REMOVED'
                    });
                },
                async invalidateUser({ userId }) {
                    if (userId === t8Owner.user.id) invalidations();
                }
            },
            event: {
                userId: t8Owner.user.id,
                vertical,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            },
            emailPseudonym: t8Owner.emailPseudonym
        });
        expect(result).toMatchObject({ consumed: true, transition: 'T8' });
        expect(notices).toHaveBeenCalledTimes(1);
        expect(invalidations).toHaveBeenCalledTimes(1);
        expect(
            await t8Owner.db.select().from(trials).where(eq(trials.userId, t8Owner.user.id))
        ).toHaveLength(1);

        const neverPublished = await fixture({ name: 'Unexercised T8 owner' });
        expect(
            await consumeTrialOnFirstPayment({
                ...machinePorts,
                billing: { coverage: async () => paidCoverage() },
                afterCommit: {
                    emitCoverageChanged: vi.fn(async () => {}),
                    invalidateUser: vi.fn(async () => {})
                },
                event: {
                    userId: neverPublished.user.id,
                    vertical,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                },
                emailPseudonym: neverPublished.emailPseudonym
            })
        ).toEqual({ consumed: false, reason: 'ACTIVATION_EVENT_NOT_EXERCISED' });

        expect(
            await consumeTrialOnFirstPayment({
                ...machinePorts,
                billing: { coverage: async () => paidCoverage() },
                afterCommit: {
                    emitCoverageChanged: vi.fn(async () => {}),
                    invalidateUser: vi.fn(async () => {})
                },
                event: {
                    userId: neverPublished.user.id,
                    vertical: VerticalEnum.TOURIST,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                },
                emailPseudonym: neverPublished.emailPseudonym
            })
        ).toEqual({ consumed: false, reason: 'ACTIVATION_EVENT_NOT_EXERCISED' });
        expect(
            await neverPublished.db
                .select()
                .from(trials)
                .where(
                    and(
                        eq(trials.userId, neverPublished.user.id),
                        eq(trials.vertical, VerticalEnum.TOURIST)
                    )
                )
        ).toHaveLength(0);
    });
});
