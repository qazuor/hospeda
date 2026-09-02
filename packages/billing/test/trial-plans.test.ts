/**
 * HOS-1012 T-033 / D-5 (spec §6.8) — the three composed trial plans.
 *
 * Two things are asserted here and they are NOT of equal strength, which is
 * worth stating up front so nobody reads the second as more than it is:
 *
 * 1. **Isolation** (strong): the three plans are absent from `ALL_PLANS` and
 *    from every derived accommodation surface, and they carry `isActive: false`
 *    so the DB-backed public endpoint (`planService.list({ active: true })`)
 *    cannot serve them either.
 * 2. **Snapshot vs sources at CONFIG level** (deliberately weak): the snapshot
 *    each definition carries equals its two source definitions in this repo.
 *    That is config compared with config, and it agrees with itself by
 *    construction — HOS-39's Model C makes `entitlements` and `limitsValues`
 *    COMMERCIAL (the DB wins, the seed does not sync them, the admin PlanDialog
 *    edits them), so the drift that matters only ever exists in a database row.
 *    The half of the guard that can actually catch it runs against RESOLVED
 *    ROWS — see `trial-plan-snapshot.guard.test.ts` (T-036).
 */

import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ALL_EXPERIENCE_PLANS,
    ALL_GASTRONOMY_PLANS,
    ALL_PLANS,
    ALL_TRIAL_PLANS,
    COMMERCE_TRIAL_DAYS,
    composeTrialGrants,
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PRO_PLAN,
    EXPERIENCE_TRIAL_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PRO_PLAN,
    GASTRONOMY_TRIAL_PLAN,
    getPlanBySlug,
    isTrialPlanSlug,
    OWNER_BASICO_PLAN,
    OWNER_PRO_PLAN,
    OWNER_TRIAL_DAYS,
    OWNER_TRIAL_PLAN,
    PLANS_BY_CATEGORY,
    readTrialComposition,
    resolveTrialPlanSlug,
    TRIAL_COMPOSITION_METADATA_KEY,
    TRIAL_PLAN_SLUGS
} from '../src/index.js';

const TRIAL_PLANS = [OWNER_TRIAL_PLAN, GASTRONOMY_TRIAL_PLAN, EXPERIENCE_TRIAL_PLAN] as const;

