import { PostTagModel, RPostPostTagModel } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import { summaryTracker } from '../utils/summaryTracker.js';

/**
 * Minimal interface for PostTag model operations used by E-2.
 *
 * @internal
 */
export interface PostTagModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
}

/**
 * Minimal interface for the post-tag join model (r_post_post_tag) used by E-2.
 *
 * Allows injecting a stub in tests without a live DB.
 *
 * @internal
 */
export interface RPostPostTagModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
    create(data: Partial<Record<string, unknown>>): Promise<Record<string, unknown>>;
}

/**
 * Minimal interface for post model operations used for ID resolution in E-2.
 *
 * @internal
 */
export interface PostModelPort {
    findOne(filter: Partial<Record<string, unknown>>): Promise<Record<string, unknown> | null>;
}

/**
 * Mapping of post titles to the PostTag slugs they should receive.
 *
 * These assignments populate realistic dev/staging fixture data so the
 * public listing flow (PostTag filters on /blog) can be exercised.
 *
 * Post titles match the `title` field stored verbatim in the DB from each
 * post's fixture JSON file. We use `title` instead of the fixture `id`
 * field (e.g. `"001-tourism-destinos-imperdibles-entre-rios"`) because the
 * fixture `id` is a non-UUID seed identifier, not the real UUID stored in
 * `posts.id` (a PostgreSQL UUID column).
 *
 * E-2 assignment rationale (from tag-seeds.md § Example Assignments):
 * - Post 001 (tourism / destinations guide)  → guía de viaje, destinos, recomendaciones locales
 * - Post 002 (gastronomy)                    → dónde comer, cultura entrerriana, recomendaciones locales
 * - Post 003 (carnival)                      → carnaval, eventos locales, cultura entrerriana
 * - Post 004 (thermal baths / wellness)      → turismo termal, escapadas, fin de semana largo
 * - Post 005 (nature / eco-tourism)          → naturaleza entrerriana, turismo rural, escapadas
 *
 * These 5 posts cover all 34 PostTags thematically, with each post
 * receiving 3 tags (≥ 15 total rows — above the AC-F22 minimum of 10).
 *
 * @internal
 */
const POST_TAG_ASSIGNMENTS: ReadonlyArray<{
    /** Exact `title` value stored in the `posts` table (preserved from fixture). */
    postTitle: string;
    postTagSlugs: ReadonlyArray<string>;
}> = [
    {
        postTitle: 'Los 10 Destinos Imperdibles de Entre Ríos en 2024',
        postTagSlugs: ['guia-de-viaje', 'destinos', 'recomendaciones-locales']
    },
    {
        postTitle: 'Gastronomía Entrerriana: Sabores Auténticos del Litoral',
        postTagSlugs: ['donde-comer', 'cultura-entrerriana', 'recomendaciones-locales']
    },
    {
        postTitle: 'El Carnaval de Gualeguaychú: Un Espectáculo de Color y Tradición',
        postTagSlugs: ['carnaval', 'eventos-locales', 'cultura-entrerriana']
    },
    {
        postTitle: 'Termas de Federación: Tu Refugio de Relax y Bienestar',
        postTagSlugs: ['turismo-termal', 'escapadas', 'fin-de-semana-largo']
    },
    {
        postTitle: 'Aventura en el Delta del Paraná: Ecoturismo en Estado Puro',
        postTagSlugs: ['naturaleza-entrerriana', 'turismo-rural', 'escapadas']
    }
] as const;

