/**
 * SPEC-080 — PostSponsorshipService.getById() relation-loading integration test.
 *
 * Verifies against a real PostgreSQL database that PostSponsorshipService
 * .getById() resolves `post` and `sponsor` (a PostSponsor brand entity, NOT a
 * User) into populated nested objects.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostSponsorshipService } from '../../../src/services/postSponsorship/postSponsorship.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedPostSponsorship,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — PostSponsorshipService.getById relation loading', () => {
    let service: PostSponsorshipService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new PostSponsorshipService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)(
        'returns populated `post` and `sponsor` (PostSponsor brand) objects (not FK strings)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const seeded = await seedPostSponsorship(tx);
                const actor = createSuperAdminActor();
                const ctx: ServiceContext = { tx };

                const result = await service.getById(actor, seeded.sponsorshipId, ctx);

                expect(result.error).toBeUndefined();
                expect(result.data).toBeDefined();
                if (!result.data) throw new Error('expected populated result.data');

                expect(result.data.id).toBe(seeded.sponsorshipId);
                const data = result.data as unknown as {
                    postId?: string;
                    sponsorId?: string;
                    post?: { id?: string; title?: string } | null;
                    sponsor?: { id?: string; name?: string; type?: string } | null;
                };
                expect(data.postId).toBe(seeded.postId);
                expect(data.sponsorId).toBe(seeded.sponsorId);
                expect(data.post?.id).toBe(seeded.postId);
                expect(data.sponsor?.id).toBe(seeded.sponsorId);
                // Confirm the sponsor is the PostSponsor brand entity, not a User.
                expect(data.sponsor?.name).toBeTruthy();
                expect(data.sponsor?.type).toBe('POST_SPONSOR');
            });
        }
    );

    it.skipIf(!dbAvailable)('throws NOT_FOUND when the sponsorship does not exist', async () => {
        await withServiceTestTransaction(async (tx) => {
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            await expect(service.getById(actor, crypto.randomUUID(), ctx)).rejects.toThrow(
                /not found/i
            );
        });
    });
});
