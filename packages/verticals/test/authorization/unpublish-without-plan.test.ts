import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';

const VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;

/** An owner with no live plan: no coverage source and an empty effective set. */
function noPlanPorts(vertical: VerticalEnum) {
    const coverage = vi.fn(async () => ({ covered: false, sources: [] }));
    const effectiveSet = vi.fn(async ({ userId }: { userId: string; vertical: VerticalEnum }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical,
            hasLiveNonTrialTitle: false,
            inheritsTouristVip: false,
            entries: []
        })
    );
    const billing: Pick<BillingForVerticals, 'coverage'> = { coverage };
    return { billing, effectiveSet, coverage };
}

describe('HOS-2244 taking a listing down does not need a plan', () => {
    it.each(
        VERTICALS
    )('%s: an owner with no plan can UNPUBLISH a published listing', async (vertical) => {
        // Arrange
        const ports = noPlanPorts(vertical);

        // Act
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            operation: 'UNPUBLISH',
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
            ...ports
        });

        // Assert
        expect(result).toEqual({ allowed: true, subjectId: 'owner', evaluatedSteps: [4] });
        expect(ports.coverage).not.toHaveBeenCalled();
        expect(ports.effectiveSet).not.toHaveBeenCalled();
    });

    it.each(VERTICALS)('%s: the same owner is still refused PUBLISH and EDIT', async (vertical) => {
        // Arrange
        const facts = { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED };
        const draft = { ownerId: 'owner', publicationStatus: PublicationStatusEnum.DRAFT };

        // Act
        const publish = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            operation: 'PUBLISH',
            facts: draft,
            ...noPlanPorts(vertical)
        });
        const edit = await resolveListingAccess({
            actorId: 'owner',
            vertical,
            operation: 'EDIT',
            facts,
            ...noPlanPorts(vertical)
        });

        // Assert
        expect(publish).toEqual({ allowed: false, reason: 'NO_COVERAGE' });
        expect(edit).toEqual({ allowed: false, reason: 'NO_COVERAGE' });
    });

    it('step 4 still applies: a foreign actor cannot UNPUBLISH and learns nothing', async () => {
        // Arrange
        const ports = noPlanPorts(VerticalEnum.ACCOMMODATION);

        // Act
        const result = await resolveListingAccess({
            actorId: 'stranger',
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'UNPUBLISH',
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
            ...ports
        });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });

    it('step 4 still applies: a missing or purged listing is NOT_FOUND', async () => {
        const ports = noPlanPorts(VerticalEnum.ACCOMMODATION);
        const base = {
            actorId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'UNPUBLISH' as const,
            ...ports
        };
        expect(await resolveListingAccess({ ...base, facts: null })).toEqual({
            allowed: false,
            reason: 'NOT_FOUND'
        });
        expect(
            await resolveListingAccess({
                ...base,
                facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PURGED }
            })
        ).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });

    it('an archived listing is not an UNPUBLISH target', async () => {
        const result = await resolveListingAccess({
            actorId: 'owner',
            vertical: VerticalEnum.VENUE,
            operation: 'UNPUBLISH',
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.ARCHIVED },
            ...noPlanPorts(VerticalEnum.VENUE)
        });
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });

    it('a guest is UNAUTHENTICATED on UNPUBLISH', async () => {
        const result = await resolveListingAccess({
            actorId: null,
            vertical: VerticalEnum.VENUE,
            operation: 'UNPUBLISH',
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
            ...noPlanPorts(VerticalEnum.VENUE)
        });
        expect(result).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' });
    });

    it('action 15 (foreign content editor) can UNPUBLISH a foreign listing, owner as subject', async () => {
        const result = await resolveListingAccess({
            actorId: 'admin',
            vertical: VerticalEnum.ACCOMMODATION,
            operation: 'UNPUBLISH',
            facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
            adminAction: { action: 'ACC_15', permitted: true, isSystemActor: false },
            ...noPlanPorts(VerticalEnum.ACCOMMODATION)
        });
        expect(result).toMatchObject({ allowed: true, subjectId: 'owner' });
    });
});
