/**
 * @file mcp-real-client.ts
 * @description The server side of «AI assistants are only for real clients»
 * (HOS-2562, owner decision of 22/11).
 *
 * A real client is a person with at least one business vertical. The rule is
 * `isRealClient` from `@repo/schemas`, the same function the web reads to show
 * «Asistentes de IA» and to answer 404 on its page, so the two sides cannot
 * disagree. The API never trusts the web's answer: it recomputes it here from
 * the actor's EFFECTIVE permissions (never its roles) and the row-ownership
 * facts (`probeBusinessOwnership`).
 *
 * Three places ask:
 * - the OAuth authorize step and the consent step (`auth-mcp-client-guard.ts`);
 * - every `/mcp` request (`middlewares/mcp-auth.ts`), which is what keeps a
 *   connection made before the rule, or a token refreshed after it, useless.
 */

import { isRealClient, isRealClientByPermissions } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { type ActorSourceUser, buildActorForUser } from '../middlewares/actor';
import { isGuestActor } from '../utils/actor';
import { probeBusinessOwnership } from '../utils/business-ownership';

/**
 * Whether an actor is a real client.
 *
 * The permissions are checked first: a host, owner or editor is answered
 * without a query. Only an account with no permission-gated vertical pays the
 * two ownership lookups (partner, provider).
 *
 * @param input.actor - The resolved actor (session or bearer).
 * @returns `true` for a real client; `false` for a guest or a pure tourist.
 */
export async function isActorRealClient({ actor }: { readonly actor: Actor }): Promise<boolean> {
    if (isGuestActor(actor)) return false;
    const permissions: readonly string[] = actor.permissions;
    if (isRealClientByPermissions({ permissions })) return true;
    const ownership = await probeBusinessOwnership({ actor });
    return isRealClient({ permissions, ...ownership });
}

/**
 * Whether a signed-in user is a real client, for callers that hold a session
 * user and no actor yet (the Better Auth hooks of the OAuth flow). Builds the
 * actor with `buildActorForUser`, the same function the session middleware
 * uses, so the effective permissions are the ones every route sees.
 *
 * @param input.user - The session user.
 * @returns `true` for a real client.
 */
export async function isUserRealClient({
    user
}: {
    readonly user: ActorSourceUser;
}): Promise<boolean> {
    const actor = await buildActorForUser({ user });
    return isActorRealClient({ actor });
}
