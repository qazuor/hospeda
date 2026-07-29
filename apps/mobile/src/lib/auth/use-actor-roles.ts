/**
 * @file use-actor-roles.ts
 * @description Fetches the authenticated actor's role SET from the API
 * (HOS-296).
 *
 * ## Why this module exists
 *
 * Until HOS-296 the mobile app read a scalar `role` straight off Better Auth's
 * `useSession().data.user`, because `users.role` was a plain column exposed
 * through Better Auth's `additionalFields`. That column is gone: one account
 * now holds several roles, and `additionalFields` is a column mapping that
 * cannot flatten a related table. So `/api/auth/get-session` no longer carries
 * `role` in ANY form.
 *
 * The role set now reaches clients on the actor, via
 * `GET /api/v1/public/auth/me` — the same route the web and admin apps use.
 * This hook is the mobile app's entire `/auth/me` plumbing; there was none
 * before.
 *
 * ## Where the state lives
 *
 * In the TanStack Query cache, not in a bespoke store or a React context. The
 * app already routes every API read through {@link useApiQuery} → `apiFetch`
 * (tier guard + session cookie + Zod validation), and the `queryClient`
 * singleton already owns retry, backoff and reconnect behaviour. Adding a
 * second caching mechanism for one value would be a parallel system to keep in
 * sync with the first.
 *
 * ## How it is invalidated
 *
 * 1. **Keyed by user id** — the cache key is `['auth', 'me', <userId>]`, so a
 *    sign-out/sign-in as a DIFFERENT account can never read the previous
 *    account's roles: it is a different key.
 * 2. **Dropped on sign-out** — when no user id is present (signed out, or the
 *    session has not been restored yet) every `['auth', 'me', …]` entry is
 *    removed. Without this, signing out and back in as the SAME user inside
 *    the 5-minute `staleTime` would serve the pre-sign-out role set — which is
 *    precisely the window in which an admin grants someone HOST and tells them
 *    to sign out and back in.
 *
 * ## `isAuthenticated`, not `response.ok`
 *
 * `/auth/me` runs with `skipAuth`, so an invalid or absent session gets
 * **HTTP 200 with a guest actor**, never a 401. Gating on the response status
 * would read a guest's (empty) permission set as an authenticated answer. The
 * gate here is the strict `isAuthenticated === true` flag, and roles are read
 * ONLY through that branch.
 *
 * @module lib/auth/use-actor-roles
 */

import type { AuthMeResponse } from '@repo/schemas';
import { AuthMeResponseSchema } from '@repo/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useApiQuery } from '../api/use-api-query';
import { logger } from '../logger';
import type { RolesStatus } from './roles';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Shared empty role set. Frozen and module-level so every "no roles" branch
 * returns the SAME reference — callers can safely use it in effect
 * dependencies without re-running on every render.
 */
const EMPTY_ROLES: readonly string[] = Object.freeze([]);

/**
 * How long a fetched role set stays fresh.
 *
 * Roles are granted from the admin panel, never from the app, so a session-long
 * value is appropriate. Five minutes matches the app-wide default and means the
 * gate performs exactly one `/auth/me` call per launch in practice.
 */
const ROLES_STALE_TIME_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/**
 * TanStack Query key factory for the actor role set.
 *
 * `all` is the prefix used to drop every cached actor on sign-out; `byUser`
 * is the concrete key, scoped so two accounts can never share an entry.
 */
export const actorRolesKeys = {
    all: ['auth', 'me'] as const,
    byUser: (userId: string) => ['auth', 'me', userId] as const
};

// ---------------------------------------------------------------------------
// Pure derivation (unit-testable without React)
// ---------------------------------------------------------------------------

/** Input for {@link deriveActorRoles}. */
export type DeriveActorRolesInput = {
    /** `false` when there is no user id yet — the query never runs. */
    readonly enabled: boolean;
    /** The parsed `/auth/me` payload, or `undefined` while it has never resolved. */
    readonly data: AuthMeResponse | undefined;
    /** Whether the last fetch attempt failed (after retries). */
    readonly isError: boolean;
};

/** Output of {@link deriveActorRoles} and {@link useActorRoles}. */
export type ActorRolesState = {
    /** Every role the actor holds. Empty unless `status` is `ready` AND authenticated. */
    readonly roles: readonly string[];
    /** Whether the role set is known, still loading, or failed. */
    readonly status: RolesStatus;
    /** The server's own verdict on the session. Never inferred from HTTP status. */
    readonly isAuthenticated: boolean;
};

