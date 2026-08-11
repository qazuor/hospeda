import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    PostAuthorPublicSchema,
    PostPublicSchema
} from '../../../src/entities/post/post.access.schema.js';
import { createValidPost } from '../../fixtures/post.fixtures.js';

/**
 * The public post payload's `author` relation was declared as
 * `UserPublicSchema` — a projection both WIDER and STRICTER than a byline
 * needs. `PostService` eager-loads the relation by default, so the wide shape
 * reached every public post route, list pages included.
 *
 * Two independent defects rode on that, and these tests pin both:
 *
 * 1. **Overexposure.** `firstName`/`lastName` are the person's real name, a
 *    different class of data from the display name they chose to publish;
 *    `roles` describes account privileges. `apps/web` actively rendered
 *    `firstName + lastName` whenever `displayName` was falsy — including in
 *    the posts block of the HOS-375 author page, whose whole premise is that
 *    only a chosen name gets published.
 * 2. **Fail-closed 500.** `stripWithSchema`
 *    (`apps/api/src/utils/response-helpers.ts`) turns any parse failure into an
 *    HTTP 500 for the WHOLE response, and `createPaginatedResponse` runs it per
 *    item. `users.image` is an unbounded nullable `text` column Better Auth
 *    writes directly, bypassing the write schemas, so one stored non-URL under
 *    `UserPublicSchema`'s `z.string().url()` 500s every page of
 *    `/api/v1/public/posts` for every visitor. `slug: z.string().min(1)` is the
 *    same trap on a second column.
 *
 * Mirrors `event.access.schema.test.ts`, where the identical fix shipped first.
 */
describe('PostPublicSchema — author relation is the narrowed public projection', () => {
    /**
     * A verbatim `users` row as the Drizzle `author` relation returns it: the
     * whole record, private columns included. The public payload must expose
     * only the public-tier subset of this.
     */
    const rawAuthorRow = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        displayName: 'Laura Vega',
        firstName: 'Laura',
        lastName: 'Vega',
        slug: 'laura-vega',
        image: 'https://cdn.hospeda.test/avatars/laura-vega.jpg',
        avatarUrl: 'https://cdn.hospeda.test/avatars/laura-vega.jpg',
        roles: ['ADMIN'],
        // Private columns that must NOT survive the projection.
        email: 'laura.vega@hospeda.test',
        password: 'hashed-secret',
        phone: '+5493442123456',
        settings: { publicProfileShowSocialNetworks: false },
        contactInfo: { personalEmail: 'laura@personal.test' },
        isSystemAccount: false,
        deletedAt: null
    };

    const postWithAuthor = (author: unknown) => ({ ...createValidPost(), author });

    it('carries the fields the byline needs when the relation is loaded', () => {
        const result = PostPublicSchema.safeParse(postWithAuthor(rawAuthorRow));

        expect(result.success).toBe(true);
        if (!result.success) return;

        expect(result.data.author?.id).toBe(rawAuthorRow.id);
        expect(result.data.author?.displayName).toBe('Laura Vega');
        // The byline's link target — `/autores/<slug>/`.
        expect(result.data.author?.slug).toBe('laura-vega');
        expect(result.data.author?.image).toBe(rawAuthorRow.image);
    });

    it('drops the real name and the account roles', () => {
        const result = PostPublicSchema.safeParse(postWithAuthor(rawAuthorRow));

        expect(result.success).toBe(true);
        if (!result.success) return;

        const author = result.data.author as Record<string, unknown>;
        for (const dropped of ['firstName', 'lastName', 'roles', 'avatarUrl']) {
            expect(author, `field "${dropped}" must not be published`).not.toHaveProperty(dropped);
        }
        // Non-vacuity: the fields the byline DOES need survived, and the raw
        // row really did carry every dropped key on the way in.
        expect(author.displayName).toBe('Laura Vega');
        for (const dropped of ['firstName', 'lastName', 'roles', 'avatarUrl']) {
            expect(rawAuthorRow).toHaveProperty(dropped);
        }
    });

    it('strips every private user column out of the loaded author', () => {
        const result = PostPublicSchema.safeParse(postWithAuthor(rawAuthorRow));

        expect(result.success).toBe(true);
        if (!result.success) return;

        const author = result.data.author as Record<string, unknown>;
        for (const leaked of [
            'email',
            'password',
            'phone',
            'settings',
            'contactInfo',
            'deletedAt'
        ]) {
            expect(author, `field "${leaked}" must not be published`).not.toHaveProperty(leaked);
        }
    });

    it('accepts a malformed avatar instead of failing the response closed', () => {
        // The property under test is 500-PREVENTION, and nothing more:
        // `stripWithSchema` is fail-closed and `createPaginatedResponse` runs it
        // per item, so under a strict `.url()` one bad `users.image` row would
        // 500 every page of `/api/v1/public/posts`.
        //
        // The schema deliberately does NOT erase the value (that used to be
        // `.catch(undefined)`, which `@hono/zod-openapi` cannot render — it
        // broke the whole global OpenAPI document). Keeping the junk out of an
        // `<img>` is the CONSUMER's job now; see
        // `apps/web/test/lib/media.renderable-image-url.test.ts` and
        // `apps/web/test/lib/api/transforms.author-avatar.test.ts`.
        const result = PostPublicSchema.safeParse(
            postWithAuthor({ ...rawAuthorRow, image: 'not-a-url' })
        );

        expect(result.success).toBe(true);
        if (!result.success) return;

        const author = result.data.author as Record<string, unknown>;
        expect(author.image).toBe('not-a-url');
        // The byline still renders.
        expect(author.displayName).toBe('Laura Vega');
        expect(author.slug).toBe('laura-vega');
    });

    it('does not render `image` through a ZodCatch (global OpenAPI doc guard)', () => {
        // Regression pin: `.catch()` here made `getOpenAPIDocument()` throw
        // ("Unknown zod object type"), which 500s `/docs/openapi.json` and
        // breaks `/docs`, `/reference` and `/ui` in EVERY environment — because
        // the OpenAPI document is global, not per-route.
        //
        // This pins the outermost wrapper only — a `.catch()` buried deeper
        // would slip past. The authoritative, nesting-proof guard is
        // `apps/api`'s `test/routes/openapi-doc-generation.test.ts`, which
        // builds the real document; this assertion just fails FASTER and names
        // the culprit field.
        expect(PostAuthorPublicSchema.shape.image instanceof z.ZodCatch).toBe(false);
    });

    it('does not 500 on an empty displayName or a missing slug', () => {
        // Production really holds `display_name = ''` rows (HOS-302), and
        // `UserPublicSchema.slug` is `z.string().min(1)` — fail-closed on both.
        const result = PostPublicSchema.safeParse(
            postWithAuthor({ ...rawAuthorRow, displayName: '', slug: '' })
        );

        expect(result.success).toBe(true);
    });

    it('parses a payload that carries no author key at all', () => {
        const historic = createValidPost();
        expect(historic).not.toHaveProperty('author');

        const result = PostPublicSchema.safeParse(historic);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.author).toBeUndefined();
        }
    });

    it('parses an author of null — the FK is nullable on the row', () => {
        const result = PostPublicSchema.safeParse(postWithAuthor(null));

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.author).toBeNull();
        }
    });
});
