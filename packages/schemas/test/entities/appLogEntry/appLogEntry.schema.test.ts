import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { CreateAppLogEntrySchema } from '../../../src/entities/appLogEntry/appLogEntry.crud.schema.js';
import {
    type AppLogEntry,
    AppLogEntrySchema
} from '../../../src/entities/appLogEntry/appLogEntry.schema.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_ENTRY_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const BASE_USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/** Minimal valid AppLogEntry (no request-context fields). */
function buildMinimalEntry(): AppLogEntry {
    return {
        id: BASE_ENTRY_ID,
        level: 'ERROR',
        message: 'Something went wrong',
        loggedAt: new Date('2026-06-01T10:00:00Z'),
        createdAt: new Date('2026-06-01T10:00:00Z')
    };
}

/** Full AppLogEntry including all 4 request-context fields. */
function buildFullEntry(): AppLogEntry {
    return {
        ...buildMinimalEntry(),
        category: 'API',
        label: 'handler-error',
        data: { stack: 'Error: ...' },
        requestId: 'req-abc123',
        userId: BASE_USER_ID,
        method: 'GET',
        path: '/api/v1/public/accommodations'
    };
}

// ---------------------------------------------------------------------------
// AppLogEntrySchema
// ---------------------------------------------------------------------------

describe('AppLogEntrySchema', () => {
    describe('Valid Data', () => {
        it('should accept a minimal entry (no request-context fields)', () => {
            // Arrange
            const input = buildMinimalEntry();

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).not.toThrow();
            const result = AppLogEntrySchema.parse(input);
            expect(result.id).toBe(BASE_ENTRY_ID);
            expect(result.level).toBe('ERROR');
            expect(result.requestId).toBeUndefined();
            expect(result.userId).toBeUndefined();
            expect(result.method).toBeUndefined();
            expect(result.path).toBeUndefined();
        });

        it('should accept a full entry with all 4 request-context fields', () => {
            // Arrange
            const input = buildFullEntry();

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).not.toThrow();
            const result = AppLogEntrySchema.parse(input);
            expect(result.requestId).toBe('req-abc123');
            expect(result.userId).toBe(BASE_USER_ID);
            expect(result.method).toBe('GET');
            expect(result.path).toBe('/api/v1/public/accommodations');
        });

        it('should accept null values for request-context fields', () => {
            // Arrange
            const input = {
                ...buildMinimalEntry(),
                requestId: null,
                userId: null,
                method: null,
                path: null
            };

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).not.toThrow();
            const result = AppLogEntrySchema.parse(input);
            expect(result.requestId).toBeNull();
            expect(result.userId).toBeNull();
        });

        it('should accept both WARN and ERROR levels', () => {
            // Arrange
            const warn = { ...buildMinimalEntry(), level: 'WARN' as const };
            const error = { ...buildMinimalEntry(), level: 'ERROR' as const };

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(warn)).not.toThrow();
            expect(() => AppLogEntrySchema.parse(error)).not.toThrow();
        });
    });

    describe('Invalid Data', () => {
        it('should reject an invalid uuid for id', () => {
            // Arrange
            const input = { ...buildMinimalEntry(), id: 'not-a-uuid' };

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject an invalid uuid for userId', () => {
            // Arrange
            const input = { ...buildMinimalEntry(), userId: 'not-a-uuid' };

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject a requestId longer than 64 characters', () => {
            // Arrange
            const input = { ...buildMinimalEntry(), requestId: 'a'.repeat(65) };

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject a method longer than 10 characters', () => {
            // Arrange
            const input = { ...buildMinimalEntry(), method: 'TOOLONGMETHOD' };

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject an invalid log level', () => {
            // Arrange
            const input = { ...buildMinimalEntry(), level: 'INFO' };

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject a missing required message', () => {
            // Arrange
            const { message: _m, ...input } = buildMinimalEntry();

            // Act + Assert
            expect(() => AppLogEntrySchema.parse(input)).toThrow(ZodError);
        });
    });
});

// ---------------------------------------------------------------------------
// CreateAppLogEntrySchema
// ---------------------------------------------------------------------------

describe('CreateAppLogEntrySchema', () => {
    describe('Valid Data', () => {
        it('should accept a minimal create payload (no request-context fields)', () => {
            // Arrange
            const input = {
                level: 'WARN' as const,
                message: 'Low disk space',
                loggedAt: new Date('2026-06-01T10:00:00Z')
            };

            // Act + Assert
            expect(() => CreateAppLogEntrySchema.parse(input)).not.toThrow();
        });

        it('should accept a full create payload with all 4 request-context fields', () => {
            // Arrange
            const input = {
                level: 'ERROR' as const,
                message: 'Handler threw',
                loggedAt: new Date('2026-06-01T10:00:00Z'),
                requestId: 'req-xyz789',
                userId: BASE_USER_ID,
                method: 'POST',
                path: '/api/v1/protected/bookmarks'
            };

            // Act + Assert
            expect(() => CreateAppLogEntrySchema.parse(input)).not.toThrow();
            const result = CreateAppLogEntrySchema.parse(input);
            expect(result.requestId).toBe('req-xyz789');
            expect(result.userId).toBe(BASE_USER_ID);
            expect(result.method).toBe('POST');
            expect(result.path).toBe('/api/v1/protected/bookmarks');
        });

        it('should produce undefined for omitted optional request-context fields', () => {
            // Arrange
            const input = { level: 'ERROR' as const, message: 'err', loggedAt: new Date() };

            // Act
            const result = CreateAppLogEntrySchema.parse(input);

            // Assert
            expect(result.requestId).toBeUndefined();
            expect(result.userId).toBeUndefined();
            expect(result.method).toBeUndefined();
            expect(result.path).toBeUndefined();
        });
    });

    describe('Invalid Data', () => {
        it('should reject an invalid uuid for userId', () => {
            // Arrange
            const input = {
                level: 'ERROR' as const,
                message: 'err',
                loggedAt: new Date(),
                userId: 'bad-uuid'
            };

            // Act + Assert
            expect(() => CreateAppLogEntrySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject a requestId longer than 64 characters', () => {
            // Arrange
            const input = {
                level: 'WARN' as const,
                message: 'warn',
                loggedAt: new Date(),
                requestId: 'x'.repeat(65)
            };

            // Act + Assert
            expect(() => CreateAppLogEntrySchema.parse(input)).toThrow(ZodError);
        });

        it('should reject a method longer than 10 characters', () => {
            // Arrange
            const input = {
                level: 'WARN' as const,
                message: 'warn',
                loggedAt: new Date(),
                method: 'DELETEDELETE'
            };

            // Act + Assert
            expect(() => CreateAppLogEntrySchema.parse(input)).toThrow(ZodError);
        });
    });
});
