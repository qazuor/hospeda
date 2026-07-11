/**
 * @file use-account-permissions.ts
 * @description Shared "resolve `/auth/me` on mount" hook — extracted from
 * `UserMenu.client.tsx` so `MobileMenu.client.tsx` (HOS-131 §6.5) can reuse
 * the exact same cache-first fetch/parse logic instead of a near-duplicate
 * effect. Both islands end up calling this hook; only the amount of the
 * result they consume differs (UserMenu also needs `user`/`role`, MobileMenu
 * only needs `permissions` since it already has its own SSR `user` prop).
 *
 * Two modes, selected by whether `initialUser` is passed:
 * - **SSR-reconciling mode** (`UserMenu`, `MobileMenu`): pass `initialUser`
 *   (the SSR snapshot, `null` for guests). A fresh cache is only trusted when
 *   its `isAuthenticated` flag AGREES with `initialUser !== null` —
 *   otherwise a post-sign-in/sign-out full reload could apply a stale,
 *   contradictory cache.
 * - **Simple mode** (omit `initialUser` entirely): any fresh, *authenticated*
 *   cache is trusted directly — no reconciliation.
 *
 * `<html data-user-authenticated>` (consumed by `GuestPreferenceNudge`) is
 * written ONLY by `UserMenu` — the single owner of that DOM attribute, since
 * it's the component mounted with `client:load` on every page. This
 * defaults to "on" whenever `initialUser` is passed (preserving `UserMenu`'s
 * original, unparameterized behavior) but `MobileMenu` explicitly opts out
 * via `syncAuthenticatedAttribute: false` — it's ALSO in SSR-reconciling
 * mode (for the same cache/SSR reconciliation), but must not become a
 * second writer of an attribute UserMenu already owns.
 *
 * `initialRole` is an optional companion to `initialUser`: it seeds the
 * `role` state so a caller with an SSR role hint (e.g. `MobileMenu`'s
 * host-mode CTA) renders correctly on first paint, before the cache/fetch
 * resolves. Purely additive — omitting it (as `UserMenu` does) keeps `role`
 * starting at `null`, unchanged from before this param existed.
 */

import { useEffect, useState } from 'react';
import {
    type AuthMeUser,
    fetchAuthMe,
    readCachedAuthMe,
    writeCachedAuthMe
} from '@/lib/auth-cache';

/** Input for `useAccountPermissions`. */
export interface UseAccountPermissionsParams {
    /**
     * SSR-provided user snapshot (`null` for guests). Pass this to enable
     * SSR-vs-cache reconciliation and the `data-user-authenticated` write
     * (`UserMenu` mode). Omit entirely to skip both (`MobileMenu` mode) —
     * `undefined` is a meaningfully different value from `null` here.
     */
    readonly initialUser?: AuthMeUser | null;
    /**
     * SSR role hint (`Astro.locals.user?.role`), seeding the `role` state so
     * first paint is correct before the cache/fetch resolves. Optional and
     * additive — omit to leave `role` starting at `null` (original
     * behavior, still used by `UserMenu`).
     */
    readonly initialRole?: string | null;
    /**
     * Skip resolving entirely (e.g. a guest-only consumer with no `user`
     * prop to reconcile against). Defaults to `false`.
     */
    readonly skip?: boolean;
    /**
     * Whether to sync `<html data-user-authenticated>` from the resolved
     * auth state. Defaults to `true` whenever `initialUser` is passed
     * (matches `UserMenu`'s original, unparameterized behavior). Pass
     * `false` for any OTHER SSR-reconciling caller (e.g. `MobileMenu`) —
     * `UserMenu` is the single owner of this attribute; a second writer
     * risks a brief flicker if the two components' resolutions land in a
     * different order.
     */
    readonly syncAuthenticatedAttribute?: boolean;
}

/** Output of `useAccountPermissions`. */
export interface UseAccountPermissionsResult {
    /** Resolved user (SSR snapshot, cache, or `/auth/me`). `null` for guests. */
    readonly user: AuthMeUser | null;
    /**
     * Effective permission strings. `null` while still resolving — callers
     * MUST treat `null` the same as `[]` for gating (fail-closed), per the
     * `isVisibleByPermissions` loading-state contract.
     */
    readonly permissions: ReadonlyArray<string> | null;
    /** Actor role (e.g. USER, HOST, ADMIN). `null` for guests or while loading. */
    readonly role: string | null;
}

/**
 * Resolves the current visitor's `/auth/me` snapshot on mount, cache-first.
 *
 * @param params - `{ initialUser?, skip? }` (RO-RO). See the two modes above.
 * @returns `{ user, permissions, role }`.
 */
export function useAccountPermissions({
    initialUser,
    initialRole = null,
    skip = false,
    syncAuthenticatedAttribute
}: UseAccountPermissionsParams = {}): UseAccountPermissionsResult {
    const [user, setUser] = useState<AuthMeUser | null>(initialUser ?? null);
    const [permissions, setPermissions] = useState<ReadonlyArray<string> | null>(null);
    const [role, setRole] = useState<string | null>(initialRole);

    // `initialUser === undefined` means the caller never passed it (simple
    // mode) — distinct from explicitly passing `null` for a guest
    // (SSR-reconciling mode, which always passes a concrete value).
    const hasSsrSignal = initialUser !== undefined;

    // Default to hasSsrSignal (UserMenu's original, unparameterized
    // behavior); callers like MobileMenu explicitly pass `false`.
    const shouldSyncAttribute = syncAuthenticatedAttribute ?? hasSsrSignal;

    // TTL guard + SSR reconciliation: see the file JSDoc for the two modes.
    // Mount-only by design (matches the original UserMenu effect) — `skip` is
    // the only reactive dependency; `initialUser` is intentionally excluded
    // so a re-render with a new (but equivalent) SSR snapshot doesn't refetch.
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only refine; initialUser is the SSR snapshot captured at mount
    useEffect(() => {
        if (skip) return;
        let cancelled = false;
        const cached = readCachedAuthMe();

        const cacheMatchesSsr = hasSsrSignal
            ? cached !== null && cached.isAuthenticated === (initialUser !== null)
            : cached?.isAuthenticated === true;

        if (cached && cacheMatchesSsr) {
            setUser(cached.user);
            setPermissions(cached.permissions);
            setRole(cached.role);
            if (shouldSyncAttribute) {
                document.documentElement.setAttribute(
                    'data-user-authenticated',
                    cached.isAuthenticated ? 'true' : 'false'
                );
            }
            return () => {
                cancelled = true;
            };
        }

        fetchAuthMe()
            .then((snapshot) => {
                if (cancelled) return;
                writeCachedAuthMe(snapshot);
                setUser(snapshot.user);
                setPermissions(snapshot.permissions);
                setRole(snapshot.role);
                if (shouldSyncAttribute) {
                    document.documentElement.setAttribute(
                        'data-user-authenticated',
                        snapshot.isAuthenticated ? 'true' : 'false'
                    );
                }
            })
            .catch(() => {
                // Network error — fail closed, keep gated items hidden.
                if (!cancelled) setPermissions([]);
            });

        return () => {
            cancelled = true;
        };
    }, [skip]);

    return { user, permissions, role };
}
