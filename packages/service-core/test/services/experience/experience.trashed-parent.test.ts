/**
 * experience.trashed-parent.test.ts
 *
 * Regression for HOS-1919: child writes on a soft-deleted (trashed) experience
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
        ExperienceFaqModel: vi.fn(function () {
            return mockFaqModel;
        })
    };
});

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addExperienceFaq } from '../../../src/services/experience/experience.faq';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

const EXPERIENCE_ID = '00000000-0000-4000-a000-000000000001';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';

const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.EXPERIENCE_OWNER],
    permissions: [PermissionEnum.EXPERIENCE_EDIT_OWN]
};

const input = {
    experienceId: EXPERIENCE_ID,
    faq: { question: 'Is it suitable for children?', answer: 'Yes, from 6.' }
};

type Model = Parameters<typeof addExperienceFaq>[0];

const makeModel = (deletedAt: Date | null) => ({
    findById: vi.fn().mockResolvedValue({
        id: EXPERIENCE_ID,
        ownerId: OWNER_ID,
        name: 'Tour',
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
    mockFaqModel.create.mockResolvedValue({ id: 'faq-1', ...input.faq });
});

describe('addExperienceFaq on a trashed listing (HOS-1919)', () => {
    it('writes the FAQ when the experience is live', async () => {
        const result = await addExperienceFaq(
            makeModel(null) as unknown as Model,
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(mockFaqModel.create).toHaveBeenCalled();
    });

    it('returns NOT_FOUND and writes nothing when the experience is soft-deleted', async () => {
        const result = await addExperienceFaq(
            makeModel(new Date()) as unknown as Model,
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockFaqModel.create).not.toHaveBeenCalled();
    });
});
