/**
 * @file service-error-code.enum.schema.test.ts
 * @description Schema-level coverage for ServiceErrorCode enum.
 *
 * Spec reference: SPEC-049 T-068 (GAP-005). Verifies that the enum surface
 * exposes CONFIGURATION_ERROR and that the corresponding Zod schema accepts
 * every published code while rejecting unknown values.
 */

import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { ServiceErrorCode } from '../../src/enums/service-error-code.enum.js';
import { ServiceErrorCodeSchema } from '../../src/enums/service-error-code.schema.js';

describe('ServiceErrorCode enum surface', () => {
    it('should expose CONFIGURATION_ERROR as a valid member', () => {
        // GAP-005 specifically asks to confirm CONFIGURATION_ERROR exists. The
        // enum value must equal the literal 'CONFIGURATION_ERROR' so error
        // payloads (which serialize the string) remain stable across deploys.
        expect(ServiceErrorCode.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
    });

    it('should not lose previously published members', () => {
        // Compatibility guard: the enum is part of the public contract carried
        // in error responses. Removing or renaming any of these would break
        // every consumer that decodes them.
        const required = [
            'NOT_FOUND',
            'VALIDATION_ERROR',
            'UNAUTHORIZED',
            'FORBIDDEN',
            'INTERNAL_ERROR',
            'CONFIGURATION_ERROR'
        ];
        for (const code of required) {
            expect(Object.values(ServiceErrorCode as Record<string, string>)).toContain(code);
        }
    });
});

describe('ServiceErrorCodeSchema', () => {
    it('should accept every published enum value', () => {
        for (const code of Object.values(ServiceErrorCode)) {
            expect(() => ServiceErrorCodeSchema.parse(code)).not.toThrow();
        }
    });

    it('should accept CONFIGURATION_ERROR explicitly (GAP-005)', () => {
        const parsed = ServiceErrorCodeSchema.parse(ServiceErrorCode.CONFIGURATION_ERROR);
        expect(parsed).toBe(ServiceErrorCode.CONFIGURATION_ERROR);
    });

    it('should reject values that are not part of the enum', () => {
        const invalid = ['SOMETHING_ELSE', 'configuration_error', '', null, undefined, 42, {}];
        for (const value of invalid) {
            expect(() => ServiceErrorCodeSchema.parse(value)).toThrow(ZodError);
        }
    });
});
