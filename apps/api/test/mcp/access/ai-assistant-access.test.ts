/**
 * HOS-2184 phase B T-040 (spec §6.4, AC-14, R-6) — `resolveAiAssistantAccess`:
 * the `ai_assistant_access` key read per owner vertical with the THROWING
 * probe, and billing's coverage read only to tell an owner from an account
 * that holds no plan at all.
 *
 * `test/setup.ts` replaces the module for every other suite; this one reads
 * the real module with `vi.importActual`. The listing-access ports are mocked:
 * the real `probeEffectiveKeys` runs over them.
 *
 * @module test/mcp/access/ai-assistant-access
 */

import type { CoverageSource } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ports = vi.hoisted(() => ({
    effectiveSet: vi.fn(),
    coverage: vi.fn()
}));

vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        effectiveSet: (...args: unknown[]) => ports.effectiveSet(...args),
        billing: { coverage: (...args: unknown[]) => ports.coverage(...args) }
    })
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const { resolveAiAssistantAccess, isUntouchedCoverage, AI_ASSISTANT_ACCESS_KEY } =
    await vi.importActual<typeof import('../../../src/mcp/access/ai-assistant-access')>(
        '../../../src/mcp/access/ai-assistant-access'
    );

const USER_ID = '5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d';
const VERSION = '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';

/** The effective set of a vertical, granting the key or not. */
function setGranting(granted: boolean) {
    return {
        entitlements: {
            get: ({ key }: { readonly key: string }) =>
                key === AI_ASSISTANT_ACCESS_KEY && granted ? 1 : undefined
        }
    };
}

const PRE_TRIAL: CoverageSource = {
    type: 'TRIAL',
    reference: { kind: 'PLAN_VERSION', planVersionId: VERSION },
    scope: 'VERTICAL',
    target: null,
    since: 'NOT_STARTED',
    until: 'NOT_STARTED',
    charged: null,
    floor: null
} as CoverageSource;

const BASE: CoverageSource = {
    type: 'BASE',
    reference: { kind: 'PLAN_VERSION', planVersionId: VERSION },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-01-01T00:00:00.000Z'),
    until: 'NEVER_EXPIRES',
    charged: null,
    floor: null
} as CoverageSource;

const SUBSCRIPTION: CoverageSource = {
    type: 'SUBSCRIPTION',
    reference: { kind: 'PLAN_VERSION', planVersionId: VERSION },
    scope: 'VERTICAL',
    target: null,
    since: new Date('2026-10-01T00:00:00.000Z'),
    until: new Date('2026-12-31T00:00:00.000Z'),
    charged: true,
    floor: null
} as CoverageSource;

/** Arranges the three verticals: which grant, and the coverage sources of each. */
function arrange(world: {
    readonly granting?: readonly VerticalEnum[];
    readonly failingSet?: readonly VerticalEnum[];
    readonly sources?: Partial<Record<VerticalEnum, readonly CoverageSource[]>>;
    readonly failingCoverage?: readonly VerticalEnum[];
}): void {
    ports.effectiveSet.mockImplementation(
        async ({ vertical }: { readonly vertical: VerticalEnum }) => {
            if (world.failingSet?.includes(vertical)) throw new Error('effective set down');
            return setGranting(world.granting?.includes(vertical) === true);
        }
    );
    ports.coverage.mockImplementation(async ({ vertical }: { readonly vertical: VerticalEnum }) => {
        if (world.failingCoverage?.includes(vertical)) throw new Error('coverage down');
        const sources = world.sources?.[vertical] ?? [PRE_TRIAL, BASE];
        return { covered: false, sources };
    });
}

