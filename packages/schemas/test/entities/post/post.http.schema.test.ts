/**
 * @fileoverview
 * Tests for the post HTTP schemas and their domain mappers, focused on
 * authorship (HOS-374 D-2).
 *
 * `authorId` used to be a required field on `PostCreateHttpSchema` that the
 * mapper passed straight through to the domain input, so any caller holding
 * `POST_CREATE` could attribute a post to an arbitrary user — and the update
 * mapper passed it through too, so authorship could be reassigned afterwards.
 *
 * Authorship is now resolved server-side from the authenticated actor. These
 * tests pin that down from both directions: the value must come from the actor,
 * and a body that still carries `authorId` must not be able to override it.
 *
 * @module test/entities/post/post.http.schema
 */
import { describe, expect, it } from 'vitest';
import {
    httpToDomainPostCreate,
    httpToDomainPostUpdate,
    PostCreateHttpSchema
} from '../../../src/entities/post/post.http.schema.js';
import { PostCategoryEnum } from '../../../src/enums/index.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const SOMEONE_ELSE_ID = '22222222-2222-4222-8222-222222222222';

/** A minimal valid create body, without `authorId`. */
const validCreateBody = {
    title: 'A perfectly reasonable post title',
    summary: 'A summary long enough to satisfy the schema minimum.',
    content: 'x'.repeat(150),
    category: PostCategoryEnum.GENERAL,
    isFeatured: false,
    isPublished: false
};

describe('PostCreateHttpSchema — authorship (HOS-374)', () => {
    it('does not require authorId', () => {
        const result = PostCreateHttpSchema.safeParse(validCreateBody);
        expect(result.success).toBe(true);
    });

    it('strips authorId when a client still sends it', () => {
        // The schema is a plain z.object, so unknown keys are stripped rather
        // than rejected — an existing client that keeps sending authorId keeps
        // working, it just no longer has any effect.
        const result = PostCreateHttpSchema.safeParse({
            ...validCreateBody,
            authorId: SOMEONE_ELSE_ID
        });

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('authorId');
    });
});

describe('httpToDomainPostCreate — authorship (HOS-374)', () => {
    it('assigns authorship from the actor', () => {
        const parsed = PostCreateHttpSchema.parse(validCreateBody);

        const domain = httpToDomainPostCreate(parsed, ACTOR_ID);

        expect(domain.authorId).toBe(ACTOR_ID);
    });

    it('ignores an authorId present on the input object', () => {
        // Deliberately NOT parsed first. Parsing strips authorId, so a test that
        // parses only proves the schema strips — it says nothing about the
        // mapper. The route handler casts the body (`body as PostCreateHttp`)
        // rather than re-parsing, so the mapper must be safe on its own.
        const unsanitized = {
            ...validCreateBody,
            authorId: SOMEONE_ELSE_ID
        } as unknown as Parameters<typeof httpToDomainPostCreate>[0];

        const domain = httpToDomainPostCreate(unsanitized, ACTOR_ID);

        expect(domain.authorId).toBe(ACTOR_ID);
        expect(domain.authorId).not.toBe(SOMEONE_ELSE_ID);
    });
});

describe('httpToDomainPostUpdate — authorship (HOS-374)', () => {
    it('never emits authorId, so authorship cannot be reassigned', () => {
        // Authorship is assigned once, at creation. An update that carries an
        // authorId must not produce one in the domain payload — otherwise the
        // create-side fix is bypassable by creating then updating.
        const domain = httpToDomainPostUpdate({
            title: 'An edited title that is long enough',
            authorId: SOMEONE_ELSE_ID
        } as Parameters<typeof httpToDomainPostUpdate>[0]);

        expect(domain.authorId).toBeUndefined();
    });
});
