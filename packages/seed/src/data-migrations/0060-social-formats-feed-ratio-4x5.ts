/**
 * @fileoverview
 * Data migration: 0060-social-formats-feed-ratio-4x5
 *
 * Corrects the recommended image ratio of the two Instagram image-feed rows in
 * `social_platform_formats`, which were seeded as `1:1` / `1080x1080`.
 *
 * Square stopped being a Hospeda format: the content plan
 * (`docs/marketing/plan-contenido-redes.md`) declares exactly two — `4:5`
 * (1080x1350) for feed publications and `9:16` (1080x1920) for stories. The
 * `9:16` rows were already correct; the feed rows were not.
 *
 * This is not cosmetic metadata. `GET /api/v1/ai/social/catalog` serves these
 * columns to the social Custom GPT, whose instructions name the catalog as the
 * source of truth for formats — so the GPT read `1:1` and generated square
 * artwork for every feed post. Fixing the prompt alone could never fix it,
 * because the catalog kept contradicting the prompt.
 *
 * Dual-write counterpart (HOS-25) for the baseline edit in
 * `packages/seed/src/required/socialAutomation.seed.ts`. The platform-format
 * seed is skip-by-key — it never updates an existing row — so the baseline edit
 * reaches fresh databases only. This carries the same delta to already-seeded
 * ones.
 *
 * Scoped to the exact stale pair (`1:1` + `1080x1080`) so an operator who has
 * since set their own ratio from the admin panel keeps it. Idempotent: re-running
 * matches nothing and reports zero.
 *
 * NOT touched here: the Facebook, X, LinkedIn TEXT_POST and X rows carry NULL in
 * both columns. That is a separate gap (no ratio guidance at all rather than
 * wrong guidance) and needs an owner decision per platform before being filled.
 *
 * ## `destructive` flag decision
 *
 * `false` — a single corrective UPDATE of two already-wrong presentation values
 * on two existing rows. No delete, no identity or commercial field touched, and
 * no row is created or removed.
 */
import { and, eq, socialPlatformFormats } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0060-social-formats-feed-ratio-4x5',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The stale values this migration replaces. Matched exactly — see the note above. */
const STALE_RATIO = '1:1';
const STALE_SIZE = '1080x1080';

/** Must stay identical to the baseline seed's two Instagram image-feed rows. */
const CORRECTED_RATIO = '4:5';
const CORRECTED_SIZE = '1080x1350';

/** The two rows this migration targets, by their natural key. */
const TARGET_ROWS = [
    { platform: 'INSTAGRAM', publishFormat: 'FEED_POST' },
    { platform: 'INSTAGRAM', publishFormat: 'CAROUSEL' }
] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let correctedRows = 0;

    for (const row of TARGET_ROWS) {
        const updated = await ctx.db
            .update(socialPlatformFormats)
            .set({ recommendedRatio: CORRECTED_RATIO, recommendedSize: CORRECTED_SIZE })
            .where(
                and(
                    eq(socialPlatformFormats.platform, row.platform),
                    eq(socialPlatformFormats.publishFormat, row.publishFormat),
                    eq(socialPlatformFormats.recommendedRatio, STALE_RATIO),
                    eq(socialPlatformFormats.recommendedSize, STALE_SIZE)
                )
            )
            .returning({ id: socialPlatformFormats.id });

        correctedRows += updated.length;
    }

    return {
        summary:
            correctedRows === 0
                ? 'Instagram feed ratios already 4:5 or operator-edited — no change.'
                : `Set Instagram FEED_POST/CAROUSEL to 4:5 1080x1350 (${correctedRows} rows).`,
        counts: { correctedRows }
    };
}
