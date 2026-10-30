import { randomUUID } from 'node:crypto';
import { getDb, sponsorshipLevels, sponsorshipPackages, sponsorships } from '@repo/db';
import { SponsorshipTargetTypeEnum, SponsorshipTierEnum } from '@repo/schemas';

/** Input for {@link seedSponsorshipLevel}. */
export interface SeedSponsorshipLevelInput {
    /** Target the level applies to. Defaults to `EVENT`. */
    readonly targetType?: SponsorshipTargetTypeEnum;
    /** Tier of the level. Defaults to `BRONZE`. */
    readonly tier?: SponsorshipTierEnum;
}

/** Rows created by {@link seedSponsorshipLevel}. */
export interface SeededSponsorshipLevel {
    /** Level id. */
    readonly id: string;
    /** Level display name. */
    readonly name: string;
    /** Target type the level applies to. */
    readonly targetType: SponsorshipTargetTypeEnum;
    /** Level tier. */
    readonly tier: SponsorshipTierEnum;
}

/**
 * Seeds one sponsorship level straight through Drizzle. Call it per test:
 * `testDb.clean()` truncates between tests.
 *
 * @param input - Optional target type and tier.
 * @returns The seeded level.
 */
export async function seedSponsorshipLevel(
    input: SeedSponsorshipLevelInput = {}
): Promise<SeededSponsorshipLevel> {
    const targetType = input.targetType ?? SponsorshipTargetTypeEnum.EVENT;
    const tier = input.tier ?? SponsorshipTierEnum.BRONZE;
    const suffix = randomUUID().slice(0, 8);
    const name = `Level ${tier} ${suffix}`;
    const [row] = await getDb()
        .insert(sponsorshipLevels)
        .values({
            slug: `level-${tier}-${suffix}`,
            name,
            targetType,
            tier,
            priceAmount: 1000
        })
        .returning({ id: sponsorshipLevels.id });
    if (!row) throw new Error('seedSponsorshipLevel: insert failed');
    return { id: row.id, name, targetType, tier };
}

/** Input for {@link seedSponsorship}. */
export interface SeedSponsorshipInput {
    /** Real user id of the sponsor that owns the row. */
    readonly sponsorUserId: string;
    /** Level the sponsorship is bound to. Its target type becomes the row's. */
    readonly level: SeededSponsorshipLevel;
    /**
     * Attach a package. Defaults to true: a sponsorship with no package makes
     * `GET /protected/sponsorships/:id` answer 500 (HOS-1905), so tests that are
     * not about that bug seed one.
     */
    readonly withPackage?: boolean;
    /** Analytics counters stored on the row, merged over zeroes. */
    readonly analytics?: {
        readonly impressions?: number;
        readonly clicks?: number;
        readonly couponsUsed?: number;
    };
}

/** Rows created by {@link seedSponsorship}. */
export interface SeededSponsorship {
    /** Sponsorship id. */
    readonly id: string;
    /** Sponsorship slug. */
    readonly slug: string;
}

/**
 * Seeds one sponsorship owned by `sponsorUserId` straight through Drizzle. The
 * target type is taken from the level so the pair is always consistent.
 *
 * @param input - Owner, level and optional package / analytics.
 * @returns Id and slug of the seeded row.
 */
export async function seedSponsorship(input: SeedSponsorshipInput): Promise<SeededSponsorship> {
    const suffix = randomUUID().slice(0, 8);
    const slug = `sponsorship-${suffix}`;
    const db = getDb();
    let packageId: string | undefined;
    if (input.withPackage ?? true) {
        const [pkg] = await db
            .insert(sponsorshipPackages)
            .values({
                slug: `package-${suffix}`,
                name: `Package ${suffix}`,
                priceAmount: 5000,
                includedPosts: 1,
                includedEvents: 1
            })
            .returning({ id: sponsorshipPackages.id });
        if (!pkg) throw new Error('seedSponsorship: package insert failed');
        packageId = pkg.id;
    }
    const [row] = await db
        .insert(sponsorships)
        .values({
            slug,
            sponsorUserId: input.sponsorUserId,
            targetType: input.level.targetType,
            targetId: randomUUID(),
            levelId: input.level.id,
            ...(packageId ? { packageId } : {}),
            ...(input.analytics
                ? { analytics: { impressions: 0, clicks: 0, couponsUsed: 0, ...input.analytics } }
                : {}),
            startsAt: new Date()
        })
        .returning({ id: sponsorships.id });
    if (!row) throw new Error('seedSponsorship: insert failed');
    return { id: row.id, slug };
}
