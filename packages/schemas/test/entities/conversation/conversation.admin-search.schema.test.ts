import { describe, expect, it } from 'vitest';
import { ConversationAdminSearchSchema } from '../../../src/entities/conversation/conversation.admin-search.schema.js';
import { ConversationStatusEnum } from '../../../src/enums/conversation-status.enum.js';

// RFC 4122 v4 UUIDs (required by Zod v4 strict UUID validation)
const UUID_ACC = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const UUID_OWNER = 'b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6';

describe('ConversationAdminSearchSchema', () => {
    describe('when given valid input', () => {
        it('should parse an empty query (all fields optional / have defaults)', () => {
            // Arrange & Act
            const result = ConversationAdminSearchSchema.safeParse({});

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
            }
        });

        it('should parse with all conversation-specific filters set', () => {
            const result = ConversationAdminSearchSchema.safeParse({
                page: 2,
                pageSize: 50,
                conversationStatus: ConversationStatusEnum.PENDING_OWNER,
                accommodationId: UUID_ACC,
                ownerId: UUID_OWNER,
                guestEmail: 'guest@example.com'
            });
            expect(result.success).toBe(true);
        });

        it('should parse with only accommodationId filter', () => {
            const result = ConversationAdminSearchSchema.safeParse({
                accommodationId: UUID_ACC
            });
            expect(result.success).toBe(true);
        });

        it('should coerce page and pageSize from strings', () => {
            const result = ConversationAdminSearchSchema.safeParse({
                page: '3',
                pageSize: '25'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(3);
                expect(result.data.pageSize).toBe(25);
            }
        });
    });

    describe('when given invalid input', () => {
        it('should reject a non-UUID accommodationId', () => {
            const result = ConversationAdminSearchSchema.safeParse({
                accommodationId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a non-UUID ownerId', () => {
            const result = ConversationAdminSearchSchema.safeParse({
                ownerId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid guestEmail', () => {
            const result = ConversationAdminSearchSchema.safeParse({
                guestEmail: 'not-an-email'
            });
            expect(result.success).toBe(false);
        });

        it('should reject an invalid conversationStatus', () => {
            const result = ConversationAdminSearchSchema.safeParse({
                conversationStatus: 'WAITING'
            });
            expect(result.success).toBe(false);
        });

        it('should reject pageSize > 100', () => {
            const result = ConversationAdminSearchSchema.safeParse({ pageSize: 101 });
            expect(result.success).toBe(false);
        });
    });
});