describe('trial plans — isolation from every sellable surface', () => {
    it('exposes exactly three trial plans, one per vertical', () => {
        expect(ALL_TRIAL_PLANS).toHaveLength(3);
        expect(TRIAL_PLAN_SLUGS).toEqual(['owner-trial', 'gastronomy-trial', 'experience-trial']);
    });

    it('keeps every trial plan OUT of ALL_PLANS', () => {
        // ALL_PLANS drives the accommodation seed loop, the plan-config surface
        // and the grant-matrix snapshot tests. Inclusion would break all three.
        const allSlugs = ALL_PLANS.map((p) => p.slug);
        for (const plan of TRIAL_PLANS) {
            expect(allSlugs).not.toContain(plan.slug);
        }
        // The count stays frozen at 6 — a trial plan that leaked into the list
        // would move this even if the slug assertion above were edited away.
        expect(ALL_PLANS).toHaveLength(6);
    });

    it('keeps every trial plan out of the commerce catalogues too', () => {
        const commerceSlugs = [...ALL_GASTRONOMY_PLANS, ...ALL_EXPERIENCE_PLANS].map((p) => p.slug);
        for (const plan of TRIAL_PLANS) {
            expect(commerceSlugs).not.toContain(plan.slug);
        }
    });

    it('is unreachable through the config-level plan lookups', () => {
        for (const plan of TRIAL_PLANS) {
            expect(getPlanBySlug(plan.slug)).toBeUndefined();
        }
        const categorised = [
            ...PLANS_BY_CATEGORY.owner,
            ...PLANS_BY_CATEGORY.complex,
            ...PLANS_BY_CATEGORY.tourist
        ].map((p) => p.slug);
        for (const plan of TRIAL_PLANS) {
            expect(categorised).not.toContain(plan.slug);
        }
    });

    it('cannot appear in the public plans response', () => {
        for (const plan of TRIAL_PLANS) {
            // `GET /api/v1/public/plans` serves `planService.list({ active: true })`
            // straight off `billing_plans`, so being out of ALL_PLANS is not
            // enough on its own — `active = false` is what keeps a DB-sourced
            // list from serving them.
            expect(plan.isActive).toBe(false);
            // And a plan with no price is not sellable even if it were listed:
            // no `billing_prices` row is ever seeded for a trial plan.
            expect(plan.monthlyPriceArs).toBe(0);
            expect(plan.annualPriceArs).toBeNull();
        }
    });

    it('inherits each vertical existing trial length instead of adding a fourth constant', () => {
        expect(OWNER_TRIAL_PLAN.trialDays).toBe(OWNER_TRIAL_DAYS);
        expect(GASTRONOMY_TRIAL_PLAN.trialDays).toBe(COMMERCE_TRIAL_DAYS);
        expect(EXPERIENCE_TRIAL_PLAN.trialDays).toBe(COMMERCE_TRIAL_DAYS);
    });

    it('stamps one product domain per vertical, and no partner trial exists', () => {
        expect(ALL_TRIAL_PLANS.map((e) => e.productDomain)).toEqual([
            ProductDomainEnum.ACCOMMODATION,
            ProductDomainEnum.GASTRONOMY,
            ProductDomainEnum.EXPERIENCE
        ]);
        // Partner plans are hasTrial:false — no partner trial plan may exist.
        expect(resolveTrialPlanSlug({ productDomain: ProductDomainEnum.PARTNER })).toBeUndefined();
    });

    it('resolves each vertical to its OWN trial plan', () => {
        expect(resolveTrialPlanSlug({ productDomain: ProductDomainEnum.ACCOMMODATION })).toBe(
            'owner-trial'
        );
        expect(resolveTrialPlanSlug({ productDomain: ProductDomainEnum.GASTRONOMY })).toBe(
            'gastronomy-trial'
        );
        expect(resolveTrialPlanSlug({ productDomain: ProductDomainEnum.EXPERIENCE })).toBe(
            'experience-trial'
        );
    });

    it('recognises trial slugs and nothing else', () => {
        expect(isTrialPlanSlug('owner-trial')).toBe(true);
        expect(isTrialPlanSlug('gastronomy-trial')).toBe(true);
        expect(isTrialPlanSlug('experience-trial')).toBe(true);
        expect(isTrialPlanSlug('owner-basico')).toBe(false);
        expect(isTrialPlanSlug('owner-pro')).toBe(false);
    });
});

describe('trial plans — the declared composition', () => {
    it('declares entitlements from pro and limits from basico, per vertical', () => {
        expect(ALL_TRIAL_PLANS.map((e) => e.composition)).toEqual([
            { entitlementsFrom: 'owner-pro', limitsFrom: 'owner-basico' },
            { entitlementsFrom: 'gastronomy-pro', limitsFrom: 'gastronomy-basico' },
            { entitlementsFrom: 'experience-pro', limitsFrom: 'experience-basico' }
        ]);
    });

    it('never composes from a premium tier', () => {
        // §6.8: premium adds custom branding, the verification badge and
        // advanced stats — things appreciated once you have decided to stay,
        // not things that decide you.
        for (const { composition } of ALL_TRIAL_PLANS) {
            expect(composition.entitlementsFrom).not.toContain('premium');
            expect(composition.limitsFrom).not.toContain('premium');
        }
    });

    it('never composes a trial plan from another trial plan', () => {
        for (const { composition } of ALL_TRIAL_PLANS) {
            expect(isTrialPlanSlug(composition.entitlementsFrom)).toBe(false);
            expect(isTrialPlanSlug(composition.limitsFrom)).toBe(false);
        }
    });
});

