/**
 * HOS-1721: a pre-trial host (no trial, no subscription, no grant) must be able
 * to put photos on their own DRAFT, capped at what the trial will grant at
 * first publish (DEC-TRIAL-007: the trial starts at the first publish, and a
 * listing cannot be published without a main photo).
 */
import {
    type CoverageResponse,
    type CoverageSource,
    CoverageSourceSchema
} from '@repo/billing-verticals-contract';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import {
    isPreTrialCoverage,
    PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL,
    resolvePreTrialDraftLimits
} from '../../src/authorization/pre-trial-draft-limit';
import { resolveListingAccess } from '../../src/authorization/resolve-listing-access';
import { rehydrateEffectiveSet } from '../../src/effective-set-cache/snapshot';
import { createInMemoryCatalog, planVersionRow } from '../plan-catalog/in-memory-catalog-reader';

const OWNER = 'owner-1';
const VERTICAL = VerticalEnum.ACCOMMODATION;
const PHOTOS = 'max_photos_per_accommodation';
const AI_QUOTA = 'max_ai_text_improve_per_month';

const preTrialSource: CoverageSource = CoverageSourceSchema.parse({
    type: 'TRIAL',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'pre-trial-version' },
    scope: 'VERTICAL',
    target: null,
    since: 'NOT_STARTED',
    until: 'NOT_STARTED',
    charged: null,
    floor: null
});
const baseSource: CoverageSource = CoverageSourceSchema.parse({
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'floor-version' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-01-01'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
});
const subscriptionSource: CoverageSource = CoverageSourceSchema.parse({
    type: 'SUBSCRIPTION',
    reference: { kind: 'PLAN_VERSION', planVersionId: 'basic-version' },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-01-01'),
    until: new Date('2026-12-31'),
    charged: true,
    floor: null
});

const PRE_TRIAL: CoverageResponse = { covered: false, sources: [preTrialSource, baseSource] };

/** Ports for an actor whose effective set holds `limits` and nothing else. */
function accessPorts(args: {
    readonly limits?: readonly { readonly key: string; readonly value: number }[];
    readonly draftLimits?: ReadonlyMap<string, number>;
}) {
    const coverage = vi.fn(async () => PRE_TRIAL);
    const effectiveSet = vi.fn(async ({ userId }: { userId: string; vertical: VerticalEnum }) =>
        rehydrateEffectiveSet({
            version: 1,
            userId,
            vertical: VERTICAL,
            hasLiveNonTrialTitle: false,
            inheritsTouristVip: false,
            entries: (args.limits ?? []).map(({ key, value }) => ({
                key,
                value,
                strategy: 'SUM' as const
            }))
        })
    );
    const preTrialDraftLimits = vi.fn(
        async () => args.draftLimits ?? new Map<string, number>([[PHOTOS, 15]])
    );
    return { billing: { coverage }, effectiveSet, preTrialDraftLimits };
}

function draftEdit(args: {
    readonly key?: string;
    readonly requested: number;
    readonly status?: PublicationStatusEnum;
    readonly ownerId?: string;
}) {
    return {
        actorId: OWNER,
        vertical: VERTICAL,
        facts: {
            ownerId: args.ownerId ?? OWNER,
            publicationStatus: args.status ?? PublicationStatusEnum.DRAFT
        },
        operation: 'EDIT' as const,
        limit: { key: args.key ?? PHOTOS, requested: args.requested }
    };
}

