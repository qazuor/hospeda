import { describe, expect, it } from 'vitest';
import { SponsorshipEntityTypeEnum, SponsorshipStatusEnum } from '../../enums/index.js';
import {
    CreateSponsorshipSchema,
    HttpCreateSponsorshipSchema,
    SearchSponsorshipsSchema,
    SponsorshipPerformanceSchema,
    SponsorshipSchema,
    UpdateSponsorshipSchema
} from './index.js';

describe('Sponsorship Schema Tests', () => {
    const baseFields = {
        createdAt: new Date('2024-01-15T00:00:00Z'),
        updatedAt: new Date('2024-01-15T00:00:00Z'),
        createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    };

    describe('SponsorshipSchema - Main Entity', () => {
        it('should validate complete sponsorship correctly', () => {
            const sponsorship = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.POST,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: new Date('2024-06-01T00:00:00Z'),
                toDate: new Date('2024-08-31T23:59:59Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                description: 'Premium sponsorship for travel content',
                priority: 80,
                budgetAmount: 500000,
                spentAmount: 125000,
                impressionCount: 150000,
                clickCount: 5000,
                ...baseFields
            };

            expect(() => SponsorshipSchema.parse(sponsorship)).not.toThrow();
        });

        it('should validate minimal sponsorship', () => {
            const sponsorship = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.EVENT,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: new Date('2024-06-01T00:00:00Z'),
                toDate: new Date('2024-08-31T23:59:59Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                priority: 50,
                spentAmount: 0,
                impressionCount: 0,
                clickCount: 0,
                ...baseFields
            };

            expect(() => SponsorshipSchema.parse(sponsorship)).not.toThrow();
        });

        it('should fail validation if toDate is before fromDate', () => {
            const sponsorship = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.POST,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: new Date('2024-08-31T00:00:00Z'),
                toDate: new Date('2024-06-01T00:00:00Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                priority: 50,
                spentAmount: 0,
                impressionCount: 0,
                clickCount: 0,
                ...baseFields
            };

            expect(() => SponsorshipSchema.parse(sponsorship)).toThrow();
        });

        it('should fail validation if spentAmount exceeds budgetAmount', () => {
            const sponsorship = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.POST,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: new Date('2024-06-01T00:00:00Z'),
                toDate: new Date('2024-08-31T23:59:59Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                budgetAmount: 100000,
                spentAmount: 150000,
                priority: 50,
                impressionCount: 1000,
                clickCount: 50,
                ...baseFields
            };

            expect(() => SponsorshipSchema.parse(sponsorship)).toThrow();
        });

        it('should fail validation if clickCount exceeds impressionCount', () => {
            const sponsorship = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.POST,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: new Date('2024-06-01T00:00:00Z'),
                toDate: new Date('2024-08-31T23:59:59Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                priority: 50,
                spentAmount: 0,
                impressionCount: 1000,
                clickCount: 1500,
                ...baseFields
            };

            expect(() => SponsorshipSchema.parse(sponsorship)).toThrow();
        });

        it('should validate all sponsorship status values', () => {
            const statuses = [
                SponsorshipStatusEnum.ACTIVE,
                SponsorshipStatusEnum.PAUSED,
                SponsorshipStatusEnum.EXPIRED,
                SponsorshipStatusEnum.CANCELLED
            ];

            for (const status of statuses) {
                const sponsorship = {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    entityType: SponsorshipEntityTypeEnum.POST,
                    entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                    fromDate: new Date('2024-06-01T00:00:00Z'),
                    toDate: new Date('2024-08-31T23:59:59Z'),
                    status,
                    priority: 50,
                    spentAmount: 0,
                    impressionCount: 0,
                    clickCount: 0,
                    ...baseFields
                };

                expect(() => SponsorshipSchema.parse(sponsorship)).not.toThrow();
            }
        });

        it('should validate both entity types', () => {
            const entityTypes = [SponsorshipEntityTypeEnum.POST, SponsorshipEntityTypeEnum.EVENT];

            for (const entityType of entityTypes) {
                const sponsorship = {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    entityType,
                    entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                    fromDate: new Date('2024-06-01T00:00:00Z'),
                    toDate: new Date('2024-08-31T23:59:59Z'),
                    status: SponsorshipStatusEnum.ACTIVE,
                    priority: 50,
                    spentAmount: 0,
                    impressionCount: 0,
                    clickCount: 0,
                    ...baseFields
                };

                expect(() => SponsorshipSchema.parse(sponsorship)).not.toThrow();
            }
        });

        it('should validate priority range (0-100)', () => {
            const validPriorities = [0, 25, 50, 75, 100];

            for (const priority of validPriorities) {
                const sponsorship = {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                    clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                    entityType: SponsorshipEntityTypeEnum.POST,
                    entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                    fromDate: new Date('2024-06-01T00:00:00Z'),
                    toDate: new Date('2024-08-31T23:59:59Z'),
                    status: SponsorshipStatusEnum.ACTIVE,
                    priority,
                    spentAmount: 0,
                    impressionCount: 0,
                    clickCount: 0,
                    ...baseFields
                };

                expect(() => SponsorshipSchema.parse(sponsorship)).not.toThrow();
            }
        });
    });

    describe('CreateSponsorshipSchema - CRUD Operations', () => {
        it('should validate sponsorship creation', () => {
            const futureFromDate = new Date();
            futureFromDate.setMonth(futureFromDate.getMonth() + 3);
            const futureToDate = new Date(futureFromDate);
            futureToDate.setDate(futureToDate.getDate() + 5);

            const createData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.EVENT,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d501',
                fromDate: futureFromDate,
                toDate: futureToDate,
                status: SponsorshipStatusEnum.ACTIVE,
                description: 'New sponsorship for travel content',
                priority: 85,
                budgetAmount: 750000
            };

            expect(() => CreateSponsorshipSchema.parse(createData)).not.toThrow();
        });
    });

    describe('UpdateSponsorshipSchema - Updates', () => {
        it('should validate partial updates', () => {
            const updateData = {
                updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                description: 'Updated sponsorship description',
                status: SponsorshipStatusEnum.PAUSED,
                budgetAmount: 600000,
                priority: 75
            };

            expect(() => UpdateSponsorshipSchema.parse(updateData)).not.toThrow();
        });
    });

    describe('SearchSponsorshipsSchema - Query Operations', () => {
        it('should validate search with filters', () => {
            const searchData = {
                q: 'luxury hotel',
                entityType: SponsorshipEntityTypeEnum.POST,
                status: SponsorshipStatusEnum.ACTIVE,
                budgetMin: 100000,
                budgetMax: 1000000,
                fromDateAfter: new Date('2024-01-01T00:00:00Z'),
                fromDateBefore: new Date('2024-12-31T23:59:59Z'),
                priorityMin: 50,
                priorityMax: 90
            };

            expect(() => SearchSponsorshipsSchema.parse(searchData)).not.toThrow();
        });

        it('should validate budget range consistency', () => {
            const invalidSearchData = {
                budgetMin: 1000000,
                budgetMax: 100000
            };

            expect(() => SearchSponsorshipsSchema.parse(invalidSearchData)).toThrow();
        });
    });

    describe('HTTP Schemas - Coercion', () => {
        it('should coerce string dates and numbers', () => {
            const httpData = {
                createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.POST,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: '2024-06-01T00:00:00Z',
                toDate: '2024-08-31T23:59:59Z',
                status: SponsorshipStatusEnum.ACTIVE,
                budgetAmount: '300000',
                priority: '80'
            };

            const result = HttpCreateSponsorshipSchema.parse(httpData);
            expect(typeof result.budgetAmount).toBe('number');
            expect(result.budgetAmount).toBe(300000);
            expect(result.fromDate).toBeInstanceOf(Date);
            expect(result.toDate).toBeInstanceOf(Date);
            expect(typeof result.priority).toBe('number');
            expect(result.priority).toBe(80);
        });
    });

    describe('SponsorshipPerformanceSchema - Relations', () => {
        it('should validate performance analytics', () => {
            const performance = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.POST,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: new Date('2024-06-01T00:00:00Z'),
                toDate: new Date('2024-08-31T23:59:59Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                priority: 80,
                spentAmount: 125000,
                impressionCount: 150000,
                clickCount: 5000,
                // Performance-specific fields
                clickThroughRate: 3.33,
                costPerImpression: 0.83,
                costPerClick: 25.0,
                budgetUtilization: 25.0,
                isActive: true,
                isExpired: false,
                isOverBudget: false,
                totalDuration: 92,
                percentageComplete: 25.0,
                ...baseFields
            };

            expect(() => SponsorshipPerformanceSchema.parse(performance)).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should validate sponsorship with maximum values', () => {
            const sponsorship = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.EVENT,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d501',
                fromDate: new Date('2024-01-01T00:00:00Z'),
                toDate: new Date('2027-12-31T23:59:59Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                description: 'A'.repeat(999),
                budgetAmount: 10000000000,
                priority: 100,
                spentAmount: 5000000000,
                impressionCount: 100000000,
                clickCount: 5000000,
                ...baseFields
            };

            expect(() => SponsorshipSchema.parse(sponsorship)).not.toThrow();
        });

        it('should fail validation with description exceeding maximum length', () => {
            const sponsorship = {
                id: 'f47ac10b-58cc-4372-a567-0e02b2c3d495',
                clientId: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
                entityType: SponsorshipEntityTypeEnum.POST,
                entityId: 'f47ac10b-58cc-4372-a567-0e02b2c3d500',
                fromDate: new Date('2024-06-01T00:00:00Z'),
                toDate: new Date('2024-08-31T23:59:59Z'),
                status: SponsorshipStatusEnum.ACTIVE,
                description: 'A'.repeat(1001),
                priority: 50,
                spentAmount: 0,
                impressionCount: 0,
                clickCount: 0,
                ...baseFields
            };

            expect(() => SponsorshipSchema.parse(sponsorship)).toThrow();
        });
    });
});
