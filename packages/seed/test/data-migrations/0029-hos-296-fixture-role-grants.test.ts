/**
 * @fileoverview
 * Unit tests for the `0029-hos-296-fixture-role-grants` data migration.
 *
 * The three multi-role primitives are INJECTED through the migration's
 * `RolePrimitivesPort` because they open real database transactions and this
 * suite runs with no database. Module-mocking was tried first and does not
 * work here: `vi.mock('@repo/service-core')` left the real `grantRole` in
 * place (it rejected the stub ids with `Invalid grantRole input`), the same
 * limitation `required/systemUser.seed.ts` documents for its own port.
 * `ctx.db` is a hand-rolled stub whose only job is to answer the single
 * `SELECT id, email FROM users WHERE email IN (...)` lookup.
 *
 * The cases below pin the four properties that matter operationally:
 * production safety (no fixtures → no writes), convergence with the 0069
 * straight-copy backfill, idempotency, and grant-before-revoke ordering.
 *
 * @module test/data-migrations/0029-hos-296-fixture-role-grants
 */
import { RoleEnum, RoleGrantReason } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RolePrimitivesPort } from '../../src/data-migrations/0029-hos-296-fixture-role-grants.js';
import * as migration from '../../src/data-migrations/0029-hos-296-fixture-role-grants.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

// The primitives are INJECTED, not module-mocked: `vi.mock('@repo/service-core')`
// does not intercept for this module (verified — the real `grantRole` still ran
// and rejected the stub ids), the same limitation `required/systemUser.seed.ts`
// documents for its own port.
const grantRole = vi.fn();
const revokeRole = vi.fn();
const getUserRoles = vi.fn();

const primitives = {
    grantRole,
    revokeRole,
    getUserRoles
} as unknown as RolePrimitivesPort;

/** A `users` row as the migration's lookup projects it. */
interface UserRow {
    id: string;
    email: string;
}

/**
 * Builds a `SeedMigrationCtx` whose `ctx.db` answers the migration's single
 * `select(...).from(users).where(...)` with the supplied rows.
 */
function buildCtx(rows: readonly UserRow[]): SeedMigrationCtx {
    const db = {
        select: () => ({
            from: () => ({
                where: () => Promise.resolve([...rows])
            })
        })
    };

    return {
        db,
        actor: { id: 'stub-actor', roles: [RoleEnum.SUPER_ADMIN], permissions: [] },
        models: {},
        services: {},
        helpers: {}
    } as unknown as SeedMigrationCtx;
}

/** Every `grantRole` call's `role`, in call order. */
const grantedRoles = (): unknown[] =>
    grantRole.mock.calls.map((call) => (call[0] as { role: unknown }).role);

/** Every `revokeRole` call's `role`, in call order. */
const revokedRoles = (): unknown[] =>
    revokeRole.mock.calls.map((call) => (call[0] as { role: unknown }).role);

beforeEach(() => {
    grantRole.mockReset().mockResolvedValue({});
    revokeRole.mockReset().mockResolvedValue({});
    getUserRoles.mockReset().mockResolvedValue([]);
});

describe('0029-hos-296-fixture-role-grants meta', () => {
    it('is a non-destructive required-group migration named after its file', () => {
        expect(migration.meta.name).toBe('0029-hos-296-fixture-role-grants');
        // 'required', NOT 'example': an example-group migration is refused
        // unconditionally in production and that refusal throws for the whole
        // pending batch, wedging every later required migration.
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
    });
});

