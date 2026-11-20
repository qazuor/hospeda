/**
 * HOS-2328 (spec HOS-2335 §6.6, AC-C33 and AC-C15b) — the `subscription`
 * block of `get_owner_summary`: per vertical it equals the `get_my_plan`
 * output, because both tools call the same reader (`readMyPlan`).
 *
 * Same summary harness and mocks as `get-owner-summary.test.ts`, plus the
 * plan readers of the `get_my_plan` harness (effective set resolved by the real
 * resolver over an in-test catalog).
 *
 * @module test/mcp/tools/summary/get-owner-summary.subscription
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    arrangeSubscriptionAndTrial,
    mocks as planMocks,
    resetWorld
} from '../plan/my-plan.harness';
import {
    actorFor,
    arrangeWorld,
    context,
    emptyWorld,
    mocks,
    resetMocks
} from './owner-summary.harness';

const readerSpy = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock('../../../../src/utils/listing-access/user-gate', () => ({
    enforceUserGate: mocks.enforceGate,
    readEffectiveKeys: mocks.effectiveKeys
}));
vi.mock('../../../../src/mcp/tools/review/owner-review-reader', () => ({
    readOwnerListingReviews: mocks.ownerReviews
}));
vi.mock('../../../../src/mcp/tools/summary/owner-summary-readers', () => ({
    countAccommodationFavorites: mocks.favorites,
    readOpenFixRequestListings: mocks.fixRequests
}));
vi.mock('../../../../src/mcp/tools/inquiry/inquiry-readers', () => ({
    readOwnerAccommodationIds: mocks.ownerAccommodationIds,
    readInquiryListContext: mocks.inquiryListContext
}));
vi.mock('../../../../src/services/listing-publication/listing-publish-completeness-batch', () => ({
    evaluateListingsPublishCompleteness: mocks.completeness
}));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/service-core')>()),
    readOwnPlanState: (...args: unknown[]) => planMocks.readOwnPlanState(...args)
}));
vi.mock('../../../../src/services/billing-addon/owner-recurring-addons.service', () => ({
    readOwnerAddonHoldings: (...args: unknown[]) => planMocks.readOwnerAddonHoldings(...args)
}));
vi.mock('../../../../src/services/listing-notices/listing-notices.service', () => ({
    readTrialSummary: (...args: unknown[]) => planMocks.readTrialSummary(...args),
    readOwnTrialPlan: (...args: unknown[]) => planMocks.readOwnTrialPlan(...args)
}));
vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: (...args: unknown[]) => planMocks.effectiveSet(...args)
    })
}));
// The real reader, wrapped so the test sees which tool called it.
vi.mock('../../../../src/mcp/tools/plan/my-plan-reader', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/mcp/tools/plan/my-plan-reader')>();
    return {
        ...actual,
        readMyPlan: (input: Parameters<typeof actual.readMyPlan>[0]) => {
            readerSpy.calls.push(input);
            return actual.readMyPlan(input);
        }
    };
});

import { getMyPlanTool } from '../../../../src/mcp/tools/plan/get-my-plan';
import type { MyPlanResult } from '../../../../src/mcp/tools/plan/my-plan-types';
import { runTool } from '../../../../src/mcp/tools/run-tool';
import { getOwnerSummaryTool } from '../../../../src/mcp/tools/summary/get-owner-summary';
import type { OwnerSummary } from '../../../../src/mcp/tools/summary/owner-summary-types';
import type { ToolDefinition } from '../../../../src/mcp/tools/tool-definition';
import { injectClock } from '../../../../src/utils/clock';
import { validateApiEnv } from '../../../../src/utils/env';

const NOW = new Date('2026-11-18T12:00:00.000Z');
const SRC = resolve(__dirname, '../../../../src/mcp/tools');

/** The summary actor, with the billing permission `get_my_plan` requires. */
function billingActor(): Actor {
    const actor = actorFor();
    return {
        ...actor,
        permissions: [...actor.permissions, PermissionEnum.BILLING_VIEW_OWN]
    } as Actor;
}

async function run<T>(definition: ToolDefinition, actor: Actor): Promise<T> {
    const outcome = await runTool({ definition, actor, input: {}, context });
    if (!outcome.ok) {
        throw new Error(`${definition.name} refused: ${outcome.failure.message}`);
    }
    return outcome.data as T;
}

