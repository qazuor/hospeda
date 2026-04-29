/**
 * SPEC-080 — UserBookmarkService.getById() relation-loading integration test.
 *
 * Verifies that against a real PostgreSQL database, UserBookmarkService
 * resolves its single eager relation (`user`) into a populated nested
 * object — not a bare FK string.
 *
 * Validates that the `user` relation is correctly declared on
 * `userBookmarks` and that `validRelationKeys` accepts it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UserBookmarkService } from '../../../src/services/userBookmark/userBookmark.service';
import type { ServiceContext } from '../../../src/types';
import { createSuperAdminActor } from '../../factories/actorFactory';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedUserBookmark,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('SPEC-080 — UserBookmarkService.getById relation loading', () => {
    let service: UserBookmarkService;

    beforeAll(() => {
        if (!dbAvailable) return;
        getServiceTestDb();
        service = new UserBookmarkService({ logger: createLoggerMock() });
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)('returns a populated `user` object (not a FK string)', async () => {
        await withServiceTestTransaction(async (tx) => {
            const seeded = await seedUserBookmark(tx);
            const actor = createSuperAdminActor();
            const ctx: ServiceContext = { tx };

            const result = await service.getById(actor, seeded.bookmarkId, ctx);

            expect(result.error).toBeUndefined();
            if (!result.data) throw new Error('expected populated result.data');

            expect(result.data.id).toBe(seeded.bookmarkId);
            expect(result.data.userId).toBe(seeded.userId);

            const data = result.data as unknown as { user?: { id?: string } | null };
            expect(data.user?.id).toBe(seeded.userId);
        });
    });
});
