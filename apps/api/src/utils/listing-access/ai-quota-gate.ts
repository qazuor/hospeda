import { getMonthlyCallCount, recordAiUsage } from '@repo/ai-core';
import { type AiFeature, ServiceErrorCode, type VerticalEnum } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import {
    type RehydratedEffectiveSet,
    resolveEntitlementStep,
    resolveLimitStep
} from '@repo/verticals';
import { apiLogger } from '../logger';
import { getListingAccessPorts } from './ports';

/** Catalog entitlement key required by each metered AI feature. */
export const AI_ENTITLEMENT_KEY_BY_FEATURE = {
    text_improve: 'ai_text_improve',
    chat: 'ai_chat',
    chat_gastronomy: 'ai_chat',
    chat_experience: 'ai_chat',
    search: 'ai_search',
    support: 'ai_support',
    translate: 'ai_translate',
    accommodation_import: 'ai_accommodation_import'
} as const satisfies Partial<Record<AiFeature, string>>;

/** Catalog monthly limit key used by each metered AI feature. */
export const AI_LIMIT_KEY_BY_FEATURE = {
    text_improve: 'max_ai_text_improve_per_month',
    chat: 'max_ai_chat_per_month',
    chat_gastronomy: 'max_ai_chat_gastronomy_per_month',
    chat_experience: 'max_ai_chat_experience_per_month',
    search: 'max_ai_search_per_month',
    support: 'max_ai_support_per_month',
    translate: 'max_ai_translate_per_month',
    accommodation_import: 'max_ai_accommodation_import_per_month'
} as const satisfies Partial<Record<AiFeature, string>>;

/** Non-throwing result of evaluating the effective AI entitlement and monthly quota. */
export type AiQuotaDecision =
    | { readonly allowed: true }
    | {
          readonly allowed: false;
          readonly reason: 'entitlement';
          readonly key: string;
          readonly max: 0;
          readonly count: 0;
      }
    | {
          readonly allowed: false;
          readonly reason: 'quota';
          readonly key: string;
          readonly max: number;
          readonly count: number;
      };

/** Evaluate the entitlement and monthly usage for one user and vertical without throwing. */
export async function evaluateAiQuota(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly feature: AiFeature;
    readonly entitlementKey?: string;
    readonly limitKey: string;
    readonly effectiveSetSnapshot?: RehydratedEffectiveSet;
}): Promise<AiQuotaDecision> {
    const snapshot = args.effectiveSetSnapshot;
    const effectiveSet = snapshot ? async () => snapshot : getListingAccessPorts().effectiveSet;
    if (args.entitlementKey) {
        const entitlement = await resolveEntitlementStep({
            userId: args.userId,
            vertical: args.vertical,
            keys: [args.entitlementKey],
            effectiveSet
        });
        if (!entitlement.allowed) {
            return {
                allowed: false,
                reason: 'entitlement',
                key: args.entitlementKey,
                max: 0,
                count: 0
            };
        }
    }

    const count = await getMonthlyCallCount({
        userId: args.userId,
        feature: args.feature,
        now: new Date()
    });
    const requested = count + 1;
    const limit = await resolveLimitStep({
        userId: args.userId,
        vertical: args.vertical,
        limit: { key: args.limitKey, requested },
        effectiveSet
    });
    if (!limit.allowed) {
        return {
            allowed: false,
            reason: 'quota',
            key: limit.key,
            max: limit.max,
            count
        };
    }
    return { allowed: true };
}

/** Enforce an effective AI entitlement and quota, recording a rejected quota attempt first. */
export async function enforceAiQuota(args: {
    readonly userId: string;
    readonly vertical: VerticalEnum;
    readonly feature: AiFeature;
    readonly entitlementKey?: string;
    readonly limitKey: string;
    readonly entitlementMessage?: string;
    readonly limitMessage?: string;
    readonly effectiveSetSnapshot?: RehydratedEffectiveSet;
}): Promise<void> {
    const decision = await evaluateAiQuota(args);
    if (decision.allowed) return;

    if (decision.reason === 'entitlement') {
        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            args.entitlementMessage ?? 'Entitlement required',
            { entitlementKey: decision.key }
        );
    }

    try {
        await recordAiUsage({
            userId: args.userId,
            feature: args.feature,
            provider: 'none',
            model: 'none',
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: 0,
            status: 'quota_exceeded'
        });
    } catch (error) {
        apiLogger.warn(
            {
                userId: args.userId,
                feature: args.feature,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-quota-gate: failed to record quota_exceeded row (enforcement continues)'
        );
    }

    throw new ServiceError(ServiceErrorCode.LIMIT_REACHED, args.limitMessage ?? 'Limit reached', {
        limitKey: decision.key,
        currentCount: decision.count,
        maxAllowed: decision.max
    });
}
