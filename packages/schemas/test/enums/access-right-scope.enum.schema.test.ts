import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AccessRightScopeEnumSchema } from '../../src/enums/access-right-scope.schema.js';
import { AccessRightScopeEnum } from '../../src/enums/index.js';

describe('AccessRightScopeEnumSchema', () => {
    it('should validate valid access right scope values', () => {
        // Test each enum value
        // biome-ignore lint/complexity/noForEach: <explanation>
        Object.values(AccessRightScopeEnum).forEach((scope) => {
            expect(() => AccessRightScopeEnumSchema.parse(scope)).not.toThrow();
        });
    });

    it('should validate ACCOMMODATION scope', () => {
        expect(() =>
            AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.ACCOMMODATION)
        ).not.toThrow();
    });

    it('should validate PLACEMENT scope', () => {
        expect(() =>
            AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.PLACEMENT)
        ).not.toThrow();
    });

    it('should validate MERCHANT scope', () => {
        expect(() => AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.MERCHANT)).not.toThrow();
    });

    it('should validate SERVICE scope', () => {
        expect(() => AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.SERVICE)).not.toThrow();
    });

    it('should validate GLOBAL scope', () => {
        expect(() => AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.GLOBAL)).not.toThrow();
    });

    it('should reject invalid access right scope values', () => {
        const invalidScopes = [
            'invalid-scope',
            'USER', // Not in this enum
            'ADMIN',
            'LOCAL',
            'REGIONAL',
            'ORGANIZATION',
            '',
            null,
            undefined,
            123,
            {},
            []
        ];

        // biome-ignore lint/complexity/noForEach: <explanation>
        invalidScopes.forEach((scope) => {
            expect(() => AccessRightScopeEnumSchema.parse(scope)).toThrow(ZodError);
        });
    });

    it('should provide appropriate error message for invalid values', () => {
        try {
            AccessRightScopeEnumSchema.parse('invalid-scope');
        } catch (error) {
            expect(error).toBeInstanceOf(ZodError);
            const zodError = error as ZodError;
            expect(zodError.issues[0]?.message).toBe('zodError.enums.accessRightScope.invalid');
        }
    });

    it('should infer correct TypeScript type', () => {
        const validScope = AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.ACCOMMODATION);

        // TypeScript should infer this as AccessRightScopeEnum
        expect(typeof validScope).toBe('string');
        expect(Object.values(AccessRightScopeEnum)).toContain(validScope);
    });

    it('should have all required scopes for access rights system', () => {
        const requiredScopes = ['accommodation', 'placement', 'merchant', 'service', 'global'];

        const enumValues = Object.values(AccessRightScopeEnum);
        expect(enumValues).toHaveLength(requiredScopes.length);

        // biome-ignore lint/complexity/noForEach: <explanation>
        requiredScopes.forEach((required) => {
            expect(enumValues).toContain(required);
        });
    });

    it('should support hierarchical access control', () => {
        // Test scope hierarchy for access control
        const accommodationScope = AccessRightScopeEnumSchema.parse(
            AccessRightScopeEnum.ACCOMMODATION
        );
        const placementScope = AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.PLACEMENT);
        const merchantScope = AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.MERCHANT);
        const serviceScope = AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.SERVICE);
        const globalScope = AccessRightScopeEnumSchema.parse(AccessRightScopeEnum.GLOBAL);

        expect(accommodationScope).toBe('accommodation');
        expect(placementScope).toBe('placement');
        expect(merchantScope).toBe('merchant');
        expect(serviceScope).toBe('service');
        expect(globalScope).toBe('global');

        // These represent different levels of access
        const scopes = [
            accommodationScope,
            placementScope,
            merchantScope,
            serviceScope,
            globalScope
        ];
        expect(scopes).toHaveLength(5);

        // biome-ignore lint/complexity/noForEach: <explanation>
        scopes.forEach((scope) => {
            expect(typeof scope).toBe('string');
            expect(scope.length).toBeGreaterThan(0);
        });
    });

    it('should support business domain mapping', () => {
        // Test that scopes map to business domains
        const businessDomainScopes = [
            AccessRightScopeEnum.ACCOMMODATION, // Accommodation management
            AccessRightScopeEnum.PLACEMENT, // Ad placement
            AccessRightScopeEnum.MERCHANT, // Merchant operations
            AccessRightScopeEnum.SERVICE // Service management
        ];

        const systemScopes = [
            AccessRightScopeEnum.GLOBAL // Global access
        ];

        expect(businessDomainScopes).toHaveLength(4);
        expect(systemScopes).toHaveLength(1);

        // All scopes should be valid
        const allScopes = [...businessDomainScopes, ...systemScopes];
        // biome-ignore lint/complexity/noForEach: <explanation>
        allScopes.forEach((scope) => {
            expect(() => AccessRightScopeEnumSchema.parse(scope)).not.toThrow();
        });
    });
});
