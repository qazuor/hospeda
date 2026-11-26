/**
 * @file ai-assistant-access.ts
 * @description Whether a person may use the Hospeda AI assistant (HOS-2184
 * phase B, T-040, G-6, spec §6.4, AC-14, R-6).
 *
 * The key `ai_assistant_access` is `global`, but the effective set is computed
 * per (user, vertical). So the three owner verticals (accommodation, venue,
 * experience) are read, each with `probeEffectiveKeys`, which THROWS when the
 * set cannot be read: `readEffectiveKeys` would turn an outage into "your plan
 * does not include it", an upsell the owner cannot act on.
 *
 * Outcomes, in order:
 * 1. any vertical grants the key → `GRANTED`;
 * 2. none grants and some read failed → `UNAVAILABLE` (never a refusal);
 * 3. none grants and the account holds no plan state in any of the three
 *    verticals → `NOT_GATED`: host-trade providers, partners, editors and staff
 *    are not owners, so the plan gate does not apply to them (each tool still
 *    authorizes them on its own);
 * 4. otherwise → `REFUSED`, naming the first vertical the owner holds a plan in,
 *    for the plans link.
 *
 * "Holds plan state in a vertical" is read from billing's own coverage
 * (`coverage(user, vertical)`, contract §2), the same sources the effective
 * set folds. An account that never touched the vertical has exactly two
 * implicit sources there: the PRE_TRIAL one (`TRIAL` whose clock did not start,
 * present only while there is NO trial row) and the floor (`BASE`). Anything
 * else (a trial row, a subscription, a courtesy, a grant, an add-on) is plan
 * state; so is the absence of the PRE_TRIAL source, which means a trial row
 * exists. An owner whose trial ended and who bought nothing has `[BASE]` only:
 * plan state, floor-only, refused.
 *
 * Coverage is read only on the refusal path, so the common call (a plan grants
 * the key) costs the three effective-set reads alone, served by the
 * effective-set cache.
 */

import type { CoverageSource } from '@repo/billing-verticals-contract';
import { EntitlementKeyEnum, VerticalEnum } from '@repo/schemas';
import { getListingAccessPorts } from '../../utils/listing-access/ports';
import { probeEffectiveKeys } from '../../utils/listing-access/user-gate';
import { apiLogger } from '../../utils/logger';

/** The entitlement that opens the assistant. */
export const AI_ASSISTANT_ACCESS_KEY = EntitlementKeyEnum.AI_ASSISTANT_ACCESS;

/** The verticals whose plans can grant the assistant, in the order a refusal names them. */
export const AI_ASSISTANT_VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;

/** A vertical whose plan can grant the assistant. */
export type AiAssistantVertical = (typeof AI_ASSISTANT_VERTICALS)[number];

/** The answer of {@link resolveAiAssistantAccess}. */
export type AiAssistantAccess =
    /** A plan in `vertical` grants the key. */
    | { readonly kind: 'GRANTED'; readonly hasAccess: true; readonly vertical: AiAssistantVertical }
    /** No plan state in any vertical: not an owner, the plan gate does not apply. */
    | { readonly kind: 'NOT_GATED'; readonly hasAccess: true }
    /** The owner's plans do not include it; `vertical` is the first one with a plan. */
    | {
          readonly kind: 'REFUSED';
          readonly hasAccess: false;
          readonly vertical: AiAssistantVertical;
      }
    /** It could not be decided: a read failed and nothing granted the key. */
    | { readonly kind: 'UNAVAILABLE'; readonly hasAccess: false };

/**
 * Whether a vertical's coverage sources are the untouched implicit pair
 * (PRE_TRIAL + floor) of an account that never held plan state there.
 *
 * @param args - Billing's sources for one vertical
 * @returns `true` when the account holds no plan state in it
 */
export function isUntouchedCoverage({
    sources
}: {
    readonly sources: readonly CoverageSource[];
}): boolean {
    const isPreTrial = (source: CoverageSource): boolean =>
        source.type === 'TRIAL' && source.since === 'NOT_STARTED';
    return (
        sources.some(isPreTrial) &&
        sources.every((source) => source.type === 'BASE' || isPreTrial(source))
    );
}

/** Logs a read that failed. Never throws. */
function logReadFailure(input: {
    readonly userId: string;
    readonly vertical: AiAssistantVertical;
    readonly read: 'effective_set' | 'coverage';
    readonly error: unknown;
}): void {
    try {
        apiLogger.warn(
            {
                userId: input.userId,
                vertical: input.vertical,
                read: input.read,
                error: input.error instanceof Error ? input.error.message : String(input.error)
            },
            'AI assistant access: read failed'
        );
    } catch {
        // Logging must not change the answer.
    }
}

/** Whether the vertical grants the key; `undefined` when its set could not be read. */
async function readGrant(input: {
    readonly userId: string;
    readonly vertical: AiAssistantVertical;
}): Promise<boolean | undefined> {
    try {
        const keys = await probeEffectiveKeys({
            userId: input.userId,
            vertical: input.vertical,
            keys: [AI_ASSISTANT_ACCESS_KEY]
        });
        return keys[AI_ASSISTANT_ACCESS_KEY] === true;
    } catch (error) {
        logReadFailure({ ...input, read: 'effective_set', error });
        return undefined;
    }
}

/** Whether the account holds plan state in the vertical; `undefined` when coverage could not be read. */
async function readHoldsPlan(input: {
    readonly userId: string;
    readonly vertical: AiAssistantVertical;
}): Promise<boolean | undefined> {
    try {
        const coverage = await getListingAccessPorts().billing.coverage({
            userId: input.userId,
            vertical: input.vertical
        });
        return !isUntouchedCoverage({ sources: coverage.sources });
    } catch (error) {
        logReadFailure({ ...input, read: 'coverage', error });
        return undefined;
    }
}

/**
 * Decides whether a person may use the AI assistant. Never throws.
 *
 * @param args.userId - The person (the MCP actor, or the session user)
 * @returns The outcome; `hasAccess` is `true` for `GRANTED` and `NOT_GATED`
 *
 * @example
 * ```typescript
 * const access = await resolveAiAssistantAccess({ userId: actor.id });
 * if (!access.hasAccess) { ... }
 * ```
 */
export async function resolveAiAssistantAccess({
    userId
}: {
    readonly userId: string;
}): Promise<AiAssistantAccess> {
    const grants = await Promise.all(
        AI_ASSISTANT_VERTICALS.map((vertical) => readGrant({ userId, vertical }))
    );
    const grantedIndex = grants.indexOf(true);
    const granted = AI_ASSISTANT_VERTICALS[grantedIndex];
    if (granted !== undefined) {
        return { kind: 'GRANTED', hasAccess: true, vertical: granted };
    }
    if (grants.includes(undefined)) {
        return { kind: 'UNAVAILABLE', hasAccess: false };
    }

    const holds = await Promise.all(
        AI_ASSISTANT_VERTICALS.map((vertical) => readHoldsPlan({ userId, vertical }))
    );
    if (holds.includes(undefined)) {
        return { kind: 'UNAVAILABLE', hasAccess: false };
    }
    const owned = AI_ASSISTANT_VERTICALS[holds.indexOf(true)];
    if (owned === undefined) {
        return { kind: 'NOT_GATED', hasAccess: true };
    }
    return { kind: 'REFUSED', hasAccess: false, vertical: owned };
}
