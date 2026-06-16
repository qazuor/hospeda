/**
 * gastronomy.faq.test.ts
 *
 * Unit tests for gastronomy FAQ helper functions (SPEC-239 T-037).
 *
 * Coverage:
 *  - addGastronomyFaq: schema validation, NOT_FOUND listing, permission gate,
 *    displayOrder auto-assign (max+1 or 0 when empty).
 *  - updateGastronomyFaq: NOT_FOUND listing, NOT_FOUND FAQ, permission gate,
 *    successful update path.
 *  - removeGastronomyFaq: NOT_FOUND listing, NOT_FOUND FAQ, successful delete.
 *  - listGastronomyFaqs: NOT_FOUND listing, returns faqs array from relations.
 *  - reorderGastronomyFaqs: unknown faqId returns VALIDATION_ERROR, happy path.
 *
 * All DB interactions are fully mocked — no live DB is touched.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const mockFaqModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn()
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        GastronomyFaqModel: vi.fn(() => mockFaqModel)
    };
});

// ---------------------------------------------------------------------------

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type {
    GastronomyFaq,
    GastronomyFaqAddInput,
    GastronomyFaqListInput,
    GastronomyFaqRemoveInput,
    GastronomyFaqReorderInput,
    GastronomyFaqUpdateInput
} from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    addGastronomyFaq,
    listGastronomyFaqs,
    removeGastronomyFaq,
    reorderGastronomyFaqs,
    updateGastronomyFaq
} from '../../../src/services/gastronomy/gastronomy.faq';
import type { Actor } from '../../../src/types';
import * as permissionUtils from '../../../src/utils/permission';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GASTRONOMY_ID = '00000000-0000-4000-a000-000000000001';
const FAQ_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';

function makeFaq(overrides: Partial<GastronomyFaq> = {}): GastronomyFaq {
    return {
        id: FAQ_ID,
        gastronomyId: GASTRONOMY_ID,
        question: 'What are the opening hours?',
        answer: 'We are open from 12:00 to 23:00 daily.',
        category: 'general',
        displayOrder: 0,
        lifecycleState: 'ACTIVE' as GastronomyFaq['lifecycleState'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        ...overrides
    } as GastronomyFaq;
}

const ownerActor: Actor = {
    id: OWNER_ID,
    role: RoleEnum.COMMERCE_OWNER,
    permissions: [PermissionEnum.COMMERCE_FAQS_EDIT_OWN]
};

const _staffActor: Actor = {
    id: 'staff-id',
    role: RoleEnum.ADMIN,
    permissions: [PermissionEnum.COMMERCE_EDIT_ALL, PermissionEnum.COMMERCE_VIEW_ALL]
};

const touristActor: Actor = {
    id: 'tourist-id',
    role: RoleEnum.USER,
    permissions: []
};

// ---------------------------------------------------------------------------
// Mock GastronomyModel factory
// ---------------------------------------------------------------------------

function makeGastronomyModel(entity: Record<string, unknown> | null = null) {
    return {
        findById: vi.fn().mockResolvedValue(entity),
        findWithRelations: vi.fn().mockResolvedValue(entity ? { ...entity, faqs: [] } : null)
    };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(permissionUtils, 'hasPermission').mockImplementation((actor, permission) =>
        (actor as Actor).permissions.includes(permission)
    );

    // Reset FAQ model mocks to sensible defaults
    mockFaqModel.findAll.mockResolvedValue({ items: [], total: 0 });
    mockFaqModel.findById.mockResolvedValue(null);
    mockFaqModel.create.mockResolvedValue(makeFaq());
    mockFaqModel.update.mockResolvedValue(makeFaq());
    mockFaqModel.softDelete.mockResolvedValue(1);
});

// ---------------------------------------------------------------------------
// addGastronomyFaq
// ---------------------------------------------------------------------------

describe('addGastronomyFaq', () => {
    it('should return VALIDATION_ERROR for invalid gastronomyId', async () => {
        // Arrange
        const model = makeGastronomyModel();
        const input = {
            gastronomyId: 'not-a-uuid',
            faq: { question: 'Question?', answer: 'Answer.' }
        } as unknown as GastronomyFaqAddInput;

        // Act
        const result = await addGastronomyFaq(
            model as unknown as Parameters<typeof addGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should return NOT_FOUND when listing does not exist', async () => {
        // Arrange
        const model = makeGastronomyModel(null);
        const input: GastronomyFaqAddInput = {
            gastronomyId: GASTRONOMY_ID,
            faq: { question: 'What are the opening hours?', answer: 'We are open daily.' }
        };

        // Act
        const result = await addGastronomyFaq(
            model as unknown as Parameters<typeof addGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return FORBIDDEN when actor lacks COMMERCE_FAQS_EDIT_OWN', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const input: GastronomyFaqAddInput = {
            gastronomyId: GASTRONOMY_ID,
            faq: { question: 'What are the opening hours?', answer: 'We are open daily.' }
        };

        // Act
        const result = await addGastronomyFaq(
            model as unknown as Parameters<typeof addGastronomyFaq>[0],
            touristActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
    });

    it('should set displayOrder to 0 when no FAQs exist', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockFaqModel.findAll.mockResolvedValue({ items: [], total: 0 });

        const input: GastronomyFaqAddInput = {
            gastronomyId: GASTRONOMY_ID,
            faq: { question: 'What are the opening hours?', answer: 'We are open daily.' }
        };

        // Act
        const result = await addGastronomyFaq(
            model as unknown as Parameters<typeof addGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert — create was called with displayOrder: 0
        expect(result.error).toBeUndefined();
        expect(mockFaqModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ displayOrder: 0 }),
            undefined
        );
    });

    it('should set displayOrder to max + 1 when FAQs exist', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockFaqModel.findAll.mockResolvedValue({
            items: [{ ...makeFaq(), displayOrder: 3 }],
            total: 1
        });

        const input: GastronomyFaqAddInput = {
            gastronomyId: GASTRONOMY_ID,
            faq: { question: 'What are the opening hours?', answer: 'We are open daily.' }
        };

        // Act
        await addGastronomyFaq(
            model as unknown as Parameters<typeof addGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert — displayOrder should be 4 (max 3 + 1)
        expect(mockFaqModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ displayOrder: 4 }),
            undefined
        );
    });

    it('should create FAQ and return it on success', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const createdFaq = makeFaq();
        mockFaqModel.create.mockResolvedValue(createdFaq);

        const input: GastronomyFaqAddInput = {
            gastronomyId: GASTRONOMY_ID,
            faq: { question: 'What are the opening hours?', answer: 'We are open daily.' }
        };

        // Act
        const result = await addGastronomyFaq(
            model as unknown as Parameters<typeof addGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.faq).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// updateGastronomyFaq
// ---------------------------------------------------------------------------

describe('updateGastronomyFaq', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        // Arrange
        const model = makeGastronomyModel(null);
        const input: GastronomyFaqUpdateInput = {
            gastronomyId: GASTRONOMY_ID,
            faqId: FAQ_ID,
            faq: { answer: 'Updated answer' }
        };

        // Act
        const result = await updateGastronomyFaq(
            model as unknown as Parameters<typeof updateGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return NOT_FOUND when FAQ belongs to a different listing', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const foreignFaq = { ...makeFaq(), gastronomyId: '00000000-0000-4000-a000-000000000099' };
        mockFaqModel.findById.mockResolvedValue(foreignFaq);

        const input: GastronomyFaqUpdateInput = {
            gastronomyId: GASTRONOMY_ID,
            faqId: FAQ_ID,
            faq: { answer: 'Updated answer' }
        };

        // Act
        const result = await updateGastronomyFaq(
            model as unknown as Parameters<typeof updateGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should update the FAQ and return it on success', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const existingFaq = makeFaq();
        const updatedFaq = { ...existingFaq, answer: 'Updated answer.' };
        mockFaqModel.findById.mockResolvedValue(existingFaq);
        mockFaqModel.update.mockResolvedValue(updatedFaq);

        const input: GastronomyFaqUpdateInput = {
            gastronomyId: GASTRONOMY_ID,
            faqId: FAQ_ID,
            faq: { answer: 'Updated answer' }
        };

        // Act
        const result = await updateGastronomyFaq(
            model as unknown as Parameters<typeof updateGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.faq).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// removeGastronomyFaq
// ---------------------------------------------------------------------------

describe('removeGastronomyFaq', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        // Arrange
        const model = makeGastronomyModel(null);
        const input: GastronomyFaqRemoveInput = {
            gastronomyId: GASTRONOMY_ID,
            faqId: FAQ_ID
        };

        // Act
        const result = await removeGastronomyFaq(
            model as unknown as Parameters<typeof removeGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return NOT_FOUND when FAQ belongs to a different listing', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const foreignFaq = { ...makeFaq(), gastronomyId: '00000000-0000-4000-a000-000000000099' };
        mockFaqModel.findById.mockResolvedValue(foreignFaq);

        const input: GastronomyFaqRemoveInput = {
            gastronomyId: GASTRONOMY_ID,
            faqId: FAQ_ID
        };

        // Act
        const result = await removeGastronomyFaq(
            model as unknown as Parameters<typeof removeGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should soft-delete the FAQ and return success', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        mockFaqModel.findById.mockResolvedValue(makeFaq());

        const input: GastronomyFaqRemoveInput = {
            gastronomyId: GASTRONOMY_ID,
            faqId: FAQ_ID
        };

        // Act
        const result = await removeGastronomyFaq(
            model as unknown as Parameters<typeof removeGastronomyFaq>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.success).toBe(true);
        expect(mockFaqModel.softDelete).toHaveBeenCalledWith(
            expect.objectContaining({ id: FAQ_ID }),
            undefined
        );
    });
});

// ---------------------------------------------------------------------------
// listGastronomyFaqs
// ---------------------------------------------------------------------------

describe('listGastronomyFaqs', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        // Arrange
        const model = {
            findWithRelations: vi.fn().mockResolvedValue(null)
        };
        const input: GastronomyFaqListInput = { gastronomyId: GASTRONOMY_ID };

        // Act
        const result = await listGastronomyFaqs(
            model as unknown as Parameters<typeof listGastronomyFaqs>[0],
            touristActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return empty FAQ array when listing has no FAQs', async () => {
        // Arrange
        const model = {
            findWithRelations: vi.fn().mockResolvedValue({ id: GASTRONOMY_ID, faqs: [] })
        };
        const input: GastronomyFaqListInput = { gastronomyId: GASTRONOMY_ID };

        // Act
        const result = await listGastronomyFaqs(
            model as unknown as Parameters<typeof listGastronomyFaqs>[0],
            touristActor,
            input
        );

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toEqual([]);
    });

    it('should return the FAQs from the listing relations', async () => {
        // Arrange
        const faqs = [makeFaq()];
        const model = {
            findWithRelations: vi.fn().mockResolvedValue({ id: GASTRONOMY_ID, faqs })
        };
        const input: GastronomyFaqListInput = { gastronomyId: GASTRONOMY_ID };

        // Act
        const result = await listGastronomyFaqs(
            model as unknown as Parameters<typeof listGastronomyFaqs>[0],
            touristActor,
            input
        );

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.faqs).toHaveLength(1);
        expect(result.data?.faqs[0]?.id).toBe(FAQ_ID);
    });
});

// ---------------------------------------------------------------------------
// reorderGastronomyFaqs
// ---------------------------------------------------------------------------

describe('reorderGastronomyFaqs', () => {
    it('should return NOT_FOUND when listing does not exist', async () => {
        // Arrange
        const model = makeGastronomyModel(null);
        const input: GastronomyFaqReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            order: [{ faqId: FAQ_ID, displayOrder: 0 }]
        };

        // Act
        const result = await reorderGastronomyFaqs(
            model as unknown as Parameters<typeof reorderGastronomyFaqs>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('should return VALIDATION_ERROR when faqId does not belong to the listing', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        // Existing FAQs: only FAQ_ID, not the 'foreign-faq-id'
        mockFaqModel.findAll.mockResolvedValue({
            items: [makeFaq()],
            total: 1
        });

        const input: GastronomyFaqReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            order: [
                { faqId: FAQ_ID, displayOrder: 0 },
                { faqId: '00000000-0000-4000-a000-000000000099', displayOrder: 1 }
            ]
        };

        // Act
        const result = await reorderGastronomyFaqs(
            model as unknown as Parameters<typeof reorderGastronomyFaqs>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('should update display orders and return success', async () => {
        // Arrange
        const model = makeGastronomyModel({ id: GASTRONOMY_ID, ownerId: OWNER_ID });
        const faq1 = makeFaq();
        const faq2 = { ...makeFaq(), id: '00000000-0000-4000-a000-000000000010', displayOrder: 1 };
        mockFaqModel.findAll.mockResolvedValue({
            items: [faq1, faq2],
            total: 2
        });
        mockFaqModel.update.mockResolvedValue({});

        const input: GastronomyFaqReorderInput = {
            gastronomyId: GASTRONOMY_ID,
            order: [
                { faqId: faq2.id, displayOrder: 0 },
                { faqId: FAQ_ID, displayOrder: 1 }
            ]
        };

        // Act
        const result = await reorderGastronomyFaqs(
            model as unknown as Parameters<typeof reorderGastronomyFaqs>[0],
            ownerActor,
            input
        );

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.success).toBe(true);
        expect(mockFaqModel.update).toHaveBeenCalledTimes(2);
    });
});
