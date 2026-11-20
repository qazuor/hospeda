/**
 * @file my-plan-reader.ts
 * @description The owner's plan per vertical, read once for every assistant
 * surface that shows it (HOS-2328, spec HOS-2335 §6.3, C-6): `get_my_plan`,
 * the `subscription` block of `get_owner_summary` (AC-C33), and HOS-2184
 * phase B AC-16 when it is built. They import {@link readMyPlan}; none of them
 * has a second implementation (AC-C15b).
 *
 * A thin adapter over existing reads, never raw tables:
 * - subscriptions: `readOwnPlanState` (service-core), the reader behind
 *   `GET /protected/billing-subscription/`;
 * - trial: `readTrialSummary`, the service behind
 *   `GET /protected/publish/trial-summary/{vertical}`, plus `readOwnTrialPlan`
 *   for the trial plan's catalog row;
 * - includes: the cached effective set (`getListingAccessPorts().effectiveSet`
 *   and `toEffectiveSetView`), so a catalog change shows with no code change;
 * - add-ons: `readOwnerAddonHoldings`, the read behind
 *   `GET /billing-addon/instances`.
 *
 * Labels come from `@repo/i18n` in the caller's locale. Plan names come from
 * the catalog row, never from a code map (HOS-1967).
 */

import type { Locale } from '@repo/i18n';
import { TrialStatusEnum } from '@repo/schemas';
import { readOwnPlanState } from '@repo/service-core';
import { translateCatalogKey } from '../../../services/ai-context/listing-labels';
import {
    type OwnerAddonHolding,
    readOwnerAddonHoldings
} from '../../../services/billing-addon/owner-recurring-addons.service';
import {
    readOwnTrialPlan,
    readTrialSummary
} from '../../../services/listing-notices/listing-notices.service';
import { env } from '../../../utils/env';
import { toEffectiveSetView } from '../../../utils/listing-access/effective-set-view';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { apiLogger } from '../../../utils/logger';
import { buildPortalUrl, type PortalLocale } from '../../portal/build-portal-url';
import type { PortalDestination } from '../../portal/portal-routes';
import {
    MY_PLAN_VERTICALS,
    type MyPlanAddon,
    type MyPlanIncludes,
    type MyPlanItem,
    type MyPlanPlan,
    type MyPlanPlansLink,
    type MyPlanResult,
    type MyPlanVertical
} from './my-plan-types';

const DAY_MS = 86_400_000;

/** Subscription statuses the plan-state reader returns (its live principal set). */
const LIVE_SUBSCRIPTION_STATUSES = [
    'ACTIVE',
    'GRACE_PERIOD',
    'SUSPENDED',
    'CANCEL_SCHEDULED',
    'PAUSED'
] as const;
type SubscriptionStatus = (typeof LIVE_SUBSCRIPTION_STATUSES)[number];

/** Verticals with a plans page in the portal. */
const PLANS_PAGE_VERTICALS = ['accommodation', 'venue', 'experience'] as const;

/** A label from the catalogue, or the fallback when the key has none. */
function label(input: {
    readonly key: string;
    readonly locale: Locale;
    readonly fallback: string;
}): string {
    return translateCatalogKey({ key: input.key, locale: input.locale }).label ?? input.fallback;
}

function portalUrl(destination: PortalDestination, locale: PortalLocale): string {
    return buildPortalUrl({ destination, locale, siteUrl: env.HOSPEDA_SITE_URL });
}

function isSubscriptionStatus(status: string): status is SubscriptionStatus {
    return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}

/** The effective set of a vertical, as labelled includes; `null` when it cannot be read. */
async function readIncludes(input: {
    readonly userId: string;
    readonly vertical: MyPlanVertical;
    readonly locale: Locale;
}): Promise<MyPlanIncludes | null> {
    const { userId, vertical, locale } = input;
    try {
        const effective = await getListingAccessPorts().effectiveSet({ userId, vertical });
        const view = toEffectiveSetView({ effective, userId, vertical });
        const entitlements = Object.entries(view.entitlements)
            .filter(([, value]) => value === 'Infinity' || value > 0)
            .map(([key]) => label({ key: `billing.entitlement.${key}`, locale, fallback: key }));
        const limits = Object.entries(view.limits).map(([key, value]) => ({
            label: label({ key: `billing.comparison.limitLabel.${key}`, locale, fallback: key }),
            value: value === 'Infinity' ? ('unlimited' as const) : value
        }));
        return { entitlements, limits };
    } catch (error) {
        apiLogger.warn(
            { userId, vertical, error: error instanceof Error ? error.message : String(error) },
            'get_my_plan: effective set could not be read'
        );
        return null;
    }
}

function toAddon(holding: OwnerAddonHolding, locale: Locale): MyPlanAddon {
    return {
        name: label({ key: `billing.addon.${holding.slug}.name`, locale, fallback: holding.name }),
        status: holding.status,
        endsAt: holding.endsAt?.toISOString() ?? null,
        renewsWithSubscription: holding.endsAt === null
    };
}

