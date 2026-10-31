/**
 * venue.trashed-parent.test.ts
 *
 * Regression for HOS-1919: child writes on a soft-deleted (trashed) venue
 * listing must answer NOT_FOUND and write nothing.
 *
 * All DB interactions are fully mocked — no live DB is touched.
 */

const mockFaqModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...actual,
        domainEventModel: doubles.domainEventModelDouble,
        withTransaction: doubles.fakeDbWithTransaction,
        VenueFaqModel: vi.fn(function () {
            return mockFaqModel;
        })
    };
});

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addVenueFaq } from '../../../src/services/venue/venue.faq';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

const VENUE_ID = '00000000-0000-4000-a000-000000000001';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';

const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.VENUE_OWNER],
    permissions: [PermissionEnum.VENUE_EDIT_OWN]
};

const input = {
    venueId: VENUE_ID,
    faq: { question: 'Do you take reservations?', answer: 'Yes, by phone.' }
};

type Model = Parameters<typeof addVenueFaq>[0];

const makeModel = (deletedAt: Date | null) => ({
    findById: vi.fn().mockResolvedValue({
        id: VENUE_ID,
        ownerId: OWNER_ID,
        name: 'Cafe',
        deletedAt
    })
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );
    mockFaqModel.findAll.mockResolvedValue({ items: [] });
    mockFaqModel.create.mockResolvedValue({ id: 'faq-1', ...input.faq, venueId: VENUE_ID });
});

describe('addVenueFaq on a trashed listing (HOS-1919)', () => {
    it('writes the FAQ when the venue is live', async () => {
        const result = await addVenueFaq(makeModel(null) as unknown as Model, ownerActor, input);

        expect(result.error).toBeUndefined();
        expect(mockFaqModel.create).toHaveBeenCalled();
    });

    it('returns NOT_FOUND and writes nothing when the venue is soft-deleted', async () => {
        const result = await addVenueFaq(
            makeModel(new Date()) as unknown as Model,
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockFaqModel.create).not.toHaveBeenCalled();
    });
});
