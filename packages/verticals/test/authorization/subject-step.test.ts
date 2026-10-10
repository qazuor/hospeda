import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveAdministrativeActionStep } from '../../src/authorization/administrative-action-step';
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
function ports(limit?: number) {
    const coverage = vi.fn(async () => ({ covered: false, sources: [source] }));
    const effectiveSet = vi.fn(
        async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
            rehydrateEffectiveSet({
                version: 1,
                userId,
                vertical,
                hasLiveNonTrialTitle: false,
                entries: [
                    { key: 'edit_accommodation_info', value: 1, strategy: 'MAX' },
                    ...(limit === undefined
                        ? []
                        : [
                              {
                                  key: 'max_photos_per_accommodation',
                                  value: limit,
                                  strategy: 'MAX' as const
                              }
                          ])
                ]
            })
    );
    const billing: Pick<BillingForVerticals, 'coverage'> = { coverage };
    return { billing, coverage, effectiveSet };
}

const base = {
    actorId: 'admin',
    vertical: VerticalEnum.ACCOMMODATION,
    facts: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
    operation: 'EDIT' as const,
    adminAction: { permitted: true, isSystemActor: false }
};
const photoLimit = { key: 'max_photos_per_accommodation', requested: 11 };

describe('AC:V5:7 / TEST:V5:8 administrative account comparison', () => {
    it('rejects actor = subject', () => {
        expect(
            resolveAdministrativeActionStep({
                action: 'ACC_15',
                actorId: 'account',
                subjectId: 'account',
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });
    it('accepts a null subject and a different account', () => {
        expect(
            resolveAdministrativeActionStep({
                action: 'ACC_15',
                actorId: 'staff',
                subjectId: null,
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: true });
        expect(
            resolveAdministrativeActionStep({
                action: 'ACC_15',
                actorId: 'staff',
                subjectId: 'partner',
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: true });
    });
    it('rejects absent permission', () => {
        expect(
            resolveAdministrativeActionStep({
                action: 'ACC_15',
                actorId: 'staff',
                subjectId: 'partner',
                permitted: false,
                isSystemActor: false
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
    });
});

describe('AC:V5:8 / TEST:V5:9 subject and owner limit', () => {
    it('evaluates a foreign administrative edit only on the resource owner', async () => {
        const port = ports(10);
        expect(await resolveListingAccess({ ...base, ...port })).toEqual({
            allowed: true,
            subjectId: 'owner',
            evaluatedSteps: [3, 4, 5, 6]
        });
        expect(port.coverage).toHaveBeenCalledExactlyOnceWith({
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(port.effectiveSet).toHaveBeenCalledExactlyOnceWith({
            userId: 'owner',
            vertical: VerticalEnum.ACCOMMODATION
        });
    });

    it('masks a foreign edit without the administrative action', async () => {
        const port = ports(10);
        expect(await resolveListingAccess({ ...base, adminAction: undefined, ...port })).toEqual({
            allowed: false,
            reason: 'NOT_FOUND'
        });
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it('refuses absent permission, actor = owner, and administrative publish at step 3', async () => {
        const port = ports(10);
        expect(
            await resolveListingAccess({
                ...base,
                adminAction: { permitted: false, isSystemActor: false },
                ...port
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' });
        expect(await resolveListingAccess({ ...base, actorId: 'owner', ...port })).toEqual({
            allowed: false,
            reason: 'FORBIDDEN'
        });
        expect(await resolveListingAccess({ ...base, operation: 'PUBLISH', ...port })).toEqual({
            allowed: false,
            reason: 'FORBIDDEN'
        });
        expect(port.coverage).not.toHaveBeenCalled();
    });

    it('applies the owner photo limit and accepts exactly the maximum', async () => {
        const port = ports(10);
        expect(await resolveListingAccess({ ...base, limit: photoLimit, ...port })).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: 'max_photos_per_accommodation',
            max: 10,
            requested: 11
        });
        expect(
            await resolveListingAccess({
                ...base,
                limit: { ...photoLimit, requested: 10 },
                ...port
            })
        ).toEqual({ allowed: true, subjectId: 'owner', evaluatedSteps: [3, 4, 5, 6, 7] });
        expect(port.effectiveSet.mock.calls.every(([args]) => args.userId === 'owner')).toBe(true);
    });

    it('treats an absent owner photo limit as zero', async () => {
        const port = ports();
        expect(
            await resolveListingAccess({ ...base, limit: { ...photoLimit, requested: 1 }, ...port })
        ).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: 'max_photos_per_accommodation',
            max: 0,
            requested: 1
        });
    });
});
