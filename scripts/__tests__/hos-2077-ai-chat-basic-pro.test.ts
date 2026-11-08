import { describe, expect, it } from 'vitest';
import { PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS as SEED_OWNED } from '../../packages/seed/src/catalog/next-version-entitlements.js';
import {
    PRODUCTION_PLAN_CATALOG,
    PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS,
    PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS
} from '../production-catalog/catalog.js';

const CHAT_LIMIT = {
    venue: 'max_ai_chat_venue_per_month',
    experience: 'max_ai_chat_experience_per_month'
} as const;

function baseline(vertical: 'venue' | 'experience', slug: string) {
    const plan = PRODUCTION_PLAN_CATALOG.find(
        (item) => item.vertical === vertical && item.slug === slug
    );
    if (!plan) throw new Error(`Missing ${vertical}/${slug}`);
    return plan.version;
}

/** Chat quota and limit a plan ends with: the baseline plus the HOS-2077 next version. */
function effectiveChat(vertical: 'venue' | 'experience', slug: string) {
    const version = baseline(vertical, slug);
    const next = PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS.find(
        (entry) => entry.vertical === vertical && entry.slug === slug
    );
    const chat = version.entitlements.find((item) => item.key === 'ai_chat') as
        | { readonly planQuota?: number }
        | undefined;
    return {
        quota: next?.entitlement.planQuota ?? chat?.planQuota ?? null,
        limit:
            next?.limit.value ??
            version.limits.find((item) => item.key === CHAT_LIMIT[vertical])?.value ??
            null
    };
}

describe('HOS-2077 AI chat on venue and experience Basic and Pro', () => {
    it('re-exports the one list migration 0155 reads (single source)', () => {
        expect(PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS).toBe(SEED_OWNED);
        expect(
            PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS.map((entry) => [
                entry.vertical,
                entry.slug,
                entry.entitlement.key,
                entry.entitlement.planQuota,
                entry.entitlement.trialQuota,
                entry.limit.key,
                entry.limit.value
            ])
        ).toEqual([
            ['venue', 'venue-basico', 'ai_chat', 20, 20, CHAT_LIMIT.venue, 20],
            ['venue', 'venue-pro', 'ai_chat', 100, 20, CHAT_LIMIT.venue, 100],
            ['experience', 'experience-basico', 'ai_chat', 20, 20, CHAT_LIMIT.experience, 20],
            ['experience', 'experience-pro', 'ai_chat', 100, 20, CHAT_LIMIT.experience, 100]
        ]);
    });

    it('does not touch the HOS-2037 list (an already-run migration reads it)', () => {
        expect(PRODUCTION_PLAN_NEXT_VERSION_ENTITLEMENTS).toEqual([
            { vertical: 'accommodation', slug: 'owner-basico', key: 'can_embed_video' }
        ]);
    });

    it('keeps the baseline immutable: Basic and Pro have no chat row and a 0 limit', () => {
        for (const vertical of ['venue', 'experience'] as const)
            for (const slug of [`${vertical}-basico`, `${vertical}-pro`]) {
                const version = baseline(vertical, slug);
                expect(
                    version.entitlements.map((item) => item.key),
                    slug
                ).not.toContain('ai_chat');
                expect(
                    version.limits.find((item) => item.key === CHAT_LIMIT[vertical])?.value,
                    slug
                ).toBe(0);
            }
    });

    it('ends with chat 20 / 100 / 1250 on Basic / Pro / Premium, quota equal to the limit', () => {
        for (const vertical of ['venue', 'experience'] as const) {
            expect(effectiveChat(vertical, `${vertical}-basico`)).toEqual({ quota: 20, limit: 20 });
            expect(effectiveChat(vertical, `${vertical}-pro`)).toEqual({ quota: 100, limit: 100 });
            expect(effectiveChat(vertical, `${vertical}-premium`)).toEqual({
                quota: 1250,
                limit: 1250
            });
        }
    });

    it('gives the trial 20: its limit comes from the lowest rank, which is Basic', () => {
        for (const vertical of ['venue', 'experience'] as const) {
            const sellable = PRODUCTION_PLAN_CATALOG.filter(
                (plan) => plan.vertical === vertical && plan.role === null
            ).sort((a, b) => a.version.rank - b.version.rank);
            const lowest = sellable[0];
            if (!lowest) throw new Error(`no sellable ${vertical} plan`);
            expect(lowest.slug).toBe(`${vertical}-basico`);
            expect(effectiveChat(vertical, lowest.slug).limit).toBe(20);
            const trial = PRODUCTION_PLAN_CATALOG.find(
                (plan) => plan.vertical === vertical && plan.role === 'trial'
            );
            expect(
                PRODUCTION_PLAN_NEXT_VERSION_QUOTA_GRANTS.some(
                    (entry) => entry.slug === trial?.slug
                )
            ).toBe(false);
        }
    });
});
