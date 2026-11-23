/**
 * @file business-ownership.ts
 * @description The two row-ownership facts that grant a business vertical
 * without a permission (HOS-2551): owning a host-trade directory listing
 * (provider) and owning a LIVE partner row (not revoked, not soft-deleted).
 *
 * One probe, two readers: `/auth/me` hands the facts to the web, and the MCP
 * «real client» gate (HOS-2562) feeds them to `isRealClient` from
 * `@repo/schemas`. Reading both through here is what keeps the web's view of a
 * person and the API's decision about them the same.
 *
 * Fail-closed: each probe swallows its own failure and answers `false`. For the
 * nav that means a missing entry for one render; for the MCP gate it means a
 * refusal, never an accidental grant.
 */

import type { BusinessOwnershipFacts } from '@repo/schemas';
import { type Actor, HostTradeService, PartnerService } from '@repo/service-core';
import { isGuestActor } from './actor';
import { apiLogger } from './logger';

const hostTradeService = new HostTradeService({ logger: apiLogger });
const partnerService = new PartnerService({ logger: apiLogger });

/**
 * Resolves the ownership facts of an actor. Both lookups run in parallel; a
 * guest owns nothing and costs no query.
 *
 * @param input.actor - The resolved actor.
 * @returns `{ ownsHostTradeListing, ownsPartner }`.
 */
export async function probeBusinessOwnership({
    actor
}: {
    readonly actor: Actor;
}): Promise<BusinessOwnershipFacts> {
    if (isGuestActor(actor)) {
        return { ownsHostTradeListing: false, ownsPartner: false };
    }
    const probeHostTrade = async (): Promise<boolean> => {
        try {
            const own = await hostTradeService.getOwn(actor);
            return own.data?.trade != null;
        } catch {
            return false;
        }
    };
    const probePartner = async (): Promise<boolean> => {
        try {
            const own = await partnerService.ownsActivePartner(actor);
            return own.data?.owns === true;
        } catch {
            return false;
        }
    };
    const [ownsHostTradeListing, ownsPartner] = await Promise.all([
        probeHostTrade(),
        probePartner()
    ]);
    return { ownsHostTradeListing, ownsPartner };
}
