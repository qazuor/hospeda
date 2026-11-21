/**
 * AsyncRegion — one place that decides which of five states to draw
 * (HOS-2413 T-024).
 *
 * `AsyncResult<T>` is a discriminated union over `loading`, `error`, `empty`,
 * `locked` and `ready`, and `AsyncRegion` REQUIRES a render function for every
 * one of them (TypeScript enforces it). A failed fetch therefore cannot fall
 * through to the empty piece or render `0`: it is `{ status: 'error' }` and
 * has its own slot. `settleAsync` is the safe way to build the state from a
 * promise.
 *
 * @module components/account/ui/AsyncRegion
 */

import type { ReactNode } from 'react';
import type { LockReason } from './lock-reason';

/** The five states of an async region. */
export type AsyncResult<T> =
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly retry: () => void }
    | { readonly status: 'empty' }
    | { readonly status: 'locked'; readonly reason: LockReason }
    | { readonly status: 'ready'; readonly data: T };

/** Props of {@link AsyncRegion}. Every slot is required. */
export interface AsyncRegionProps<T> {
    /** The current state. */
    readonly state: AsyncResult<T>;
    /** Draws the loading state (a Skeleton). */
    readonly loading: () => ReactNode;
    /** Draws the error state (an ErrorState wired to `retry`). */
    readonly error: (input: { readonly retry: () => void }) => ReactNode;
    /** Draws the empty state (an EmptyState). Only for a SUCCESSFUL empty result. */
    readonly empty: () => ReactNode;
    /** Draws the locked state (a LockedState). */
    readonly locked: (reason: LockReason) => ReactNode;
    /** Draws the data. */
    readonly ready: (data: T) => ReactNode;
}

/**
 * Draws the piece for the current state.
 *
 * @param props - See {@link AsyncRegionProps}.
 * @returns The output of exactly one slot.
 */
export function AsyncRegion<T>({
    state,
    loading,
    error,
    empty,
    locked,
    ready
}: AsyncRegionProps<T>) {
    switch (state.status) {
        case 'loading':
            return <>{loading()}</>;
        case 'error':
            return <>{error({ retry: state.retry })}</>;
        case 'empty':
            return <>{empty()}</>;
        case 'locked':
            return <>{locked(state.reason)}</>;
        case 'ready':
            return <>{ready(state.data)}</>;
    }
}

/**
 * Turns a promise into an {@link AsyncResult}. A rejection becomes
 * `{ status: 'error' }`: it can never become `empty`.
 *
 * @param input - Options object.
 * @param input.load - The work to run.
 * @param input.retry - What the error state's retry button should run.
 * @param input.isEmpty - Tells when a SUCCESSFUL result counts as empty.
 * @returns `ready`, `empty` (only on success) or `error`.
 */
export async function settleAsync<T>({
    load,
    retry,
    isEmpty
}: {
    readonly load: () => Promise<T>;
    readonly retry: () => void;
    readonly isEmpty?: (data: T) => boolean;
}): Promise<AsyncResult<T>> {
    try {
        const data = await load();
        return isEmpty?.(data) ? { status: 'empty' } : { status: 'ready', data };
    } catch {
        return { status: 'error', retry };
    }
}
