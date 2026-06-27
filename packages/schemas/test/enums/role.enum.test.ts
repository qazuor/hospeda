import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { RoleEnum } from '../../src/enums/role.enum.js';
import { RoleEnumSchema } from '../../src/enums/role.schema.js';

describe('RoleEnum', () => {
    describe('enum values', () => {
        it('should define SYSTEM role', () => {
            expect(RoleEnum.SYSTEM).toBe('SYSTEM');
        });

        it('should define all standard roles', () => {
            expect(RoleEnum.SUPER_ADMIN).toBe('SUPER_ADMIN');
            expect(RoleEnum.ADMIN).toBe('ADMIN');
            expect(RoleEnum.CLIENT_MANAGER).toBe('CLIENT_MANAGER');
            expect(RoleEnum.EDITOR).toBe('EDITOR');
            expect(RoleEnum.HOST).toBe('HOST');
            expect(RoleEnum.COMMERCE_OWNER).toBe('COMMERCE_OWNER');
            expect(RoleEnum.SPONSOR).toBe('SPONSOR');
            expect(RoleEnum.USER).toBe('USER');
            expect(RoleEnum.GUEST).toBe('GUEST');
        });

        it('should have exactly 10 roles (including SYSTEM and COMMERCE_OWNER)', () => {
            expect(Object.values(RoleEnum)).toHaveLength(10);
        });

        // SPEC-239: COMMERCE_OWNER role
        it('should define COMMERCE_OWNER', () => {
            expect(RoleEnum.COMMERCE_OWNER).toBe('COMMERCE_OWNER');
        });

        it('COMMERCE_OWNER should be distinct from HOST', () => {
            expect(RoleEnum.COMMERCE_OWNER).not.toBe(RoleEnum.HOST);
        });
    });

    describe('RoleEnumSchema', () => {
        it('should parse SYSTEM successfully', () => {
            const result = RoleEnumSchema.parse('SYSTEM');
            expect(result).toBe(RoleEnum.SYSTEM);
        });

        it('should accept all defined RoleEnum values', () => {
            for (const value of Object.values(RoleEnum)) {
                expect(() => RoleEnumSchema.parse(value)).not.toThrow();
            }
        });

        it('should reject invalid role values', () => {
            const invalidValues = [
                'MODERATOR',
                'OWNER',
                'CUSTOMER',
                'system',
                'System',
                '',
                null,
                undefined
            ];

            for (const value of invalidValues) {
                expect(() => RoleEnumSchema.parse(value)).toThrow(ZodError);
            }
        });

        it('should be case-sensitive (SYSTEM != system)', () => {
            expect(() => RoleEnumSchema.parse('system')).toThrow(ZodError);
            expect(() => RoleEnumSchema.parse('System')).toThrow(ZodError);
            expect(() => RoleEnumSchema.parse('SYSTEM')).not.toThrow();
        });

        // SPEC-239: COMMERCE_OWNER schema parsing
        it('should parse COMMERCE_OWNER successfully', () => {
            const result = RoleEnumSchema.parse('COMMERCE_OWNER');
            expect(result).toBe(RoleEnum.COMMERCE_OWNER);
        });

        it('should provide appropriate error message for invalid values', () => {
            try {
                RoleEnumSchema.parse('INVALID_ROLE');
            } catch (error) {
                expect(error).toBeInstanceOf(ZodError);
                const zodError = error as ZodError;
                expect(zodError.issues[0]?.message).toBe('zodError.enums.role.invalid');
            }
        });
    });
});