/**
 * Seeds PostTag assignments for test posts (SPEC-086 E-2).
 *
 * Applies 3 PostTags per test post by content theme, inserting rows into
 * the `r_post_post_tag` join table. The composite primary key
 * `(postId, postTagId)` guarantees uniqueness — this seed is idempotent:
 * if a row already exists, the DB PK constraint is caught and the row is
 * skipped gracefully.
 *
 * PostTag assignments have NO per-user attribution (D-001): any editor/admin
 * can set the canonical PostTags for a post — the assignment is editorial.
 *
 * Post resolution: posts are looked up by their `title` column value, which is
 * preserved verbatim from the fixture JSON during the example posts seed run.
 * The fixture `id` field (e.g. "001-tourism-...") is a non-UUID seed identifier
 * and cannot be used to query the `posts.id` UUID column.
 *
 * Prerequisites:
 *   - PostTags required seed (R-4) must have run (PostTag rows must exist).
 *   - Example posts seed must have run (post rows must exist).
 *
 * @param postTagModelOverride - Optional PostTag model override for DI in tests.
 * @param rPostPostTagModelOverride - Optional join model override for DI in tests.
 * @param postModelOverride - Optional post model override for DI in tests.
 * @returns Promise that resolves when all PostTag assignments have been seeded
 *
 * @throws {Error} When an unexpected DB error occurs (not a PK duplicate)
 *
 * @example
 * ```ts
 * await seedPostTagAssignments();
 * // Inserts up to 15 rows in r_post_post_tag (3 per post × 5 posts)
 * ```
 */
export async function seedPostTagAssignments(
    postTagModelOverride?: PostTagModelPort,
    rPostPostTagModelOverride?: RPostPostTagModelPort,
    postModelOverride?: PostModelPort
): Promise<void> {
    const separator = '#'.repeat(90);

    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  SEEDING POST TAG ASSIGNMENTS — E-2 (SPEC-086)`);

    const postTagModel: PostTagModelPort = postTagModelOverride ?? new PostTagModel();
    const rPostPostTagModel: RPostPostTagModelPort =
        rPostPostTagModelOverride ?? new RPostPostTagModel();

    // Inline post lookup — we only need findOne by title.
    // When no override is given, import PostModel dynamically to avoid circular deps.
    const postModel: PostModelPort = await (async () => {
        if (postModelOverride) return postModelOverride;
        const { PostModel } = await import('@repo/db');
        return new PostModel();
    })();

    try {
        let totalCreated = 0;
        let totalSkipped = 0;

        for (const assignment of POST_TAG_ASSIGNMENTS) {
            // Resolve post title → real DB UUID.
            // We look up by `title` because the fixture `id` field is a non-UUID seed
            // identifier and cannot be used to query the `posts.id` UUID column.
            const postRecord = await postModel.findOne({ title: assignment.postTitle });

            if (!postRecord) {
                logger.info(
                    `${STATUS_ICONS.Warning} Post (title: "${assignment.postTitle}") not found, skipping its PostTag assignments`
                );
                continue;
            }

            const postId = postRecord.id as string;

            for (const slug of assignment.postTagSlugs) {
                // Resolve PostTag slug → real DB UUID
                const postTagRecord = await postTagModel.findOne({ slug });

                if (!postTagRecord) {
                    logger.info(
                        `${STATUS_ICONS.Warning} PostTag slug "${slug}" not found, skipping`
                    );
                    continue;
                }

                const postTagId = postTagRecord.id as string;

                // Idempotency: check if assignment already exists via composite PK
                const existing = await rPostPostTagModel.findOne({ postId, postTagId });

                if (existing) {
                    logger.info(
                        `${STATUS_ICONS.Skip} PostTag "${slug}" → post (title: "${assignment.postTitle}") already assigned, skipping`
                    );
                    totalSkipped++;
                    continue;
                }

                await rPostPostTagModel.create({ postId, postTagId });

                logger.info(
                    `${STATUS_ICONS.Success} Assigned PostTag "${slug}" to post (title: "${assignment.postTitle}")`
                );
                totalCreated++;
            }
        }

        logger.info(
            `${STATUS_ICONS.Success} PostTag assignments E-2 done — created: ${totalCreated}, skipped: ${totalSkipped}`
        );
        summaryTracker.trackSuccess('PostTag Assignments E-2');
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`${STATUS_ICONS.Error} Failed to seed PostTag assignments (E-2): ${message}`);
        summaryTracker.trackError('PostTag Assignments E-2', 'post-tag-assignments-e2', message);
        throw error;
    }
}
