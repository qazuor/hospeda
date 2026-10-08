/** TEST:V4:13 — shared forward cases against bootstrap coverage. */
import { randomUUID } from 'node:crypto';
import {
    CoverageResponseSchema,
    type CoverageArgs,
    type CoverageResponse
} from '@repo/billing-verticals-contract';
import { coverageCaseSet } from '@repo/billing-verticals-contract/testing';
import {
    FLOOR_PLAN_ROLE,
    PRE_TRIAL_PLAN_ROLE,
    TrialStatusEnum,
    VerticalEnum,
    type PlanRole
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createBootstrapBillingForVerticals } from '../../src/coverage/bootstrap-billing-for-verticals';
import type {
    BootstrapCoverageReader,
    BootstrapTrialRow
} from '../../src/coverage/trial-and-base-sources';

const startedAt = new Date('2025-01-02T00:00:00.000Z');
const endsAt = new Date('2025-01-16T00:00:00.000Z');
const createdAt = new Date('2024-01-01T00:00:00.000Z');
const trialVersionId = randomUUID();
const versions = new Map<string, string>();
const versionFor = (vertical: string, role: PlanRole): string => {
    const key = `${vertical}:${role}`;
    const existing = versions.get(key);
    if (existing) return existing;
    const id = randomUUID();
    versions.set(key, id);
    return id;
};

function makeHarness() {
    const rows = new Map<string, BootstrapTrialRow>();
    const keyOf = ({ userId, vertical }: CoverageArgs): string => `${userId}:${vertical}`;
    const reader: BootstrapCoverageReader = {
        async findTrial(args) {
            return rows.get(keyOf(args)) ?? null;
        },
        async findAccountCreatedAt() {
            return createdAt;
        },
        async findCurrentVersionByRole({ vertical, role }) {
            return {
                id: versionFor(vertical, role),
                planId: randomUUID(),
                vertical,
                rank: 0,
                sellable: false,
                current: true
            };
        }
    };
    const subject = createBootstrapBillingForVerticals({ reader });
    const active = (args: CoverageArgs): BootstrapTrialRow => ({
        ...args,
        status: TrialStatusEnum.TRIAL_ACTIVE,
        trialPlanId: randomUUID(),
        floor: {
            entitlementsVersionId: randomUUID(),
            limitsVersionId: randomUUID(),
            trialPlanVersionId: trialVersionId
        },
        startedAt,
        endsAt
    });
    return {
        subject,
        arrange: {
            async preTrial(args: CoverageArgs) {
                rows.delete(keyOf(args));
            },
            async trialRunning(args: CoverageArgs) {
                rows.set(keyOf(args), active(args));
            },
            async trialExpired(args: CoverageArgs) {
                rows.set(keyOf(args), {
                    ...active(args),
                    status: TrialStatusEnum.TRIAL_EXPIRED
                });
            }
        },
        act: {
            async startTrial(args: CoverageArgs) {
                rows.set(keyOf(args), active(args));
                await subject.emitCoverageChanged({
                    ...args,
                    sourceType: 'TRIAL',
                    change: 'CHANGED'
                });
            }
        },
        newUserId: randomUUID
    };
}

coverageCaseSet({ describe, it, expect, makeHarness: async () => makeHarness() });

describe('TEST:V4:13 bootstrap-only answers', () => {
    it('retention and charging deny, and billing sources never appear', async () => {
        const h = makeHarness();
        const who = { userId: randomUUID(), vertical: VerticalEnum.ACCOMMODATION };
        await h.arrange.trialRunning(who);
        const result = await h.subject.coverage(who);
        expect(result.sources.map((source) => source.type)).toEqual(['TRIAL', 'BASE']);
        expect(result.sources[0]?.reference).toEqual({
            kind: 'PLAN_VERSION',
            planVersionId: trialVersionId
        });
        expect(result.sources[0]?.since).toEqual(startedAt);
        expect(result.sources[1]?.since).toEqual(createdAt);
        expect(result.sources.every((source) => source.floor === null)).toBe(true);
        expect(await h.subject.retentionStopped(who)).toEqual({
            stopped: false,
            pauseEndedAt: null,
            coverageLostAt: null
        });
        expect(await h.subject.canCharge({ userId: who.userId })).toEqual({ canCharge: false });
    });

    it('PRE_TRIAL rejects a constant covered:true implementation', async () => {
        const h = makeHarness();
        const response: CoverageResponse = await h.subject.coverage({
            userId: randomUUID(),
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(response.covered).toBe(false);
        expect(response.sources).toHaveLength(2);
        expect(response.sources[0]?.reference).toEqual({
            kind: 'PLAN_VERSION',
            planVersionId: versionFor('accommodation', PRE_TRIAL_PLAN_ROLE)
        });
        expect(response.sources[1]?.reference).toEqual({
            kind: 'PLAN_VERSION',
            planVersionId: versionFor('accommodation', FLOOR_PLAN_ROLE)
        });
        expect(CoverageResponseSchema.safeParse({ ...response, covered: true }).success).toBe(false);
    });

    it('a consumed trial row with no floor reference emits BASE only', async () => {
        const who = { userId: randomUUID(), vertical: VerticalEnum.ACCOMMODATION };
        const reader: BootstrapCoverageReader = {
            async findTrial() {
                return {
                    ...who,
                    status: TrialStatusEnum.TRIAL_CONVERTED,
                    trialPlanId: null,
                    floor: null,
                    startedAt: null,
                    endsAt: null
                };
            },
            async findAccountCreatedAt() {
                return createdAt;
            },
            async findCurrentVersionByRole({ vertical, role }) {
                return {
                    id: versionFor(vertical, role),
                    planId: randomUUID(),
                    vertical,
                    rank: 0,
                    sellable: false,
                    current: true
                };
            }
        };
        const result = await createBootstrapBillingForVerticals({ reader }).coverage(who);
        expect(result.covered).toBe(false);
        expect(result.sources.map((source) => source.type)).toEqual(['BASE']);
    });
});
