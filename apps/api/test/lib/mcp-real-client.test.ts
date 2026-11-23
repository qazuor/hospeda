/**
 * HOS-2562 — the API's «real client» check (`src/lib/mcp-real-client.ts`):
 * the shared `isRealClient` rule fed with the actor's EFFECTIVE permissions and
 * the row-ownership probe, never the roles.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ownership } = vi.hoisted(() => ({
    ownership: { ownsHostTradeListing: false, ownsPartner: false }
}));

vi.mock('../../src/utils/business-ownership', () => ({
    probeBusinessOwnership: vi.fn(async () => ({ ...ownership }))
}));

import { isActorRealClient } from '../../src/lib/mcp-real-client';
import { createGuestActor } from '../../src/utils/actor';
import { probeBusinessOwnership } from '../../src/utils/business-ownership';

const USER_ID = '00000000-0000-4000-8000-000000000042';

function actorWith(input: {
    readonly roles?: readonly RoleEnum[];
    readonly permissions?: readonly PermissionEnum[];
}): Actor {
    return {
        id: USER_ID,
        roles: [...(input.roles ?? [RoleEnum.USER])],
        permissions: [...(input.permissions ?? [])]
    } as Actor;
}

describe('isActorRealClient', () => {
    beforeEach(() => {
        ownership.ownsHostTradeListing = false;
        ownership.ownsPartner = false;
        vi.mocked(probeBusinessOwnership).mockClear();
    });

    it('answers true for a host by permission, without the ownership queries', async () => {
        const actor = actorWith({ permissions: [PermissionEnum.ACCOMMODATION_CREATE] });

        expect(await isActorRealClient({ actor })).toBe(true);
        expect(probeBusinessOwnership).not.toHaveBeenCalled();
    });

    it('answers false for a pure tourist after probing ownership', async () => {
        const actor = actorWith({ permissions: [PermissionEnum.ACCOMMODATION_REVIEW_CREATE] });

        expect(await isActorRealClient({ actor })).toBe(false);
        expect(probeBusinessOwnership).toHaveBeenCalledWith({ actor });
    });

    it.each([
        ['provider', 'ownsHostTradeListing'],
        ['partner', 'ownsPartner']
    ] as const)('answers true for a %s by row ownership alone', async (_label, fact) => {
        ownership[fact] = true;

        expect(await isActorRealClient({ actor: actorWith({}) })).toBe(true);
    });

    it('never lets a role decide: a HOST role without the permission is not a client', async () => {
        const actor = actorWith({ roles: [RoleEnum.HOST], permissions: [] });

        expect(await isActorRealClient({ actor })).toBe(false);
    });

    it('answers false for the guest actor (a real UUID, so asked with isGuestActor)', async () => {
        expect(await isActorRealClient({ actor: createGuestActor() })).toBe(false);
        expect(probeBusinessOwnership).not.toHaveBeenCalled();
    });
});
