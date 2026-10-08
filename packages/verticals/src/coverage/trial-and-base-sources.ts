/** Reads only references needed to resolve the trial and BASE sources. */
import {
    CoverageArgsSchema,
    CoverageResponseSchema,
    coverageSourceClassOf,
    type CoverageArgs,
    type CoverageResponse,
    type CoverageSource
} from '@repo/billing-verticals-contract';
import {
    FLOOR_PLAN_ROLE,
    PRE_TRIAL_PLAN_ROLE,
    TrialStatusEnum,
    type PlanRole
} from '@repo/schemas';
import type { TrialFloorReferences, TrialInProgress } from '../effective-set/trial-ratchet';
import type { PlanVersionSummaryRow } from '../plan-catalog/catalog-reader';
import { CatalogVersionNotFoundError } from '../plan-catalog/errors';

/** The persisted trial state read without consulting the clock. */
export interface BootstrapTrialRow extends Pick<TrialInProgress, 'userId' | 'vertical'> {
    readonly status: TrialStatusEnum;
    readonly trialPlanId: string | null;
    readonly startedAt: Date | null;
    readonly endsAt: Date | null;
    readonly floor: TrialFloorReferences | null;
}

/** Read-only port for the bootstrap coverage resolution. */
export interface BootstrapCoverageReader {
    /** Trial row for this user and vertical, or null for PRE_TRIAL. */
    findTrial(args: CoverageArgs): Promise<BootstrapTrialRow | null>;
    /** Account creation instant. */
    findAccountCreatedAt(args: { readonly userId: string }): Promise<Date>;
    /** Current version of the non-sellable plan identified by its immutable role. */
    findCurrentVersionByRole(args: {
        readonly vertical: string;
        readonly role: PlanRole;
    }): Promise<PlanVersionSummaryRow | null>;
}

/** Resolve trial and BASE references, including PRE_TRIAL's non-covering source. */
export async function resolveTrialAndBaseSources(args: {
    readonly reader: BootstrapCoverageReader;
    readonly input: CoverageArgs;
}): Promise<CoverageResponse> {
    const input = CoverageArgsSchema.parse(args.input);
    const { reader } = args;
    const [trial, createdAt, floorVersion] = await Promise.all([
        reader.findTrial(input),
        reader.findAccountCreatedAt({ userId: input.userId }),
        reader.findCurrentVersionByRole({ vertical: input.vertical, role: FLOOR_PLAN_ROLE })
    ]);
    if (!floorVersion) {
        throw new CatalogVersionNotFoundError({
            kind: 'plan_version',
            id: `${input.vertical}:${FLOOR_PLAN_ROLE}`
        });
    }

    const sources: CoverageSource[] = [];
    if (!trial) {
        const preTrialVersion = await reader.findCurrentVersionByRole({
            vertical: input.vertical,
            role: PRE_TRIAL_PLAN_ROLE
        });
        if (!preTrialVersion) {
            throw new CatalogVersionNotFoundError({
                kind: 'plan_version',
                id: `${input.vertical}:${PRE_TRIAL_PLAN_ROLE}`
            });
        }
        sources.push({
            type: 'TRIAL',
            reference: { kind: 'PLAN_VERSION', planVersionId: preTrialVersion.id },
            scope: 'VERTICAL',
            target: null,
            since: 'NOT_STARTED',
            until: 'NOT_STARTED',
            charged: null,
            floor: null
        });
    } else if (trial.status === TrialStatusEnum.TRIAL_ACTIVE) {
        if (!trial.startedAt || !trial.endsAt || !trial.floor) {
            throw new Error('TRIAL_ACTIVE row lacks complete timing or floor references');
        }
        sources.push({
            type: 'TRIAL',
            reference: { kind: 'PLAN_VERSION', planVersionId: trial.floor.trialPlanVersionId },
            scope: 'VERTICAL',
            target: null,
            since: trial.startedAt,
            until: trial.endsAt,
            charged: null,
            floor: null
        });
    }
    sources.push({
        type: 'BASE',
        reference: { kind: 'PLAN_VERSION', planVersionId: floorVersion.id },
        scope: 'VERTICAL',
        target: null,
        since: createdAt,
        until: 'NEVER_EXPIRES',
        charged: null,
        floor: null
    });
    return CoverageResponseSchema.parse({
        covered: sources.some((source) => coverageSourceClassOf({ source }).sourceClass === 'TITLE'),
        sources
    });
}