describe('0029-hos-296-fixture-role-grants up()', () => {
    it('writes nothing when no fixture account exists (the production case)', async () => {
        const result = await migration.up(buildCtx([]), primitives);

        expect(grantRole).not.toHaveBeenCalled();
        expect(revokeRole).not.toHaveBeenCalled();
        expect(getUserRoles).not.toHaveBeenCalled();
        expect(result.counts?.fixturesMatched).toBe(0);
        expect(result.counts?.rolesGranted).toBe(0);
        expect(result.counts?.rolesRevoked).toBe(0);
        expect(result.summary).toMatch(/nothing to converge/i);
    });

    it('adds the missing USER hat to a commerce owner the 0069 copy left single-hatted', async () => {
        // 0069 copies `users.role = 'COMMERCE_OWNER'` verbatim, so the fixture
        // ends up one hat short of what the seed grants today.
        getUserRoles.mockResolvedValue([RoleEnum.COMMERCE_OWNER]);

        const result = await migration.up(
            buildCtx([{ id: 'u-julieta', email: 'gastro-owner-julieta@local.test' }]),
            primitives
        );

        expect(grantedRoles()).toEqual([RoleEnum.USER]);
        expect(grantRole).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'u-julieta',
                role: RoleEnum.USER,
                grantedBy: null,
                reason: RoleGrantReason.SEED
            })
        );
        // grant-only: the hat 0069 already wrote is never re-granted (no
        // duplicate, original `grant_reason` preserved) and never revoked.
        expect(revokeRole).not.toHaveBeenCalled();
        expect(result.counts?.rolesGranted).toBe(1);
    });

    it('never grants COMMERCE_OWNER to the e2e tourist fixture (commerce-02 case 1)', async () => {
        getUserRoles.mockResolvedValue([RoleEnum.USER]);

        await migration.up(
            buildCtx([{ id: 'u-tourist', email: 'e2e-tourist@local.test' }]),
            primitives
        );

        // Already correct after the backfill: zero writes, and above all no
        // COMMERCE_OWNER — its ABSENCE is what commerce-02 case 1 asserts.
        expect(grantRole).not.toHaveBeenCalled();
        expect(revokeRole).not.toHaveBeenCalled();
    });

    it('grants the declared set then revokes a drifted hat, in that order', async () => {
        // `tourist-free@local.test` that walked the host-onboarding funnel:
        // the old destructive scalar write left `users.role = 'HOST'`, so 0069
        // copies `{HOST}`. Target is `{USER}`.
        getUserRoles.mockResolvedValue([RoleEnum.HOST]);

        const result = await migration.up(
            buildCtx([{ id: 'u-drifted', email: 'tourist-free@local.test' }]),
            primitives
        );

        expect(grantedRoles()).toEqual([RoleEnum.USER]);
        expect(revokedRoles()).toEqual([RoleEnum.HOST]);
        // Ordering is load-bearing: USER must land before HOST is revoked, or
        // revokeRole's last-role guard (AC-5) rejects the revoke.
        expect(grantRole.mock.invocationCallOrder[0]).toBeLessThan(
            revokeRole.mock.invocationCallOrder[0] as number
        );
        expect(result.counts?.rolesGranted).toBe(1);
        expect(result.counts?.rolesRevoked).toBe(1);
    });

    it('is a no-op on a second run once the sets already match', async () => {
        getUserRoles.mockResolvedValue([RoleEnum.USER, RoleEnum.HOST]);

        const result = await migration.up(
            buildCtx([{ id: 'u-host', email: 'host-pro@local.test' }]),
            primitives
        );

        expect(grantRole).not.toHaveBeenCalled();
        expect(revokeRole).not.toHaveBeenCalled();
        expect(result.counts?.fixturesMatched).toBe(1);
    });

    it('enlists every role write in the migration transaction', async () => {
        getUserRoles.mockResolvedValue([RoleEnum.SPONSOR]);
        const ctx = buildCtx([{ id: 'u-editor', email: 'editor@local.test' }]);

        await migration.up(ctx, primitives);

        // Without `ctx.tx` the primitives open a SECOND transaction on the pool
        // that cannot see this migration's uncommitted writes.
        expect(getUserRoles).toHaveBeenCalledWith(expect.objectContaining({ ctx: { tx: ctx.db } }));
        for (const call of [...grantRole.mock.calls, ...revokeRole.mock.calls]) {
            expect(call[0]).toMatchObject({ ctx: { tx: ctx.db } });
        }
        expect(grantedRoles()).toEqual([RoleEnum.USER, RoleEnum.EDITOR]);
        expect(revokedRoles()).toEqual([RoleEnum.SPONSOR]);
    });

    it('propagates a failed grant so the runner rolls the migration back', async () => {
        getUserRoles.mockResolvedValue([]);
        grantRole.mockResolvedValue({ error: { message: 'db exploded' } });

        await expect(
            migration.up(buildCtx([{ id: 'u-host', email: 'host-pro@local.test' }]), primitives)
        ).rejects.toThrow(/host-pro@local\.test.*db exploded/s);
    });
});
