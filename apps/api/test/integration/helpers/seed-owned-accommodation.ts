import { randomUUID } from 'node:crypto';
import { accommodationFaqs, and, eq, getDb, plans, planVersions, trials } from '@repo/db';
import { FLOOR_PLAN_ROLE, TRIAL_PLAN_ROLE, TrialStatusEnum, VerticalEnum } from '@repo/schemas';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from './seed-public-accommodation';

/** Rows created by {@link seedOwnedAccommodation}. */
export interface SeededOwnedAccommodation extends SeededPublicAccommodation {
    /** Ids of the FAQs seeded on the accommodation, in display order. */
    readonly faqIds: readonly string[];
}

/** Input for {@link seedOwnedAccommodation}. */
export interface SeedOwnedAccommodationInput {
    /** How many FAQs to attach. Defaults to 0. */
    readonly faqCount?: number;
    /** Reuses this owner instead of creating one (and skips their trial). */
    readonly ownerId?: string;
}

/**
 * Seeds a PUBLISHED accommodation whose owner holds an active accommodation
 * trial, optionally with FAQs. The trial matters: write routes authorise the
 * owner through the listing-access chain (action 15 / EDIT), which reads the
 * migrated trial plan's floor entitlements. Without it the owner is refused
 * even with the right permissions.
 *
 * Call it per test: `testDb.clean()` truncates between tests.
 *
 * @param input - Optional FAQ count and owner override.
 * @returns The accommodation (see {@link SeededPublicAccommodation}) and its FAQ ids.
 * @throws {Error} When the migrated accommodation plan versions are missing.
 */
export async function seedOwnedAccommodation(
    input: SeedOwnedAccommodationInput = {}
): Promise<SeededOwnedAccommodation> {
    const db = getDb();
    const ownerId =
        input.ownerId ??
        (
            await createTestUser({
                email: `seed-owned-acc-${randomUUID()}@example.test`,
                slug: `seed-owned-acc-${randomUUID()}`
            })
        ).id;

    if (!input.ownerId) {
        const versions = await db
            .select({
                role: plans.role,
                slug: plans.slug,
                planId: plans.id,
                versionId: planVersions.id
            })
            .from(plans)
            .innerJoin(planVersions, eq(planVersions.planId, plans.id))
            .where(
                and(eq(plans.vertical, VerticalEnum.ACCOMMODATION), eq(planVersions.current, true))
            );
        const versionFor = (predicate: (row: (typeof versions)[number]) => boolean) => {
            const version = versions.find(predicate);
            if (!version) throw new Error('seedOwnedAccommodation: missing plan version');
            return version;
        };
        const premium = versionFor((row) => row.slug === 'owner-premium');
        const floor = versionFor((row) => row.role === FLOOR_PLAN_ROLE);
        const trial = versionFor((row) => row.role === TRIAL_PLAN_ROLE);
        const startedAt = new Date();
        await db.insert(trials).values({
            userId: ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            status: TrialStatusEnum.TRIAL_ACTIVE,
            trialPlanId: trial.planId,
            floorEntitlementsVersionId: premium.versionId,
            floorLimitsVersionId: floor.versionId,
            floorTrialPlanVersionId: trial.versionId,
            startedAt,
            endsAt: new Date(startedAt.getTime() + 14 * 24 * 60 * 60 * 1000),
            emailPseudonym: randomUUID().replaceAll('-', '').padEnd(64, '0'),
            deadlinesVersion: 1
        });
    }

    const accommodation = await seedPublicAccommodation({ ownerId });

    const faqCount = input.faqCount ?? 0;
    const faqIds: string[] = [];
    for (let index = 0; index < faqCount; index++) {
        const rows = await db
            .insert(accommodationFaqs)
            .values({
                accommodationId: accommodation.id,
                question: `Seeded question number ${index + 1}?`,
                answer: `Seeded answer number ${index + 1} for the integration tests.`,
                displayOrder: index
            })
            .returning({ id: accommodationFaqs.id });
        const id = rows[0]?.id;
        if (!id) throw new Error('seedOwnedAccommodation: FAQ insert failed');
        faqIds.push(id);
    }

    return { ...accommodation, faqIds };
}
