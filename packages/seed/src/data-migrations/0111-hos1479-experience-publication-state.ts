/**
 * HOS-1479: bring existing inline experience fixtures into line with the
 * publication state written by the baseline seed. The structural cut 0148
 * backfills publication columns on live rows first; this migration handles
 * any surviving fixture rows and is safe to repeat.
 */
import { experiences, legacyPublicationStatus } from '@repo/db';
import { eq, inArray } from 'drizzle-orm';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0111-hos1479-experience-publication-state',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const fixtureSlugs = [
    'excursion-rio-uruguay-concepcion',
    'alquiler-kayak-colon-termas',
    'guia-turistica-gualeguaychu-carnaval',
    'paseo-en-lancha-concordia-lago',
    'tour-cultural-casas-historicas-concepcion'
] as const;

/** Synchronize existing fixture rows without creating demo content in live databases. */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const rows = await ctx.db
        .select({
            id: experiences.id,
            lifecycleState: experiences.lifecycleState,
            visibility: experiences.visibility,
            publicationStatus: experiences.publicationStatus
        })
        .from(experiences)
        .where(inArray(experiences.slug, fixtureSlugs));

    let updated = 0;
    for (const row of rows) {
        const publicationStatus = legacyPublicationStatus(row);
        if (row.publicationStatus === publicationStatus) continue;
        await ctx.db
            .update(experiences)
            .set({ publicationStatus })
            .where(eq(experiences.id, row.id));
        updated++;
    }

    return {
        summary: `Synchronized publication status for ${updated} existing experience fixture(s).`,
        counts: { updated }
    };
}
