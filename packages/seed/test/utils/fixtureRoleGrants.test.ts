/**
 * @fileoverview
 * Unit tests for `utils/fixtureRoleGrants.ts` (HOS-296).
 *
 * These cover the seam that replaced a silently-discarded `role` key on the
 * user fixtures: `users.role` no longer exists, `UserCreateInputSchema` strips
 * the unknown key, and Drizzle's `.values()` iterates table columns rather than
 * object keys — so before this helper existed, every JSON fixture's declared
 * role parsed, inserted and logged correctly while persisting nothing.
 *
 * The `grantRole` primitive is injected (never module-mocked) because it opens
 * a real database transaction and these tests run with no database.
 *
 * @module test/utils/fixtureRoleGrants
 */
import { RoleEnum, RoleGrantReason } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { GrantRolePort } from '../../src/utils/fixtureRoleGrants.js';
import { grantFixtureRole, resolveFixtureRole } from '../../src/utils/fixtureRoleGrants.js';

/** Builds a `grantRole` stub that always succeeds, plus its spy. */
function buildGrant(): { grant: GrantRolePort; calls: ReturnType<typeof vi.fn> } {
    const calls = vi.fn().mockResolvedValue({});
    return { grant: calls as unknown as GrantRolePort, calls };
}

describe('resolveFixtureRole', () => {
    it('returns the role the fixture declares', () => {
        expect(resolveFixtureRole({ item: { role: 'HOST' }, source: 'f.json' })).toBe(
            RoleEnum.HOST
        );
        expect(resolveFixtureRole({ item: { role: 'COMMERCE_OWNER' }, source: 'f.json' })).toBe(
            RoleEnum.COMMERCE_OWNER
        );
    });

    it('defaults to USER when the fixture declares no role', () => {
        // Mirrors the dropped column's own `DEFAULT 'USER'`.
        expect(resolveFixtureRole({ item: {}, source: 'f.json' })).toBe(RoleEnum.USER);
        expect(resolveFixtureRole({ item: { role: null }, source: 'f.json' })).toBe(RoleEnum.USER);
    });

    it('throws on an unknown role instead of silently degrading to USER', () => {
        expect(() => resolveFixtureRole({ item: { role: 'HOSTT' }, source: '007.json' })).toThrow(
            /007\.json.*unknown role/is
        );
        expect(() => resolveFixtureRole({ item: { role: 'host' }, source: '007.json' })).toThrow(
            /unknown role/i
        );
        expect(() => resolveFixtureRole({ item: { role: 42 }, source: '007.json' })).toThrow(
            /unknown role/i
        );
    });
});

describe('grantFixtureRole', () => {
    it('grants the baseline USER hat AND the declared role, as system grants with reason "seed"', async () => {
        const { grant, calls } = buildGrant();

        const role = await grantFixtureRole({
            result: { data: { id: 'user-1' } },
            item: { role: 'HOST' },
            source: '007-user-x.json',
            grant
        });

        expect(role).toBe(RoleEnum.HOST);
        expect(calls).toHaveBeenCalledTimes(2);
        expect(calls).toHaveBeenNthCalledWith(1, {
            userId: 'user-1',
            role: RoleEnum.USER,
            grantedBy: null,
            reason: RoleGrantReason.SEED
        });
        expect(calls).toHaveBeenNthCalledWith(2, {
            userId: 'user-1',
            role: RoleEnum.HOST,
            grantedBy: null,
            reason: RoleGrantReason.SEED
        });
    });

    it('adds the implicit USER hat on top of the declared role', async () => {
        // {USER, declared} is what every account-creating path produces and
        // what migration 0069 backfills, so fresh and migrated databases must
        // agree. A single-hatted fixture would also be un-revokable (AC-5) and
        // un-demotable (`shouldRevokeHostHat`).
        const { grant, calls } = buildGrant();

        await grantFixtureRole({
            result: { data: { id: 'user-2' } },
            item: { role: 'EDITOR' },
            source: 'f.json',
            grant
        });

        expect(calls.mock.calls.map((call) => (call[0] as { role: RoleEnum }).role)).toEqual([
            RoleEnum.USER,
            RoleEnum.EDITOR
        ]);
    });

    it('collapses to a single grant when the fixture declares USER', async () => {
        const { grant, calls } = buildGrant();

        await grantFixtureRole({
            result: { data: { id: 'user-4' } },
            item: { role: 'USER' },
            source: 'f.json',
            grant
        });

        expect(calls).toHaveBeenCalledTimes(1);
        expect(calls.mock.calls[0]?.[0]).toMatchObject({ role: RoleEnum.USER });
    });

    it('is a no-op when the create result carries no id', async () => {
        const { grant, calls } = buildGrant();

        await expect(
            grantFixtureRole({ result: { data: {} }, item: { role: 'HOST' }, source: 'f', grant })
        ).resolves.toBeNull();
        await expect(
            grantFixtureRole({ result: null, item: { role: 'HOST' }, source: 'f', grant })
        ).resolves.toBeNull();

        expect(calls).not.toHaveBeenCalled();
    });

    it('throws when the grant fails, naming the fixture', async () => {
        const grant = vi
            .fn()
            .mockResolvedValue({ error: { message: 'boom' } }) as unknown as GrantRolePort;

        await expect(
            grantFixtureRole({
                result: { data: { id: 'user-3' } },
                item: { role: 'HOST' },
                source: '009-user-y.json',
                grant
            })
        ).rejects.toThrow(/009-user-y\.json.*boom/s);
    });
});
