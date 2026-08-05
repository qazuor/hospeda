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
 * ## `contentOnly` flag decision
 *
 * `true`. The 9 articles live ONLY here, not in the baseline seed
 * (`src/data/**`), to keep this production content cleanly separate from the
 * demo `example` posts. That makes this file the sole source of its own rows,
 * so baseline-stamping must not skip it: `--baseline-stamp` leaves it pending
 * and then runs it for real, and a from-scratch build (prod day-1, local
 * `db:fresh-dev`) gets the articles like any live environment does.
 *
 * Before HOS-375 this was a genuine gap — every fresh build stamped the
 * migration applied with the content never created, and the ledger then
 * blocked it from ever running. The documented workaround was a manual re-run
 * listed in `docs/deployment/first-time-setup.md`; that list was already stale
 * (it named this migration but not `0027`/`0028`, which had the identical
 * gap), which is exactly why the fix is a flag on the migration rather than a
 * list somewhere else. See `data-migrations/types.ts`
 * (`SeedMigrationMeta.contentOnly`) and
 * `docs/guides/seed-data-migrations.md`.
 *
 * Not retroactive: an environment where this migration is already ledgered —
 * including a dev DB stamped by an older `db:fresh-dev` — is unaffected and
 * still needs a rebuild to pick the content up.
 *
 * ## No imagery (revised)
 *
 * This migration originally stamped every post with a fake `placehold.co`
 * cover and gave the editorial author a matching fake avatar, on the
 * assumption an operator would swap them for real assets later. Nothing
 * distinguished them from a genuine upload — the public site rendered a flat
 * green rectangle and the admin editor showed a populated image slot for a
 * post that had no photo. Both are gone: posts are created with no `media` at
 * all, and the author with no `avatar`. The web renders nothing for a
 * cover-less post and the author card falls back to its initial-letter avatar.
 * `0030-clear-placeholder-blog-media` removes the ones already written to live
 * environments.
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
    destructive: false,
    contentOnly: true
} as const satisfies SeedMigrationModule['meta'];

/** Unique identity of the shared editorial author created by this migration. */
const EDITORIAL_EMAIL = 'editorial@hospeda.com.ar';

/**
 * Curated public slug for the editorial author (HOS-375 §6.10.2, G-9). Set
 * explicitly at creation so a new environment never generates the random
 * `user-<8 hex>` auto-slug that `users.slug.$defaultFn` would otherwise
 * produce — that slug became a public, indexable URL under HOS-375, and it
 * differed per environment. `0040-editorial-author-slug` is the migration half
 * of this dual-write, renaming the account in environments seeded before the
 * slug was set here; keep both sides in sync.
 */
const EDITORIAL_SLUG = 'equipo-hospeda';

const EDITORIAL_BIO =
    'Somos el equipo editorial de Hospeda. Recorremos la costa del rio Uruguay y todo el Litoral ' +
    'entrerriano para contarte que visitar, donde comer y como aprovechar cada escapada. Turismo ' +
    'local, contado por quienes lo conocen de cerca.';

/**
 * The Hospeda isotype, used as the editorial account's avatar (HOS-375).
 *
 * An avatar is one of the five conditions of §6.5, so without one this account
 * — the site's main editorial voice, and its richest author page by far — was
 * the ONLY author excluded from the index while accounts with a single post
 * qualified. The condition itself is unchanged; the account was simply missing
 * the data.
 *
 * The transformation segment is deliberate, not decoration. The page renders
 * the avatar in a 96px circle, so `w_192,h_192` serves it at 2x for retina and
 * nothing larger; `c_fill` matches the element's own `object-fit: cover`, so
 * the CDN and the browser crop identically instead of fighting; `f_auto` and
 * `q_auto` cut the payload from 28.7 KB of PNG to ~8 KB of WebP. The source
 * asset is already square (192x192), so `c_fill` crops nothing today.
 *
 * `0042-editorial-author-avatar` is the migration half of this dual-write, for
 * environments seeded before this field existed; keep both sides in sync.
 */
const EDITORIAL_AVATAR =
    'https://res.cloudinary.com/djqdu6u93/image/upload/f_auto,q_auto,w_192,h_192,c_fill/' +
    'v1783526697/hospeda/prod/avatars/5748fbbd-7b13-4c65-b545-5510e106b0a5.png';

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
    /**
     * Caption/alt authored for the cover photo that should eventually be shot
     * for this article. Deliberately unused: the migration no longer writes a
     * cover (see "No imagery" above). They stay in the fixtures so whoever
     * wires real image URLs has the copy ready.
     */
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
            slug: EDITORIAL_SLUG,
            emailVerified: true,
            role: RoleEnum.EDITOR,
            displayName: 'Equipo Hospeda',
            firstName: 'Equipo',
            lastName: 'Hospeda',
            profile: { bio: EDITORIAL_BIO, avatar: EDITORIAL_AVATAR },
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
