/**
 * SPEC-080 — PostService.getById() relation-loading integration test.
 *
 * Highest-value test in SPEC-080: validates the nested `sponsorship.sponsor`
 * resolution that GAP-028 flagged. The mocked unit tests cannot catch a
 * misconfigured nested relation definition because the mocks bypass Drizzle
 * entirely. Here we go through real PostgreSQL.
 *
 * NOTE: `sponsorship.sponsor` is a `post_sponsors` brand entity (with name,
 * type, description, logo, contact, social) — NOT a User. This is a schema
 * discovery from T-010 of SPEC-080.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostService } from '../../../src/services/post/post.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedPost,
    seedPostSponsorship,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — PostService.getById relation loading', () => {
    let service: PostService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new PostService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'resolves nested `sponsorship.sponsor` (PostSponsor brand) end-to-end',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedPostSponsorship(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.postId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.postId);

                const data = result.data as unknown as {
                    authorId?: string;
                    sponsorshipId?: string | null;
                    author?: { id?: string } | null;
                    sponsorship?: {
                        id?: string;
                        sponsorId?: string;
                        sponsor?: { id?: string; name?: string; type?: string } | null;
                    } | null;
                };

                expect(data.authorId).toBe(seeded.authorId);
                expect(data.author?.id).toBe(seeded.authorId);

                // Top-level sponsorship is populated.
                expect(data.sponsorshipId).toBe(seeded.sponsorshipId);
                expect(data.sponsorship?.id).toBe(seeded.sponsorshipId);

                // *** GAP-028 GUARD ***: the nested PostSponsor must resolve.
                expect(data.sponsorship?.sponsor).toBeDefined();
                expect(data.sponsorship?.sponsor?.id).toBe(seeded.sponsorId);
                expect(data.sponsorship?.sponsor?.type).toBe('POST_SPONSOR');
                expect(data.sponsorship?.sponsorId).toBe(
                    data.sponsorship?.sponsor?.id ?? seeded.sponsorId
                );
            });
        }
    );

    it.skipIf(!dbAvailable)('returns null `sponsorship` when the post has no sponsor', async () => {
        await withServiceTestTransaction(async (tx) => {
            const seeded = await seedPost(tx);
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            const result = await service.getById(actor, seeded.postId, ctx);

            expect(result.error).toBeUndefined();
            expect(result.data).toBeDefined();
            if (!result.data) throw new Error('expected populated result.data');

            const data = result.data as unknown as {
                authorId?: string;
                sponsorshipId?: string | null;
                author?: { id?: string } | null;
                sponsorship?: unknown;
            };
            expect(data.authorId).toBe(seeded.authorId);
            expect(data.author?.id).toBe(seeded.authorId);
            expect(data.sponsorshipId).toBeNull();
            expect(data.sponsorship ?? null).toBeNull();
        });
    });

    it.skipIf(!dbAvailable)('throws NOT_FOUND when the post does not exist', async () => {
        await withServiceTestTransaction(async (tx) => {
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            await expect(service.getById(actor, crypto.randomUUID(), ctx)).rejects.toThrow(
                /not found/i
            );
        });
    });
});
