/**
 * Action reason resolution for administrative writes (ACC:15, HOS-1493).
 *
 * An administrative action on somebody else's resource may carry a reason —
 * the "por qué" of the auditable event (NUCLEO/08 §1.2). The reason arrives at
 * the API edge (a request header) and lives in the API's request context.
 * `@repo/service-core` may not import an app, so the API wires a resolver here
 * at startup, mirroring `setCorrelationIdResolver` (`utils/correlation.ts`).
 *
 * Resolution order, first non-empty hit wins:
 * 1. `ctx.actionReason`, when the caller threaded one explicitly;
 * 2. the wired resolver (the active request's reason);
 * 3. `null` — the reason is optional for action 15.
 *
 * Every candidate is trimmed; a blank value counts as absent.
 *
 * @module utils/action-reason
 */

import type { ServiceContext } from '../types';

/** Returns the ambient action reason, or `undefined` outside a request. */
export type ActionReasonResolver = () => string | undefined;

let resolver: ActionReasonResolver | undefined;

/**
 * Wires the ambient action-reason resolver. Call once at API startup with the
 * app's request-context reader.
 *
 * @param fn - Reader of the active request's action reason.
 */
export function setActionReasonResolver(fn: ActionReasonResolver): void {
    resolver = fn;
}

const normalize = (value: string | undefined): string | null => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
};

/**
 * Resolves the reason an administrative service write must carry.
 *
 * @param input.ctx - The service context of the write, if any.
 * @returns `{ reason }`, a trimmed non-empty string or `null`.
 */
export function resolveServiceActionReason(input: {
    readonly ctx?: Pick<ServiceContext, 'actionReason'>;
}): { readonly reason: string | null } {
    const fromCtx = normalize(input.ctx?.actionReason);
    if (fromCtx !== null) return { reason: fromCtx };
    return { reason: normalize(resolver?.()) };
}

/**
 * Clears the wired resolver. Test-only.
 *
 * @internal
 */
export function _resetActionReasonResolver(): void {
    resolver = undefined;
}
