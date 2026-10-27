/**
 * experience.faq.test.ts
 *
 * Unit tests for the experience FAQ update/remove helpers (HOS-1907).
 *
 * Coverage:
 *  - updateExperienceFaq / removeExperienceFaq: a live FAQ is written, a FAQ
 *    that is already soft-deleted is NOT_FOUND and nothing is written.
 *
 * All DB interactions are fully mocked — no live DB is touched.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockFaqModel = {
    findById: vi.fn(),
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

// ---------------------------------------------------------------------------

import type { ExperienceFaq } from '@repo/schemas';
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    removeExperienceFaq,
    updateExperienceFaq
} from '../../../src/services/experience/experience.faq';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

const EXPERIENCE_ID = '00000000-0000-4000-a000-000000000001';
const FAQ_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';

function makeFaq(overrides: Partial<ExperienceFaq> = {}): ExperienceFaq {
    return {
        id: FAQ_ID,
        experienceId: EXPERIENCE_ID,
        question: 'Is it suitable for children?',
        answer: 'Yes, from 6 years old.',
        category: 'general',
        displayOrder: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as ExperienceFaq;
}

const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.EXPERIENCE_OWNER],
    permissions: [PermissionEnum.EXPERIENCE_EDIT_OWN]
};

function makeModel() {
    return {
        findById: vi.fn().mockResolvedValue({ id: EXPERIENCE_ID, ownerId: OWNER_ID, name: 'Tour' })
    };
}

type Model = Parameters<typeof updateExperienceFaq>[0];

beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );
    mockFaqModel.findById.mockResolvedValue(makeFaq());
    mockFaqModel.update.mockResolvedValue(makeFaq({ answer: 'Updated answer' }));
    mockFaqModel.softDelete.mockResolvedValue(1);
});

describe('updateExperienceFaq', () => {
    const input = { experienceId: EXPERIENCE_ID, faqId: FAQ_ID, faq: { answer: 'Updated answer' } };

    it('updates a live FAQ', async () => {
        const result = await updateExperienceFaq(
            makeModel() as unknown as Model,
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(mockFaqModel.update).toHaveBeenCalled();
    });

    it('returns NOT_FOUND for an already soft-deleted FAQ (HOS-1907)', async () => {
        mockFaqModel.findById.mockResolvedValue(makeFaq({ deletedAt: new Date() }));

        const result = await updateExperienceFaq(
            makeModel() as unknown as Model,
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockFaqModel.update).not.toHaveBeenCalled();
    });
});

describe('removeExperienceFaq', () => {
    const input = { experienceId: EXPERIENCE_ID, faqId: FAQ_ID };

    it('soft-deletes a live FAQ', async () => {
        const result = await removeExperienceFaq(
            makeModel() as unknown as Model,
            ownerActor,
            input
        );

        expect(result.error).toBeUndefined();
        expect(mockFaqModel.softDelete).toHaveBeenCalled();
    });

    it('returns NOT_FOUND for an already soft-deleted FAQ (HOS-1907)', async () => {
        mockFaqModel.findById.mockResolvedValue(makeFaq({ deletedAt: new Date() }));

        const result = await removeExperienceFaq(
            makeModel() as unknown as Model,
            ownerActor,
            input
        );

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mockFaqModel.softDelete).not.toHaveBeenCalled();
    });
});
