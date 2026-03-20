import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { SponsorshipAdminSearchSchema } from '../../../src/index.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('SponsorshipAdminSearchSchema', () => {
    describe('base defaults', () => {
        it('should parse empty object with base defaults', () => {
            // Arrange
            const input = {};

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.status).toBe('all');
            expect(result.sort).toBe('createdAt:desc');
            expect(result.includeDeleted).toBe(false);
            expect(result.search).toBeUndefined();
            expect(result.sponsorUserId).toBeUndefined();
            expect(result.targetType).toBeUndefined();
            expect(result.targetId).toBeUndefined();
            expect(result.sponsorshipStatus).toBeUndefined();
        });
    });

    describe('base fields', () => {
        it('should accept valid base fields', () => {
            // Arrange
            const input = {
                search: 'acme',
                sort: 'name:asc',
                status: 'ACTIVE',
                page: 2,
                pageSize: 50
            };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.search).toBe('acme');
            expect(result.sort).toBe('name:asc');
            expect(result.status).toBe('ACTIVE');
            expect(result.page).toBe(2);
            expect(result.pageSize).toBe(50);
        });

        it('should accept includeDeleted and date range filters', () => {
            // Arrange
            const input = {
                includeDeleted: true,
                createdAfter: '2025-01-01T00:00:00Z',
                createdBefore: '2025-12-31T23:59:59Z'
            };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.includeDeleted).toBe(true);
            expect(result.createdAfter).toBeInstanceOf(Date);
            expect(result.createdBefore).toBeInstanceOf(Date);
        });
    });

    describe('sponsorUserId', () => {
        it('should accept a valid UUID', () => {
            // Arrange
            const input = { sponsorUserId: VALID_UUID };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.sponsorUserId).toBe(VALID_UUID);
        });

        it('should reject an invalid UUID', () => {
            // Arrange
            const input = { sponsorUserId: 'not-a-uuid' };

            // Act & Assert
            expect(() => SponsorshipAdminSearchSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('targetType', () => {
        it('should accept "event" as valid target type', () => {
            // Arrange
            const input = { targetType: 'event' };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.targetType).toBe('event');
        });

        it('should accept "post" as valid target type', () => {
            // Arrange
            const input = { targetType: 'post' };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.targetType).toBe('post');
        });

        it('should reject an invalid target type', () => {
            // Arrange
            const input = { targetType: 'INVALID' };

            // Act & Assert
            expect(() => SponsorshipAdminSearchSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('targetId', () => {
        it('should accept a valid UUID', () => {
            // Arrange
            const input = { targetId: VALID_UUID };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.targetId).toBe(VALID_UUID);
        });

        it('should reject an invalid UUID', () => {
            // Arrange
            const input = { targetId: 'invalid-id' };

            // Act & Assert
            expect(() => SponsorshipAdminSearchSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('sponsorshipStatus', () => {
        it('should accept "pending"', () => {
            // Arrange
            const input = { sponsorshipStatus: 'pending' };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.sponsorshipStatus).toBe('pending');
        });

        it('should accept "active"', () => {
            // Arrange
            const input = { sponsorshipStatus: 'active' };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.sponsorshipStatus).toBe('active');
        });

        it('should accept "expired"', () => {
            // Arrange
            const input = { sponsorshipStatus: 'expired' };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.sponsorshipStatus).toBe('expired');
        });

        it('should accept "cancelled"', () => {
            // Arrange
            const input = { sponsorshipStatus: 'cancelled' };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.sponsorshipStatus).toBe('cancelled');
        });

        it('should reject an invalid sponsorship status', () => {
            // Arrange
            const input = { sponsorshipStatus: 'INVALID' };

            // Act & Assert
            expect(() => SponsorshipAdminSearchSchema.parse(input)).toThrow(ZodError);
        });
    });

    describe('combined filters', () => {
        it('should accept all sponsorship-specific filters together', () => {
            // Arrange
            const targetId = '660e8400-e29b-41d4-a716-446655440001';
            const input = {
                sponsorUserId: VALID_UUID,
                targetType: 'event',
                targetId,
                sponsorshipStatus: 'active',
                search: 'test sponsor',
                page: 3,
                pageSize: 25
            };

            // Act
            const result = SponsorshipAdminSearchSchema.parse(input);

            // Assert
            expect(result.sponsorUserId).toBe(VALID_UUID);
            expect(result.targetType).toBe('event');
            expect(result.targetId).toBe(targetId);
            expect(result.sponsorshipStatus).toBe('active');
            expect(result.search).toBe('test sponsor');
            expect(result.page).toBe(3);
            expect(result.pageSize).toBe(25);
        });
    });
});
