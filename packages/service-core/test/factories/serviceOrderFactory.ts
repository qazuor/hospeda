import type { ServiceOrder } from '@repo/schemas';
import { ServiceOrderStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory.js';

/**
 * Creates a mock ServiceOrder for testing
 *
 * @param overrides - Partial ServiceOrder to override defaults
 * @returns Complete ServiceOrder object
 */
export function createMockServiceOrder(overrides?: Partial<ServiceOrder>): ServiceOrder {
    const now = new Date();
    const orderedAt = overrides?.orderedAt ?? now;

    const defaults: ServiceOrder = {
        // Base fields
        id: getMockId('serviceOrder', 'so1'),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        createdById: getMockId('user', 'creator') as string | null,
        updatedById: getMockId('user', 'updater') as string | null,
        deletedById: null,

        // Relationship fields
        clientId: getMockId('client', 'c1'),
        serviceTypeId: getMockId('professionalService', 'ps1'),
        pricingPlanId: getMockId('pricingPlan', 'pp1'),

        // Order status and lifecycle
        status: ServiceOrderStatusEnum.PENDING,
        orderedAt,
        deliveryDate: new Date(orderedAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after order
        completedAt: null,

        // Order details
        notes: 'Test order notes',
        clientRequirements: 'Test client requirements - minimum 10 characters for validation',

        // Deliverables (optional)
        deliverables: undefined,

        // Pricing
        pricing: {
            baseAmount: 100000, // $1000.00 in cents
            additionalCharges: 0,
            discountAmount: 0,
            totalAmount: 100000,
            currency: 'ARS',
            taxAmount: 21000, // 21% tax
            finalAmount: 121000 // total + tax
        },

        // Metadata
        serviceMetadata: {
            category: 'test',
            priority: 'normal'
        },
        adminInfo: {
            notes: 'Admin test notes',
            internalRef: 'TEST-001'
        }
    };

    return { ...defaults, ...overrides };
}

/**
 * Creates a mock ServiceOrder with COMPLETED status
 *
 * @param overrides - Partial ServiceOrder to override defaults
 * @returns Complete ServiceOrder object with COMPLETED status
 */
export function createMockCompletedServiceOrder(overrides?: Partial<ServiceOrder>): ServiceOrder {
    const now = new Date();
    const orderedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
    const completedAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    return createMockServiceOrder({
        status: ServiceOrderStatusEnum.COMPLETED,
        orderedAt,
        completedAt,
        deliverables: {
            files: [
                {
                    id: getMockId('file', 'f1'),
                    name: 'deliverable.pdf',
                    url: 'https://example.com/files/deliverable.pdf',
                    size: 1024000,
                    mimeType: 'application/pdf',
                    uploadedAt: completedAt
                }
            ],
            description: 'Completed deliverables',
            completionNotes: 'Work completed successfully',
            revisionRequests: [],
            approvalStatus: 'approved' as const,
            approvedAt: completedAt,
            approvedById: getMockId('user', 'approver')
        },
        ...overrides
    });
}

/**
 * Creates a mock ServiceOrder with IN_PROGRESS status
 *
 * @param overrides - Partial ServiceOrder to override defaults
 * @returns Complete ServiceOrder object with IN_PROGRESS status
 */
export function createMockInProgressServiceOrder(overrides?: Partial<ServiceOrder>): ServiceOrder {
    const now = new Date();
    const orderedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

    return createMockServiceOrder({
        status: ServiceOrderStatusEnum.IN_PROGRESS,
        orderedAt,
        ...overrides
    });
}
