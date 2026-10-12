import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PermissionEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    ADMINISTRATIVE_ACTION_LISTING_OPERATIONS,
    isAdministrativeActionPermitted
} from '../../src/authorization/administrative-actions';
import type { ListingOperation } from '../../src/authorization/listing-operation';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';

const source = {
    type: 'BASE' as const,
    reference: { kind: 'PLAN_VERSION' as const, planVersionId: 'base' },
    scope: 'VERTICAL' as const,
    target: null,
    since: new Date('2025-01-01'),
    until: 'NEVER_EXPIRES' as const,
    charged: null,
    floor: null
};

/** Billing and effective-set doubles; the owner holds both keys the operations need. */
function ports() {
    const coverage = vi.fn(async () => ({ covered: false, sources: [source] }));
    const effectiveSet = vi.fn(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                inheritsTouristVip: false,
                entries: [
                    { key: 'edit_accommodation_info', value: 1, strategy: 'MAX' },
                    { key: 'recover_own_listing', value: 1, strategy: 'MAX' }
                ]
            })
    );
    const billing: Pick<BillingForVerticals, 'coverage'> = { coverage };
    return { billing, coverage, effectiveSet };
}

function resolve(args: {
    readonly action: 'ACC_15' | 'ACC_23';
    readonly operation: ListingOperation;
    readonly status?: PublicationStatusEnum;
    readonly actorId?: string;
    readonly permitted?: boolean;
    readonly isSystemActor?: boolean;
    readonly doubles: ReturnType<typeof ports>;
}) {
    return resolveListingAccess({
        actorId: args.actorId ?? 'admin',
        vertical: VerticalEnum.ACCOMMODATION,
        facts: {
            ownerId: 'owner',
            publicationStatus: args.status ?? PublicationStatusEnum.DRAFT
        },
        operation: args.operation,
        adminAction: {
            action: args.action,
            permitted: args.permitted ?? true,
            isSystemActor: args.isSystemActor ?? false
        },
        billing: args.doubles.billing,
        effectiveSet: args.doubles.effectiveSet
    });
}

describe('TEST:V8a:9 the administrative action decides the operation it admits', () => {
    it('declares EDIT for action 15 and DELETE for action 23', () => {
        expect(ADMINISTRATIVE_ACTION_LISTING_OPERATIONS).toEqual({
            ACC_15: ['EDIT'],
            ACC_23: ['DELETE']
        });
    });

    it('(a) action 15 edits a foreign listing with the owner as subject', async () => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({ action: 'ACC_15', operation: 'EDIT', doubles });

        // Assert
        expect(result).toMatchObject({ allowed: true, subjectId: 'owner' });
    });

    it('(b) action 15 does not delete, and steps 5 and 6 never run', async () => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({ action: 'ACC_15', operation: 'DELETE', doubles });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'FORBIDDEN' });
        expect(doubles.coverage).not.toHaveBeenCalled();
        expect(doubles.effectiveSet).not.toHaveBeenCalled();
    });

    it.each([
        PublicationStatusEnum.DRAFT,
        PublicationStatusEnum.PUBLISHED,
        PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
        PublicationStatusEnum.ARCHIVED,
        PublicationStatusEnum.MODERATED
    ])('(c) action 23 deletes a foreign %s listing evaluated on the owner', async (status) => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({ action: 'ACC_23', operation: 'DELETE', status, doubles });

        // Assert
        expect(result).toMatchObject({ allowed: true, subjectId: 'owner' });
        if (!result.allowed) throw new Error('expected allowed');
        expect(result.evaluatedSteps).toEqual(expect.arrayContaining([3, 4, 5, 6]));
        expect(doubles.coverage).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner' }));
        expect(doubles.effectiveSet).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'owner' })
        );
    });

    it('(d) action 23 does not edit', async () => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({ action: 'ACC_23', operation: 'EDIT', doubles });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'FORBIDDEN' });
        expect(doubles.coverage).not.toHaveBeenCalled();
    });

    it('(e) action 23 without its permission is forbidden', async () => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({
            action: 'ACC_23',
            operation: 'DELETE',
            permitted: false,
            doubles
        });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });

    it('(f) action 23 on the actor own listing is forbidden', async () => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({
            action: 'ACC_23',
            operation: 'DELETE',
            actorId: 'owner',
            doubles
        });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });

    it('(g) a system actor cannot run action 23', async () => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({
            action: 'ACC_23',
            operation: 'DELETE',
            isSystemActor: true,
            doubles
        });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });

    it('(h) action 23 on a PURGED listing is not found', async () => {
        // Arrange
        const doubles = ports();

        // Act
        const result = await resolve({
            action: 'ACC_23',
            operation: 'DELETE',
            status: PublicationStatusEnum.PURGED,
            doubles
        });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
    });
});

describe('TEST:V8a:9 step 3 permission is derived from the action own permissions only', () => {
    it('an actor holding only the action 15 permission cannot purge through action 23', async () => {
        // Arrange
        const doubles = ports();
        const actorPermissions = [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT];
        const permitted = isAdministrativeActionPermitted({ action: 'ACC_23', actorPermissions });

        // Act
        const result = await resolve({ action: 'ACC_23', operation: 'DELETE', permitted, doubles });

        // Assert
        expect(permitted).toBe(false);
        expect(result).toEqual({ allowed: false, reason: 'FORBIDDEN' });
        expect(doubles.coverage).not.toHaveBeenCalled();
    });

    it('an actor holding the action 23 permission is permitted for action 23 only', () => {
        // Arrange
        const actorPermissions = [PermissionEnum.LISTING_PURGE_ON_REQUEST];

        // Act + Assert
        expect(isAdministrativeActionPermitted({ action: 'ACC_23', actorPermissions })).toBe(true);
        expect(isAdministrativeActionPermitted({ action: 'ACC_15', actorPermissions })).toBe(false);
        expect(
            isAdministrativeActionPermitted({ action: 'ACC_23', actorPermissions: undefined })
        ).toBe(false);
    });
});
