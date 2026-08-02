/**
 * Tests for the multi-role HTTP schemas (HOS-296).
 *
 * The invariant that matters here is the one that used to live ONLY inside a
 * React component: `SYSTEM` and `GUEST` may never be granted. Hiding them from
 * the admin dropdown does not stop anyone calling
 * `POST /api/v1/admin/users/:id/roles` directly, and granting `GUEST` makes
 * `isGuestActor()` true for a fully valid session — `/auth/me` then answers
 * `isAuthenticated: false` and the account is treated as anonymous on every
 * page, with no error anywhere.
 */

import { describe, expect, it } from 'vitest';
import {
    AssignableRoleEnumSchema,
    GrantUserRoleBodySchema,
    NON_ASSIGNABLE_ROLES
} from '../../../src/entities/user/user-role.schema.js';
import { RoleEnum } from '../../../src/enums/role.enum.js';

describe('GrantUserRoleBodySchema', () => {
    it('accepts a real, assignable role', () => {
        const result = GrantUserRoleBodySchema.safeParse({ role: RoleEnum.HOST });

        expect(result.success).toBe(true);
    });

    it('rejects GUEST — it would silently un-authenticate the account', () => {
        const result = GrantUserRoleBodySchema.safeParse({ role: RoleEnum.GUEST });

        expect(result.success).toBe(false);
    });

    it('rejects SYSTEM — it belongs to the reserved non-loginable account', () => {
        const result = GrantUserRoleBodySchema.safeParse({ role: RoleEnum.SYSTEM });

        expect(result.success).toBe(false);
    });

    it('still accepts an optional operator reason for the audit row', () => {
        const result = GrantUserRoleBodySchema.safeParse({
            role: RoleEnum.SPONSOR,
            reason: 'sponsors the summer campaign'
        });

        expect(result.success).toBe(true);
    });
});

describe('NON_ASSIGNABLE_ROLES', () => {
    it('is exactly {SYSTEM, GUEST}', () => {
        // Pinned so widening the list becomes a deliberate, reviewed change —
        // every entry here is a role an operator can never hand out.
        expect([...NON_ASSIGNABLE_ROLES].sort()).toEqual([RoleEnum.GUEST, RoleEnum.SYSTEM].sort());
    });

    it('rejects every listed role through AssignableRoleEnumSchema', () => {
        for (const role of NON_ASSIGNABLE_ROLES) {
            expect(AssignableRoleEnumSchema.safeParse(role).success).toBe(false);
        }
    });

    it('accepts every OTHER role', () => {
        const assignable = Object.values(RoleEnum).filter(
            (role) => !NON_ASSIGNABLE_ROLES.includes(role)
        );

        for (const role of assignable) {
            expect(AssignableRoleEnumSchema.safeParse(role).success).toBe(true);
        }
    });
});