describe('HOS-1721 pre-trial photo limit on a DRAFT (step 7)', () => {
    it('allows the main photo on the own DRAFT of a pre-trial actor with empty limits', async () => {
        // Arrange
        const ports = accessPorts({});
        // Act
        const result = await resolveListingAccess({ ...draftEdit({ requested: 1 }), ...ports });
        // Assert
        expect(result).toEqual({ allowed: true, subjectId: OWNER, evaluatedSteps: [4, 5, 7] });
        expect(ports.preTrialDraftLimits).toHaveBeenCalledWith({
            userId: OWNER,
            vertical: VERTICAL
        });
    });

    it('allows gallery photos up to the cap the trial will grant, and no further', async () => {
        // Arrange
        const ports = accessPorts({});
        // Act
        const atCap = await resolveListingAccess({ ...draftEdit({ requested: 15 }), ...ports });
        const overCap = await resolveListingAccess({ ...draftEdit({ requested: 16 }), ...ports });
        // Assert
        expect(atCap.allowed).toBe(true);
        expect(overCap).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: PHOTOS,
            max: 15,
            requested: 16
        });
    });

    it('keeps a PUBLISHED listing of a pre-trial actor at the effective limit (0)', async () => {
        // Arrange
        const ports = accessPorts({});
        // Act
        const result = await resolveListingAccess({
            ...draftEdit({ requested: 1, status: PublicationStatusEnum.PUBLISHED }),
            ...ports
        });
        // Assert
        expect(result).toMatchObject({ allowed: false, reason: 'NO_CAPABILITY' });
        expect(ports.preTrialDraftLimits).not.toHaveBeenCalled();
    });

    it('keeps an UNPUBLISHED_BY_BILLING listing at the effective limit (0)', async () => {
        // Arrange
        const ports = {
            ...accessPorts({}),
            effectiveSet: vi.fn(async ({ userId }: { userId: string }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical: VERTICAL,
                    hasLiveNonTrialTitle: false,
                    inheritsTouristVip: false,
                    entries: [{ key: 'edit_accommodation_info', value: 1, strategy: 'MAX' }]
                })
            )
        };
        // Act
        const result = await resolveListingAccess({
            ...draftEdit({ requested: 1, status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING }),
            ...ports
        });
        // Assert
        expect(result).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: PHOTOS,
            max: 0,
            requested: 1
        });
        expect(ports.preTrialDraftLimits).not.toHaveBeenCalled();
    });

    it('never exposes a DRAFT that belongs to somebody else', async () => {
        // Arrange
        const ports = accessPorts({});
        // Act
        const result = await resolveListingAccess({
            ...draftEdit({ requested: 1, ownerId: 'somebody-else' }),
            ...ports
        });
        // Assert
        expect(result).toEqual({ allowed: false, reason: 'NOT_FOUND' });
        expect(ports.preTrialDraftLimits).not.toHaveBeenCalled();
    });

    it('keeps a non-photo limit (AI quota) denied on a DRAFT with empty limits', async () => {
        // Arrange
        const ports = accessPorts({ draftLimits: new Map([[AI_QUOTA, 99]]) });
        // Act
        const result = await resolveListingAccess({
            ...draftEdit({ key: AI_QUOTA, requested: 1 }),
            ...ports
        });
        // Assert
        expect(result).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: AI_QUOTA,
            max: 0,
            requested: 1
        });
        expect(ports.preTrialDraftLimits).not.toHaveBeenCalled();
    });

    it('keeps a covered user capped by their own plan limit on a DRAFT', async () => {
        // Arrange
        const ports = accessPorts({ limits: [{ key: PHOTOS, value: 10 }] });
        // Act
        const result = await resolveListingAccess({ ...draftEdit({ requested: 11 }), ...ports });
        // Assert
        expect(result).toEqual({
            allowed: false,
            reason: 'LIMIT_REACHED',
            key: PHOTOS,
            max: 10,
            requested: 11
        });
        expect(ports.preTrialDraftLimits).not.toHaveBeenCalled();
    });

    it('stays denied when the port finds no draft cap (actor is not pre-trial)', async () => {
        // Arrange
        const ports = accessPorts({ draftLimits: new Map() });
        // Act
        const result = await resolveListingAccess({ ...draftEdit({ requested: 1 }), ...ports });
        // Assert
        expect(result).toMatchObject({ allowed: false, reason: 'LIMIT_REACHED', max: 0 });
    });
});

