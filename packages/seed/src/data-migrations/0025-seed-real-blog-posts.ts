/**
 * @fileoverview
 * Data migration: 0025-seed-real-blog-posts
 *
 * Seeds the FIRST batch of real editorial blog posts — production content,
 * not the demo `src/data/post/**` fixtures (those are `example`-group and
 * never reach prod). Nine evergreen/seasonal travel guides for the Uruguay
 * river coast and the Entre Rios Litoral.
 *
 * Unlike the demo posts, these must land on production, where NO example
 * user exists: the prod seed runs `--required --exclude=users`, so none of
 * `src/data/user/example/**` is present. This migration therefore also
 * creates — idempotently, resolved by unique `email` — a dedicated branded
 * editorial author ("Equipo Hospeda") and attributes every post to it.
 *
 * Article content is read from colocated JSON under `data/real-blog-posts/`
 * (one file per article), using the same `import.meta.url` + `readFile`
 * resolution pattern as `0018-poi-curation-safe-subset.ts`, so the migration
 * is independent of `process.cwd()` in every environment.
 *
 * The inserts bypass `PostService`/`UserService` and go straight through
 * `PostModel`/`UserModel` (same pattern as `0019-backfill-example-partners.ts`
 * and the seed factory's own deterministic-id direct path). Every fixture
 * carries a curated, unique `slug`, so the only service hook that could fire
 * (slug auto-generation) is a guaranteed no-op.
 *
 * ## Idempotency
 *
 * - **Author**: resolved by unique `email` (`editorial@hospeda.com.ar`);
 *   created only when missing. Re-running never creates a second account.
 * - **Posts**: resolved by unique `slug` (`posts.slug` is UNIQUE); created
 *   only when missing.
 * - **Destination links**: a standalone migration has no `idMapper`, so
 *   `relatedDestinationSlug` is resolved to a real destination UUID by its
 *   unique `slug` at run time. A slug that does not resolve is left `null`
 *   (the FK is nullable, `onDelete: set null`) and counted, never fatal.
 *
 * ## `destructive` flag decision
 *
 * `false` — every operation is an INSERT-if-missing. Nothing is deleted or
 * overwritten.
 *
 * ## Baseline-stamp gap (content-only migration)
 *
 * The 9 articles live ONLY here, not in the baseline seed (`src/data/**`), to
 * keep this production content cleanly separate from the demo `example` posts.
 * The trade-off: a from-scratch build (prod day-1, local `db:fresh-dev`)
 * baseline-stamps every pending migration WITHOUT running `up()`, so on a fresh
 * DB this content is NOT created. It lands correctly on already-live
 * environments (the normal deploy path, where `pnpm db:seed:migrate` runs the
 * migration for real). After a fresh/DR rebuild, this migration must be re-run
 * for real — see `docs/deployment/first-time-setup.md` (step 4, "Content-only
 * migrations must be re-run for real after a from-scratch build").
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Post, User } from '@repo/schemas';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    type PostCategoryEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0025-seed-real-blog-posts',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** Unique identity of the shared editorial author created by this migration. */
const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

/**
 * Placeholder image URLs. The operator swaps these for real assets from the
 * admin panel after the content lands (decided with the content owner). They
 * are valid, resolvable URLs so `MediaSchema`/`UserProfileSchema` `.url()`
 * validation passes, and obviously placeholder so they are easy to spot.
 */
const PLACEHOLDER_FEATURED_IMAGE_URL = 'https://placehold.co/1200x630/1b6b4c/ffffff?text=Hospeda';
const EDITORIAL_AVATAR_URL = 'https://placehold.co/400x400/1b6b4c/ffffff?text=Hospeda';

const EDITORIAL_BIO =
    'Somos el equipo editorial de Hospeda. Recorremos la costa del rio Uruguay y todo el Litoral ' +
    'entrerriano para contarte que visitar, donde comer y como aprovechar cada escapada. Turismo ' +
    'local, contado por quienes lo conocen de cerca.';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, 'data', 'real-blog-posts');

/**
 * Shape of a real blog post fixture as authored under
 * `data/real-blog-posts/*.json`. Deliberately narrower and cleaner than the
 * demo `src/data/post/*.json` fixtures: it stores a destination *slug* (not a
 * seed-key id, since this migration resolves links by slug), and omits engine
 * fields the migration sets uniformly (author, visibility, moderation).
 */