function planOf(input: {
    readonly slug: string;
    readonly name: string;
    readonly version: string | null;
    readonly locale: Locale;
}): MyPlanPlan {
    return {
        slug: input.slug,
        name: label({
            key: `billing.plan.${input.slug}.name`,
            locale: input.locale,
            fallback: input.name
        }),
        version: input.version
    };
}

/** The title part of an item (everything but includes, add-ons and links), or `null` without one. */
type TitlePart = Pick<
    MyPlanItem,
    | 'plan'
    | 'status'
    | 'trialState'
    | 'statusLabel'
    | 'nextChargeAt'
    | 'serviceEndsAt'
    | 'graceEndsAt'
    | 'trialDaysLeft'
>;

/** A running trial of the vertical as a title, or `null` when there is none. */
async function readTrialTitle(input: {
    readonly userId: string;
    readonly vertical: MyPlanVertical;
    readonly locale: Locale;
    readonly now: Date;
}): Promise<TitlePart | null> {
    const { userId, vertical, locale, now } = input;
    const summary = await readTrialSummary({ userId, vertical });
    if (summary.status !== TrialStatusEnum.TRIAL_ACTIVE) {
        return null;
    }
    const trialPlan = await readOwnTrialPlan({ userId, vertical });
    const endsAt = summary.endsAt ? new Date(summary.endsAt) : null;
    return {
        plan: trialPlan
            ? planOf({
                  slug: trialPlan.slug,
                  name: trialPlan.name,
                  version: trialPlan.planVersionId,
                  locale
              })
            : null,
        status: 'TRIAL',
        trialState: TrialStatusEnum.TRIAL_ACTIVE,
        statusLabel: label({ key: 'account.subscription.statusTrial', locale, fallback: 'TRIAL' }),
        nextChargeAt: null,
        serviceEndsAt: null,
        graceEndsAt: null,
        trialDaysLeft: endsAt
            ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS))
            : null
    };
}

/**
 * Reads the owner's plan per vertical.
 *
 * The caller checks `BILLING_VIEW_OWN` first: this reader decides nothing about
 * who may read it, and only ever reads the given owner's rows.
 *
 * @param input.userId - The owner.
 * @param input.vertical - Only this vertical; all of them when omitted.
 * @param input.locale - Locale of labels and links (`es` when omitted).
 * @param input.now - The caller's clock instant.
 * @returns One item per vertical with a live subscription or a running trial;
 *   with none, an empty list and the plans pages (AC-C15).
 */
export async function readMyPlan(input: {
    readonly userId: string;
    readonly vertical?: MyPlanVertical;
    readonly locale?: PortalLocale;
    readonly now: Date;
}): Promise<MyPlanResult> {
    const { userId, now } = input;
    const locale = input.locale ?? 'es';
    const verticals: readonly MyPlanVertical[] = input.vertical
        ? [input.vertical]
        : MY_PLAN_VERTICALS;

    const [planState, holdings] = await Promise.all([
        readOwnPlanState({ userId, now }),
        readOwnerAddonHoldings({ userId })
    ]);

    const titles = await Promise.all(
        verticals.map(async (vertical): Promise<TitlePart | null> => {
            // The newest live principal subscription of the vertical wins over a trial.
            const subscription = planState.subscriptions
                .filter((row) => row.vertical === vertical && isSubscriptionStatus(row.status))
                .at(-1);
            if (subscription && isSubscriptionStatus(subscription.status)) {
                return {
                    plan: planOf({
                        slug: subscription.plan.slug,
                        name: subscription.plan.name,
                        version: subscription.planVersionId,
                        locale
                    }),
                    status: subscription.status,
                    trialState: null,
                    statusLabel: label({
                        key: `account.subscription.mine.status.${subscription.status}`,
                        locale,
                        fallback: subscription.status
                    }),
                    nextChargeAt: subscription.nextCharge?.at.toISOString() ?? null,
                    serviceEndsAt: subscription.serviceEndsAt?.toISOString() ?? null,
                    graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
                    trialDaysLeft: null
                };
            }
            return readTrialTitle({ userId, vertical, locale, now });
        })
    );

    const held = verticals.flatMap((vertical, index) => {
        const title = titles[index];
        return title ? [{ vertical, title }] : [];
    });
    const items = await Promise.all(
        held.map(async ({ vertical, title }): Promise<MyPlanItem> => {
            const addons = holdings
                .filter((holding) => holding.verticals.includes(vertical))
                .map((holding) => toAddon(holding, locale));
            return {
                vertical,
                verticalLabel: label({
                    key: `account.subscription.mine.vertical.${vertical}`,
                    locale,
                    fallback: vertical
                }),
                ...title,
                includes: await readIncludes({ userId, vertical, locale }),
                addons,
                actionUrl: portalUrl({ kind: 'subscription' }, locale),
                ...(addons.length > 0 ? { addonsUrl: portalUrl({ kind: 'addons' }, locale) } : {})
            };
        })
    );

    if (items.length > 0) {
        return { items };
    }
    const plans: MyPlanPlansLink[] = PLANS_PAGE_VERTICALS.filter((vertical) =>
        (verticals as readonly string[]).includes(vertical)
    ).map((vertical) => ({ vertical, url: portalUrl({ kind: 'plans', vertical }, locale) }));
    return { items, plans };
}