describe('isPreTrialCoverage', () => {
    it('is true only without a title and with a trial that has not started', () => {
        expect(isPreTrialCoverage({ coverage: PRE_TRIAL })).toBe(true);
        expect(isPreTrialCoverage({ coverage: { covered: false, sources: [baseSource] } })).toBe(
            false
        );
        expect(
            isPreTrialCoverage({
                coverage: {
                    covered: true,
                    sources: [preTrialSource, subscriptionSource, baseSource]
                }
            })
        ).toBe(false);
    });
});

describe('resolvePreTrialDraftLimits', () => {
    function catalogWithTrial(args: { readonly trialDays?: number } = {}) {
        const catalog = createInMemoryCatalog();
        catalog.addPlanVersion(
            planVersionRow({
                rank: 10,
                limits: [
                    { key: PHOTOS, value: 15, aggregationStrategy: 'SUM' },
                    { key: AI_QUOTA, value: 5, aggregationStrategy: 'SUM' }
                ]
            })
        );
        catalog.addPlanVersion(
            planVersionRow({
                rank: 30,
                limits: [{ key: PHOTOS, value: 40, aggregationStrategy: 'SUM' }]
            })
        );
        const trialVersionId = catalog.addPlanVersion(
            planVersionRow({
                planId: 'trial-plan',
                sellable: false,
                limits: [{ key: 'max_accommodations', value: 3, aggregationStrategy: 'SUM' }]
            })
        );
        const trialPlans = {
            findTrialPlan: vi.fn(async () => ({
                planId: 'trial-plan',
                planVersionId: trialVersionId,
                trialDays: args.trialDays ?? 14
            }))
        };
        return { reader: catalog.reader, trialPlans };
    }

    it('resolves the photo cap the trial would grant, from the lowest-rank sellable version', async () => {
        // Arrange
        const { reader, trialPlans } = catalogWithTrial();
        // Act
        const limits = await resolvePreTrialDraftLimits({
            billing: { coverage: async () => PRE_TRIAL },
            reader,
            trialPlans,
            userId: OWNER,
            vertical: VERTICAL
        });
        // Assert: only photo keys, never the AI quota nor the trial overrides.
        expect([...limits.entries()]).toEqual([[PHOTOS, 15]]);
        expect(PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL).toEqual({ [VERTICAL]: [PHOTOS] });
    });

    it('resolves nothing for an actor who is not pre-trial', async () => {
        // Arrange
        const { reader, trialPlans } = catalogWithTrial();
        // Act
        const limits = await resolvePreTrialDraftLimits({
            billing: {
                coverage: async () => ({ covered: true, sources: [subscriptionSource, baseSource] })
            },
            reader,
            trialPlans,
            userId: OWNER,
            vertical: VERTICAL
        });
        // Assert
        expect(limits.size).toBe(0);
        expect(trialPlans.findTrialPlan).not.toHaveBeenCalled();
    });

    it('resolves nothing, without reading coverage, for a vertical with no draft key', async () => {
        // Arrange
        const { reader, trialPlans } = catalogWithTrial();
        const coverage = vi.fn(async () => PRE_TRIAL);
        // Act
        const limits = await resolvePreTrialDraftLimits({
            billing: { coverage },
            reader,
            trialPlans,
            userId: OWNER,
            vertical: VerticalEnum.TOURIST
        });
        // Assert
        expect(limits.size).toBe(0);
        expect(coverage).not.toHaveBeenCalled();
    });

    it('resolves nothing when the vertical grants no trial', async () => {
        // Arrange
        const { reader, trialPlans } = catalogWithTrial({ trialDays: 0 });
        // Act
        const limits = await resolvePreTrialDraftLimits({
            billing: { coverage: async () => PRE_TRIAL },
            reader,
            trialPlans,
            userId: OWNER,
            vertical: VERTICAL
        });
        // Assert
        expect(limits.size).toBe(0);
    });
});