describe('get_owner_summary subscription block (HOS-2328)', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        arrangeWorld(emptyWorld());
        resetWorld();
        readerSpy.calls = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetMocks();
    });

    it('AC-C33: per vertical, the block equals the get_my_plan output', async () => {
        // Arrange: every field filled, add-ons included
        arrangeSubscriptionAndTrial();
        planMocks.readOwnerAddonHoldings.mockResolvedValue([
            {
                slug: 'extra-photos-20',
                name: 'Catalog photos pack',
                status: 'ACTIVE',
                endsAt: null,
                verticals: ['accommodation']
            }
        ]);
        const actor = billingActor();

        // Act
        const summary = await run<OwnerSummary>(getOwnerSummaryTool, actor);
        const plan = await run<MyPlanResult>(getMyPlanTool, actor);

        // Assert
        expect(plan.items.map((item) => item.vertical)).toEqual(['accommodation', 'venue']);
        expect(plan.items[0]?.addons).toHaveLength(1);
        expect(summary.subscription).toEqual(
            Object.fromEntries(plan.items.map((item) => [item.vertical, item]))
        );
        expect(summary.subscription?.accommodation).toEqual(plan.items[0]);
        expect(summary.subscription?.venue).toEqual(plan.items[1]);
    });

    it('AC-C15b: both tools call the one shared reader at run time', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();
        const actor = billingActor();

        // Act
        await run<OwnerSummary>(getOwnerSummaryTool, actor);
        await run<MyPlanResult>(getMyPlanTool, actor);

        // Assert
        expect(readerSpy.calls).toHaveLength(2);
        expect(planMocks.readOwnPlanState).toHaveBeenCalledTimes(2);
    });

    it('AC-C15b: both tools import readMyPlan from the same module, with no copy', () => {
        // Arrange
        const tool = readFileSync(resolve(SRC, 'plan/get-my-plan.ts'), 'utf8');
        const summary = readFileSync(resolve(SRC, 'summary/get-owner-summary.ts'), 'utf8');
        const reader = readFileSync(resolve(SRC, 'plan/my-plan-reader.ts'), 'utf8');

        // Assert
        expect(tool).toMatch(/import \{ readMyPlan \} from '\.\/my-plan-reader';/);
        expect(summary).toMatch(/import \{ readMyPlan \} from '\.\.\/plan\/my-plan-reader';/);
        expect(reader).toMatch(/import \{ readOwnPlanState \} from '@repo\/service-core';/);
        for (const source of [tool, summary]) {
            expect(source).not.toMatch(/readOwnPlanState|readTrialSummary|effectiveSet\(/);
        }
    });

    it('leaves the block out without BILLING_VIEW_OWN and reads no plan', async () => {
        // Arrange
        arrangeSubscriptionAndTrial();

        // Act
        const summary = await run<OwnerSummary>(getOwnerSummaryTool, actorFor());

        // Assert
        expect(summary).not.toHaveProperty('subscription');
        expect(readerSpy.calls).toHaveLength(0);
        expect(planMocks.readOwnPlanState).not.toHaveBeenCalled();
    });

    it('is an empty block for an owner with no plan', async () => {
        // Act
        const summary = await run<OwnerSummary>(getOwnerSummaryTool, billingActor());

        // Assert
        expect(summary.subscription).toEqual({});
    });
});

describe('get_owner_summary when the plan read fails (HOS-2328)', () => {
    beforeAll(() => {
        validateApiEnv();
        injectClock({ clock: { now: () => NOW } });
    });

    beforeEach(() => {
        arrangeWorld(emptyWorld());
        resetWorld();
        readerSpy.calls = [];
    });

    afterEach(() => {
        vi.restoreAllMocks();
        resetMocks();
    });

    it.each([
        ['an out-of-contract subscription', 'readOwnPlanState'],
        ['an unknown trial status', 'readTrialSummary']
    ] as const)('still answers, without the block, on %s', async (_case, reader) => {
        // Arrange
        arrangeSubscriptionAndTrial();
        planMocks[reader].mockRejectedValue(new Error('Unknown billing option cycle'));

        // Act
        const summary = await run<OwnerSummary>(getOwnerSummaryTool, billingActor());

        // Assert
        expect(summary).not.toHaveProperty('subscription');
        expect(summary.omitted).toEqual({ subscription: 'unavailable' });
        expect(summary.listings.accommodation.total).toBe(0);
        expect(Array.isArray(summary.attention)).toBe(true);
    });
});