describe('readTrialComposition', () => {
    it('reads a well-formed composition off metadata', () => {
        expect(
            readTrialComposition({
                [TRIAL_COMPOSITION_METADATA_KEY]: {
                    entitlementsFrom: 'owner-pro',
                    limitsFrom: 'owner-basico'
                }
            })
        ).toEqual({ entitlementsFrom: 'owner-pro', limitsFrom: 'owner-basico' });
    });

    it.each([
        ['null metadata', null],
        ['a non-object metadata', 'owner-pro'],
        ['metadata without the key', { slug: 'owner-basico' }],
        ['a null composition', { [TRIAL_COMPOSITION_METADATA_KEY]: null }],
        [
            'a composition missing limitsFrom',
            { [TRIAL_COMPOSITION_METADATA_KEY]: { entitlementsFrom: 'owner-pro' } }
        ],
        [
            'a composition missing entitlementsFrom',
            { [TRIAL_COMPOSITION_METADATA_KEY]: { limitsFrom: 'owner-basico' } }
        ],
        [
            'an empty-string slug',
            { [TRIAL_COMPOSITION_METADATA_KEY]: { entitlementsFrom: '', limitsFrom: 'x' } }
        ],
        [
            'a non-string slug',
            { [TRIAL_COMPOSITION_METADATA_KEY]: { entitlementsFrom: 7, limitsFrom: 'x' } }
        ]
    ])('answers undefined for %s', (_label, metadata) => {
        expect(readTrialComposition(metadata)).toBeUndefined();
    });
});

describe('composeTrialGrants', () => {
    it('takes entitlements from the first source and limits from the second', () => {
        const composed = composeTrialGrants({
            entitlementsSource: { entitlements: ['a', 'b'], limits: { wrong: 99 } },
            limitsSource: { entitlements: ['nope'], limits: { right: 1 } }
        });
        expect(composed.entitlements).toEqual(['a', 'b']);
        expect(composed.limits).toEqual({ right: 1 });
    });

    it('degrades a missing half to empty rather than borrowing the other source', () => {
        const composed = composeTrialGrants({
            entitlementsSource: { limits: { wrong: 99 } },
            limitsSource: { entitlements: ['nope'] }
        });
        expect(composed.entitlements).toEqual([]);
        expect(composed.limits).toEqual({});
    });
});

describe('trial plans — the display snapshot (WEAK: config vs config)', () => {
    // Read the file docblock before trusting this block: it compares config with
    // config and therefore agrees with itself. It pins that the snapshot the
    // seed writes on a FRESH database is the right one. It says nothing about
    // an already-seeded environment, where the sources are operator-editable
    // rows. T-036's guard is the half that covers that.
    it.each([
        [OWNER_TRIAL_PLAN, OWNER_PRO_PLAN, OWNER_BASICO_PLAN],
        [GASTRONOMY_TRIAL_PLAN, GASTRONOMY_PRO_PLAN, GASTRONOMY_BASICO_PLAN],
        [EXPERIENCE_TRIAL_PLAN, EXPERIENCE_PRO_PLAN, EXPERIENCE_BASICO_PLAN]
    ])('$0.slug snapshots pro entitlements and basico limits', (trial, pro, basico) => {
        expect(trial.entitlements).toEqual(pro.entitlements);
        expect(trial.limits).toEqual(basico.limits);
    });

    it('gives the accommodation trial pro features on basico limits, concretely', () => {
        // The whole commercial point of D-5, spelled out rather than derived:
        // the host EXPERIENCES what sells (featured listing, external calendar
        // sync, direct WhatsApp) while being capped at one accommodation, so
        // nothing they loaded can fail to fit in the plan they then buy.
        expect(OWNER_TRIAL_PLAN.entitlements).toContain('featured_listing');
        expect(OWNER_TRIAL_PLAN.entitlements).toContain('can_sync_external_calendar');
        expect(OWNER_TRIAL_PLAN.entitlements).not.toEqual(OWNER_BASICO_PLAN.entitlements);

        const maxAccommodations = OWNER_TRIAL_PLAN.limits.find(
            (l) => l.key === 'max_accommodations'
        );
        expect(maxAccommodations?.value).toBe(1);
    });
});
