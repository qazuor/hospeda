import { type DrizzleClient, getDb, plans, planVersions } from '@repo/db';

/**
 * Example-only catalog. A migrated production catalog owns the whole plan area:
 * when any plan exists this step performs no writes at all.
 */
export async function seedBillingCatalog(
    db: DrizzleClient = getDb()
): Promise<'loaded' | 'skipped'> {
    return db.transaction(async (tx) => {
        const existing = await tx.select({ id: plans.id }).from(plans).limit(1);
        if (existing.length > 0) return 'skipped';

        await tx.insert(plans).values({
            id: 'ba3f5300-1e8d-5ceb-9aa0-003fe87df015',
            vertical: 'experience',
            slug: 'example-experience',
            name: 'Example Experience Plan',
            description: 'Demonstration catalog only'
        });
        await tx.insert(planVersions).values({
            id: '2d4e34e3-c1f2-5b29-9ca8-d5e16c45b0bc',
            planId: 'ba3f5300-1e8d-5ceb-9aa0-003fe87df015',
            vertical: 'experience',
            rank: 1,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false,
            inheritsTouristVip: false
        });
        return 'loaded';
    });
}
