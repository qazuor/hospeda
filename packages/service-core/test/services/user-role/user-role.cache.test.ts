/**
 * Tests for the per-user role cache (HOS-296).
 *
 * `actorMiddleware` is global and calls `getUserRoles` on EVERY authenticated
 * request, so the read has to be cached — but a stale role set after a grant is
 * precisely the failure mode that ruled out Better Auth's `customSession` for
 * this change. The two properties below are what keep both true at once:
 *
 * 1. A non-transactional read is served from cache within the TTL.
 * 2. `grantRole` / `revokeRole` invalidate it themselves, so an operator's
 *    grant is visible on the very next request rather than up to a TTL later.
 *
 * A transactional read (`ctx.tx`) must bypass the cache in both directions — a
 * value read inside a transaction may be rolled back.
 *
 * @module test/services/user-role/user-role.cache
 */

import type { DrizzleClient } from '@repo/db';
import { setDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    invalidateUserRolesCache,
    readCachedUserRoles,
    USER_ROLES_CACHE_TTL_MS,
    writeCachedUserRoles
} from '../../../src/services/user-role/user-role.cache.js';
import { getUserRoles, grantRole } from '../../../src/services/user-role/user-role.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

/** Counts how many role SELECTs reached the "database". */
const selectSpy = vi.fn();

/** Rows the fake client answers the held-roles query with. */
let roleRows: { role: RoleEnum }[] = [];

const buildFakeClient = (): DrizzleClient =>
    ({
        select: () => ({
            from: () => ({
                where: () => {
                    selectSpy();
                    return Promise.resolve(roleRows);
                }
            })
        }),
        insert: () => ({
            values: () => ({
                onConflictDoNothing: () => ({ returning: async () => [] })
            })
        })
        // biome-ignore lint/suspicious/noExplicitAny: partial Drizzle double; the fluent builder's types add nothing here
    }) as any;

beforeEach(() => {
    selectSpy.mockClear();
    roleRows = [{ role: RoleEnum.USER }];
    invalidateUserRolesCache();
    const client = buildFakeClient();
    setDb({
        ...(client as unknown as Record<string, unknown>),
        transaction: async (callback: (tx: DrizzleClient) => Promise<unknown>) => callback(client)
        // biome-ignore lint/suspicious/noExplicitAny: same rationale as buildFakeClient
    } as any);
});

afterEach(() => {
    invalidateUserRolesCache();
    setDb(null as unknown as DrizzleClient);
});

describe('user-role cache primitives', () => {
    it('returns undefined once the entry is older than the TTL', () => {
        // Arrange
        vi.useFakeTimers();
        writeCachedUserRoles({ userId: USER_ID, roles: [RoleEnum.USER] });

        // Act
        vi.advanceTimersByTime(USER_ROLES_CACHE_TTL_MS + 1);
        const cached = readCachedUserRoles({ userId: USER_ID });

        // Assert
        expect(cached).toBeUndefined();
        vi.useRealTimers();
    });

    it('keeps the TTL short enough to bound the multi-instance staleness window', () => {
        // A long TTL here reintroduces exactly the staleness that ruled out
        // Better Auth's customSession, so the bound is asserted, not assumed.
        expect(USER_ROLES_CACHE_TTL_MS).toBeLessThanOrEqual(60_000);
    });
});

describe('getUserRoles caching', () => {
    it('serves a second non-transactional read from cache', async () => {
        // Act
        const first = await getUserRoles({ userId: USER_ID });
        const second = await getUserRoles({ userId: USER_ID });

        // Assert
        expect(first).toEqual([RoleEnum.USER]);
        expect(second).toEqual([RoleEnum.USER]);
        expect(selectSpy).toHaveBeenCalledTimes(1);
    });

    it('bypasses the cache entirely when the caller owns the transaction', async () => {
        // Arrange — populate the cache through a normal read first.
        await getUserRoles({ userId: USER_ID });
        selectSpy.mockClear();

        // Act
        await getUserRoles({ userId: USER_ID, ctx: { tx: buildFakeClient() } });

        // Assert — a value read inside a transaction may be rolled back.
        expect(selectSpy).toHaveBeenCalledTimes(1);
    });

    it('re-queries after grantRole, so a grant is visible on the next request', async () => {
        // Arrange — warm the cache with the pre-grant set.
        expect(await getUserRoles({ userId: USER_ID })).toEqual([RoleEnum.USER]);

        // Act — the grant lands and the DB now reports both hats.
        roleRows = [{ role: RoleEnum.USER }, { role: RoleEnum.HOST }];
        const granted = await grantRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            grantedBy: null,
            reason: 'accommodation_activated'
        });

        // Assert
        expect(granted.error).toBeUndefined();
        expect(await getUserRoles({ userId: USER_ID })).toEqual([RoleEnum.USER, RoleEnum.HOST]);
    });
});
