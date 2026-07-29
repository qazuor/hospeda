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

import { LAST_ROLE_REVOKE_REASON, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isLastRoleRevokeRefusal,
    shouldRevokeHostHat
} from '../../src/cron/jobs/archive-abandoned-drafts.job';

/**
 * Builds an error shaped exactly like the real `ServiceError`.
 *
 * Constructed here rather than imported: the API test harness substitutes its
 * own `ServiceError` class for `@repo/service-core`'s, which drops the fourth
 * `reason` constructor argument — the very field under test. That substitution
 * is also why the predicate duck-types instead of using `instanceof`.
 */
const buildServiceError = (params: {
    code: string;
    message: string;
    reason?: string;
}): Error & { code: string; reason?: string } =>
    Object.assign(new Error(params.message), {
        name: 'ServiceError',
        code: params.code,
        reason: params.reason
    });

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

describe('isLastRoleRevokeRefusal', () => {
    it('recognises the last-role refusal by its machine-readable reason', () => {
        // `shouldRevokeHostHat` reads without a lock; `revokeRole` then takes
        // `SELECT ... FOR UPDATE`. A concurrent writer removing the owner's
        // OTHER hat in that window turns "safe to revoke" into a refusal, and
        // because the job passes `ctx.tx` the refusal is THROWN. Uncaught, it
        // escapes the job's transaction and rolls back every draft archived in
        // the run — not just this owner's.
        const error = buildServiceError({
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: "Cannot revoke role 'HOST': it is the last role held by user '<uuid>'.",
            reason: LAST_ROLE_REVOKE_REASON
        });

        expect(isLastRoleRevokeRefusal({ error })).toBe(true);
    });

    it('does NOT swallow an unrelated ServiceError that merely shares the code', () => {
        // Catching too widely would turn a real outage into a silent
        // `owner_demotion_skipped` log line.
        const error = buildServiceError({
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: 'Invalid revokeRole input.'
        });

        expect(isLastRoleRevokeRefusal({ error })).toBe(false);
    });

    it.each([
        ['a plain Error carrying the same words', new Error('it is the last role held by user')],
        ['a non-Error value', 'boom'],
        ['undefined', undefined]
    ])('does NOT match %s', (_label, error) => {
        // Pinned deliberately: matching on message text would both break on
        // rewording and leak the subject's UUID to whatever consumed it.
        expect(isLastRoleRevokeRefusal({ error })).toBe(false);
    });
});