interface RealPostFixture {
    readonly slug: string;
    readonly category: `${PostCategoryEnum}`;
    readonly title: string;
    readonly summary: string;
    readonly content: string;
    /** Unique destination slug to link, or `null` for multi-destination posts. */
    readonly relatedDestinationSlug: string | null;
    readonly seo: { readonly title: string; readonly description: string };
    readonly readingTimeMinutes: number;
    readonly publishedAt: string;
    readonly isFeatured: boolean;
    readonly isFeaturedInWebsite: boolean;
    readonly featuredImageCaption: string;
    readonly featuredImageAlt: string;
}

/**
 * Loads every `*.json` article fixture from {@link DATA_DIR}, sorted by
 * filename so `publishedAt` ordering stays deterministic across runs.
 */
async function loadRealPostFixtures(): Promise<readonly RealPostFixture[]> {
    const entries = await readdir(DATA_DIR);
    const files = entries.filter((f) => f.endsWith('.json')).sort();
    const fixtures: RealPostFixture[] = [];
    for (const file of files) {
        const raw = await readFile(path.join(DATA_DIR, file), 'utf-8');
        fixtures.push(JSON.parse(raw) as RealPostFixture);
    }
    return fixtures;
}

/**
 * Resolves the editorial author, creating it once if missing. Uses a
 * re-`findOne` after `create` so the returned id is captured regardless of
 * what `UserModel.create` returns.
 */
async function ensureEditorialAuthor(ctx: SeedMigrationCtx): Promise<User> {
    const userModel = new ctx.models.UserModel();

    const existing = (await userModel.findOne({ email: EDITORIAL_EMAIL }, ctx.db)) as User | null;
    if (existing) {
        return existing;
    }

    await userModel.create(
        {
            email: EDITORIAL_EMAIL,
            emailVerified: true,
            role: RoleEnum.EDITOR,
            displayName: 'Equipo Hospeda',
            firstName: 'Equipo',
            lastName: 'Hospeda',
            profile: { avatar: EDITORIAL_AVATAR_URL, bio: EDITORIAL_BIO },
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdById: ctx.actor.id,
            updatedById: ctx.actor.id
        } as Partial<User>,
        ctx.db
    );

    const created = (await userModel.findOne({ email: EDITORIAL_EMAIL }, ctx.db)) as User | null;
    if (!created) {
        throw new Error(`Failed to create editorial author "${EDITORIAL_EMAIL}"`);
    }
    return created;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const author = await ensureEditorialAuthor(ctx);

    const postModel = new ctx.models.PostModel();
    const destinationModel = new ctx.models.DestinationModel();

    const counts = {
        postsCreated: 0,
        postsSkipped: 0,
        destinationLinksResolved: 0,
        destinationLinksMissing: 0
    };

    const fixtures = await loadRealPostFixtures();

    for (const fixture of fixtures) {
        const existing = await postModel.findOne({ slug: fixture.slug }, ctx.db);
        if (existing) {
            counts.postsSkipped += 1;
            continue;
        }

        let relatedDestinationId: string | null = null;
        if (fixture.relatedDestinationSlug) {
            const destination = await destinationModel.findOne(
                { slug: fixture.relatedDestinationSlug },
                ctx.db
            );
            if (destination) {
                relatedDestinationId = destination.id;
                counts.destinationLinksResolved += 1;
            } else {
                counts.destinationLinksMissing += 1;
            }
        }

        await postModel.create(
            {
                slug: fixture.slug,
                category: fixture.category as PostCategoryEnum,
                title: fixture.title,
                summary: fixture.summary,
                content: fixture.content,
                media: {
                    featuredImage: {
                        url: PLACEHOLDER_FEATURED_IMAGE_URL,
                        caption: fixture.featuredImageCaption,
                        alt: fixture.featuredImageAlt,
                        moderationState: ModerationStatusEnum.APPROVED
                    }
                },
                authorId: author.id,
                relatedDestinationId,
                visibility: VisibilityEnum.PUBLIC,
                isNews: false,
                isFeatured: fixture.isFeatured,
                isFeaturedInWebsite: fixture.isFeaturedInWebsite,
                publishedAt: new Date(fixture.publishedAt),
                readingTimeMinutes: fixture.readingTimeMinutes,
                seo: fixture.seo,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                moderationState: ModerationStatusEnum.APPROVED,
                createdById: author.id,
                updatedById: author.id
            } as Partial<Post>,
            ctx.db
        );
        counts.postsCreated += 1;
    }

    return {
        summary:
            `Real blog posts: ${counts.postsCreated} created, ${counts.postsSkipped} skipped; ` +
            `author "${author.displayName ?? EDITORIAL_EMAIL}" ready; ` +
            `${counts.destinationLinksResolved} destination link(s) resolved, ` +
            `${counts.destinationLinksMissing} unresolved.`,
        counts
    };
}
