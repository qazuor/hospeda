/**
 * @file auth-session.ts
 * @description Shared test helper for islands that resolve the visitor's
 * session client-side (HOS-369 WB0-4).
 *
 * Since the SSR `isAuthenticated` prop stopped being a source of truth, an
 * island's session comes from `useAccountPermissions`, which reads
 * `@/lib/auth-cache`. Tests therefore control the session by mocking that one
 * module — this helper only builds the snapshot it should return, so the shape
 * stays in one place.
 *
 * The mock itself must be declared per test file (`vi.mock` is not shareable),
 * and the recommended factory is:
 *
 * ```ts
 * const mockReadCachedAuthMe = vi.fn();
 *
 * vi.mock('@/lib/auth-cache', () => ({
 *     readCachedAuthMe: () => mockReadCachedAuthMe(),
 *     // A cached AUTHENTICATED snapshot resolves synchronously inside the
 *     // hook's mount effect, so tests need no waiting. Anything else falls
 *     // through to this fetch, deliberately left pending: the components
 *     // render their anonymous variant while unresolved, which is exactly what
 *     // a guest must see.
 *     fetchAuthMe: () => new Promise(() => undefined),
 *     writeCachedAuthMe: () => undefined,
 *     // `test/setup.ts` calls this in a global afterEach.
 *     resetInFlightAuthMe: () => undefined
 * }));
 * ```
 */

import type { AuthMeSnapshot } from '@/lib/auth-cache';

/**
 * Build an `/auth/me` snapshot for a guest or a signed-in visitor.
 *
 * @param params - `{ isAuthenticated, name, email, id, roles }` (RO-RO). Only
 *   `isAuthenticated` is required; the rest default to a generic test user.
 * @returns The snapshot `readCachedAuthMe` should return.
 */
export function buildAuthSnapshot({
    isAuthenticated,
    id = 'user-1',
    name = 'Ana Test',
    email = 'ana@example.com',
    roles = ['USER'],
    permissions = []
}: {
    readonly isAuthenticated: boolean;
    readonly id?: string;
    readonly name?: string;
    readonly email?: string;
    readonly roles?: readonly string[];
    readonly permissions?: readonly string[];
}): AuthMeSnapshot {
    return {
        isAuthenticated,
        user: isAuthenticated ? { id, name, email } : null,
        permissions,
        roles: isAuthenticated ? roles : [],
        cachedAt: Date.now()
    };
}
