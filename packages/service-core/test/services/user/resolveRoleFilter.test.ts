/**
 * Regression tests for `resolveRoleFilter` (HOS-296).
 *
 * `UserAdminSearchSchema` exposes a legacy singular `role` alongside the
 * multi-value `roles`, and its own JSDoc promises "if both are present, the
 * resolver intersects them". No resolver existed: `_executeAdminSearch`
 * destructured only `roles`, so `role` fell through into `simpleFilters` and
 * reached the model as a WHERE on `users.role`. Once HOS-296 dropped that
 * column, `GET /api/v1/admin/users?role=ADMIN` became a runtime failure.
 *
 * The distinction these tests exist to protect is the one that is easy to get
 * wrong: "no filter supplied" and "filters supplied but disjoint" must NOT
 * collapse into the same result. The first must leave the query unconstrained;
 * the second must match nothing.
 */
import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveRoleFilter } from '../../../src/services/user/user.service';

describe('resolveRoleFilter', () => {
    it('returns undefined when neither filter is supplied', () => {
        // Arrange / Act
        const result = resolveRoleFilter({});

        // Assert — undefined means "do not constrain the query at all".
        expect(result).toBeUndefined();
    });

    it('returns the single role when only the legacy `role` is supplied', () => {
        // Arrange / Act
        const result = resolveRoleFilter({ role: RoleEnum.ADMIN });

        // Assert
        expect(result).toEqual([RoleEnum.ADMIN]);
    });

    it('returns the whole set when only `roles` is supplied', () => {
        // Arrange
        const roles = [RoleEnum.HOST, RoleEnum.COMMERCE_OWNER] as const;

        // Act
        const result = resolveRoleFilter({ roles });

        // Assert
        expect(result).toEqual([RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);
    });

    it('intersects both filters when they overlap, as the schema documents', () => {
        // Arrange
        const roles = [RoleEnum.HOST, RoleEnum.ADMIN] as const;

        // Act
        const result = resolveRoleFilter({ role: RoleEnum.ADMIN, roles });

        // Assert
        expect(result).toEqual([RoleEnum.ADMIN]);
    });

    it('returns an EMPTY array — not undefined — when both filters are disjoint', () => {
        // Arrange — an operator asking for ADMIN among {HOST} wants zero rows.
        const roles = [RoleEnum.HOST] as const;

        // Act
        const result = resolveRoleFilter({ role: RoleEnum.ADMIN, roles });

        // Assert — the caller renders `[]` as "match nothing". Returning
        // `undefined` here would silently widen the query to every user, which
        // is the whole point of keeping the two outcomes distinct.
        expect(result).toEqual([]);
        expect(result).not.toBeUndefined();
    });

    it('treats an empty `roles` array as "not supplied", never as "match nothing"', () => {
        // Arrange — this is the `?roles=` / `?roles=,,` wire case, which parses
        // to []. It must not collapse the query to WHERE FALSE.
        const roles: readonly RoleEnum[] = [];

        // Act
        const result = resolveRoleFilter({ roles });

        // Assert
        expect(result).toBeUndefined();
    });

    it('falls back to the singular role when `roles` parsed empty', () => {
        // Arrange — `?role=HOST&roles=` must still filter by HOST rather than
        // intersecting against an empty set and matching nothing.
        const roles: readonly RoleEnum[] = [];

        // Act
        const result = resolveRoleFilter({ role: RoleEnum.HOST, roles });

        // Assert
        expect(result).toEqual([RoleEnum.HOST]);
    });
});
