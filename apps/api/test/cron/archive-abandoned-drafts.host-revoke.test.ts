/**
 * Unit tests for `shouldRevokeHostHat` — the HOS-296 demotion rule in the
 * `archive-abandoned-drafts` cron job.
 *
 * The job itself (advisory lock + transaction + batched updates) needs a live
 * database and has no unit suite; this covers the one decision inside it that
 * changed semantics, which is also the one that is easy to get subtly wrong.
 *
 * Before HOS-296 the job ran
 * `update(users).set({ role: USER }).where(id = owner AND role = HOST)`. The
 * `role = HOST` predicate was doing double duty as both "is a host" and
 * "is not staff" — it worked only because a user could hold exactly one role.
 * With a SET of hats, "revoke HOST" and "leave everything else alone" are two
 * separate statements, and the last-role guard is a third.
 *
 * @module test/cron/archive-abandoned-drafts.host-revoke.test
 */

import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { shouldRevokeHostHat } from '../../src/cron/jobs/archive-abandoned-drafts.job';

describe('shouldRevokeHostHat', () => {
    it('revokes when the owner holds HOST alongside another hat', () => {
        expect(shouldRevokeHostHat({ heldRoles: [RoleEnum.USER, RoleEnum.HOST] })).toBe(true);
    });

    it('does NOT revoke when HOST is the only hat the account holds (AC-5)', () => {
        // `revokeRole` would refuse this anyway; deciding it here keeps the
        // job's `demoted` counter honest instead of counting a rejected call.
        expect(shouldRevokeHostHat({ heldRoles: [RoleEnum.HOST] })).toBe(false);
    });

    it('does NOT revoke an owner who never held HOST', () => {
        expect(shouldRevokeHostHat({ heldRoles: [RoleEnum.USER] })).toBe(false);
        expect(shouldRevokeHostHat({ heldRoles: [] })).toBe(false);
    });

    it.each([
        RoleEnum.ADMIN,
        RoleEnum.SUPER_ADMIN,
        RoleEnum.CLIENT_MANAGER
    ])('does NOT revoke a %s who never held HOST', (staffRole) => {
        // Staff are protected because HOST is absent, not because of a
        // hard-coded exclusion list — the old job needed one, this does not.
        expect(shouldRevokeHostHat({ heldRoles: [RoleEnum.USER, staffRole] })).toBe(false);
    });

    it.each([
        RoleEnum.COMMERCE_OWNER,
        RoleEnum.SPONSOR,
        RoleEnum.EDITOR
    ])('revokes HOST from an owner who also holds %s, leaving that hat to survive', (otherHat) => {
        // The point of the change: the decision names exactly one role, so
        // a commerce owner who stops being a host stays a commerce owner.
        expect(shouldRevokeHostHat({ heldRoles: [RoleEnum.USER, RoleEnum.HOST, otherHat] })).toBe(
            true
        );
    });
});