describe('resolveAiAssistantAccess (HOS-2184 T-040)', () => {
    beforeEach(() => {
        ports.effectiveSet.mockReset();
        ports.coverage.mockReset();
    });

    it('grants when one vertical grants the key, and reads no coverage', async () => {
        // Arrange
        arrange({ granting: [VerticalEnum.VENUE] });

        // Act
        const access = await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(access).toEqual({ kind: 'GRANTED', hasAccess: true, vertical: VerticalEnum.VENUE });
        expect(ports.effectiveSet).toHaveBeenCalledTimes(3);
        expect(ports.coverage).not.toHaveBeenCalled();
    });

    it('grants even when another vertical could not be read', async () => {
        // Arrange
        arrange({
            granting: [VerticalEnum.EXPERIENCE],
            failingSet: [VerticalEnum.ACCOMMODATION]
        });

        // Act
        const access = await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(access).toEqual({
            kind: 'GRANTED',
            hasAccess: true,
            vertical: VerticalEnum.EXPERIENCE
        });
    });

    it('answers UNAVAILABLE, never a refusal, when none grants and a read failed', async () => {
        // Arrange
        arrange({ failingSet: [VerticalEnum.VENUE], sources: { accommodation: [BASE] } });

        // Act
        const access = await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(access).toEqual({ kind: 'UNAVAILABLE', hasAccess: false });
        expect(ports.coverage).not.toHaveBeenCalled();
    });

    it('answers UNAVAILABLE when none grants and a coverage read failed', async () => {
        // Arrange
        arrange({ failingCoverage: [VerticalEnum.EXPERIENCE] });

        // Act
        const access = await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(access).toEqual({ kind: 'UNAVAILABLE', hasAccess: false });
    });

    it('does not gate an account with no plan state in any vertical (provider, partner, staff)', async () => {
        // Arrange: PRE_TRIAL + floor everywhere, and (hypothetically) no key granted.
        arrange({});

        // Act
        const access = await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(access).toEqual({ kind: 'NOT_GATED', hasAccess: true });
        expect(ports.coverage).toHaveBeenCalledTimes(3);
    });

    it('refuses a floor-only owner (trial ended, nothing bought), naming that vertical', async () => {
        // Arrange: a trial row with no running trial leaves the floor alone.
        arrange({ sources: { experience: [BASE] } });

        // Act
        const access = await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(access).toEqual({
            kind: 'REFUSED',
            hasAccess: false,
            vertical: VerticalEnum.EXPERIENCE
        });
    });

    it('refuses with the FIRST vertical the owner holds a plan in', async () => {
        // Arrange
        arrange({ sources: { venue: [SUBSCRIPTION, BASE], experience: [BASE] } });

        // Act
        const access = await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(access).toEqual({ kind: 'REFUSED', hasAccess: false, vertical: VerticalEnum.VENUE });
    });

    it('reads the key with the catalog name and the user of the call', async () => {
        // Arrange
        arrange({ granting: [VerticalEnum.ACCOMMODATION] });

        // Act
        await resolveAiAssistantAccess({ userId: USER_ID });

        // Assert
        expect(AI_ASSISTANT_ACCESS_KEY).toBe('ai_assistant_access');
        expect(ports.effectiveSet).toHaveBeenCalledWith({
            userId: USER_ID,
            vertical: VerticalEnum.ACCOMMODATION
        });
    });
});

describe('isUntouchedCoverage', () => {
    it('is true for the PRE_TRIAL + floor pair of an account without a trial row', () => {
        expect(isUntouchedCoverage({ sources: [PRE_TRIAL, BASE] })).toBe(true);
    });

    it('is false for the floor alone (a trial row exists)', () => {
        expect(isUntouchedCoverage({ sources: [BASE] })).toBe(false);
    });

    it('is false when a subscription sits beside the pre-trial pair', () => {
        expect(isUntouchedCoverage({ sources: [PRE_TRIAL, SUBSCRIPTION, BASE] })).toBe(false);
    });

    it('is false for a running trial (its clock started)', () => {
        const running = {
            ...PRE_TRIAL,
            since: new Date('2026-11-01T00:00:00.000Z'),
            until: new Date('2026-12-01T00:00:00.000Z')
        } as CoverageSource;
        expect(isUntouchedCoverage({ sources: [running, BASE] })).toBe(false);
    });
});
