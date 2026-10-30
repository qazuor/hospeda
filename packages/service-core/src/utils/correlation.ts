/**
 * Correlation id resolution for service-layer writes (HOS-1499).
 *
 * The correlation of a business intention is minted at the API edge (U2,
 * HOS-1424) and lives in the API's request context. `@repo/service-core` may
 * not import an app, so the API wires a resolver here at startup, mirroring the
 * `setUserPermissionsCacheInvalidator` pattern (`permission.effects.ts`).
 *
 * Resolution order, first hit wins:
 * 1. `ctx.correlationId`, when the caller threaded one explicitly;
 * 2. the wired resolver (the active request's correlation);
 * 3. a freshly minted UUID — `domain_event.correlation_id` is NOT NULL, and a
 *    write outside any request (a script, a test) starts its own intention.
 *
 * @module utils/correlation
 */

import { randomUUID } from 'node:crypto';
import type { ServiceContext } from '../types';

/** Returns the ambient correlation id, or `undefined` outside a request. */
export type CorrelationIdResolver = () => string | undefined;

let resolver: CorrelationIdResolver | undefined;

/**
 * Wires the ambient correlation resolver. Call once at API startup with the
 * app's request-context reader.
 *
 * @param fn - Reader of the active request's correlation id.
 */
export function setCorrelationIdResolver(fn: CorrelationIdResolver): void {
    resolver = fn;
}

/**
 * Resolves the correlation id a service write must carry.
 *
 * @param input.ctx - The service context of the write, if any.
 * @returns `{ correlationId }`, always a non-empty string.
 */
export function resolveServiceCorrelationId(input: {
    readonly ctx?: Pick<ServiceContext, 'correlationId'>;
}): { readonly correlationId: string } {
    const correlationId = input.ctx?.correlationId ?? resolver?.() ?? randomUUID();
    return { correlationId };
}

/**
 * Clears the wired resolver. Test-only.
 *
 * @internal
 */
export function _resetCorrelationIdResolver(): void {
    resolver = undefined;
}
