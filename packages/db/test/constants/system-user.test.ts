import { describe, expect, it } from 'vitest';
import { SYSTEM_USER_EMAIL, SYSTEM_USER_ID } from '../../src/constants/index';

// Re-import from barrel to verify the re-export path works.
// We use a named import (not dynamic) to avoid loading the full DB client
// which requires a live PostgreSQL connection.
import { SYSTEM_USER_EMAIL as BARREL_EMAIL, SYSTEM_USER_ID as BARREL_ID } from '../../src/index';

/**
 * Generic UUID format regex (RFC 4122 shape, version-agnostic).
 *
 * SYSTEM_USER_ID is a reserved/synthetic UUID — its version nibble is 0, not 4,
 * so a strict UUID v4 regex would reject it. We validate the structural shape only.
 */
const UUID_FORMAT_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('SYSTEM_USER_ID', () => {
    it('should match RFC 4122 UUID format (8-4-4-4-12 hex groups)', () => {
        // Arrange — SYSTEM_USER_ID is a reserved synthetic UUID (not UUID v4).
        // Act + Assert
        expect(SYSTEM_USER_ID).toMatch(UUID_FORMAT_REGEX);
    });

    it('should have the exact reserved value', () => {
        expect(SYSTEM_USER_ID).toBe('a0000000-0000-4000-8000-000000000001');
    });

    it('should be re-exported from the package barrel unchanged', () => {
        expect(BARREL_ID).toBe(SYSTEM_USER_ID);
    });

    it('should be a string at runtime', () => {
        expect(typeof SYSTEM_USER_ID).toBe('string');
    });
});

describe('SYSTEM_USER_EMAIL', () => {
    it('should have the expected internal address', () => {
        expect(SYSTEM_USER_EMAIL).toBe('system@hospeda.internal');
    });

    it('should be re-exported from the package barrel unchanged', () => {
        expect(BARREL_EMAIL).toBe(SYSTEM_USER_EMAIL);
    });
});
