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
            expect(RoleEnum.SPONSOR).toBe('SPONSOR');
            expect(RoleEnum.USER).toBe('USER');
            expect(RoleEnum.GUEST).toBe('GUEST');
        });

        it('should have exactly 11 roles', () => {
            expect(Object.values(RoleEnum)).toHaveLength(11);
        });

        // HOS-1077: the per-vertical owner roles.
        it('should define GASTRONOMY_OWNER and EXPERIENCE_OWNER', () => {
            expect(RoleEnum.GASTRONOMY_OWNER).toBe('GASTRONOMY_OWNER');
            expect(RoleEnum.EXPERIENCE_OWNER).toBe('EXPERIENCE_OWNER');
        });

        it('the two vertical owner roles are distinct from each other and HOST', () => {
            // The whole product point: "owns a restaurant" and "owns an
            // excursion" have to be expressible apart. If any two of these
            // collapse, the split bought nothing.
            const owners = [RoleEnum.GASTRONOMY_OWNER, RoleEnum.EXPERIENCE_OWNER, RoleEnum.HOST];
            expect(new Set(owners).size).toBe(3);
        });

        it('should not define the retired COMMERCE_OWNER role', () => {
            expect(Object.values(RoleEnum)).not.toContain('COMMERCE_OWNER');
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

        it('should reject the retired COMMERCE_OWNER role', () => {
            expect(() => RoleEnumSchema.parse('COMMERCE_OWNER')).toThrow(ZodError);
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