/**
 * Maps a raw query state onto the role state the navigation gate consumes.
 *
 * Kept pure and exported so the AC-9 behaviour can be asserted in a plain
 * `node` Vitest environment — the mobile test setup has no React renderer.
 *
 * Precedence, and why:
 * 1. `!enabled` → `ready` with no roles. There is no user to have roles; the
 *    gate decides `(auth)` from the session alone and must not wait on a
 *    request that will never be made.
 * 2. `data` present → `ready`. Data wins over `isError` deliberately: TanStack
 *    Query reports `status: 'error'` when a BACKGROUND refetch fails while
 *    still serving the previously fetched payload. Treating that as an error
 *    would kick a signed-in host out of `(host)` on one flaky refetch.
 * 3. `isError` with no data → `error`. Nothing was ever fetched.
 * 4. Otherwise → `loading`.
 *
 * @param input - `enabled` flag plus the raw query `data` / `isError`.
 * @returns The role set, its status, and the server's `isAuthenticated` verdict.
 */
export function deriveActorRoles({
    enabled,
    data,
    isError
}: DeriveActorRolesInput): ActorRolesState {
    if (!enabled) {
        return { roles: EMPTY_ROLES, status: 'ready', isAuthenticated: false };
    }

    if (data !== undefined) {
        // Strict gate: `/auth/me` is `skipAuth`, so a rejected session comes
        // back as 200 + guest actor. Only `isAuthenticated === true` yields roles.
        if (data.isAuthenticated !== true) {
            return { roles: EMPTY_ROLES, status: 'ready', isAuthenticated: false };
        }
        return { roles: data.actor.roles, status: 'ready', isAuthenticated: true };
    }

    if (isError) {
        return { roles: EMPTY_ROLES, status: 'error', isAuthenticated: false };
    }

    return { roles: EMPTY_ROLES, status: 'loading', isAuthenticated: false };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Input for {@link useActorRoles}. */
export type UseActorRolesInput = {
    /**
     * The authenticated user's id, from `useSession().data.user.id`.
     * `undefined` while the session is restoring or when signed out — the
     * query stays disabled and the cache is dropped.
     */
    readonly userId: string | undefined;
};

/**
 * Returns every role the authenticated actor holds.
 *
 * Must be called below the app's `QueryClientProvider` (see
 * `app/_layout.tsx`, which renders the navigation gate inside it precisely so
 * this hook is usable there).
 *
 * @param input - `{ userId }` — the session's user id, or `undefined`.
 * @returns `{ roles, status, isAuthenticated }`.
 *
 * @example
 * ```tsx
 * const { data, isPending } = useSession();
 * const { roles, status } = useActorRoles({ userId: data?.user.id });
 * const { group } = resolveAuthGroup({
 *   sessionStatus: isPending ? 'loading' : data ? 'authenticated' : 'unauthenticated',
 *   rolesStatus: status,
 *   roles
 * });
 * ```
 */
export function useActorRoles({ userId }: UseActorRolesInput): ActorRolesState {
    const queryClient = useQueryClient();
    const enabled = Boolean(userId);

    const query = useApiQuery({
        queryKey: actorRolesKeys.byUser(userId ?? ''),
        path: '/api/v1/public/auth/me',
        schema: AuthMeResponseSchema,
        enabled,
        staleTime: ROLES_STALE_TIME_MS
    });

    // Sign-out (and the pre-restore window) drops every cached actor, so a
    // subsequent sign-in as the same user always re-reads the role set.
    useEffect(() => {
        if (enabled) return;
        queryClient.removeQueries({ queryKey: actorRolesKeys.all });
    }, [enabled, queryClient]);

    const { roles, status, isAuthenticated } = deriveActorRoles({
        enabled,
        data: query.data,
        isError: query.isError
    });

    // Neither degraded state is allowed to be silent: both downgrade an actor
    // to the least-privileged shell, and a host losing `(host)` must be
    // diagnosable from the device log rather than reported as "the app is weird".
    useEffect(() => {
        if (status === 'error') {
            logger.warn(
                'Actor roles could not be loaded from /auth/me; falling back to the least-privileged navigation group. Will recover on the next successful refetch.'
            );
            return;
        }
        if (status === 'ready' && enabled && !isAuthenticated) {
            logger.warn(
                'A Better Auth session exists but /auth/me reports an unauthenticated actor; treating the user as having no roles.'
            );
        }
    }, [status, enabled, isAuthenticated]);

    return { roles, status, isAuthenticated };
}
