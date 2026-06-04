import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    type AppLogEntryFilter,
    AppLogEntryFilterSchema
} from '../../../src/entities/appLogEntry/appLogEntry.query.schema.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_USER_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/** Minimal valid filter (all optional fields omitted). */
function buildMinimalFilter(): Record<string, unknown> {
    return {};
}

// ---------------------------------------------------------------------------
// AppLogEntryFilterSchema — existing fields (smoke)
// ---------------------------------------------------------------------------

describe('AppLogEntryFilterSchema — existing fields', () => {
    it('should accept an empty filter and apply defaults', () => {
        // Arrange + Act
        const result = AppLogEntryFilterSchema.parse(buildMinimalFilter());

        // Assert
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(50);
        expect(result.level).toBeUndefined();
        expect(result.category).toBeUndefined();
    });

    it('should accept a valid level filter', () => {
        // Arrange
        const input = { level: 'ERROR' };

        // Act
        const result = AppLogEntryFilterSchema.parse(input);

        // Assert
        expect(result.level).toBe('ERROR');
    });

    it('should reject an invalid level value', () => {
        // Arrange
        const input = { level: 'INFO' };

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).toThrow(ZodError);
    });
});

// ---------------------------------------------------------------------------
// AppLogEntryFilterSchema — new request-context filter fields
// ---------------------------------------------------------------------------

describe('AppLogEntryFilterSchema — requestId filter', () => {
    it('should accept a valid requestId (within 64 chars)', () => {
        // Arrange
        const input = { requestId: 'req-abc-123' };

        // Act
        const result: AppLogEntryFilter = AppLogEntryFilterSchema.parse(input);

        // Assert
        expect(result.requestId).toBe('req-abc-123');
    });

    it('should accept a requestId at the 64-char boundary', () => {
        // Arrange
        const input = { requestId: 'r'.repeat(64) };

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).not.toThrow();
    });

    it('should reject a requestId longer than 64 characters', () => {
        // Arrange
        const input = { requestId: 'r'.repeat(65) };

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).toThrow(ZodError);
    });

    it('should produce undefined when requestId is omitted', () => {
        // Arrange + Act
        const result = AppLogEntryFilterSchema.parse({});

        // Assert
        expect(result.requestId).toBeUndefined();
    });
});

describe('AppLogEntryFilterSchema — userId filter', () => {
    it('should accept a valid UUID for userId', () => {
        // Arrange
        const input = { userId: VALID_USER_ID };

        // Act
        const result: AppLogEntryFilter = AppLogEntryFilterSchema.parse(input);

        // Assert
        expect(result.userId).toBe(VALID_USER_ID);
    });

    it('should reject a non-UUID string for userId', () => {
        // Arrange
        const input = { userId: 'not-a-uuid' };

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).toThrow(ZodError);
    });

    it('should reject an empty string for userId', () => {
        // Arrange
        const input = { userId: '' };

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).toThrow(ZodError);
    });

    it('should produce undefined when userId is omitted', () => {
        // Arrange + Act
        const result = AppLogEntryFilterSchema.parse({});

        // Assert
        expect(result.userId).toBeUndefined();
    });
});

describe('AppLogEntryFilterSchema — method filter', () => {
    it('should accept a valid HTTP method', () => {
        // Arrange
        const input = { method: 'GET' };

        // Act
        const result: AppLogEntryFilter = AppLogEntryFilterSchema.parse(input);

        // Assert
        expect(result.method).toBe('GET');
    });

    it('should accept a method at the 10-char boundary', () => {
        // Arrange
        const input = { method: 'PROPFIND12' }; // exactly 10 chars

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).not.toThrow();
    });

    it('should reject a method longer than 10 characters', () => {
        // Arrange
        const input = { method: 'TOOLONGMETH' }; // 11 chars

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).toThrow(ZodError);
    });

    it('should produce undefined when method is omitted', () => {
        // Arrange + Act
        const result = AppLogEntryFilterSchema.parse({});

        // Assert
        expect(result.method).toBeUndefined();
    });
});

describe('AppLogEntryFilterSchema — path filter', () => {
    it('should accept a valid path substring', () => {
        // Arrange
        const input = { path: '/api/v1/public' };

        // Act
        const result: AppLogEntryFilter = AppLogEntryFilterSchema.parse(input);

        // Assert
        expect(result.path).toBe('/api/v1/public');
    });

    it('should accept an empty string for path (no-op filter)', () => {
        // Arrange
        const input = { path: '' };

        // Act + Assert
        expect(() => AppLogEntryFilterSchema.parse(input)).not.toThrow();
    });

    it('should produce undefined when path is omitted', () => {
        // Arrange + Act
        const result = AppLogEntryFilterSchema.parse({});

        // Assert
        expect(result.path).toBeUndefined();
    });
});

describe('AppLogEntryFilterSchema — combined new request-context filters', () => {
    it('should accept all four new filter fields simultaneously', () => {
        // Arrange
        const input = {
            requestId: 'req-combine-test',
            userId: VALID_USER_ID,
            method: 'POST',
            path: '/api/v1/protected/bookmarks'
        };

        // Act
        const result: AppLogEntryFilter = AppLogEntryFilterSchema.parse(input);

        // Assert
        expect(result.requestId).toBe('req-combine-test');
        expect(result.userId).toBe(VALID_USER_ID);
        expect(result.method).toBe('POST');
        expect(result.path).toBe('/api/v1/protected/bookmarks');
    });

    it('should accept new context filters combined with existing filters', () => {
        // Arrange
        const input = {
            level: 'ERROR',
            category: 'API',
            requestId: 'req-ctx',
            userId: VALID_USER_ID,
            method: 'GET',
            path: '/api',
            page: 2,
            pageSize: 25
        };

        // Act
        const result: AppLogEntryFilter = AppLogEntryFilterSchema.parse(input);

        // Assert
        expect(result.level).toBe('ERROR');
        expect(result.category).toBe('API');
        expect(result.requestId).toBe('req-ctx');
        expect(result.userId).toBe(VALID_USER_ID);
        expect(result.method).toBe('GET');
        expect(result.path).toBe('/api');
        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(25);
    });
});
